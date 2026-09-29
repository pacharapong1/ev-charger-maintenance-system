import Link from 'next/link';
import { SearchX } from 'lucide-react';

/**
 * Shown when /machines/[machineId] cannot match a station code.
 *
 * The usual cause is a stale bookmark or a link to a station that was deleted,
 * which is a dead end rather than a server fault, so this explains the situation
 * and offers the way back instead of leaving a bare 404.
 */
export default function MachineHistoryNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <SearchX className="h-8 w-8 text-ink-subtle dark:text-slate-600" aria-hidden="true" />
      <h1 className="text-lg font-semibold text-ink dark:text-slate-100">
        ไม่พบเครื่องจักรรหัสนี้
      </h1>
      <p className="max-w-sm text-sm text-ink-muted dark:text-slate-400">
        รหัสเครื่องจักรในลิงก์อาจไม่ถูกต้อง หรือเครื่องจักรนั้นถูกลบออกจากระบบแล้ว
      </p>
      <Link href="/machines" className="btn btn-sm mt-1">
        กลับไปหน้าเครื่องจักร
      </Link>
    </div>
  );
}
