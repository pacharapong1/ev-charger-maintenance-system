/**
 * A readable failure page for a missing Supabase configuration.
 *
 * Without this, a clone that has no .env.local gets a bare 500 on every route,
 * because middleware.ts builds a Supabase client before anything else runs. The
 * 500 says nothing about the cause, so the only way to diagnose it is to read
 * the middleware source. This module states the two variables that are absent
 * and how to supply them.
 *
 * Rendered as a standalone document with inline styles rather than JSX: this
 * response is produced on the edge before the app tree loads, so Tailwind is
 * not available and the markup cannot reuse the app's component styles.
 */
import { NextResponse, type NextRequest } from 'next/server';

interface RequiredVariable {
  name: string;
  description: string;
}

const REQUIRED: RequiredVariable[] = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'Project URL, shaped like https://xxxxxxxxxxxx.supabase.co',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'The anon public key from the same API settings page',
  },
  {
    name: 'SUPABASE_JWT_SECRET',
    description:
      'The legacy shared secret (HS256) from Project Settings > API Keys. This project signs its own session tokens, so it is required. Never give it a NEXT_PUBLIC_ prefix.',
  },
];

/**
 * Which of the required variables are absent or blank.
 *
 * A variable set to an empty string or to whitespace counts as missing: that is
 * what a stray newline from copy and paste produces, and it is exactly as fatal
 * as not defining the variable at all.
 */
export function missingSupabaseVariables(
  env: Record<string, string | undefined> = process.env,
): RequiredVariable[] {
  return REQUIRED.filter((variable) => {
    const value = env[variable.name];
    return !value || value.trim().length === 0;
  });
}

export function isSupabaseConfigured(): boolean {
  return missingSupabaseVariables().length === 0;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPage(missing: RequiredVariable[]): string {
  const rows = missing
    .map(
      (variable) => `
        <li style="margin:0 0 12px;">
          <code style="display:block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;color:#7dd3fc;word-break:break-all;">${escapeHtml(
            variable.name,
          )}</code>
          <span style="display:block;margin-top:2px;font-size:13px;color:#94a3b8;">${escapeHtml(
            variable.description,
          )}</span>
        </li>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EV-ChargeOps &middot; Supabase is not configured</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: #0b0f16;
        color: #e2e8f0;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        line-height: 1.6;
      }
      main { width: 100%; max-width: 640px; }
      .card {
        background: #111722;
        border: 1px solid #1e293b;
        border-radius: 12px;
        padding: 28px;
      }
      h1 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
      p { margin: 0 0 16px; color: #94a3b8; font-size: 14px; }
      ul { margin: 0 0 24px; padding: 0; list-style: none; }
      h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.06em; }
      pre {
        margin: 0;
        padding: 14px 16px;
        background: #0b0f16;
        border: 1px solid #1e293b;
        border-radius: 8px;
        overflow-x: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px;
        color: #e2e8f0;
      }
      .note { margin: 20px 0 0; font-size: 12px; color: #64748b; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <h1>Supabase is not configured</h1>
        <p>
          The server started, but it cannot reach a Supabase project, so it
          refuses to serve any page rather than pretending the database is empty.
          ${missing.length === 1 ? 'One variable is' : 'These variables are'} missing:
        </p>

        <ul>${rows}</ul>

        <h2>How to fix</h2>
        <pre>NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_JWT_SECRET=your-projects-shared-secret</pre>

        <p class="note">
          Locally, put these lines in a <code>.env.local</code> file in the project
          root, then restart the dev server. On Vercel, add them under
          Project Settings &rarr; Environment Variables, tick Production, Preview
          and Development, then redeploy. The first two values are public by
          design: access is controlled by Row Level Security, not by hiding the
          key. The third is a secret and must never carry a
          <code>NEXT_PUBLIC_</code> prefix, because that would inline it into the
          JavaScript bundle that ships to the browser.
        </p>
      </div>
    </main>
  </body>
</html>`;
}

/**
 * 503 rather than 500: the application is not broken, the deployment is
 * misconfigured, and 503 is the status that tells a monitoring system the
 * service is expected to recover on its own once the variables are supplied.
 */
export function configurationErrorResponse(request: NextRequest): NextResponse {
  const missing = missingSupabaseVariables();

  // An API caller cannot render HTML, and a JSON body behind an error is what
  // makes the failure legible to a client or to curl.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        error: 'supabase_not_configured',
        message: 'The Supabase environment variables are not set on this deployment.',        missing: missing.map((variable) => variable.name),
      },
      { status: 503 },
    );
  }

  return new NextResponse(renderPage(missing), {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
