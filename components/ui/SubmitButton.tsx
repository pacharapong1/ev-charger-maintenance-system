'use client';

import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Loader2, Save, type LucideIcon } from 'lucide-react';
import type { ActionState } from '@/lib/validation';

/**
 * Raises a toast for whatever a server action returned, and returns the state
 * unchanged so it can be assigned straight back into useFormState.
 *
 * Shared by every mutating form so they all behave the same: toast the success,
 * toast the error, and when the action failed on specific fields, lead with the
 * first field message because it is the most actionable part of the reply.
 */
export function useActionToast() {
  return function notify(state: ActionState): ActionState {
    if (state.ok) {
      toast.success(state.ok);
    } else if (state.error) {
      const firstFieldError = state.fieldErrors
        ? Object.values(state.fieldErrors)[0]
        : undefined;
      toast.error(firstFieldError ?? state.error);
    }
    return state;
  };
}

/**
 * Submit button wired to the enclosing form's pending state, so it disables
 * itself and shows a spinner during a server action without the caller having
 * to thread a boolean through.
 */
export function SubmitButton({
  label,
  pendingLabel,
  className = 'btn btn-primary',
  icon: Icon = Save,
}: {
  label: string;
  pendingLabel: string;
  className?: string;
  icon?: LucideIcon;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="h-4 w-4" aria-hidden="true" />
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}
