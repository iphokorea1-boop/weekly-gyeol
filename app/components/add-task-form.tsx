"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_VISUALS } from "@/app/components/task-visuals";
import { formatDateISO, todayInSeoul } from "@/lib/task-utils";

type Kind = "dated" | "routine" | "floating";

const KINDS: Kind[] = ["dated", "routine", "floating"];

const WEEKDAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 0, label: "일" },
];

function todayInputValue() {
  return formatDateISO(todayInSeoul());
}

const inputClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-dated focus:ring-2 focus:ring-dated/25";

export default function AddTaskForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("dated");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(todayInputValue());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleWeekday(v: number) {
    setWeekdays((prev) =>
      prev.includes(v) ? prev.filter((w) => w !== v) : [...prev, v]
    );
  }

  function reset() {
    setTitle("");
    setStartTime("");
    setEndTime("");
    setWeekdays([]);
    setDueDate(todayInputValue());
    setKind("dated");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);

    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        dueDate: kind === "dated" ? dueDate : null,
        weekdays: kind === "routine" ? weekdays.sort().join(",") : null,
        startTime: startTime || null,
        endTime: endTime || null,
      }),
    });

    setSubmitting(false);
    reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pressable group flex w-full items-center gap-2 rounded-xl border border-dashed border-border-strong px-3.5 py-3 text-sm font-medium text-ink-soft hover:border-dated hover:bg-dated-soft hover:text-dated-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dated"
      >
        <Plus
          className="h-4 w-4 transition-[rotate] duration-300 ease-[var(--ease-spring)] group-hover:rotate-90"
          strokeWidth={2.5}
        />
        할 일 추가
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="animate-panel-in flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="무엇을 해야 하나요?"
        className={cn(inputClass, "text-[15px] font-medium")}
      />

      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((value) => {
          const visuals = KIND_VISUALS[value];
          const Icon = visuals.icon;
          const active = kind === value;
          return (
            <button
              type="button"
              key={value}
              onClick={() => setKind(value)}
              className={cn(
                "pressable press-deep flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
                active
                  ? visuals.surface
                  : "border-border text-ink-soft hover:bg-surface-sunk"
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
              {visuals.label}
            </button>
          );
        })}
      </div>

      {kind === "dated" && (
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputClass}
        />
      )}

      {kind === "routine" && (
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((w) => (
            <button
              type="button"
              key={w.value}
              onClick={() => toggleWeekday(w.value)}
              className={cn(
                "pressable press-deep h-9 w-9 rounded-full border text-xs font-bold",
                weekdays.includes(w.value)
                  ? "border-routine-line bg-routine-soft text-routine-ink"
                  : "border-border text-ink-soft hover:bg-surface-sunk"
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}

      {kind !== "floating" && (
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={cn(inputClass, "w-full tabular-nums")}
          />
          <span className="text-ink-faint">–</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={cn(inputClass, "w-full tabular-nums")}
          />
        </div>
      )}

      <div className="flex justify-end gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="pressable rounded-lg px-3.5 py-2 font-medium text-ink-soft hover:bg-surface-sunk"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="pressable lift rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-40"
        >
          추가
        </button>
      </div>
    </form>
  );
}
