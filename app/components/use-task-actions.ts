"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * A single short tap. Android honours this; iOS Safari ignores it entirely, so
 * it's a bonus on the devices that support it rather than part of the design.
 */
function tapFeedback() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(8);
  }
}

/**
 * @param serverDone completion state from the last server render, used as the
 *   baseline the optimistic override reconciles against.
 */
export function useTaskActions(taskId: string, serverDone = false) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  // Non-null while the "+N XP" burst is on screen after a completion.
  const [burst, setBurst] = useState<number | null>(null);
  // Non-null while a local guess is overriding the server's answer.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  // True for the length of the completion flourish (ring pulse, tick draw).
  const [celebrating, setCelebrating] = useState(false);

  // Drop the override as soon as a refreshed server render disagrees with the
  // value we last saw. Keying this to serverDone rather than a timer matters: a
  // fixed delay would expire mid-request on a slow connection and flash the old
  // state back. Adjusted during render rather than in an effect — React's
  // documented pattern for resetting state on a prop change, and it avoids the
  // extra commit an effect would cost.
  const [seenServerDone, setSeenServerDone] = useState(serverDone);
  if (seenServerDone !== serverDone) {
    setSeenServerDone(serverDone);
    setOptimistic(null);
  }

  const done = optimistic ?? serverDone;

  async function toggle(date: Date = new Date(), xp?: number) {
    const next = !done;

    // Paint first, ask the server second. The round-trip to Neon is 100-300ms
    // from Korea; waiting for it before filling the checkbox is what made
    // tapping feel unresponsive, and no amount of easing fixes a delayed start.
    setOptimistic(next);
    tapFeedback();

    if (next) {
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 520);
      if (xp) {
        setBurst(xp);
        setTimeout(() => setBurst(null), 950);
      }
    }

    const res = await fetch(`/api/tasks/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: date.toISOString() }),
    });
    const result = await res.json().catch(() => null);

    // Correct the guess if the server disagreed — a double tap or a lost race
    // can land the two out of step.
    if (result && typeof result.completed === "boolean" && result.completed !== next) {
      setOptimistic(result.completed);
    }
    router.refresh();
  }

  async function remove() {
    setPending(true);
    tapFeedback();
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    router.refresh();
  }

  async function assignToDate(date: Date) {
    setPending(true);
    tapFeedback();
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: date.toISOString() }),
    });
    router.refresh();
    setPending(false);
  }

  return { pending, burst, done, celebrating, toggle, remove, assignToDate };
}
