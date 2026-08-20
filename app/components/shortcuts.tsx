"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  isTypingTarget,
  resolveShortcut,
  SHORTCUTS,
  SHORTCUT_GROUPS,
  VIEW_HREF,
} from "@/lib/shortcuts";
import { formatDateISO, todayInSeoul } from "@/lib/task-utils";
import { dayCaption, useQuickAdd } from "@/app/components/quick-add";

type HelpValue = { openHelp: () => void };

const HelpContext = createContext<HelpValue | null>(null);

/** Lets the nav open the same panel `?` opens. */
export function useShortcutHelp(): HelpValue | null {
  return useContext(HelpContext);
}

const KEY_CHIP =
  "grid h-7 min-w-7 place-items-center rounded-md border border-border-strong bg-surface-sunk px-1.5 text-[12px] font-bold text-ink";

function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="키보드 단축키"
        onClick={(event) => event.stopPropagation()}
        className="animate-panel-in max-h-full w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold tracking-tight">
              키보드 단축키
            </h2>
            <p className="mt-1 text-xs text-ink-soft">
              글자를 입력하는 중에는 동작하지 않습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="pressable press-deep grid h-8 w-8 flex-none place-items-center rounded-lg border border-border text-ink-soft hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {SHORTCUT_GROUPS.map((group) => (
          <section key={group} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-[11px] font-bold tracking-wide text-ink-faint">
              {group}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                <li key={s.id} className="flex items-start gap-3">
                  <span className="flex flex-none gap-1">
                    {s.keys.map((k) => (
                      <kbd key={k} className={KEY_CHIP}>
                        {k}
                      </kbd>
                    ))}
                  </span>
                  <span className="pt-1">
                    <span className="text-sm font-medium">{s.label}</span>
                    {s.note && (
                      <span className="mt-0.5 block text-[11px] text-ink-faint">
                        {s.note}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-ink-faint">
          <strong className="text-ink-soft">T와 W에 Ctrl이 없는 이유</strong> —
          Ctrl+T는 새 탭, Ctrl+W는 탭 닫기라 브라우저가 먼저 가져갑니다. 웹
          페이지가 이길 수 없는 싸움이라 그냥 글자만 누르게 했습니다.
        </p>
      </div>
    </div>
  );
}

/**
 * The one place that listens for shortcut keys.
 *
 * Prev/next do not compute a date. They click the link the page already
 * rendered (`[data-period]` on PeriodNav), so what "previous" means stays
 * decided by the page that knows which period it is showing — and any view
 * that grows a PeriodNav gets the arrows for free.
 */
export function ShortcutsProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { open: openQuickAdd, isOpen: quickAddOpen } = useQuickAdd();
  const [helpOpen, setHelpOpen] = useState(false);

  const openHelp = useCallback(() => setHelpOpen(true), []);

  // Close on navigation. The backdrop makes the nav unclickable, so the case
  // this catches is the browser's own Back button while the panel is up.
  // Adjusted during render — the same pattern the boards use to reset state
  // from a changed input, and the reason there is no effect here.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (helpOpen) setHelpOpen(false);
  }

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      // isComposing covers Hangul: mid-composition every key arrives as one
      // more keystroke in the syllable being built, not as a command.
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        return;
      }

      // A form on screen owns the keyboard until it is dismissed.
      if (quickAddOpen) return;

      const id = resolveShortcut({
        key: event.key,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        alt: event.altKey,
      });
      if (!id) return;
      if (helpOpen && id !== "help") return;

      if (id === "help") {
        event.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }

      if (id === "prev" || id === "next") {
        const link = document.querySelector<HTMLElement>(
          `[data-period="${id}"]`
        );
        // The today page has no period to move through. Leaving the default
        // alone there keeps the arrow keys scrolling, as they should.
        if (!link) return;
        event.preventDefault();
        link.click();
        return;
      }

      if (id === "new") {
        event.preventDefault();
        const today = formatDateISO(todayInSeoul());
        openQuickAdd(
          {
            kind: "dated",
            dueDate: today,
            startTime: "",
            endTime: "",
            weekdays: [],
          },
          dayCaption(today),
          // No cell was clicked, so the form is centred instead of anchored.
          { left: window.innerWidth / 2, top: window.innerHeight * 0.16, width: 0, height: 0 }
        );
        return;
      }

      const href = VIEW_HREF[id];
      if (!href) return;
      event.preventDefault();
      router.push(href);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, helpOpen, quickAddOpen, openQuickAdd, router]);

  return (
    <HelpContext.Provider value={{ openHelp }}>
      {children}
      {helpOpen &&
        createPortal(
          <HelpPanel onClose={() => setHelpOpen(false)} />,
          document.body
        )}
    </HelpContext.Provider>
  );
}
