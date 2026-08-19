"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
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
  onDragPointerDown,
  dragging = false,
}: {
  task: TaskBlockData;
  kind: "routine" | "dated";
  top: number;
  height: number;
  occurrenceDate: Date;
  col?: number;
  cols?: number;
  /** Present makes the whole block draggable. */
  onDragPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  dragging?: boolean;
}) {
  const { pending, done, celebrating, toggle } = useTaskActions(
    task.id,
    task.done
  );
  const visuals = KIND_VISUALS[kind];
  const KindIcon = visuals.icon;
  const roomy = height >= 34;

  return (
    <button
      type="button"
      onClick={() => toggle(occurrenceDate)}
      onPointerDown={onDragPointerDown}
      title={`${task.title}${task.startTime ? ` · ${task.startTime}` : ""}`}
      style={{
        top,
        height,
        left: `calc(${(col * 100) / cols}% + 3px)`,
        width: `calc(${100 / cols}% - 6px)`,
        // Overrides .pressable's `manipulation`. Without it the browser claims
        // the gesture for scrolling and a touch drag never starts.
        touchAction: onDragPointerDown ? "none" : undefined,
      }}
      className={cn(
        "pressable lift group absolute overflow-hidden rounded-lg border py-1 pl-3 pr-1.5 text-left",
        "hover:z-10",
        visuals.surface,
        onDragPointerDown && "cursor-grab active:cursor-grabbing",
        pending && "opacity-60",
        done && "opacity-55",
        // Faded, but still hit-testable: the drop resolver walks up from
        // whatever is under the pointer to find the day column, and that path
        // runs straight through this block.
        dragging && "opacity-25"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 left-1 w-[3px] rounded-full transition-opacity duration-300",
          visuals.rail,
          done && "opacity-40"
        )}
      />

      <span className="flex items-center gap-1">
        {done ? (
          <Check
            className={cn("h-3 w-3 flex-none", celebrating && "check-draw")}
            strokeWidth={3.5}
          />
        ) : (
          <KindIcon className="h-3 w-3 flex-none opacity-70" strokeWidth={2.5} />
        )}
        <span
          className={cn(
            "truncate text-[11px] font-bold leading-tight",
            done && "line-through"
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
