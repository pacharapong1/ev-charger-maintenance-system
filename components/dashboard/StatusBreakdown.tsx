import type { StatusRow } from '@/lib/dashboard';
import { formatCount } from '@/lib/dashboard';

/**
 * One card per machine status. Renders all four statuses including the ones with
 * a zero count, so the row always reads as a complete picture of the fleet
 * rather than silently omitting a status that has gone to zero.
 */
export default function StatusBreakdown({ rows }: { rows: StatusRow[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {rows.map((row) => (
        <div
          key={row.status}
          className="card flex items-center gap-3 p-4"
          // Drives the left accent bar, coloured by status.
          style={{ borderLeft: `3px solid ${row.color}` }}
        >
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: row.color }}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-ink-muted dark:text-slate-400">
              {row.label}
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-ink dark:text-slate-50">
              {formatCount(row.count)}
            </p>
          </div>

          <span className="shrink-0 rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-medium tabular-nums text-ink-muted dark:bg-slate-800 dark:text-slate-400">
            {row.percent}%
          </span>
        </div>
      ))}
    </div>
  );
}
