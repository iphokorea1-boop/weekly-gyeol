"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The feed address, which is a password in the shape of a URL.
 *
 * Hidden until asked for, because this screen is the sort of thing that ends
 * up in a screenshot sent to someone for help — and anyone holding this
 * address can read the whole schedule, with no sign-in and no trace.
 */
export default function CalendarLink({ url }: { url: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Denied clipboard permission, or an insecure context. Showing the
      // address is the fallback: it can still be selected by hand.
      setShown(true);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "rounded-lg border border-border bg-surface-sunk px-3 py-2.5",
          "font-mono text-[11px] break-all",
          shown ? "text-ink-soft" : "text-ink-faint select-none"
        )}
      >
        {shown ? url : "•".repeat(64)}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShown((open) => !open)}
          className="pressable press-deep lift flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-ink-soft hover:text-foreground"
        >
          {shown ? (
            <EyeOff className="h-3.5 w-3.5" strokeWidth={2.5} />
          ) : (
            <Eye className="h-3.5 w-3.5" strokeWidth={2.5} />
          )}
          {shown ? "가리기" : "주소 보기"}
        </button>

        <button
          type="button"
          onClick={copy}
          className="pressable press-deep lift flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={2.5} />
          )}
          {copied ? "복사했어요" : "주소 복사"}
        </button>
      </div>
    </div>
  );
}
