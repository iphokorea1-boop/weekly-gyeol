"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function useTaskActions(taskId: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle(date: Date = new Date()) {
    setPending(true);
    await fetch(`/api/tasks/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: date.toISOString() }),
    });
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

  return { pending, toggle, remove, assignToDate };
}
