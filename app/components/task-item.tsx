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
};

export default function TaskItem({
  task,
  kind,
  extra,
}: {
  task: TaskItemData;
  kind: TaskKind;
  extra?: ReactNode;
}) {
  const { pending, toggle, remove } = useTaskActions(task.id);
  const visuals = KIND_VISUALS[kind];
  const KindIcon = visuals.icon;
  const meta = [task.weekdaysLabel, task.startTime && task.endTime
    ? `${task.startTime}–${task.endTime}`
    : task.startTime]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5 rounded-xl border py-2.5 pl-5 pr-2.5 shadow-xs transition-all",
        "hover:-translate-y-px hover:shadow-sm",
        visuals.surface,
        pending && "opacity-60",
        task.done && "opacity-60"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-1.5 w-1 rounded-full transition-opacity",
          visuals.rail,
          task.done && "opacity-40"
        )}
      />

      <button
        type="button"
        onClick={() => toggle()}
        aria-label={task.done ? "완료 취소" : "완료로 표시"}
        aria-pressed={task.done}
        className={cn(
          "grid h-5 w-5 flex-none place-items-center rounded-full border-2 transition-all",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
          task.done ? cn("border-transparent", visuals.check) : visuals.checkIdle
        )}
      >
        {task.done && <Check className="h-3 w-3" strokeWidth={3.5} />}
      </button>

      <KindIcon
        aria-label={visuals.label}
        className="h-3.5 w-3.5 flex-none opacity-70"
        strokeWidth={2.25}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "truncate text-sm font-semibold",
              task.done && "line-through"
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
          "flex-none rounded-md p-1 text-current opacity-0 transition-all",
          "hover:bg-black/5 hover:text-destructive group-hover:opacity-60",
          "focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
        )}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
