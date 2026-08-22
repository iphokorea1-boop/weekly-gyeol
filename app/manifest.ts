import type { MetadataRoute } from "next";

/**
 * What turns the site into something a phone will keep on its home screen.
 *
 * `display: "standalone"` is the whole point: launched from the home screen the
 * app opens without the address bar, which on a phone is most of the difference
 * between "a website I bookmarked" and "an app I use".
 *
 * Note this file is fetched by the browser *without* cookies, so `proxy.ts` has
 * to let it through unauthenticated — otherwise it is redirected to /login and
 * the install prompt never appears. See the matcher there.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "주간결",
    short_name: "주간결",
    description: "루틴, 할 일, 언젠가 할 일을 한 결로 정리하는 개인 시간관리",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches --background and --foreground in globals.css. background_color
    // paints the splash screen while the app boots; getting it wrong shows a
    // white flash before a sand-coloured page.
    background_color: "#f1f0ef",
    theme_color: "#21201c",
    categories: ["productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops icons to whatever shape the launcher uses, so the
      // maskable one keeps its art well inside the centre.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
