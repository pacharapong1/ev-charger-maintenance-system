'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Cable,
  CheckSquare,
  Cpu,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  AI_CAUSE_HINT,
  AI_CAUSE_LABEL,
  type AiAnalyzeMeta,
  type AiAnalyzeResponse,
  type AiAnalysis,
  type AiCauseCategory,
} from '@/lib/ai';

/**
 * Modal that runs the analyzer and shows the result.
 *
 * Accessibility is done by hand rather than with a dialog library: role=dialog
 * plus aria-modal, Escape to close, a focus trap, focus restored to the button
 * that opened it, and a scroll lock. The model output is rendered as text only;
 * there is no dangerouslySetInnerHTML anywhere, so a prompt injection cannot turn
 * into markup.
 */

type Status = 'idle' | 'loading' | 'done' | 'error';

const CAUSE_ICON: Record<AiCauseCategory, typeof Cable> = {
  'Cable/Connector': Cable,
  'Power Module Overheat': Cpu,
  'Insufficient Data': ShieldAlert,
};

/** Confidence bands, chosen so a middling score cannot read as reassurance. */
function confidenceTone(score: number): { label: string; bar: string; text: string } {
  if (score >= 75) {
    return {
      label: 'มั่นใจสูง',
      bar: 'bg-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-400',
    };
  }
  if (score >= 50) {
    return {
      label: 'มั่นใจปานกลาง',
      bar: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
    };
  }
  return {
    label: 'ยังไม่มั่นใจ',
    bar: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
  };
}

/** Confirms a list is a real NodeList before for...of over it. */
function isFocusable(node: Element): node is HTMLElement {
  return (
    node instanceof HTMLElement &&
    !node.hasAttribute('disabled') &&
    node.getAttribute('aria-hidden') !== 'true'
  );
}

