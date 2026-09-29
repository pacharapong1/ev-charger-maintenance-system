import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from './session';
import type { Profile, Role } from './supabase/types';
import { can, type Permission } from './permissions';

export type { SessionUser };

/**
 * The columns an application query is allowed to read. The password hash is
 * missing on purpose: SELECT on it is revoked in 02_rls.sql, so a query that
 * asked for it would come back without the column rather than with the hash.
 */
export type PublicProfile = Omit<Profile, 'password_hash'>;

export type AuthContext = {
  user: SessionUser;
  profile: PublicProfile;
  role: Role;
};

/**
 * Reads the signed-in identity from the session cookie.
 *
 * Wrapped in React cache() so a page that calls it several times still verifies
 * the signature only once per request. The signature check is the whole trust
 * boundary here: the cookie is attacker-controlled data, and nothing in it is
 * believed until the HMAC matches.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
});

/**
 * Reads the profile row, and with it the role.
 *
 * The role always comes from the database rather than from the session token, so
 * an Admin who demotes someone takes effect on that person's very next request
 * instead of when their token happens to expire. The same reason applies to
 * self-assignment: there is no sign-up, and an account exists only because an
 * Admin created it, so no user can hand themselves a role.
 */
export const getProfile = cache(async (userId: string): Promise<PublicProfile | null> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, role, created_at')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to load profile for', userId, error);
    return null;
  }
  return data;
});

/** Resolves the full auth context, or null when there is no valid session. */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const user = await getUser();
  if (!user) return null;

  const profile = await getProfile(user.id);
  if (!profile) return null;

  return { user, profile, role: profile.role };
});

/**
 * Guard for Server Components and Server Actions: bounces anonymous visitors to
 * the login page. Remember to call it before any data access, not after.
 */
export async function requireUser(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect('/login');
  return context;
}

/** Guard for pages and actions that need a specific role. */
export async function requireRole(allowed: readonly Role[]): Promise<AuthContext> {
  const context = await requireUser();
  if (!allowed.includes(context.role)) redirect('/unauthorized');
  return context;
}

/** Guard for a specific permission from the matrix in lib/permissions.ts. */
export async function requirePermission(permission: Permission): Promise<AuthContext> {
  const context = await requireUser();
  if (!can(context.role, permission)) redirect('/unauthorized');
  return context;
}
