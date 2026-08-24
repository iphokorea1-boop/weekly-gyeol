"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TaskKind } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import TaskItem, { type TaskItemData } from "@/app/components/task-item";

/**
 * Today's three lists, plus the place finished rows collect.
 *
 * This has to be a client component because it decides *where a row lives*,
 * and that decision has to happen the instant a checkbox is tapped. Leaving it
 * to the server render would mean the row sat in place until `router.refresh()`
 * came back — a few hundred milliseconds from Korea to Neon and back — which is
 * exactly the delay the optimistic checkbox in use-task-actions.ts exists to
 * avoid. Splitting the lists on the server would have quietly reintroduced it.
 */

/**
 * How long a checked row stays where it was tapped.
 *
 * Everything that says "this is done" happens where the finger already is: the
 * ring pulses outward, the tick draws itself, a sweep crosses the row, the XP
 * rises off the top edge. Moving the row out from under all that would cut it
 * in half and take the feedback with it. So the row waits for the sweep to
 * finish, plays its own exit, and only then moves.
 */
const HOLD_MS = 620;
const EXIT_MS = 160;

/**
 * Someone who has asked for less motion has no animation to wait for, and a
 * row that lingers for three quarters of a second with nothing happening reads
 * as the app being slow rather than as deliberate.
 */
function moveDelay(): number {
  if (typeof window === "undefined") return HOLD_MS + EXIT_MS;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : HOLD_MS + EXIT_MS;
}

/** Checked, but not yet moved: "hold" is the celebration, "exit" the fade. */
type Phase = "hold" | "exit";

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-xs font-bold tracking-wide text-ink-faint">{title}</h2>
      {count > 0 && (
        <span className="text-xs font-semibold tabular-nums text-ink-faint/80">
          {count}
        </span>
      )}
    </div>
  );
}

function Empty({ children, wide }: { children: string; wide?: boolean }) {
  return (
    <p
      className={cn(
        "rounded-lg border border-dashed border-border px-3 py-3 text-sm text-ink-faint",
        wide && "w-full"
      )}
    >
      {children}
    </p>
  );
}