export default function AiAnalysisModal({
  alarmId,
  alarmCode,
  onClose,
}: {
  alarmId: string;
  alarmCode: string;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<AiAnalyzeMeta | null>(null);
  const [ticked, setTicked] = useState<Record<number, boolean>>({});

  const dialogRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const descriptionId = useId();
  // Set on mount so the trap can put focus back where it came from on close.
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    return () => previouslyFocused.current?.focus?.();
  }, []);

  // Escape closes; Tab cycles inside the dialog so focus cannot escape to the
  // page behind, which would let a screen reader wander into a hidden table.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(isFocusable);

      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Lock the page behind the overlay.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const analyze = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setAnalysis(null);
    setTicked({});

    try {
      const response = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alarmId }),
      });

      // A non-JSON body means a proxy or an unhandled crash, so fall back to a
      // status-derived message rather than throwing on json() alone.
      const payload = (await response.json().catch(() => null)) as AiAnalyzeResponse | null;

      if (!payload) {
        setError(`เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ (${response.status})`);
        setStatus('error');
        return;
      }

      if (!payload.ok) {
        setError(payload.error);
        setStatus('error');
        return;
      }

      setAnalysis(payload.analysis);
      setMeta({
        model: payload.meta.model,
        alarm_code: payload.meta.alarm_code,
        machine: payload.meta.machine,
        analyzed_at: payload.meta.analyzed_at,
      });
      setStatus('done');
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      setStatus('error');
    }
  }, [alarmId]);

  // Run once when the modal opens.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void analyze();
  }, [analyze]);

  // Move focus into the dialog so the next Tab stays inside it.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const tone = analysis ? confidenceTone(analysis.confidence_score) : null;
  const Icon = analysis ? CAUSE_ICON[analysis.primary_cause] : Cable;

  return (
    createPortal(
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        {/* Backdrop: decorative, so the click target is the wrapper below. */}
        <div
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          aria-hidden="true"
        />

        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-card dark:border-slate-700 dark:bg-[#111722] dark:shadow-card-dark sm:max-h-[88vh] sm:rounded-2xl"
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 dark:border-slate-800">
            <div className="min-w-0">
              <h2
                id={headingId}
                className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink dark:text-slate-50"
              >
                <Cpu className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                วิเคราะห์สาเหตุด้วย AI
              </h2>
              <p
                id={descriptionId}
                className="mt-0.5 truncate text-xs text-ink-subtle dark:text-slate-500"
              >
                Alarm <code className="font-mono">{alarmCode}</code>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm shrink-0"
              aria-label="ปิดหน้าต่างผลการวิเคราะห์"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {status === 'loading' ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Loader2
                  className="h-6 w-6 animate-spin text-brand-600 dark:text-brand-400"
                  aria-hidden="true"
                />
                <p className="text-sm text-ink-muted dark:text-slate-400">
                  กำลังวิเคราะห์ข้อมูล Alarm...
                </p>
                <p className="text-xs text-ink-subtle dark:text-slate-500">
                  ใช้เวลาไม่กี่วินาที
                </p>
                {/* Announced to screen readers, since the visible text is not a live region. */}
                <span className="sr-only" role="status">
                  กำลังวิเคราะห์
                </span>
              </div>
            ) : null}

            {status === 'error' ? (
              <div className="alert-error flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium">วิเคราะห์ไม่สำเร็จ</p>
                  <p className="mt-0.5 text-sm">{error}</p>
                </div>
              </div>
            ) : null}

            {status === 'done' && analysis && tone ? (
              <div className="space-y-5">
                {/* Primary cause */}
                <section className="rounded-xl border border-line bg-surface-muted/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle dark:text-slate-500">
                    สาเหตุหลัก
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-base font-semibold text-ink dark:text-slate-50">
                    <Icon className="h-4.5 w-4.5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                    {AI_CAUSE_LABEL[analysis.primary_cause]}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted dark:text-slate-400">
                    {AI_CAUSE_HINT[analysis.primary_cause]}
                  </p>
                </section>

                {/* Confidence */}
                <section>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink dark:text-slate-100">
                      ความมั่นใจ
                    </h3>
                    <p className={`text-sm font-semibold tabular-nums ${tone.text}`}>
                      {analysis.confidence_score}% · {tone.label}
                    </p>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken dark:bg-slate-700"
                    role="meter"
                    aria-valuenow={analysis.confidence_score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="ความมั่นใจของผลวิเคราะห์"
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${tone.bar}`}
                      style={{ width: `${analysis.confidence_score}%` }}
                    />
                  </div>
                  {analysis.confidence_score < 50 ? (
                    <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                      ความมั่นใจต่ำ ควรเก็บข้อมูลการวัดเพิ่มก่อนตัดสินใจ
                    </p>
                  ) : null}
                </section>

                {/* Reasoning */}
                <section>
                  <h3 className="text-sm font-semibold text-ink dark:text-slate-100">เหตุผล</h3>
                  <p className="mt-1.5 rounded-lg border border-line bg-surface-muted/40 px-3 py-2.5 text-sm leading-relaxed text-ink-muted dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-300">
                    {analysis.reasoning}
                  </p>
                </section>

                {/* Checklist */}
                <section>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink dark:text-slate-100">
                    <CheckSquare className="h-4 w-4 text-ink-subtle dark:text-slate-500" aria-hidden="true" />
                    ขั้นตอนการตรวจซ่อม ({analysis.repair_checklist.length} ข้อ)
                  </h3>
                  <ol className="mt-2 space-y-1.5">
                    {analysis.repair_checklist.map((step, index) => {
                      const checked = Boolean(ticked[index]);
                      return (
                        <li key={`${index}-${step.slice(0, 24)}`}>
                          <label
                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                              checked
                                ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/25'
                                : 'border-line bg-surface hover:bg-surface-muted/50 dark:border-slate-700 dark:bg-slate-800/25 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setTicked((prev) => ({ ...prev, [index]: !prev[index] }))
                              }
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900"
                            />
                            <span className="flex min-w-0 flex-1 gap-2">
                              <span
                                className={`shrink-0 text-xs font-semibold tabular-nums ${
                                  checked
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-ink-subtle dark:text-slate-500'
                                }`}
                              >
                                {index + 1}.
                              </span>
                              <span
                                className={`text-sm leading-relaxed ${
                                  checked
                                    ? 'text-ink-subtle line-through dark:text-slate-500'
                                    : 'text-ink-muted dark:text-slate-300'
                                }`}
                              >
                                {step}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ol>
                </section>

                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  ผลนี้จากโมเดล AI เป็นเพียงข้อเสนอแนะ ไม่ใช่การยืนยันสาเหตุ
                  ก่อนลงมือต้องตรวจสอบด้วยตนเองและปฏิบัติตามขั้นตอนความปลอดภัยของสถานี
                </p>
              </div>
            ) : null}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5 dark:border-slate-800">
            <p className="truncate text-[11px] text-ink-subtle dark:text-slate-500">
              {meta ? `โมเดล ${meta.model}` : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void analyze()}
                disabled={status === 'loading'}
                className="btn btn-sm"
              >
                {status === 'loading' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                วิเคราะห์ใหม่
              </button>
              <button type="button" onClick={onClose} className="btn btn-sm btn-primary">
                ปิด
              </button>
            </div>
          </footer>
        </div>
      </div>,
      document.body,
    )
  );
}
