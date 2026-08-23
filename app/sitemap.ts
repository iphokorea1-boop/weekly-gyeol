import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/nudge";

/**
 * One entry, and that is not an oversight.
 *
 * Every other route is behind the login gate in proxy.ts, so listing /week or
 * /month here would point a crawler at a redirect to /login. A sitemap of
 * redirects is worse than a short sitemap: it spends the crawl budget and
 * teaches the index that this site answers every URL with the same page.
 *
 * When a public page that is not the app itself exists — a landing or a guide —
 * it belongs here, and that is the point at which this file starts earning its
 * keep.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: appUrl(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
