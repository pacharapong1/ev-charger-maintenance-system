import { cookies } from 'next/headers';
// Aliased because this module exports its own createClient, and the name is what
// every call site imports. The alias keeps the two apart without forcing every
// caller to rename the import.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SESSION_COOKIE, verifySessionToken } from '../session';

/**
 * Server client for React Server Components, Server Actions and Route Handlers.
 *
 * WHY THIS USES @supabase/supabase-js DIRECTLY, NOT @supabase/ssr
 * ------------------------------------------------------------
 * @supabase/ssr is a wrapper that exists to bridge Supabase Auth's cookie
 * session into Next.js. It always wires up an onAuthStateChange listener to keep
 * that cookie in sync, and supabase-js blocks that call when the `accessToken`
 * option is set:
 *
 *   "Supabase Client is configured with the accessToken option, accessing
 *    supabase.auth.onAuthStateChange is not possible"
 *
 * There is no way to opt out: the auth client cannot manage a session it does
 * not own. Since this project signs its own tokens, there is no Supabase session
 * to manage, so the wrapper has nothing left to do and only gets in the way.
 * Creating the client directly is the documented approach for a custom
 * accessToken, and the three options below switch off the auth machinery that
 * would otherwise try to persist a session in localStorage on the client.
 *
 * WHAT accessToken DOES
 * ---------------------
 * supabase-js normally asks its auth client for a token. Pointing it at our own
 * function instead means every PostgREST request carries the session token
 * minted by lib/session.ts. PostgREST verifies the signature with the project's
 * shared secret, sets the Postgres role to `authenticated` and exposes the `sub`
 * claim as auth.uid(), which is what every RLS policy keys off.
 *
 * Because the callback is a function rather than a string, the token is read
 * from the request cookie on every call, so a role change or a logout takes
 * effect on the next request instead of when a cached token expires.
 *
 * Returning null when there is no valid session is meaningful: the request then
 * goes out as the anonymous role, which 02_rls.sql has revoked from every table.
 * A signed-out visitor gets a permission error from the database rather than an
 * empty result set, so "no access" can never be mistaken for "no data".
 *
 * A note on the two known limits of this approach. Supabase requires the
 * project's shared (HS256) secret, so a project configured with only asymmetric
 * signing keys cannot be used this way; and the token cannot be revoked before it
 * expires, so "sign out everywhere" is not available. Neither matters for a
 * single-site internal tool, and both are stated in the README.
 *
 * This function must not be imported from a "use client" file.
 */
export function createClient() {
  const cookieStore = cookies();

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // The three options below exist purely to keep the Supabase Auth client
      // dormant. Without them it would try to restore a session from
      // localStorage, which is meaningless here and logs a warning on the
      // server where localStorage does not exist.
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      accessToken: async () => {
        const token = cookieStore.get(SESSION_COOKIE)?.value;
        if (!token) return null;
        return (await verifySessionToken(token)) ? token : null;
      },
    },
  );
}
