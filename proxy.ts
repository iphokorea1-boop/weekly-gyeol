import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * An optimistic gate only. It checks that a session cookie is *present*, never
 * whether it is valid — the docs warn against database work here because this
 * runs on every request including prefetches. The real check lives in the data
 * access layer, which is what actually guards the data.
 *
 * Note it deliberately does not bounce signed-in visitors away from /login. A
 * stale cookie would satisfy the cookie-presence test but fail the real check,
 * sending the browser /login -> / -> /login forever. The login page redirects
 * already-authenticated users itself, using a genuine database lookup.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login") return NextResponse.next();
  if (request.cookies.get(SESSION_COOKIE)) return NextResponse.next();

  const target = new URL("/login", request.url);
  return NextResponse.redirect(target);
}

export const config = {
  // API routes are excluded so unauthenticated calls get a 401 JSON body from
  // the handler instead of an HTML redirect a fetch() cannot make sense of.
  //
  // The manifest is excluded because the browser fetches it *without* cookies.
  // Redirecting it to /login makes the site look uninstallable — no home-screen
  // prompt — and nothing reports an error, so it quietly never works. It holds
  // no user data. The generated icons need no entry of their own: Next serves
  // them at /icon.png and /apple-icon.png, which the extension rule below
  // already covers. Keep it that way rather than excluding the bare words —
  // "icon" here would be a prefix match, and would let a future /icons page
  // past the gate.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\.(?:png|svg|ico)$).*)",
  ],
};
