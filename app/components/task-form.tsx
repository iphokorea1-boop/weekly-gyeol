"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { KIND_VISUALS } from "@/app/components/task-visuals";
import { formatDateISO, todayInSeoul } from "@/lib/task-utils";

export type DraftKind = "dated" | "routine" | "floating";

/**
 * Everything the form starts out holding except the title, which always starts
 * empty. Split out so a calendar cell can hand the form a day — and, in the
 * weekly grid, an hour — that the user has already chosen by clicking.
 */
export type TaskDraft = {
  kind: DraftKind;
  /** `YYYY-MM-DD`. */
  dueDate: string;
  /** `HH:MM`, or "" for no time. */
  startTime: string;
  endTime: string;
  weekdays: number[];
};

export function emptyDraft(): TaskDraft {
  return {
    kind: "dated",
    dueDate: formatDateISO(todayInSeoul()),
    startTime: "",
    endTime: "",
    weekdays: [],
  };
}

const KINDS: DraftKind[] = ["dated", "routine", "floating"];

const WEEKDAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 0, label: "일" },
];

const inputClass =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-dated focus:ring-2 focus:ring-dated/25";

/**
 * The add-a-task fields, with no opinion about where they are drawn.
 *
 * The state starts from `draft` and is never synced back to it: the component
 * is unmounted when it closes, so reopening on another day mounts a fresh copy
 * rather than leaving half-typed state from the previous day behind.
 */
export default function TaskForm({
  draft,
  caption,
  onClose,
  submitLabel = "추가",
}: {
  draft: TaskDraft;
  /** Which day (and time) this was opened on. Omitted on the today page. */
  caption?: string;
  onClose: () => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<DraftKind>(draft.kind);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(draft.dueDate);
  const [startTime, setStartTime] = useState(draft.startTime);
  const [endTime, setEndTime] = useState(draft.endTime);
  const [weekdays, setWeekdays] = useState<number[]>(draft.weekdays);
  const [submitting, setSubmitting] = useState(false);

  function toggleWeekday(v: number) {
    setWeekdays((prev) =>
      prev.includes(v) ? prev.filter((w) => w !== v) : [...prev, v]
    );
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
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      {caption && (
        <p className="text-xs font-bold tabular-nums text-dated-ink">
          {caption}
        </p>
      )}

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
          onClick={onClose}
          className="pressable rounded-lg px-3.5 py-2 font-medium text-ink-soft hover:bg-surface-sunk"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="pressable lift rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
