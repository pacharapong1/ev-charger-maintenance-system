import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Lock, Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { escapeLike, machineFilterCount, readMachineFilters } from '@/lib/filters';
import { CreateMachineForm } from '@/components/machines/MachineForms';
import MachineFilters from '@/components/machines/MachineFilters';
import MachineTable from '@/components/machines/MachineTable';

export const metadata: Metadata = { title: 'เครื่องจักร' };

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function MachinesPage({ searchParams }: Props) {
  const { role } = await requireUser();
  const canManage = can(role, 'manageMachines');
  const filters = readMachineFilters(searchParams);
  const activeCount = machineFilterCount(filters);

  const supabase = createClient();

  // Total is fetched unfiltered so the summary can say "showing 3 of 6" rather
  // than just "3", which tells the operator whether a filter is hiding anything.
  const totalQuery = supabase.from('machines').select('*', { count: 'exact', head: true });

  let query = supabase
    .from('machines')
    .select('id, machine_id, name, type, location, status')
    .order('machine_id', { ascending: true });

  // Conditions are combined with AND, and the search term is one OR group
  // across the three text columns.
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.location) query = query.ilike('location', `%${escapeLike(filters.location)}%`);
  if (filters.type) query = query.ilike('type', `%${escapeLike(filters.type)}%`);
  if (filters.search) {
    const term = `%${escapeLike(filters.search)}%`;
    query = query.or(`machine_id.ilike.${term},name.ilike.${term},location.ilike.${term}`);
  }

  const [result, totalResult] = await Promise.all([query, totalQuery]);
  const total = totalResult.count ?? 0;

  // Postgres returns machine_id; the client table works in machineId so the
  // prop type does not have to carry snake_case through the component tree.
  const rows = (result.data ?? []).map((row) => ({
    id: row.id,
    machineId: row.machine_id,
    name: row.name,
    type: row.type,
    location: row.location,
    status: row.status,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-slate-50">
          ข้อมูลตู้ชาร์จ EV
        </h1>
        <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
          {canManage
            ? 'คุณมีสิทธิ์เพิ่ม แก้ไข และลบตู้ชาร์จ'
            : 'บัญชีของคุณดูข้อมูลได้อย่างเดียว'}
        </p>
      </div>

      {canManage ? (
        <section className="card">
          <header className="card-header">
            <h2 className="card-title">เพิ่มตู้ชาร์จใหม่</h2>
            <Plus className="h-4 w-4 text-ink-subtle dark:text-slate-500" aria-hidden="true" />
          </header>
          <div className="p-5">
            <CreateMachineForm />
          </div>
        </section>
      ) : null}

      {/*
        FilterShell uses useSearchParams, which Next requires to sit inside a
        Suspense boundary so a static shell can still be prerendered.
      */}
      <Suspense fallback={<div className="card h-24 animate-pulse" />}>
        <MachineFilters activeCount={activeCount} shown={rows.length} total={total} />
      </Suspense>

      <section className="card">
        {result.error ? (
          <p className="alert-error m-5">โหลดข้อมูลไม่สำเร็จ: {result.error.message}</p>
        ) : (
          <MachineTable rows={rows} canManage={canManage} isFiltered={activeCount > 0} />
        )}
      </section>

      {!canManage ? (
        <p className="flex items-center gap-1.5 text-xs text-ink-subtle dark:text-slate-500">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          การเพิ่ม แก้ไข และลบตู้ชาร์จสงวนไว้สำหรับผู้ดูแลระบบ (Admin) เท่านั้น
        </p>
      ) : null}
    </div>
  );
}
