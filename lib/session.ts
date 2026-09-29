/**
 * Session tokens, minted and verified by this project.
 *
 * Supabase Auth is not used anywhere. Instead a successful login produces a JWT
 * signed with the Supabase project's shared (HS256) secret, and that token is
 * what the rest of the stack works with:
 *
 *   - the app verifies the signature itself to decide who is signed in, and
 *   - the Supabase client sends the same token to PostgREST, which validates the
 *     signature, sets the Postgres role to `authenticated` and exposes the `sub`
 *     claim as auth.uid(). Every RLS policy already keys off auth.uid(), so none
 *     of them had to change.
 *
 * The token is the session: there is no refresh token and no server-side session
 * table. It expires, and the user signs in again. That is the right trade for a
 * stateless deployment, and it is also why revoking access means changing the
 * password rather than deleting a row.
 *
 * Web Crypto is used rather than node:crypto because this module is also imported
 * by middleware, which runs on the edge runtime. Requires Node 20 or newer for
 * globalThis.crypto.
 */

const JWT_HEADER = { alg: 'HS256', typ: 'JWT' } as const;

/** Postgres role carried in the claim, NOT the application role. */
const POSTGRES_ROLE = 'authenticated';

/** Eight hours: one shift, including a lunch break. */
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;

export const SESSION_COOKIE = 'ev-chargeops-session';

/** Identity carried in the token. The application role is never included. */
export type SessionUser = {
  id: string;
  username: string;
};

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'SUPABASE_JWT_SECRET is not set. Copy it from Supabase > Project Settings > API Keys (the legacy shared secret, HS256).',
    );
  }
  return secret;
}

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto is unavailable. Node 20 or newer is required.');
  }
  return subtle;
}

function toBase64Url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// No explicit return type on purpose: annotating it as `Uint8Array` widens the
// type to ArrayBufferLike under TypeScript 5.7+, which Web Crypto then rejects.
function fromBase64Url(input: string) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return getSubtle().importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export type CreateSessionInput = {
  id: string;
  username: string;
};

/**
 * Signs a session token for a user who has just passed the password check.
 *
 * `role` is the Postgres role PostgREST should assume; the Admin / Technician /
 * Viewer decision is deliberately absent, because a role stored in a token would
 * survive a demotion until the token expired. lib/auth.ts reads it from
 * public.profiles on every request instead.
 */
export async function createSessionToken({ id, username }: CreateSessionInput): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);

  const header = toBase64Url(JSON.stringify(JWT_HEADER));
  const payload = toBase64Url(
    JSON.stringify({
      sub: id,
      username,
      role: POSTGRES_ROLE,
      aud: 'authenticated',
      iss: 'supabase',
      iat: issuedAt,
      exp: issuedAt + SESSION_DURATION_SECONDS,
    }),
  );

  const key = await importKey(getSecret());
  const signature = await getSubtle().sign('HMAC', key, encoder.encode(`${header}.${payload}`));

  return `${header}.${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * Verifies a token and returns the identity inside it, or null.
 *
 * Every failure is the same null: a malformed token, a token signed with the
 * wrong secret, and an expired token are indistinguishable to the caller, so a
 * probe cannot learn which of the three it produced. A database error is logged
 * rather than swallowed silently, because a missing secret looks exactly like an
 * expired session from the outside and would otherwise be very hard to diagnose.
 */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];

  try {
    const key = await importKey(getSecret());
    const valid = await getSubtle().verify(
      'HMAC',
      key,
      fromBase64Url(signature),
      encoder.encode(`${header}.${payload}`),
    );
    if (!valid) return null;

    const claims: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (typeof claims !== 'object' || claims === null) return null;

    const { sub, username, exp } = claims as Record<string, unknown>;
    if (typeof sub !== 'string' || sub.length === 0) return null;
    if (typeof username !== 'string' || username.length === 0) return null;
    if (typeof exp !== 'number' || exp * 1000 <= Date.now()) return null;

    return { id: sub, username };
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}

/**
 * Cookie attributes for the session.
 *
 * httpOnly keeps the token away from JavaScript, so an XSS bug cannot read it and
 * post it anywhere. sameSite=lax still sends it on a top level navigation from
 * another site, which is what makes following a shared link into /machines work.
 * `secure` is conditional rather than hard-coded so the same build works on
 * http://localhost, where a secure cookie would never be stored.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  } as const;
}
