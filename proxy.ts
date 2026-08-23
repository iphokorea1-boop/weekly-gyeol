import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * Two jobs, in this order: give every page a Content-Security-Policy carrying a
 * fresh nonce, then send anonymous visitors to the login screen.
 *
 * The auth gate is an optimistic one only. It checks that a session cookie is
 * *present*, never whether it is valid — the docs warn against database work
 * here because this runs on every request including prefetches. The real check
 * lives in the data access layer, which is what actually guards the data.
 *
 * Note it deliberately does not bounce signed-in visitors away from /login. A
 * stale cookie would satisfy the cookie-presence test but fail the real check,
 * sending the browser /login -> / -> /login forever. The login page redirects
 * already-authenticated users itself, using a genuine database lookup.
 */

/**
 * The policy for a single request.
 *
 * A nonce is what lets the scripts Next.js emits run while an injected one does
 * not, and it is only worth anything if it is unguessable and never reused —
 * hence one per request rather than one per deploy.
 */
function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    // 'strict-dynamic' lets a script this nonce vouches for pull in the chunks
    // it needs, so code splitting keeps working without naming every file here.
    // React's development build compiles with eval; the production one does not,
    // so that hole is opened for `next dev` only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // A nonce cannot cover a `style` attribute, and eleven components position
    // themselves with one — the now-line, the week grid, the nav pill, the
    // quick-add popover. Dropping 'unsafe-inline' here does not fail loudly; it
    // silently unstyles all of them. Style injection is also a far narrower
    // problem than script injection, which is the one the nonce above solves.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    // Noto Sans KR is self-hosted by next/font, so no font CDN needs naming.
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Server Actions post back to this origin; nothing should post anywhere else.
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Left out in development, where the dev server is plain http and there is
    // nothing to upgrade to.
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  // Hyphens and hex are both inside the base64 character set a nonce is allowed
  // to use, so the UUID needs no re-encoding.
  const nonce = crypto.randomUUID();
  const csp = contentSecurityPolicy(nonce);

  const { pathname } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE));

  // "/" is the landing page for anyone without a session — the page that has to
  // work for a stranger who followed a link, which is the whole point of having
  // one. app/page.tsx decides which of the two it renders; bouncing it here
  // would make that decision unreachable.
  if (pathname !== "/" && pathname !== "/login" && !signedIn) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  // Set on the *request* as well as the response, because that is where Next.js
  // reads the nonce back from before it renders. Given only the response header,
  // the framework's own <script> tags go out unnonced and the page never boots.
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // API routes are excluded so unauthenticated calls get a 401 JSON body from
  // the handler instead of an HTML redirect a fetch() cannot make sense of.
  // They get their own, stricter policy from next.config.ts instead.
  //
  // The manifest is excluded because the browser fetches it *without* cookies.
  // Redirecting it to /login makes the site look uninstallable — no home-screen
  // prompt — and nothing reports an error, so it quietly never works. It holds
  // no user data. The generated icons need no entry of their own: Next serves
  // them at /icon.png and /apple-icon.png, which the extension rule below
  // already covers. Keep it that way rather than excluding the bare words —
  // "icon" here would be a prefix match, and would let a future /icons page
  // past the gate.
  //
  // robots.txt and sitemap.xml are excluded for the same reason and fail the
  // same quiet way: a crawler arrives without cookies, gets redirected to a
  // login page, and never reads the file that was the whole point of the visit.
  // Nothing errors — the sitemap simply reads as a site whose every URL is the
  // login screen, which is worse than having published no sitemap at all. Both
  // are named in full rather than matched by extension, so a future /notes.txt
  // or /export.xml route does not inherit the exemption.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\.(?:png|svg|ico)$).*)",
  ],
};
