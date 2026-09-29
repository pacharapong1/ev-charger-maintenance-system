/**
 * Route protection.
 *
 * Two jobs:
 *
 *   1. Send anonymous visitors away from protected pages before any server
 *      component runs, so protected markup is never streamed to someone who is
 *      not signed in.
 *   2. Send signed-in visitors away from the login form, which they have no use
 *      for.
 *
 * The session is a JWT signed by lib/session.ts, so "signed in" here means the
 * signature verified and the token has not expired. middleware only checks that.
 * It cannot read the role, because that would mean a database query on every
 * request including static assets. Role checks therefore live in the server layer
 * (lib/auth.ts) and in the database (02_rls.sql), which is the correct place for
 * them anyway.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import {
  configurationErrorResponse,
  isSupabaseConfigured,
} from '@/lib/supabase/config-error';

// /auth/callback is intentionally absent: there is no OAuth flow, because
// authentication is this project's own login form.
const PUBLIC_ROUTES = ['/login', '/unauthorized'];

export async function middleware(request: NextRequest) {
  // Checked before anything else. Without these variables the session cannot be
  // verified, which would look like a silent "nobody can log in" rather than a
  // deployment problem, so it is worth catching here and naming the variables.
  if (!isSupabaseConfigured()) {
    return configurationErrorResponse(request);
  }

  const { pathname } = request.nextUrl;
  const user = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // API routes answer with a status code and a JSON body, not a redirect. They
  // just return 401 themselves instead of being bounced to the login form, which
  // would otherwise arrive as HTML the client cannot parse.
  const isApiRoute = pathname.startsWith('/api/');

  // Signed-in users have no reason to see the login form.
  if (user && pathname === '/login') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  if (!user && !isPublicRoute && !isApiRoute) {
    // Keep the destination so login can return the user to it, but do not carry
    // the original query string across: it would reappear as a stray filter on
    // the login URL, and the protected page will re-read it from its own params.
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.search = '';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on every path except:
     *   _next/static, _next/image   build output
     *   favicon.ico, common assets   files with an extension
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
