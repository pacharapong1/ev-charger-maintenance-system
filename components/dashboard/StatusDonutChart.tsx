'use client';

import { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { StatusRow } from '@/lib/dashboard';
import { formatCount } from '@/lib/dashboard';

/**
 * Donut of the machine fleet split by status.
 *
 * Read as a share of the fleet, so the centre shows the total rather than a
 * percentage: "6 total stations" is the number an operator actually acts on,
 * and the per-slice percentages stay available in the legend beside the chart.
 */
export default function StatusDonutChart({ rows }: { rows: StatusRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  // ResponsiveContainer measures its parent with a ResizeObserver, which only
  // exists after mount. Rendering it during SSR would emit a 0x0 chart and then
  // mismatch on hydration, so the chart is held back until the size is known.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-56 w-56 shrink-0 sm:h-64 sm:w-64">
        {ready ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  const entry = payload?.[0];
                  if (!active || !entry) return null;
                  const row = entry.payload as StatusRow;
                  return (
                    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-card dark:border-slate-700 dark:bg-slate-800">
                      <p className="font-medium text-ink dark:text-slate-100">{row.label}</p>
                      <p className="mt-0.5 tabular-nums text-ink-muted dark:text-slate-400">
                        {formatCount(row.count)} ตู้ · {row.percent}%
                      </p>
                    </div>
                  );
                }}
              />
              <Pie
                data={rows}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="64%"
                outerRadius="92%"
                paddingAngle={total > 0 ? 2 : 0}
                cornerRadius={4}
                stroke="none"
                isAnimationActive={false}
              >
                {rows.map((row) => (
                  <Cell key={row.status} fill={row.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : null}

        {/* Centre label sits outside the SVG so it inherits Tailwind theming
            and never fights Recharts for layout. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-ink dark:text-slate-50">
            {formatCount(total)}
          </span>
          <span className="mt-0.5 text-xs text-ink-subtle dark:text-slate-500">ตู้ชาร์จทั้งหมด</span>
        </div>
      </div>

      {/* The legend is the accessible text equivalent of the chart: every slice
          is named and counted, so nothing depends on distinguishing the hues. */}
      <ul className="flex-1 space-y-1.5">
        {rows.map((row) => (
          <li key={row.status} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: row.color }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-muted dark:text-slate-400">
              {row.label}
            </span>
            <span className="shrink-0 tabular-nums font-medium text-ink dark:text-slate-200">
              {formatCount(row.count)}
            </span>
            <span className="w-10 shrink-0 text-right tabular-nums text-xs text-ink-subtle dark:text-slate-500">
              {row.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
