import type { ReactNode } from 'react';
import AppShell from '@/components/shell/AppShell';

/**
 * Everything inside this route group is the signed-in application.
 *
 * The (app) segment is a route group: it does not appear in any URL, it only
 * lets /dashboard and the top level master data pages share one layout. That
 * means the auth guard and the navigation live in exactly one place instead of
 * being duplicated per segment, and a new top level page is protected the moment
 * it is added here.
 *
 * /login, /unauthorized and /auth/callback stay outside, since they must render
 * without a session.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
