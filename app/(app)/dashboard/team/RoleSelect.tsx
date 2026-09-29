'use client';

import { useTransition, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { changeUserRole } from './actions';
import { ROLE_ORDER, ROLE_LABEL } from '@/lib/permissions';
import type { Role } from '@/lib/supabase/types';

export function RoleSelect({
  userId,
  currentRole,
  isSelf,
}: {
  userId: string;
  currentRole: Role;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        defaultValue={currentRole}
        disabled={pending}
        aria-label="เปลี่ยนบทบาท"
        className="field w-auto py-1.5 text-xs"
        onChange={(event) => {
          const next = event.target.value as Role;

          if (
            !window.confirm(
              `เปลี่ยนบทบาทเป็น ${ROLE_LABEL[next]} (${next}) หรือไม่?\nการเปลี่ยนแปลงจะมีผลทันที`,
            )
          ) {
            // The DOM value has already moved to the new option. Put it back so
            // the select keeps showing the role that is actually stored.
            event.target.value = currentRole;
            return;
          }

          startTransition(async () => {
            const result = await changeUserRole(userId, next);
            setError(result.error);
          });
        }}
      >
        {ROLE_ORDER.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABEL[role]} ({role})
          </option>
        ))}
      </select>

      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-subtle" aria-hidden="true" />
      ) : null}
      {isSelf ? <span className="text-xs text-ink-subtle dark:text-slate-500">บัญชีของคุณ</span> : null}
      {error ? <span role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </div>
  );
}
