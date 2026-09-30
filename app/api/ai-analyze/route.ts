import { NextResponse } from 'next/server';

import { getAuthContext } from '@/lib/auth';

import { can } from '@/lib/permissions';

import { createClient } from '@/lib/supabase/server';

import { type AiAnalysis, type AiAnalyzeFailure, type AiErrorCode } from '@/lib/ai';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

/**
 * Guard against an accidental click loop on "วิเคราะห์ใหม่".
 *
 * There is no paid upstream behind this route any more, so the limit is loose
 * on purpose: it exists to keep a runaway client from hammering the database,
 * not to ration a metered model call.
 */
const RATE_LIMIT = { max: 60, windowMs: 60_000 };

const buckets = new Map<string, number[]>();

function rateLimitKey(userId: string): string {
  return userId;
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((at) => now - at < RATE_LIMIT.windowMs);

  if (hits.length >= RATE_LIMIT.max) {
    buckets.set(key, hits);

    const oldest = hits[0] ?? now;

    const retryAfterSec = Math.ceil((RATE_LIMIT.windowMs - (now - oldest)) / 1000);

    return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  hits.push(now);

  buckets.set(key, hits);

  return { allowed: true, retryAfterSec: 0 };
}

function pruneBuckets(): void {
  if (buckets.size < 500) return;

  const cutoff = Date.now() - RATE_LIMIT.windowMs;

  for (const [key, hits] of buckets) {
    if (hits.every((at) => at < cutoff)) buckets.delete(key);
  }
}

function fail(code: AiErrorCode, error: string, status: number, headers?: HeadersInit) {
  const body: AiAnalyzeFailure = { ok: false, code, error };

  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MODEL_NAME = 'mock-system-100%';

/**
 * Mock analysis served for every request.
 *
 * No model is called and no API key is read, so this runs at zero cost. The
 * shape is the exact `AiAnalysis` contract from `lib/ai`: `AiAnalysisModal`
 * indexes `CAUSE_ICON` by `primary_cause`, renders `confidence_score` as a
 * meter, and iterates `repair_checklist`, so a missing or renamed field breaks
 * the modal rather than degrading it. `repair_checklist` stays within the 3-5
 * item range the validator enforces, and the first step is the safety
 * isolation, matching the rules the prompt used to state.
 *
 * The `AiAnalysis` return type is what keeps this honest: a typo in a field
 * name or a category outside `AI_CAUSE_CATEGORIES` fails `tsc`.
 */
function getMockAnalysis(alarmCode: string): AiAnalysis {
  return {
    primary_cause: 'Cable/Connector',
    confidence_score: 85,
    reasoning:
      `วิเคราะห์สาเหตุเบื้องต้นสำหรับรหัส ${alarmCode} ` +
      'พบว่ามีโอกาสสูงที่จะเกิดจากจุดเชื่อมต่อสายสื่อสารสัญญาณหรือสายพาวเวอร์หลวม ' +
      'ทำให้ระบบเซนเซอร์ส่งค่าผิดปกติเข้ามายังบอร์ดควบคุมหลัก',
    repair_checklist: [
      'ปิดเมนสวิตช์จ่ายไฟของตู้ชาร์จ EV (Safety Off)',
      'ตรวจสอบจุดต่อสายสื่อสาร RS485 / Modbus ทั้งฝั่ง Controller และ Meter',
      'วัดค่าแรงดันไฟฟ้าอินพุต L-N และ L-L ว่าอยู่ในช่วงปกติหรือไม่',
      'ทำความสะอาดขั้วต่อสายไฟเพื่อป้องกันคราบออกไซด์สะสม',
      'สับเบรกเกอร์ขึ้นแล้วกด Reset ระบบเพื่อตรวจสอบสถานะการแจ้งเตือนอีกครั้ง',
    ],
  };
}

export async function POST(request: Request) {
  const context = await getAuthContext();

  if (!context) {
    return fail('unauthorized', 'กรุณาเข้าสู่ระบบก่อนใช้งาน', 401);
  }

  if (!can(context.role, 'useAiAnalysis')) {
    return fail('forbidden', 'บัญชีของคุณไม่มีสิทธิ์วิเคราะห์ด้วย AI', 403);
  }

  pruneBuckets();

  const limited = checkRateLimit(rateLimitKey(context.user.id));

  if (!limited.allowed) {
    return fail(
      'rate_limited',
      `ขอบเขตการวิเคราะห์ถี่เกินไป กรุณารอ ${limited.retryAfterSec} วินาทีแล้วลองใหม่`,
      429,
      { 'Retry-After': String(limited.retryAfterSec) },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail('bad_request', 'รูปแบบคำขอไม่ถูกต้อง', 400);
  }

  const alarmId =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).alarmId
      : undefined;

  if (typeof alarmId !== 'string' || !UUID_PATTERN.test(alarmId)) {
    return fail('bad_request', 'ไม่พบ Alarm ที่ระบุ', 400);
  }

  const supabase = createClient();

  const { data: alarm, error: readError } = await supabase
    .from('alarms')
    .select('id, alarm_code, machines(machine_id, name)')
    .eq('id', alarmId)
    .maybeSingle();

  if (readError) {
    console.error('ai-analyze: reading the alarm failed', readError);

    return fail('upstream_error', 'อ่านข้อมูล Alarm ไม่สำเร็จ', 500);
  }

  if (!alarm) {
    return fail('not_found', 'ไม่พบ Alarm ที่ระบุ หรือคุณไม่มีสิทธิ์เข้าถึง', 404);
  }

  const machine = alarm.machines as { machine_id?: string; name?: string } | null;

  return NextResponse.json(
    {
      ok: true as const,
      analysis: getMockAnalysis(alarm.alarm_code),
      meta: {
        model: MODEL_NAME,
        alarm_code: alarm.alarm_code,
        machine: machine?.machine_id ?? machine?.name ?? '-',
        analyzed_at: new Date().toISOString(),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}