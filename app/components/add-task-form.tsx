"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import TaskForm, { emptyDraft } from "@/app/components/task-form";

/** The always-available add button on the today page. */
export default function AddTaskForm() {
  const [open, setOpen] = useState(false);

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
    <div className="animate-panel-in rounded-xl border border-border bg-surface p-4 shadow-sm">
      {/* Mounted only while open, so every reopen starts from a clean draft. */}
      <TaskForm draft={emptyDraft()} onClose={() => setOpen(false)} />
    </div>
  );
}
