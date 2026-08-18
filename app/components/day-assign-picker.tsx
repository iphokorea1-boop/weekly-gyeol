"use client";

import { useState } from "react";
import { weekdayLabel, weekdayOf } from "@/lib/task-utils";
import { useTaskActions } from "@/app/components/use-task-actions";

export default function DayAssignPicker({
  taskId,
  weekDates,
}: {
  taskId: string;
  weekDates: Date[];
}) {
  const [open, setOpen] = useState(false);
  const { pending, assignToDate } = useTaskActions(taskId);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="pressable text-[10px] font-semibold text-floating-ink underline decoration-dotted underline-offset-2 hover:opacity-70"
      >
        이 날로 옮기기
      </button>
    );
  }

  return (
    <div className="animate-panel-in flex flex-wrap items-center gap-1">
      {weekDates.map((date) => (
        <button
          key={date.toISOString()}
          type="button"
          disabled={pending}
          onClick={() => assignToDate(date)}
          className="pressable press-deep grid h-5 w-5 place-items-center rounded-full border border-floating text-[10px] font-semibold text-floating-ink hover:bg-floating-soft"
        >
          {weekdayLabel(weekdayOf(date))}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="pressable px-1 text-[10px] text-ink-faint hover:text-ink"
        aria-label="취소"
      >
        ×
      </button>
    </div>
  );
}
