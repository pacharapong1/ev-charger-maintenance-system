import { redirect } from 'next/navigation';

/**
 * The master data pages moved up one level to /machines, /alarms and
 * /maintenance. These redirects keep older bookmarks, dashboard deep links and
 * anything pasted from chat working, and carry the query string across so a
 * filtered link stays filtered.
 */
export default function LegacyMachinesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string' && value) query.set(key, value);
  }

  const suffix = query.toString();
  redirect(`/machines${suffix ? `?${suffix}` : ''}`);
}
