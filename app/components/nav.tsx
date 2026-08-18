"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CalendarRange, LayoutGrid, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "오늘", icon: Sun },
  { href: "/week", label: "주간", icon: CalendarRange },
  { href: "/month", label: "월간", icon: CalendarDays },
  { href: "/year", label: "연간", icon: LayoutGrid },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          {/* One mark per task kind, in the same order the views present them. */}
          <span aria-hidden className="flex items-end gap-[3px]">
            <span className="h-3 w-1.5 rounded-full bg-routine" />
            <span className="h-5 w-1.5 rounded-full bg-dated" />
            <span className="h-2 w-1.5 rounded-full bg-floating" />
          </span>
          <span className="text-[15px] font-extrabold tracking-tight">
            주간결
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 rounded-full border border-border bg-surface p-1 shadow-xs">
          {TABS.map((tab) => {
            const active =
              tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-ink-soft hover:bg-surface-sunk hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
