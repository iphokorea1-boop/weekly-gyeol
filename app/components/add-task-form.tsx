"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Kind = "dated" | "routine" | "floating";

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
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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
        className="w-full rounded-lg border border-dashed border-border-strong px-3 py-2 text-left text-sm text-ink-faint transition-colors hover:border-dated hover:text-dated-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dated"
      >
        + 할 일 추가
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="무엇을 해야 하나요?"
        className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-dated"
      />

      <div className="flex gap-1.5 text-xs">
        {(
          [
            ["dated", "날짜 있는 할 일"],
            ["routine", "정기 루틴"],
            ["floating", "언젠가 할 일"],
          ] as [Kind, string][]
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            onClick={() => setKind(value)}
            className={`rounded-full border px-2.5 py-1 transition-colors ${
              kind === value
                ? "border-dated bg-dated-soft text-dated-ink font-medium"
                : "border-border text-ink-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {kind === "dated" && (
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-dated"
        />
      )}

      {kind === "routine" && (
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((w) => (
            <button
              type="button"
              key={w.value}
              onClick={() => toggleWeekday(w.value)}
              className={`h-7 w-7 rounded-full border text-xs transition-colors ${
                weekdays.includes(w.value)
                  ? "border-routine bg-routine-soft text-routine-ink font-semibold"
                  : "border-border text-ink-soft"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}

      {kind !== "floating" && (
        <div className="flex gap-2">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-dated"
          />
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-dated"
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
          className="rounded-md px-3 py-1.5 text-ink-soft hover:bg-surface-sunk"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="rounded-md bg-dated px-3 py-1.5 font-medium text-white disabled:opacity-50"
        >
          추가
        </button>
      </div>
    </form>
  );
}
