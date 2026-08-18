"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_VISUALS } from "@/app/components/task-visuals";
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
  const visuals = KIND_VISUALS[kind];
  const KindIcon = visuals.icon;
  const roomy = height >= 34;

  return (
    <button
      type="button"
      onClick={() => toggle(occurrenceDate)}
      title={`${task.title}${task.startTime ? ` · ${task.startTime}` : ""}`}
      style={{
        top,
        height,
        left: `calc(${(col * 100) / cols}% + 3px)`,
        width: `calc(${100 / cols}% - 6px)`,
      }}
      className={cn(
        "group absolute overflow-hidden rounded-lg border py-1 pl-3 pr-1.5 text-left shadow-xs transition-all",
        "hover:z-10 hover:shadow-md",
        visuals.surface,
        pending && "opacity-60",
        task.done && "opacity-55"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-1 w-[3px] rounded-full",
          visuals.rail,
          task.done && "opacity-40"
        )}
      />

      <span className="flex items-center gap-1">
        {task.done ? (
          <Check className="h-3 w-3 flex-none" strokeWidth={3.5} />
        ) : (
          <KindIcon className="h-3 w-3 flex-none opacity-70" strokeWidth={2.5} />
        )}
        <span
          className={cn(
            "truncate text-[11px] font-bold leading-tight",
            task.done && "line-through"
          )}
        >
          {task.title}
        </span>
      </span>

      {roomy && task.startTime && (
        <span className="mt-0.5 block truncate text-[9.5px] font-medium tabular-nums opacity-70">
          {task.startTime}
          {task.endTime ? `–${task.endTime}` : ""}
        </span>
      )}
    </button>
  );
}
