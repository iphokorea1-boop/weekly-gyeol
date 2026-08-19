import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/app/components/nav";
import { getCurrentUser } from "@/lib/dal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "주간결",
  description: "루틴, 할 일, 언젠가 할 일을 한 결로 정리하는 개인 시간관리",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read once here and passed down, so the nav doesn't repeat the session
  // lookup every page already performs.
  const user = await getCurrentUser();

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav user={user} />
        {children}
      </body>
    </html>
  );
}
