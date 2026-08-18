"use client";

import type { ReactNode } from "react";
import type { TaskKind } from "@/lib/task-utils";
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

export const KIND_STYLE: Record<TaskKind, string> = {
  routine:
    "border-l-[3px] border-routine text-routine-ink bg-[repeating-linear-gradient(45deg,var(--routine-soft)_0_6px,transparent_6px_12px)]",
  dated: "border-l-[3px] border-dated text-dated-ink bg-dated-soft",
  floating:
    "border border-dashed border-floating text-floating-ink bg-floating-soft rounded-lg",
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

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 text-sm ${
        kind === "floating" ? "" : "rounded-md"
      } ${KIND_STYLE[kind]} ${pending ? "opacity-60" : ""} ${
        task.done ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => toggle()}
        aria-label={task.done ? "완료 취소" : "완료로 표시"}
        aria-pressed={task.done}
        className="grid h-4 w-4 flex-none place-items-center rounded-full border-[1.5px] border-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {task.done && (
          <span className="block h-[5px] w-[7px] -translate-y-px rotate-[-45deg] border-b-[1.5px] border-l-[1.5px] border-current" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <span className={`font-medium ${task.done ? "line-through" : ""}`}>
          {task.title}
        </span>
        {task.overdue && (
          <span className="ml-2 rounded bg-routine/20 px-1.5 py-0.5 text-[10px] font-semibold text-routine-ink">
            지남
          </span>
        )}
        {(task.startTime || task.weekdaysLabel) && (
          <div className="mt-0.5 text-[11px] tabular-nums opacity-75">
            {task.weekdaysLabel ? `${task.weekdaysLabel} · ` : ""}
            {task.startTime}
            {task.endTime ? `–${task.endTime}` : ""}
          </div>
        )}
        {extra && <div className="mt-1">{extra}</div>}
      </div>

      <button
        type="button"
        onClick={remove}
        aria-label="삭제"
        className="flex-none rounded px-1.5 py-0.5 text-xs text-ink-faint opacity-0 transition-opacity hover:text-routine group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        ×
      </button>
    </div>
  );
}
