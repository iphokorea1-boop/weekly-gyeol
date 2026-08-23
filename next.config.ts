import type { NextConfig } from "next";

/**
 * Response headers.
 *
 * The Content-Security-Policy for *pages* is not here — it carries a per-request
 * nonce, so it is built in `proxy.ts` where a request exists. What lives here is
 * everything that is the same for every response, plus a policy for the one
 * route that serves HTML without going through the proxy.
 */

/**
 * Applied to everything. None of these depend on the request.
 */
const BASELINE = [
  // Two years, and every subdomain. Deliberately without `preload`: that token
  // only means anything once the domain is submitted to the browsers' preload
  // list, and removal from that list takes months. Worth doing once the domain
  // is settled — not on the first deploy.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Superseded by CSP's frame-ancestors, kept for browsers that predate it.
  { key: "X-Frame-Options", value: "DENY" },
  // Full URLs stay inside the site; other origins are told the origin only. A
  // task title never appears in a URL here, but the app is the sort of thing
  // that grows share links, and this is the safer default to grow into.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app asks for none of these. Saying so stops an embedded third party
  // from asking on its behalf.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

/**
 * The proxy does not run on /api (see its matcher), and one route under it
 * answers with a whole HTML page: the unsubscribe screen, which is reachable
 * from an email without a session. It runs no JavaScript at all, so it gets a
 * policy that allows none — the strictest thing in the codebase, and a real
 * guard on the one page an unauthenticated stranger can reach.
 */
const API_CSP = [
  "default-src 'none'",
  // The page styles itself with inline `style` attributes, which no nonce can
  // cover. Nothing else is permitted.
  "style-src 'unsafe-inline'",
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Nothing gains from announcing the framework and version in every response.
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/(.*)", headers: BASELINE },
      {
        source: "/api/:path*",
        headers: [{ key: "Content-Security-Policy", value: API_CSP }],
      },
    ];
  },
};

export default nextConfig;
