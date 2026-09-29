import type { Metadata } from 'next';
import { AlertCircle, ShieldCheck, UserX, Users } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { ROLE_DESCRIPTION, ROLE_LABEL, ROLE_ORDER } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { formatCount } from '@/lib/dashboard';
import { formatDateTime } from '@/lib/format';
import { RoleSelect } from './RoleSelect';

export const metadata: Metadata = { title: 'สมาชิก' };

const ROLE_BADGE: Record<string, string> = {
  Admin: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  Engineer: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  Technician: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  Viewer: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export default async function TeamPage() {
  // Only an Admin may open this page. Technicians and Viewers are redirected to
  // /unauthorized before any data is read.
  const { user } = await requireRole(['Admin']);
  const supabase = createClient();

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, role, created_at')
    .order('role', { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-slate-50">
            สมาชิกและสิทธิ์การเข้าถึง
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
            เฉพาะผู้ดูแลระบบจึงเปลี่ยนบทบาทได้
          </p>
        </div>
        <p className="text-sm text-ink-subtle dark:text-slate-500">
          {formatCount(profiles?.length ?? 0)} คน
        </p>
      </div>

      <section className="card">
        <header className="card-header">
          <h2 className="card-title">สิทธิ์ของแต่ละบทบาท</h2>
          <ShieldCheck className="h-4 w-4 text-ink-subtle dark:text-slate-500" aria-hidden="true" />
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-line bg-surface-muted/60 dark:border-slate-800 dark:bg-slate-800/20">
              <tr>
                <th scope="col" className="table-head px-5 py-3">บทบาท</th>
                <th scope="col" className="table-head px-5 py-3">ความสามารถ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-slate-800">
                {ROLE_ORDER.map((role) => (
                <tr key={role}>
                  <td className="whitespace-nowrap px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ROLE_BADGE[role]
                      }`}
                    >
                      {role}
                    </span>{' '}
                    <span className="font-medium text-ink dark:text-slate-200">
                      {ROLE_LABEL[role]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-muted dark:text-slate-400">
                    {ROLE_DESCRIPTION[role]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <header className="card-header">
          <h2 className="card-title">รายชื่อสมาชิก</h2>
          <Users className="h-4 w-4 text-ink-subtle dark:text-slate-500" aria-hidden="true" />
        </header>

        {error ? (
          <p className="alert-error m-5 flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            โหลดข้อมูลไม่สำเร็จ: {error.message}
          </p>
        ) : !profiles || profiles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <UserX className="h-6 w-6 text-ink-subtle dark:text-slate-600" aria-hidden="true" />
            <p className="text-sm text-ink-muted dark:text-slate-400">ยังไม่มีสมาชิกในระบบ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-line bg-surface-muted/60 dark:border-slate-800 dark:bg-slate-800/20">
                <tr>
                  <th scope="col" className="table-head px-5 py-3">ชื่อผู้ใช้</th>
                  <th scope="col" className="table-head px-5 py-3">ชื่อ-นามสกุล</th>
                  <th scope="col" className="table-head px-5 py-3">บทบาท</th>
                  <th scope="col" className="table-head px-5 py-3">สมัครเมื่อ</th>
                  <th scope="col" className="table-head px-5 py-3">เปลี่ยนบทบาท</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line dark:divide-slate-800">
                {profiles.map((profile) => (
                  <tr
                    key={profile.id}
                    className="transition-colors hover:bg-surface-muted/60 dark:hover:bg-slate-800/30"
                  >
                    <td className="whitespace-nowrap px-5 py-3">
                      <code className="font-mono text-sm text-ink dark:text-slate-200">
                        {profile.username}
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium text-ink dark:text-slate-200">
                      {profile.full_name?.trim() || 'ไม่ระบุชื่อ'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          ROLE_BADGE[profile.role] ?? ROLE_BADGE.Viewer
                        }`}
                      >
                        {profile.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums text-ink-subtle dark:text-slate-500">
                      {formatDateTime(profile.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <RoleSelect
                        userId={profile.id}
                        currentRole={profile.role}
                        isSelf={profile.id === user.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