export default function TodayBoard({
  dated,
  routines,
  floating,
}: {
  dated: TaskItemData[];
  routines: TaskItemData[];
  floating: TaskItemData[];
}) {
  /**
   * Which side of the board a row belongs on. Deliberately not the same
   * question as whether its checkbox is filled — the checkbox flips the moment
   * it is tapped, placement waits. Absent means "whatever the server said".
   */
  const [placed, setPlaced] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [showDone, setShowDone] = useState(true);

  // Unchecking during the hold has to cancel the move that was already booked,
  // or the row would jump to 완료 a moment after being un-completed.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({});

  const entries: { kind: TaskKind; task: TaskItemData }[] = [
    ...dated.map((task) => ({ kind: "dated" as const, task })),
    ...routines.map((task) => ({ kind: "routine" as const, task })),
    ...floating.map((task) => ({ kind: "floating" as const, task })),
  ];

  /**
   * Retire placements the server has caught up with.
   *
   * Without this a local guess would outlive its usefulness: a completion
   * undone on a phone would come back from the server as `done: false` while
   * this board still filed the row under 완료, leaving an unchecked row sitting
   * in the finished list. Adjusted during render rather than in an effect —
   * React's documented way to reset state on changed props, and the pattern
   * use-task-actions.ts already follows.
   */
  const serverSig = entries
    .map(({ task }) => `${task.id}${task.done ? "1" : "0"}`)
    .join(",");
  const [seenSig, setSeenSig] = useState(serverSig);
  if (seenSig !== serverSig) {
    setSeenSig(serverSig);
    setPlaced((prev) => {
      const server = new Map(entries.map(({ task }) => [task.id, task.done]));
      const next: Record<string, boolean> = {};
      for (const [id, guess] of Object.entries(prev)) {
        // Kept only while it still disagrees with the server; once the two
        // match the guess is redundant, and once the row is gone it is stale.
        if (server.has(id) && server.get(id) !== guess) next[id] = guess;
      }
      return next;
    });
  }

  const isDone = (task: TaskItemData) =>
    phase[task.id] ? false : (placed[task.id] ?? task.done);

  function clearTimers(id: string) {
    for (const timer of timers.current[id] ?? []) clearTimeout(timer);
    delete timers.current[id];
  }

  function drop(record: Record<string, unknown>, id: string) {
    const next = { ...record };
    delete next[id];
    return next;
  }

  function handleToggle(id: string, next: boolean) {
    clearTimers(id);

    // Un-completing moves the row back at once. There is no flourish to wait
    // out, and a row that lingered in 완료 after being unchecked would read as
    // the tap having missed.
    if (!next) {
      setPhase((p) => drop(p, id) as Record<string, Phase>);
      setPlaced((p) => ({ ...p, [id]: false }));
      return;
    }

    const delay = moveDelay();
    if (delay === 0) {
      setPlaced((p) => ({ ...p, [id]: true }));
      return;
    }

    setPhase((p) => ({ ...p, [id]: "hold" }));
    timers.current[id] = [
      setTimeout(() => setPhase((p) => ({ ...p, [id]: "exit" })), HOLD_MS),
      setTimeout(() => {
        setPhase((p) => drop(p, id) as Record<string, Phase>);
        setPlaced((p) => ({ ...p, [id]: true }));
        delete timers.current[id];
      }, delay),
    ];
  }

  /**
   * The board's own answer, not the server's, is what the row is told. A row
   * moving between the two lists is unmounted and mounted again, so whatever
   * optimistic state TaskItem was holding dies with it — handed the stale
   * server value, a row would land in 완료 with an empty checkbox.
   */
  const render = (
    { kind, task }: { kind: TaskKind; task: TaskItemData },
    index: number
  ) => (
    <TaskItem
      key={task.id}
      kind={kind}
      task={{ ...task, done: isDone(task) }}
      index={index}
      leaving={phase[task.id] === "exit"}
      onToggle={(next) => handleToggle(task.id, next)}
    />
  );

  const openDated = entries.filter((e) => e.kind === "dated" && !isDone(e.task));
  const openRoutines = entries.filter(
    (e) => e.kind === "routine" && !isDone(e.task)
  );
  const openFloating = entries.filter(
    (e) => e.kind === "floating" && !isDone(e.task)
  );
  const finished = entries.filter((e) => isDone(e.task));

  return (
    <>
      <section className="flex flex-col gap-2">
        <SectionHeading title="오늘 할 일" count={openDated.length} />
        <div className="flex flex-col gap-1.5">
          {openDated.length === 0 && (
            <Empty>
              {dated.length === 0
                ? "오늘 예정된 할 일이 없어요."
                : "오늘 할 일을 다 끝냈어요."}
            </Empty>
          )}
          {openDated.map(render)}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading title="정기 루틴" count={openRoutines.length} />
        <div className="flex flex-col gap-1.5">
          {openRoutines.length === 0 && (
            <Empty>
              {routines.length === 0
                ? "오늘 해당하는 루틴이 없어요."
                : "오늘 루틴을 다 끝냈어요."}
            </Empty>
          )}
          {openRoutines.map(render)}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading
          title="미배치함 · 언젠가 할 일"
          count={openFloating.length}
        />
        <div className="flex flex-wrap gap-1.5">
          {openFloating.length === 0 && (
            <Empty wide>
              {floating.length === 0
                ? "쌓아둔 할 일이 없어요."
                : "쌓아둔 걸 다 비웠어요."}
            </Empty>
          )}
          {openFloating.map(render)}
        </div>
      </section>

      {/* Only once there is something in it. An empty 완료 on a fresh morning
          would be a heading explaining that nothing has happened yet. */}
      {finished.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2>
            <button
              type="button"
              onClick={() => setShowDone((open) => !open)}
              aria-expanded={showDone}
              className={cn(
                "pressable flex items-baseline gap-2 rounded-md px-1 py-0.5 -mx-1",
                "text-ink-faint hover:text-ink-soft",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dated"
              )}
            >
              <span className="text-xs font-bold tracking-wide">완료</span>
              <span className="text-xs font-semibold tabular-nums opacity-80">
                {finished.length}
              </span>
              <ChevronDown
                aria-hidden
                strokeWidth={2.5}
                className={cn(
                  "h-3.5 w-3.5 self-center transition-transform duration-200",
                  !showDone && "-rotate-90"
                )}
              />
            </button>
          </h2>
          {showDone && (
            <div className="flex flex-col gap-1.5">{finished.map(render)}</div>
          )}
        </section>
      )}
    </>
  );
}
