"use client";

import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Check, GripVertical, X } from "lucide-react";
import type { TaskKind } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import { KIND_VISUALS } from "@/app/components/task-visuals";
import TaskForm, { type TaskDraft } from "@/app/components/task-form";
import { useTaskActions } from "@/app/components/use-task-actions";

/**
 * How close together two taps have to be — in time, and on screen — to count
 * as one gesture rather than two.
 *
 * Both are deliberately forgiving. A finger wanders between taps far more than
 * a mouse does, and the cost of being generous here is nil: a single tap on
 * this row does nothing at all, so a pair read where none was meant opens a
 * form that one press of 취소 closes. Being strict costs a gesture that
 * silently fails, which is the worse of the two.
 */
const DOUBLE_TAP_MS = 450;
const DOUBLE_TAP_PX = 40;

export type TaskItemData = {
  id: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  weekdaysLabel?: string;
  done: boolean;
  overdue?: boolean;
  xp?: number;
  /**
   * Which day's occurrence the checkbox toggles. Dated tasks must record
   * against their due date — recording an overdue task against today would
   * write a completion the due-date lookup never finds, leaving it stuck
   * unchecked. Routines and backlog items just use today.
   */
  occurrenceDate?: Date;
  /**
   * Present makes the row editable: a double tap swaps it for the task form,
   * opened on these values. Absent leaves the row read-only, which is what the
   * weekly board's 248px backlog column wants — the form does not fit there.
   */
  editDraft?: TaskDraft;
};

