import { redirect } from 'next/navigation';

/** Moved to /alarms. See the sibling redirects in this folder. */
export default function LegacyAlarmsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string' && value) query.set(key, value);
  }

  const suffix = query.toString();
  redirect(`/alarms${suffix ? `?${suffix}` : ''}`);
}
