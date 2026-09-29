import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

export default async function RootPage() {
  const user = await getUser();
  redirect(user ? '/dashboard' : '/login');
}

export const metadata: Metadata = { title: 'EV-ChargeOps' };
