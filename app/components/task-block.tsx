"use client";

import { KIND_STYLE } from "@/app/components/task-item";
import { useTaskActions } from "@/app/components/use-task-actions";

export type TaskBlockData = {
  id: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  done: boolean;
};

export default function TaskBlock({
  task,
  kind,
  top,
  height,
  occurrenceDate,
  col = 0,
  cols = 1,
}: {
  task: TaskBlockData;
  kind: "routine" | "dated";
  top: number;
  height: number;
  occurrenceDate: Date;
  col?: number;
  cols?: number;
}) {
  const { pending, toggle } = useTaskActions(task.id);
  const showTime = task.startTime && height >= 28;

  return (
    <button
      type="button"
      onClick={() => toggle(occurrenceDate)}
      style={{
        top,
        height,
        left: `calc(${(col * 100) / cols}% + 3px)`,
        width: `calc(${100 / cols}% - 6px)`,
      }}
      className={`absolute overflow-hidden rounded-[7px] px-[7px] py-1 text-left text-[11px] font-semibold leading-tight ${
        KIND_STYLE[kind]
      } ${pending ? "opacity-60" : ""} ${task.done ? "opacity-50" : ""}`}
    >
      <span className={`block truncate ${task.done ? "line-through" : ""}`}>
        {task.title}
      </span>
      {showTime && (
        <span className="mt-0.5 block truncate text-[9.5px] font-medium tabular-nums opacity-75">
          {task.startTime}
          {task.endTime ? `–${task.endTime}` : ""}
        </span>
      )}
    </button>
  );
}
