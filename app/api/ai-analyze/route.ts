import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthContext } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import {
  AI_ANALYSIS_SCHEMA,
  buildUserPrompt,
  parseAiAnalysis,
  parseModelPayload,
  SYSTEM_PROMPT,
  type AiAnalyzeFailure,
  type AiErrorCode,
} from '@/lib/ai';

/**
 * POST /api/ai-analyze
 *
 * Diagnoses one alarm with the configured OpenAI model and returns a validated
 * AiAnalysis.
 *
 * Design notes worth keeping:
 *
 * - The client posts an alarm id, never the alarm's text. The route loads the
 *   record through the caller's own Supabase session, so the prompt cannot be
 *   forged and a Technician cannot analyze an alarm they could not already read.
 *   RLS does the scoping; the permission check below decides who may spend tokens.
 * - The response is never cached and the model output is never trusted: it goes
 *   through parseAiAnalysis before it is returned.
 * - The API key is read from an unprefixed env var, so it is server-only and
 *   cannot reach the browser bundle.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Abort a stuck upstream rather than holding the request open. */
const REQUEST_TIMEOUT_MS = 30_000;

/** A malformed shape is often a transient sampling miss, so one retry. */
const MAX_ATTEMPTS = 2;

/* -------------------------------------------------------------------------- */
/* Cost control                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Per-user rate limit, because each call costs money and this endpoint is
 * reachable by anyone who can sign in.
 *
 * In-memory and therefore per process: on a multi-instance deployment each
 * instance keeps its own counter, so the effective ceiling is N multiplied by
 * the instance count. That is acceptable as a guard against a stuck loop or a
 * curious user, not as a billing control. Swap for a shared store (Upstash
 * Redis, or a Supabase table) if this ever needs to be exact.
 */
const RATE_LIMIT = { max: 10, windowMs: 60_000 };
const buckets = new Map<string, number[]>();

function rateLimitKey(userId: string): string {
  return userId;
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((at) => now - at < RATE_LIMIT.windowMs);

  if (hits.length >= RATE_LIMIT.max) {
    buckets.set(key, hits);
    // hits is non-empty here because max > 0, but the fallback keeps the
    // element access type-safe without a non-null assertion.
    const oldest = hits[0] ?? now;
    const retryAfterSec = Math.ceil((RATE_LIMIT.windowMs - (now - oldest)) / 1000);
    return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, retryAfterSec: 0 };
}

/** Bounds the map so an unattended long-running process cannot grow it forever. */
function pruneBuckets(): void {
  if (buckets.size < 500) return;
  const cutoff = Date.now() - RATE_LIMIT.windowMs;
  for (const [key, hits] of buckets) {
    if (hits.every((at) => at < cutoff)) buckets.delete(key);
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function fail(code: AiErrorCode, error: string, status: number, headers?: HeadersInit) {
  const body: AiAnalyzeFailure = { ok: false, code, error };
  return NextResponse.json(body, {
    status,
    // Analysis is per-alarm and per-moment; a cached copy would be misleading.
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

/** numeric columns can arrive as a string depending on the PostgREST config. */
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* -------------------------------------------------------------------------- */
/* Handler                                                                     */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  // requirePermission() redirects, which is wrong for an API route, so the
  // context is resolved and checked here to return a status code instead.
  const context = await getAuthContext();
  if (!context) {
    return fail('unauthorized', 'กรุณาเข้าสู่ระบบก่อนใช้งาน', 401);
  }
  if (!can(context.role, 'useAiAnalysis')) {
    return fail('forbidden', 'บัญชีของคุณไม่มีสิทธิ์วิเคราะห์ด้วย AI', 403);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Configuration, not a bug: say so plainly instead of surfacing a 500.
    return fail(
      'not_configured',
      'ยังไม่ได้ตั้งค่า OPENAI_API_KEY บนเซิร์ฟเวอร์',
      503,
    );
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

  // Read through the caller's session: the alarms_select policy allows any
  // signed-in user, so this returns null for a row that does not exist and is
  // indistinguishable from one the caller may not see. That is the intent.
  const supabase = createClient();
  const { data: alarm, error: readError } = await supabase
    .from('alarms')
    .select(
      'id, alarm_code, description, cause, status, created_at, voltage_peak, temperature_peak, current_peak, machines(machine_id, name)',
    )
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
  const userPrompt = buildUserPrompt({
    alarmCode: alarm.alarm_code,
    description: alarm.description,
    cause: alarm.cause,
    status: alarm.status,
    machine: machine?.machine_id ?? machine?.name ?? '-',
    createdAt: alarm.created_at,
    voltagePeak: toNumberOrNull(alarm.voltage_peak),
    temperaturePeak: toNumberOrNull(alarm.temperature_peak),
    currentPeak: toNumberOrNull(alarm.current_peak),
  });

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const openai = new OpenAI({ apiKey });

  let lastFailure = 'ผลลัพธ์จาก AI ไม่ถูกต้องตามที่กำหนด';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let content: string | null = null;

    try {
      const completion = await openai.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          // Forces the response into AI_ANALYSIS_SCHEMA instead of prose, which
          // is what makes parseAiAnalysis able to rely on a shape at all.
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'alarm_analysis',
              strict: true,
              schema: AI_ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
            },
          },
          // Low: the task is classification plus a fixed checklist, where a
          // creative answer is not an improvement.
          temperature: 0.2,
          max_tokens: 900,
        },
        { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
      );

      content = completion.choices[0]?.message?.content ?? null;
    } catch (error) {
      // Logged without the key, the prompt, or the alarm's text.
      console.error(`ai-analyze: model call failed on attempt ${attempt}`, {
        name: error instanceof Error ? error.name : 'unknown',
        message: error instanceof Error ? error.message : String(error),
      });

      // An auth or quota failure will not fix itself on a retry.
      const status = (error as { status?: number })?.status;
      if (status === 401) {
        return fail('not_configured', 'OPENAI_API_KEY ไม่ถูกต้อง', 503);
      }
      if (status === 429) {
        return fail('upstream_error', 'บริการ AI ปฏิเสธคำขอชั่วคราว กรุณาลองใหม่อีกครั้ง', 502);
      }
      if (attempt === MAX_ATTEMPTS) {
        return fail('upstream_error', 'เชื่อมต่อบริการ AI ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 502);
      }
      continue;
    }

    const analysis = parseAiAnalysis(parseModelPayload(content));
    if (analysis) {
      return NextResponse.json(
        {
          ok: true as const,
          analysis,
          meta: {
            model,
            alarm_code: alarm.alarm_code,
            machine: machine?.machine_id ?? machine?.name ?? '-',
            analyzed_at: new Date().toISOString(),
          },
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    lastFailure = 'AI ไม่ได้ส่งผลลัพธ์ที่ถูกต้องตามรูปแบบที่กำหนด';
  }

  console.error('ai-analyze: model output failed validation on every attempt', {
    model,
    alarmCode: alarm.alarm_code,
  });
  return fail('invalid_response', lastFailure, 502);
}
