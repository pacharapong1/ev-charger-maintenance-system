'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from '@/lib/session';
import type { Database, Role } from '@/lib/supabase/types';
import { isRole } from '@/lib/permissions';

export type LoginState = {
  error: string | null;
};

/** Mirrors profiles_username_format_check so the rule lives in one readable place. */
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/;

/**
 * bcrypt is the expensive part and runs on a fixed-length hash, so a password
 * beyond this length cannot be valid. The cap is there to stop a 10 MB string
 * being sent to the database on every attempt.
 */
const MAX_PASSWORD_LENGTH = 200;

type Identity = {
  id: string;
  username: string;
  full_name: string | null;
  role: Role;
};

/**
 * A client with no session attached, used only to call public.login().
 *
 * The caller is anonymous, which is the point: the function is SECURITY DEFINER
 * precisely because the anonymous role has no read access to the password hashes.
 * Nothing here creates a browser session.
 */
function createAnonClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Only same-site relative paths back, so the `next` parameter cannot be used as
 * an open redirect to an attacker controlled host.
 */
function safeNextPath(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard';
  }
  return value;
}

function readIdentity(value: unknown): Identity | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id, username, full_name: fullName, role } = value as Record<string, unknown>;
  if (typeof id !== 'string' || typeof username !== 'string') return null;
  if (!isRole(role)) return null;
  return { id, username, full_name: typeof fullName === 'string' ? fullName : null, role };
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNextPath(formData.get('next'));

  if (!USERNAME_PATTERN.test(username)) {
    return { error: 'ชื่อผู้ใช้ต้องเป็น 3-40 ตัวอักษร และใช้ได้เฉพาะ A-Z a-z 0-9 . _ -' };
  }
  if (password.length === 0) {
    return { error: 'กรุณากรอกรหัสผ่าน' };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { error: 'รหัสผ่านยาวเกินไป' };
  }

  const { data, error } = await createAnonClient().rpc('login', {
    p_username: username,
    p_password: password,
  });

  if (error) {
    console.error('login() failed:', error.message);
    return { error: 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' };
  }

  // public.login() returns null for a wrong password and for an unknown
  // username, so there is nothing to say about which one it was.
  const identity = readIdentity(data);
  if (!identity) {
    return { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  }

  const token = await createSessionToken({ id: identity.id, username: identity.username });

  // The password was right, but a session token is only useful if the database
  // accepts it. Checking that here, rather than letting the redirect land on a
  // page full of permission errors, turns the one realistic misconfiguration
  // (a SUPABASE_JWT_SECRET that does not match the project) into a clear message.
  const probe = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      accessToken: async () => token,
    },
  );
  const { error: probeError } = await probe
    .from('profiles')
    .select('id')
    .eq('id', identity.id)
    .single();

  if (probeError) {
    console.error('Session token was rejected by PostgREST:', probeError.message);
    return {
      error:
        'เข้าสู่ระบบได้ แต่เซิร์ฟเวอร์ฐานข้อมูลไม่ยอมรับโทเคน กรุณาตรวจสอบว่า SUPABASE_JWT_SECRET ตรงกับค่าใน Supabase > Project Settings > API Keys',
    };
  }

  cookies().set(SESSION_COOKIE, token, sessionCookieOptions());

  // The session cookie was set inside the server action, so revalidatePath lets
  // the server components behind the redirect read the new session.
  revalidatePath('/', 'layout');
  redirect(next);
}

export async function logout(): Promise<void> {
  // Deleting the cookie is the entire sign-out. There is no refresh token and no
  // server-side session row to revoke, so nothing else needs to be cleaned up.
  cookies().delete(SESSION_COOKIE);
  revalidatePath('/', 'layout');
  redirect('/login');
}
