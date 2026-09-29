'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TopAlarmCode } from '@/lib/supabase/types';
import { ALARM_BAR_COLOR } from '@/lib/dashboard';
import { formatCount } from '@/lib/dashboard';

/**
 * Horizontal bar chart of the 5 most frequent alarm codes.
 *
 * Laid out horizontally because alarm codes are short labels that would collide
 * on a vertical axis, and because ranking reads top-down much more naturally
 * this way. Bars are ordered most frequent at the top, which is the reverse of
 * the X axis direction, hence the reversed array.
 */
export default function TopAlarmsBarChart({ data }: { data: TopAlarmCode[] }) {
  // Ascending order, because Recharts stacks the first category at the bottom
  // of a vertical layout.
  const rows = [...data].reverse();

  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (rows.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-subtle dark:text-slate-500">
        ยังไม่มีข้อมูล Alarm เพื่อวิเคราะห์
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      {ready ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
            barCategoryGap="28%"
          >
            <CartesianGrid
              horizontal={false}
              stroke="var(--chart-grid)"
              strokeDasharray="3 3"
            />
            <XAxis
              type="number"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="alarm_code"
              width={104}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: 'var(--chart-grid)', fillOpacity: 0.45 }}
              content={({ active, payload }) => {
                const entry = payload?.[0];
                if (!active || !entry) return null;
                const row = entry.payload as TopAlarmCode;
                return (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-card dark:border-slate-700 dark:bg-slate-800">
                    <p className="font-medium text-ink dark:text-slate-100">
                      {row.alarm_code}
                    </p>
                    <p className="mt-0.5 tabular-nums text-ink-muted dark:text-slate-400">
                      เกิด {formatCount(row.occurrences)} ครั้ง
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="occurrences" name="จำนวนครั้ง" radius={[0, 6, 6, 0]} isAnimationActive={false}>
              {/* The top bar carries the emphasis colour, the rest step down, so
                  the leading cause is findable without reading the axis. */}
              {rows.map((row, index) => (
                <Cell
                  key={row.alarm_code}
                  fill={ALARM_BAR_COLOR}
                  fillOpacity={index === rows.length - 1 ? 1 : 0.45 + index * 0.12}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