export default function TaskItem({
  task,
  kind,
  extra,
  index = 0,
  onDragPointerDown,
  dragging = false,
  leaving = false,
  onToggle,
}: {
  task: TaskItemData;
  kind: TaskKind;
  extra?: ReactNode;
  /** Position in its list, used to stagger the entrance. */
  index?: number;
  /**
   * Set while the row is on its way out of this list. Only the owning list
   * knows a row is leaving — the row itself cannot tell a completion from a
   * completion that is about to be filed somewhere else.
   */
  leaving?: boolean;
  /**
   * Fired with the state the tap is heading for, at the moment it is tapped
   * rather than when the server confirms. A list that groups by completion
   * needs to know as early as the checkbox does.
   */
  onToggle?: (done: boolean) => void;
  /**
   * Present adds a drag grip. The grip rather than the whole row, because a
   * row fills the list's width — making all of it drag-on-touch would leave
   * no way to scroll the list on a phone.
   */
  onDragPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  dragging?: boolean;
}) {
  const { pending, burst, done, celebrating, toggle, remove } = useTaskActions(
    task.id,
    task.done
  );
  const [editing, setEditing] = useState(false);
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);

  // Mounted only while editing, so a cancelled edit leaves nothing behind and
  // the next one opens on the row as it stands by then rather than on the
  // values it held the first time.
  if (editing && task.editDraft) {
    return (
      // w-full so the panel claims its own line in the 미배치함 section,
      // whose rows sit in a wrapping flex row rather than a column.
      <div className="animate-panel-in w-full rounded-xl border border-border bg-surface p-4 shadow-sm">
        <TaskForm
          taskId={task.id}
          draft={task.editDraft}
          onClose={() => setEditing(false)}
          submitLabel="저장"
        />
      </div>
    );
  }

  const visuals = KIND_VISUALS[kind];
  const KindIcon = visuals.icon;
  const meta = [task.weekdaysLabel, task.startTime && task.endTime
    ? `${task.startTime}–${task.endTime}`
    : task.startTime]
    .filter(Boolean)
    .join(" · ");

  /**
   * Two taps rather than one. A single tap on a row is how you scroll past it
   * on a phone, and the controls inside the row already answer to one — so a
   * single tap opening a form would take the checkbox's gesture away from it.
   *
   * The pair is counted here rather than left to the browser's `dblclick`.
   * That event is dependable under a mouse and not under a finger: once
   * `.pressable`'s `touch-action: manipulation` tells the browser it need not
   * wait to see whether a second tap means "zoom", mobile browsers stop
   * synthesising the double event and report two ordinary taps instead — which
   * is why the first version of this did nothing on a phone. Counting clicks
   * covers both, because a tap is a click everywhere.
   */
  function handleTap(event: ReactMouseEvent<HTMLDivElement>) {
    // The checkbox, the drag grip and the delete button own their own taps, and
    // a tap one of them has answered cannot be half of this gesture.
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input")
    ) {
      lastTap.current = null;
      return;
    }

    const now = Date.now();
    const previous = lastTap.current;
    lastTap.current = { at: now, x: event.clientX, y: event.clientY };

    if (
      !previous ||
      now - previous.at > DOUBLE_TAP_MS ||
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) >
        DOUBLE_TAP_PX
    ) {
      return;
    }

    lastTap.current = null;
    // A double click selects the word under it. Cleared here so a highlight
    // doesn't flash across the title as the form takes the row's place.
    window.getSelection()?.removeAllRanges();
    setEditing(true);
  }

  return (
    <div
      onClick={task.editDraft ? handleTap : undefined}
      // Capped at 6 so a long list doesn't leave the last rows visibly waiting.
      style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
      className={cn(
        "pressable press-soft lift animate-item-in group relative flex items-center gap-2.5 rounded-xl border py-2.5 pl-5 pr-2.5",
        visuals.surface,
        // Also what makes the tap register on iOS, which drops delegated click
        // events on elements it has not been told are interactive.
        task.editDraft && "cursor-pointer",
        pending && "opacity-60",
        done && "opacity-60",
        dragging && "opacity-25",
        leaving && "animate-item-out"
      )}
    >
      {/* Clipped by its own wrapper rather than the row, so the row can still
          let the XP burst escape above its top edge. */}
      {celebrating && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
        >
          <span className="animate-complete-sweep complete-sweep-fill absolute inset-0" />
        </span>
      )}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-1.5 w-1 rounded-full transition-opacity duration-300",
          visuals.rail,
          done && "opacity-40"
        )}
      />

      {onDragPointerDown && (
        <span
          aria-hidden
          onPointerDown={onDragPointerDown}
          style={{ touchAction: "none" }}
          className="-ml-2 flex-none cursor-grab rounded p-0.5 opacity-40 hover:opacity-80 active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      )}

      <div className="relative flex-none">
        <button
          type="button"
          onClick={() => {
            onToggle?.(!done);
            toggle(task.occurrenceDate ?? new Date(), task.xp);
          }}
          aria-label={done ? "완료 취소" : "완료로 표시"}
          aria-pressed={done}
          className={cn(
            "pressable press-deep grid h-5 w-5 place-items-center rounded-full border-2",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
            done ? cn("border-transparent", visuals.check) : visuals.checkIdle,
            celebrating && "animate-check-pop"
          )}
        >
          {done && (
            <Check
              className={cn("h-3 w-3", celebrating && "check-draw")}
              strokeWidth={3.5}
            />
          )}
        </button>
        {celebrating && (
          <span
            aria-hidden
            className={cn(
              "animate-ring-pulse pointer-events-none absolute inset-0 rounded-full border-2",
              visuals.checkIdle
            )}
          />
        )}
        {burst && (
          <span
            aria-hidden
            className="animate-xp-burst pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-extrabold whitespace-nowrap"
          >
            +{burst}
          </span>
        )}
      </div>

      <KindIcon
        aria-label={visuals.label}
        className="h-3.5 w-3.5 flex-none opacity-70"
        strokeWidth={2.25}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "truncate text-sm font-semibold transition-opacity duration-300",
              done && "line-through"
            )}
          >
            {task.title}
          </span>
          {task.overdue && (
            <span className="flex-none rounded-full bg-destructive/15 px-1.5 py-px text-[10px] font-bold text-destructive">
              지남
            </span>
          )}
        </div>
        {meta && (
          <div className="mt-0.5 text-[11px] font-medium tabular-nums opacity-75">
            {meta}
          </div>
        )}
        {extra && <div className="mt-1.5">{extra}</div>}
      </div>

      <button
        type="button"
        onClick={remove}
        aria-label="삭제"
        className={cn(
          "pressable press-deep flex-none rounded-md p-1 text-current opacity-0",
          "hover:bg-black/5 hover:text-destructive group-hover:opacity-60",
          "focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
        )}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
