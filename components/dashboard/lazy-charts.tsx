'use client';

import dynamic from 'next/dynamic';

/**
 * Charts are loaded on demand rather than in the dashboard's initial bundle.
 *
 * Recharts is by far the heaviest dependency here and is only needed once the
 * KPI cards above it are already on screen. Deferring it cuts roughly half the
 * route's first-load JS, so the numbers the operator came for render without
 * waiting for charting code to download and parse.
 *
 * ssr: false is legal only inside a client component, which is why the page
 * imports these wrappers instead of importing the charts directly.
 */
function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-surface-sunken dark:bg-slate-800/40 ${
        className ?? 'h-64 w-full'
      }`}
    />
  );
}

export const LazyStatusDonutChart = dynamic(
  () => import('./StatusDonutChart').then((mod) => mod.default),
  { ssr: false, loading: () => <ChartSkeleton className="h-56 w-full sm:h-64" /> },
);

export const LazyTopAlarmsBarChart = dynamic(
  () => import('./TopAlarmsBarChart').then((mod) => mod.default),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
