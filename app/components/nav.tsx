"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "오늘" },
  { href: "/week", label: "이번 주" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex w-full max-w-3xl gap-1 px-4 pt-6 sm:px-6">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-dated-soft text-dated-ink"
                : "text-ink-soft hover:bg-surface-sunk"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
