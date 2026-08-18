"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function useTaskActions(taskId: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  // Non-null while the "+N XP" burst is on screen after a completion.
  const [burst, setBurst] = useState<number | null>(null);

  async function toggle(date: Date = new Date(), xp?: number) {
    setPending(true);
    const res = await fetch(`/api/tasks/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: date.toISOString() }),
    });
    const result = await res.json().catch(() => ({ completed: false }));
    if (result.completed && xp) {
      setBurst(xp);
      setTimeout(() => setBurst(null), 900);
    }
    router.refresh();
    setPending(false);
  }

  async function remove() {
    setPending(true);
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    router.refresh();
  }

  async function assignToDate(date: Date) {
    setPending(true);
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: date.toISOString() }),
    });
    router.refresh();
    setPending(false);
  }

  return { pending, burst, toggle, remove, assignToDate };
}
