"use client";

import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { TaskKind } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import { KIND_VISUALS } from "@/app/components/task-visuals";
import { useTaskActions } from "@/app/components/use-task-actions";

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
};

export default function TaskItem({
  task,
  kind,
  extra,
  index = 0,
}: {
  task: TaskItemData;
  kind: TaskKind;
  extra?: ReactNode;
  /** Position in its list, used to stagger the entrance. */
  index?: number;
}) {
  const { pending, burst, done, celebrating, toggle, remove } = useTaskActions(
    task.id,
    task.done
  );
  const visuals = KIND_VISUALS[kind];
  const KindIcon = visuals.icon;
  const meta = [task.weekdaysLabel, task.startTime && task.endTime
    ? `${task.startTime}–${task.endTime}`
    : task.startTime]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      // Capped at 6 so a long list doesn't leave the last rows visibly waiting.
      style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
      className={cn(
        "pressable press-soft lift animate-item-in group relative flex items-center gap-2.5 rounded-xl border py-2.5 pl-5 pr-2.5",
        visuals.surface,
        pending && "opacity-60",
        done && "opacity-60"
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

      <div className="relative flex-none">
        <button
          type="button"
          onClick={() => toggle(task.occurrenceDate ?? new Date(), task.xp)}
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
