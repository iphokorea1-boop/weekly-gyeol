import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/nudge";

/**
 * What crawlers may look at.
 *
 * The app is meant to be found now, but most of it still cannot be: proxy.ts
 * sends anonymous visitors to /login, so a crawler following any other path is
 * shown the login screen and nothing else. Allowing everything would fill an
 * index with copies of one page under a dozen URLs, so the crawl is pointed at
 * the root and kept off the routes that answer nobody.
 *
 * /api is JSON with nothing to read, and one route under it — the unsubscribe
 * page — carries a signed token in its query string. That page already sends
 * `noindex` itself, but a crawler has no business fetching a one-time link out
 * of somebody's inbox at all, which is what the Disallow says.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
