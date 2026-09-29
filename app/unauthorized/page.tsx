import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { ROLE_DESCRIPTION, ROLE_LABEL } from '@/lib/permissions';
import LogoutButton from '@/components/LogoutButton';

export const metadata: Metadata = { title: 'ไม่มีสิทธิ์เข้าถึง' };

const ROLE_SUGGESTION = {
  Admin: 'คุณสามารถจัดการทุกส่วนได้อยู่แล้ว หากพบว่าเมนูบางส่วนไม่แสดง ให้ลองออกจากระบบแล้วเข้าใหม่',
  Technician:
    'หน้านี้ต้องการสิทธิ์ของผู้ดูแลระบบ หากคุณเป็นช่างซ่อมบำรุงแล้วยังเข้าไม่ได้ ให้แจ้งผู้ดูแลระบบตรวจสอบบทบาทของคุณ',
  Engineer:
    'หน้านี้ต้องการสิทธิ์ของผู้ดูแลระบบ เพราะวิศวกรแก้ไขได้เฉพาะ Alarm เท่านั้น หากคุณเป็นวิศวกรแล้วยังเข้าไม่ได้ ให้แจ้งผู้ดูแลระบบตรวจสอบบทบาทของคุณ',
  Viewer:
    'บัญชีของคุณมีสิทธิ์ดูข้อมูลอย่างเดียว การแก้ไขข้อมูลต้องเป็นช่างซ่อมบำรุง วิศวกร หรือผู้ดูแลระบบ',
} as const;

export default async function UnauthorizedPage() {
  const context = await requireUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card p-6">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </span>

          <h1 className="mt-4 text-lg font-semibold tracking-tight text-ink dark:text-slate-50">
            ไม่มีสิทธิ์เข้าถึงหน้านี้
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-slate-400">
            คุณเข้าสู่ระบบแล้ว แต่บทบาทของคุณไม่อนุญาตให้เปิดหน้านี้
          </p>

          <dl className="mt-5 space-y-3 rounded-lg border border-line bg-surface-muted/60 p-4 dark:border-slate-800 dark:bg-slate-800/20">
            <div>
              <dt className="text-xs font-medium text-ink-subtle dark:text-slate-500">บทบาทของคุณ</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink dark:text-slate-200">
                {ROLE_LABEL[context.role]}{' '}
                <span className="text-ink-subtle dark:text-slate-500">({context.role})</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-subtle dark:text-slate-500">สิทธิ์ที่คุณมี</dt>
              <dd className="mt-0.5 text-sm text-ink-muted dark:text-slate-400">
                {ROLE_DESCRIPTION[context.role]}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-subtle dark:text-slate-500">แนะนำ</dt>
              <dd className="mt-0.5 text-sm text-ink-muted dark:text-slate-400">
                {ROLE_SUGGESTION[context.role]}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link href="/dashboard" className="btn">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              กลับไปหน้าแดชบอร์ด
            </Link>
            <LogoutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
