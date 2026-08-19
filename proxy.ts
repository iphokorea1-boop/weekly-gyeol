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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:png|svg|ico)$).*)"],
};
