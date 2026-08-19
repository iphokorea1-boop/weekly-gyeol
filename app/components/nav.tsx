"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, CalendarRange, LayoutGrid, LogOut, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/dal";

const TABS = [
  { href: "/", label: "오늘", icon: Sun },
  { href: "/week", label: "주간", icon: CalendarRange },
  { href: "/month", label: "월간", icon: CalendarDays },
  { href: "/year", label: "연간", icon: LayoutGrid },
];

export default function Nav({ user }: { user: CurrentUser | null }) {
  const pathname = usePathname();
  const listRef = useRef<HTMLDivElement>(null);
  // null until measured; the active tab keeps its own background until then,
  // so the server-rendered nav already looks right and the handover is invisible.
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  const measure = useCallback(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
    setPill(
      active ? { left: active.offsetLeft, width: active.offsetWidth } : null
    );
  }, []);

  useEffect(() => {
    measure();
  }, [measure, pathname]);

  // Re-measure on anything that changes tab widths: viewport resize, the sm
  // breakpoint revealing labels, or a late web font swapping in.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const child of Array.from(list.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [measure]);

  const wordmark = (
    <Link href="/" className="pressable flex items-center gap-2.5">
      {/* One mark per task kind, in the same order the views present them. */}
      <span aria-hidden className="flex items-end gap-[3px]">
        <span className="h-3 w-1.5 rounded-full bg-routine" />
        <span className="h-5 w-1.5 rounded-full bg-dated" />
        <span className="h-2 w-1.5 rounded-full bg-floating" />
      </span>
      <span className="text-[15px] font-extrabold tracking-tight">주간결</span>
    </Link>
  );

  if (!user) {
    return (
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-3 sm:px-6">
          {wordmark}
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {wordmark}

        <div className="flex items-center gap-2">
          <nav className="rounded-full border border-border bg-surface p-1 shadow-xs">
            {/* Inner wrapper carries no border or padding, so a tab's offsetLeft
                is measured from the same origin the pill is positioned against. */}
            <div ref={listRef} className="relative flex items-center gap-0.5">
              {pill && (
                <span
                  aria-hidden
                  className="nav-pill absolute inset-y-0 left-0 rounded-full bg-primary shadow-sm"
                  style={{ width: pill.width, translate: `${pill.left}px 0` }}
                />
              )}

              {TABS.map((tab) => {
                const active =
                  tab.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(tab.href);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "pressable press-deep relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold",
                      active
                        ? "text-primary-foreground"
                        : "text-ink-soft hover:text-foreground",
                      active && !pill && "bg-primary shadow-sm"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <form action={logout}>
            <button
              type="submit"
              title={user.email}
              aria-label="로그아웃"
              className="pressable press-deep lift grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-ink-soft hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
