import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Nav from "@/app/components/nav";
import { QuickAddProvider } from "@/app/components/quick-add";
import { ShortcutsProvider } from "@/app/components/shortcuts";
import { getCurrentUser } from "@/lib/dal";
import "./globals.css";

// Hangul is most of what this app renders, and Geist has no Hangul at all — it
// fell through to whatever the OS supplied, so the same screen looked different
// on Windows and on a Mac. Noto Sans KR draws both scripts, so the digits in a
// time label and the words beside them finally match.
//
// `subsets` does not filter what gets downloaded: every unicode-range chunk in
// the Google stylesheet is self-hosted either way. It only picks which chunks
// get a <link rel=preload>. Naming only "latin" is deliberate — preloading the
// ~120 Hangul chunks would flood the head, and the browser fetches the handful
// a page actually needs on its own.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
});

// Geist Mono used to be loaded here too. Nothing ever rendered with it — the
// --font-mono token it fed is unreferenced — but preloading pulled the file down
// on every page anyway. --font-mono now names the platform's own mono face.

export const metadata: Metadata = {
  title: "주간결",
  description: "루틴, 할 일, 언젠가 할 일을 한 결로 정리하는 개인 시간관리",
  // iOS ignores the web manifest for "홈 화면에 추가" and reads these instead,
  // so the two have to agree — app/manifest.ts is not enough on an iPhone.
  appleWebApp: {
    capable: true,
    title: "주간결",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Tints the phone's status bar to match the page rather than leaving a white
  // strip above a sand background. Two values so a dark-mode phone gets the
  // dark page colour instead of the light one.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f0ef" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read once here and passed down, so the nav doesn't repeat the session
  // lookup every page already performs.
  const user = await getCurrentUser();

  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Both wrap the whole app rather than each board: the add form is now
            reachable from the keyboard on any page, and the shortcut handler
            has to be able to open it. */}
        <QuickAddProvider>
          <ShortcutsProvider enabled={Boolean(user)}>
            <Nav user={user} />
            {children}
          </ShortcutsProvider>
        </QuickAddProvider>
      </body>
    </html>
  );
}
