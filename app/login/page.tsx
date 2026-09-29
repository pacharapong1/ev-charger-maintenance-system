import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PlugZap } from 'lucide-react';
import { getUser } from '@/lib/auth';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ | EV-ChargeOps',
  description: 'ระบบจัดการเครื่องจักรชาร์จไฟฟ้าและงานซ่อมบำรุง',
};

type SearchParams = { next?: string };

// One account per role, so signing in as each one demonstrates a different set
// of buttons. The role comes from public.profiles, not from this list: these
// labels are only a hint shown on the form.
const TEST_ACCOUNTS = [
  { username: 'admin', label: 'ผู้ดูแลระบบ' },
  { username: 'tech1', label: 'ช่างซ่อมบำรุง' },
  { username: 'eng1', label: 'วิศวกร' },
  { username: 'view1', label: 'ผู้ดูข้อมูล' },
];

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  // Already signed in: skip the form. middleware also redirects; this is the
  // second layer that keeps the page correct when rendered directly.
  const user = await getUser();
  if (user) redirect('/dashboard');

  // Only same-origin relative paths are honoured. Without the leading-slash
  // check, ?next=https://evil.example would turn this into an open redirect
  // that phishers can point at a convincing login page on our own domain.
  const next = searchParams.next?.startsWith('/') ? searchParams.next : '/dashboard';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-card dark:bg-brand-500 dark:text-brand-950">
            <PlugZap className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink dark:text-slate-50">
            EV-ChargeOps
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
            ระบบจัดการเครื่องจักรชาร์จและงานซ่อมบำรุง
          </p>
        </div>

        <LoginForm next={next} />

        <section className="mt-4 rounded-xl border border-dashed border-line-strong bg-surface/60 p-4 dark:border-slate-700 dark:bg-slate-800/30">
          <h2 className="text-xs font-semibold text-ink dark:text-slate-200">
            บัญชีทดลองใช้งาน
          </h2>
          <p className="mt-1 text-xs text-ink-subtle dark:text-slate-500">
            รหัสผ่านเดียวกันทั้งหมด: <code className="font-mono">Password123!</code>
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {TEST_ACCOUNTS.map((account) => (
              <li key={account.username} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <code className="font-mono text-ink-muted dark:text-slate-400">{account.username}</code>
                <span className="text-ink-subtle dark:text-slate-500">{account.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
