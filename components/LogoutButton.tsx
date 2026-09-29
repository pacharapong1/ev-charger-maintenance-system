import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { logout } from '@/app/login/actions';

/**
 * Logout is a POST server action, not a link. A GET route could be triggered
 * by any third party page with an <img> tag, which would let that page log the
 * user out at will.
 */
export default async function LogoutButton() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <form action={logout}>
      <button
        type="submit"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-100"
        title="ออกจากระบบ"
        aria-label="ออกจากระบบ"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}
