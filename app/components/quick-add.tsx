"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import TaskForm, { type TaskDraft } from "@/app/components/task-form";
import { formatKo, parseDateISO } from "@/lib/task-utils";

/**
 * Adding a task by clicking the day you want it on.
 *
 * The calendar views had no way to create anything: you went to the today page,
 * added the task, then came back and dragged it into place. Clicking the cell
 * skips both steps, and the cell already knows the date — in the weekly grid,
 * the hour as well.
 *
 * A popover rather than an inline form, because a month cell is 104px tall and
 * a heatmap square is 20px. It is anchored to whatever was clicked so the form
 * stays next to the day it is about.
 */

/** Viewport coordinates of the thing the popover should sit against. */
export type Anchor = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Session = { draft: TaskDraft; caption: string; anchor: Anchor };

type QuickAddValue = {
  open: (draft: TaskDraft, caption: string, anchor: Anchor) => void;
};

const QuickAddContext = createContext<QuickAddValue | null>(null);

export function useQuickAdd(): QuickAddValue {
  const value = useContext(QuickAddContext);
  if (!value) throw new Error("useQuickAdd must be used inside a QuickAddProvider");
  return value;
}

/**
 * Whether a click landed on something that already means something else.
 *
 * Cells contain task chips, blocks and links, and a click on one of those is
 * about that item — not a request to add a new task underneath it. Holiday
 * chips are deliberately not excluded: they are labels, and wanting to plan
 * something on a holiday is a perfectly ordinary reason to click one.
 */
export function opensQuickAdd(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !target.closest("a, button, input, [data-nq]");
}

const WIDTH = 320;
const GAP = 8;
const MARGIN = 12;

function Popover({
  session,
  onClose,
}: {
  session: Session;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Measured after mount rather than guessed: the height depends on which kind
  // is selected and whether the time row is showing.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const { innerWidth: vw, innerHeight: vh } = window;
    const { left, top, width: aw, height: ah } = session.anchor;

    let y = top + ah + GAP;
    if (y + height > vh - MARGIN) {
      // Flip above the anchor, and if it does not fit there either, sit as low
      // as the viewport allows rather than running off the bottom.
      const above = top - height - GAP;
      y = above >= MARGIN ? above : Math.max(MARGIN, vh - height - MARGIN);
    }

    // Align to the left edge of the cell, then pull back inside the viewport.
    const x = Math.max(
      MARGIN,
      Math.min(left + (aw - width) / 2, vw - width - MARGIN)
    );

    setPos({ top: y, left: x });
  }, [session]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    // Capture phase, so a click on another cell closes this popover before that
    // cell's own handler opens the next one.
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="할 일 추가"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: `min(${WIDTH}px, calc(100vw - ${MARGIN * 2}px))`,
        // Laid out before it is placed, so the first paint is not at 0,0.
        visibility: pos ? "visible" : "hidden",
      }}
      className="animate-panel-in fixed z-50 rounded-xl border border-border bg-surface p-4 shadow-lg"
    >
      <TaskForm
        draft={session.draft}
        caption={session.caption}
        onClose={onClose}
      />
    </div>
  );
}

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const open = useCallback((draft: TaskDraft, caption: string, anchor: Anchor) => {
    setSession({ draft, caption, anchor });
  }, []);
  const close = useCallback(() => setSession(null), []);

  return (
    <QuickAddContext.Provider value={{ open }}>
      {children}
      {/* No SSR guard needed: the session stays null until a click, which only
          ever happens in the browser. */}
      {session &&
        createPortal(
          <Popover session={session} onClose={close} />,
          document.body
        )}
    </QuickAddContext.Provider>
  );
}

/** "8월 22일 (토)", with the hour appended when the click chose one. */
export function dayCaption(dateISO: string, time?: string): string {
  const label = formatKo(parseDateISO(dateISO), {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  return time ? `${label} · ${time}` : label;
}
