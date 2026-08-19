"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseDateISO, routineOccursOn, weekdayLabel, weekdayOf } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import {
  DragProvider,
  useDrag,
  type DragItem,
  type DropTarget,
} from "@/app/components/drag-context";
import {
  buildMove,
  placementSignature,
  reconcileMoves,
  withMove,
  type BoardTask,
  type TaskMove,
} from "@/app/components/board-task";
import { tapFeedback } from "@/app/components/use-task-actions";

const MAX_CHIPS_PER_DAY = 3;

type MonthBoardProps = {
  /** Whole weeks covering the month, Monday first, as `YYYY-MM-DD`. */
  gridDates: string[];
  /** `YYYY-MM` of the month being displayed; the rest of the grid is spill. */
  monthISO: string;
  todayISO: string;
  tasks: BoardTask[];
  holidays: Record<string, string[]>;
};

export default function MonthBoard(props: MonthBoardProps) {
  const router = useRouter();
  const [moves, setMoves] = useState<Record<string, TaskMove>>({});

  // Same optimistic bookkeeping as the weekly board; see week-board.tsx.
  const signature = placementSignature(props.tasks);
  const [seenSignature, setSeenSignature] = useState(signature);
  if (seenSignature !== signature) {
    setSeenSignature(signature);
    setMoves((current) => reconcileMoves(current, props.tasks));
  }

  async function handleDrop(item: DragItem, target: DropTarget) {
    const move = buildMove(item, target);
    if (!move) return;

    setMoves((current) => ({ ...current, [item.taskId]: move }));
    tapFeedback();

    const res = await fetch(`/api/tasks/${item.taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(move),
    });
    if (!res.ok) {
      setMoves((current) => {
        const next = { ...current };
        delete next[item.taskId];
        return next;
      });
      return;
    }
    router.refresh();
  }

  const tasks = props.tasks.map((t) => withMove(t, moves[t.id]));

  return (
    <DragProvider onDrop={handleDrop}>
      <Grid {...props} tasks={tasks} />
    </DragProvider>
  );
}

function Grid({
  gridDates,
  monthISO,
  todayISO,
  tasks,
  holidays,
}: MonthBoardProps) {
  const { item: held, target, begin } = useDrag();
  const weeks = Array.from({ length: gridDates.length / 7 }, (_, i) =>
    gridDates.slice(i * 7, i * 7 + 7)
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b border-border">
          {gridDates.slice(0, 7).map((dateISO) => (
            <div
              key={dateISO}
              className="border-r border-border px-2 py-2 text-center text-[11px] font-bold tracking-wide text-ink-faint last:border-r-0"
            >
              {weekdayLabel(weekdayOf(parseDateISO(dateISO)))}
            </div>
          ))}
        </div>

        {weeks.map((week) => (
          <div
            key={week[0]}
            className="grid grid-cols-7 border-b border-border last:border-b-0"
          >
            {week.map((dateISO) => {
              const date = parseDateISO(dateISO);
              const inMonth = dateISO.startsWith(monthISO);
              const isToday = dateISO === todayISO;
              const dayHolidays = holidays[dateISO] ?? [];
              const isHoliday = dayHolidays.length > 0;
              const over = target?.type === "month" && target.date === dateISO;

              const dated = tasks.filter(
                (t) => !t.weekdays && t.dueDate === dateISO
              );
              const routines = tasks.filter(
                (t) => t.weekdays && routineOccursOn(t.weekdays, date)
              );
              const routinesDone = routines.filter((t) =>
                t.completions.includes(dateISO)
              ).length;

              return (
                <Link
                  key={dateISO}
                  href={`/week?week=${dateISO}`}
                  // An <a> is natively draggable, so without this the browser
                  // starts dragging the link itself the moment a chip inside it
                  // moves, and its drag image fights the one we render.
                  draggable={false}
                  data-drop="month"
                  data-date={dateISO}
                  className={cn(
                    "pressable press-soft flex min-h-[104px] min-w-0 flex-col gap-1 border-r border-border p-1.5 last:border-r-0 hover:bg-surface-sunk",
                    "transition-colors duration-150",
                    inMonth ? "" : "opacity-45",
                    isToday
                      ? "bg-dated-soft/40"
                      : isHoliday
                        ? "bg-holiday-soft/50"
                        : "",
                    over && "bg-dated-soft ring-1 ring-dated ring-inset"
                  )}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 place-items-center rounded-full text-xs font-bold tabular-nums",
                      isToday
                        ? "bg-dated text-white"
                        : isHoliday
                          ? "text-holiday"
                          : ""
                    )}
                  >
                    {date.getUTCDate()}
                  </span>

                  <div className="flex flex-col gap-1">
                    {/* Holidays sit above the day's own tasks: they're the
                        context you read the rest of the cell against. */}
                    {dayHolidays.map((name) => (
                      <span
                        key={name}
                        className="truncate rounded-md border-l-[3px] border-holiday bg-holiday-soft px-1.5 py-0.5 text-[11px] font-semibold text-holiday"
                      >
                        {name}
                      </span>
                    ))}

                    {dated.slice(0, MAX_CHIPS_PER_DAY).map((t) => {
                      const done = t.completions.includes(dateISO);
                      return (
                        <span
                          key={t.id}
                          onPointerDown={(event) =>
                            begin(
                              {
                                taskId: t.id,
                                title: t.title,
                                kind: "dated",
                                durationMinutes: null,
                                hasEnd: Boolean(t.endTime),
                                grabOffsetMinutes: 0,
                                originDate: dateISO,
                              },
                              event
                            )
                          }
                          style={{ touchAction: "none" }}
                          className={cn(
                            "truncate rounded-md border-l-[3px] border-dated bg-dated-soft px-1.5 py-0.5 text-[11px] font-semibold text-dated-ink",
                            "cursor-grab active:cursor-grabbing",
                            done && "opacity-50 line-through",
                            held?.taskId === t.id && "opacity-25"
                          )}
                        >
                          {t.startTime ? `${t.startTime} ` : ""}
                          {t.title}
                        </span>
                      );
                    })}

                    {dated.length > MAX_CHIPS_PER_DAY && (
                      <span className="px-1 text-[10px] font-medium text-ink-faint">
                        +{dated.length - MAX_CHIPS_PER_DAY}건 더
                      </span>
                    )}
                  </div>

                  {/* Routine load sits as a quiet bar so it doesn't compete
                      with the day's actual appointments. */}
                  {routines.length > 0 && (
                    <div
                      className="mt-auto h-1 overflow-hidden rounded-full bg-surface-sunk"
                      title={`정기 루틴 ${routinesDone}/${routines.length} 완료`}
                    >
                      <span
                        className="block h-full rounded-full bg-routine"
                        style={{
                          width: `${(routinesDone / routines.length) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
