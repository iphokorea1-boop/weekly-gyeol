"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Dragging, on Pointer Events rather than the HTML5 drag-and-drop API.
 *
 * The HTML5 API does not fire at all on touch screens, which would have made
 * this feature useless on a phone — the device this app is most used on. Pointer
 * Events cover mouse, touch and pen through one code path.
 *
 * Drop targets are found by hit-testing the point under the pointer for a
 * `[data-drop]` ancestor, so a zone joins in by rendering data attributes and
 * needs no registration, no ref and no context subscription.
 */

export type DragKind = "routine" | "dated" | "floating";

export type DragItem = {
  taskId: string;
  title: string;
  kind: DragKind;
  /** Block length in minutes. null for a task that has no time yet. */
  durationMinutes: number | null;
  /** Whether the task stores an end time, or only a start. */
  hasEnd: boolean;
  /** How far into the block the pointer grabbed it, in minutes. */
  grabOffsetMinutes: number;
  /** The day the drag began on. Routines are not allowed to leave it. */
  originDate: string | null;
};

export type DropTarget =
  | { type: "timed"; date: string; startMinutes: number }
  | { type: "allday"; date: string }
  | { type: "backlog" }
  | { type: "month"; date: string };

/** Quarter-hour grid: fine enough to be useful, coarse enough to land on. */
const SNAP_MINUTES = 15;
export const DEFAULT_DURATION_MINUTES = 30;
/**
 * A press must travel this far before it becomes a drag. Without it every tap
 * on a task block would register as a zero-length drag and the checkbox would
 * stop toggling.
 */
const START_THRESHOLD_PX = 6;

function canDrop(item: DragItem, target: DropTarget): boolean {
  if (item.kind === "routine") {
    // A routine is defined by weekdays, not by a date. Dropping it on another
    // column would mean rewriting its whole recurrence, which would silently
    // turn a three-day routine into a one-day one. It slides in time only.
    return target.type === "timed" && target.date === item.originDate;
  }
  // A floating task is already in the backlog; highlighting it as a target
  // would promise a change that never happens.
  if (target.type === "backlog") return item.kind === "dated";
  return true;
}

function resolveTarget(x: number, y: number, item: DragItem): DropTarget | null {
  const zone = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-drop]");
  if (!zone) return null;

  let target: DropTarget | null = null;
  const date = zone.dataset.date ?? "";

  switch (zone.dataset.drop) {
    case "timed": {
      const rect = zone.getBoundingClientRect();
      const pxPerMinute = Number(zone.dataset.pxPerMinute) || 1;
      const rangeMinutes = Number(zone.dataset.rangeMinutes) || 0;
      const duration = item.durationMinutes ?? DEFAULT_DURATION_MINUTES;
      // Subtracting the grab offset is what keeps the block under the point you
      // actually picked it up by, instead of snapping its top to the cursor.
      const raw = (y - rect.top) / pxPerMinute - item.grabOffsetMinutes;
      const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
      const maxStart = Math.max(0, rangeMinutes - duration);
      target = {
        type: "timed",
        date,
        startMinutes: Math.min(Math.max(snapped, 0), maxStart),
      };
      break;
    }
    case "allday":
      target = { type: "allday", date };
      break;
    case "backlog":
      target = { type: "backlog" };
      break;
    case "month":
      target = { type: "month", date };
      break;
  }

  return target && canDrop(item, target) ? target : null;
}

type DragContextValue = {
  item: DragItem | null;
  target: DropTarget | null;
  /** Call from onPointerDown on whatever should be draggable. */
  begin: (item: DragItem, event: ReactPointerEvent<HTMLElement>) => void;
};

const DragContext = createContext<DragContextValue | null>(null);

export function useDrag(): DragContextValue {
  const value = useContext(DragContext);
  if (!value) throw new Error("useDrag must be used inside a DragProvider");
  return value;
}

export function DragProvider({
  onDrop,
  children,
}: {
  onDrop: (item: DragItem, target: DropTarget) => void;
  children: ReactNode;
}) {
  const [item, setItem] = useState<DragItem | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  // The gesture lives in a ref because the window listeners below are attached
  // once; reading it from state would hand them a closure over the first render.
  const gesture = useRef<{
    item: DragItem;
    x: number;
    y: number;
    started: boolean;
  } | null>(null);
  const targetRef = useRef<DropTarget | null>(null);
  const onDropRef = useRef(onDrop);

  useEffect(() => {
    onDropRef.current = onDrop;
  });

  const begin = useCallback(
    (next: DragItem, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return; // left button / primary touch only
      gesture.current = {
        item: next,
        x: event.clientX,
        y: event.clientY,
        started: false,
      };
      // Capture keeps the events coming even when the pointer runs off the
      // element, which it does immediately in any real drag.
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    []
  );

  useEffect(() => {
    function reset() {
      gesture.current = null;
      targetRef.current = null;
      setItem(null);
      setTarget(null);
      setPoint(null);
      document.body.style.removeProperty("user-select");
    }

    function handleMove(event: PointerEvent) {
      const g = gesture.current;
      if (!g) return;

      if (!g.started) {
        const travelled = Math.hypot(event.clientX - g.x, event.clientY - g.y);
        if (travelled < START_THRESHOLD_PX) return;
        g.started = true;
        setItem(g.item);
        document.body.style.userSelect = "none";
      }

      // Stops the text selection a mouse drag would otherwise paint across the
      // page, and the scroll a touch drag would trigger.
      event.preventDefault();
      setPoint({ x: event.clientX, y: event.clientY });
      const next = resolveTarget(event.clientX, event.clientY, g.item);
      targetRef.current = next;
      setTarget(next);
    }

    function handleUp() {
      const g = gesture.current;
      const landed = targetRef.current;
      const dragged = g?.started ?? false;
      reset();
      if (!dragged || !g) return;

      // Releasing after a drag also fires a click, which would toggle the task
      // you just moved — or, in the month grid, follow the link the chip sits
      // inside. Swallow exactly one, in the capture phase, before it reaches
      // anything. A tap that never became a drag never gets here, so tapping
      // still works normally.
      const swallow = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(
        () => window.removeEventListener("click", swallow, { capture: true }),
        300
      );

      if (landed) onDropRef.current(g.item, landed);
    }

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      document.body.style.removeProperty("user-select");
    };
  }, []);

  return (
    <DragContext.Provider value={{ item, target, begin }}>
      {children}
      {/* No SSR guard needed: both values stay null until a pointer event,
          which only ever happens in the browser. */}
      {item &&
        point &&
        createPortal(
          <div
            aria-hidden
            className="drag-ghost"
            style={{ left: point.x, top: point.y }}
          >
            {item.title}
          </div>,
          document.body
        )}
    </DragContext.Provider>
  );
}
