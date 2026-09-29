'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { AlertCircle, Loader2, LogIn } from 'lucide-react';
import { login, type LoginState } from './actions';

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          กำลังเข้าสู่ระบบ...
        </>
      ) : (
        <>
          <LogIn className="h-4 w-4" aria-hidden="true" />
          เข้าสู่ระบบ
        </>
      )}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useFormState(login, initialState);

  return (
    <form action={formAction} className="card space-y-4 p-6">
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <label htmlFor="username" className="field-label">
          ชื่อผู้ใช้
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="admin"
          className="field"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="field-label">
          รหัสผ่าน
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="field"
          required
        />
      </div>

      {state.error ? (
        <p role="alert" className="alert-error flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{state.error}</span>
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
