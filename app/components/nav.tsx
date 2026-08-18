"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "오늘" },
  { href: "/week", label: "주간" },
  { href: "/month", label: "월간" },
  { href: "/year", label: "연간" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-[var(--background)]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          {/* Three marks for the three kinds of task the app tracks. */}
          <span aria-hidden className="flex items-end gap-[3px]">
            <span className="h-3.5 w-1.5 rounded-full bg-routine" />
            <span className="h-5 w-1.5 rounded-full bg-dated" />
            <span className="h-2.5 w-1.5 rounded-full bg-floating" />
          </span>
          <span className="text-[15px] font-extrabold tracking-tight">
            주간결
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5">
          {TABS.map((tab) => {
            const active =
              tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-dated text-white shadow-sm"
                    : "text-ink-soft hover:bg-surface-sunk hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
