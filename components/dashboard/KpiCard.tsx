import type { LucideIcon } from 'lucide-react';
import { formatCount } from '@/lib/dashboard';

export type KpiTone = 'brand' | 'emerald' | 'blue' | 'amber' | 'red' | 'slate';

/**
 * Per-tone classes for the icon chip and the value text.
 *
 * Split out so a single `tone` prop drives a consistent colour pairing, instead
 * of every caller hand-picking a background and a text colour that can drift
 * apart as new tones are added.
 */
const TONE_CHIP: Record<KpiTone, string> = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const TONE_RING: Record<KpiTone, string> = {
  brand: 'ring-brand-500/20',
  emerald: 'ring-emerald-500/20',
  blue: 'ring-blue-500/20',
  amber: 'ring-amber-500/20',
  red: 'ring-red-500/20',
  slate: 'ring-slate-500/20',
};

export default function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'slate',
  hint,
  href,
  accent,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: KpiTone;
  /** Secondary line under the number, e.g. "พร้อมใช้งาน 2 ตู้". */
  hint?: string;
  /** When set the whole card becomes a link to the relevant list page. */
  href?: string;
  /** A 2px bar in the accent colour along the left edge. */
  accent?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-ink-muted dark:text-slate-400">{label}</p>
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-4 ${TONE_CHIP[tone]} ${TONE_RING[tone]}`}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>

      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-ink dark:text-slate-50">
        {formatCount(value)}
      </p>

      {hint ? (
        <p className="mt-1.5 text-xs text-ink-subtle dark:text-slate-500">{hint}</p>
      ) : null}
    </>
  );

  const className = `card relative overflow-hidden p-5 ${
    href ? 'transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500' : ''
  }`;

  const inner = (
    <>
      {accent ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ backgroundColor: accent }}
        />
      ) : null}
      {body}
    </>
  );

  if (!href) return <div className={className}>{inner}</div>;

  return (
    <a href={href} className={`${className} block`}>
      {inner}
    </a>
  );
}
