import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ThemeScript from '@/components/theme/ThemeScript';
import Toaster from '@/components/ui/Toaster';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'EV-ChargeOps',
    template: '%s | EV-ChargeOps',
  },
  description: 'ระบบจัดการเครื่องจักรชาร์จไฟฟ้าและงานซ่อมบำรุง',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: ThemeScript mutates className on <html> before
    // React hydrates, so the server and client HTML intentionally differ here.
    <html lang="th" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen">
        {children}
        {/* Mounted at the root so a toast from a form, a table row action or a
            filter run is visible on every route, not just the ones that
            happen to render their own provider. */}
        <Toaster />
      </body>
    </html>
  );
}
