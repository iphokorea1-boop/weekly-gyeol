"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  capacityPercent,
  formatKo,
  GRID_END_HOUR,
  GRID_RANGE_MINUTES,
  GRID_START_HOUR,
  layoutOverlaps,
  minutesFromGridStart,
  minutesToTime,
  parseDateISO,
  routineOccursOn,
} from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import TaskBlock from "@/app/components/task-block";
import TaskItem from "@/app/components/task-item";
import DayAssignPicker from "@/app/components/day-assign-picker";
import NowLine from "@/app/components/now-line";
import {
  DEFAULT_DURATION_MINUTES,
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
import {
  dayCaption,
  opensQuickAdd,
  QuickAddProvider,
  useQuickAdd,
} from "@/app/components/quick-add";

const PX_PER_MINUTE = 50 / 60;
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * 60 * PX_PER_MINUTE; // 900

/**
 * Clicking to create rounds down to the half hour, not to the quarter the drag
 * snaps to. The grid draws a line every hour, so a click can only really claim
 * to mean "this hour" or "the second half of it" — offering 15-minute precision
 * from a gesture that cannot express it would just produce times nobody chose.
 */
const CREATE_SLOT_MINUTES = 30;

const HOUR_MARKS = Array.from(
  { length: (GRID_END_HOUR - GRID_START_HOUR) / 2 + 1 },
  (_, i) => GRID_START_HOUR + i * 2
);

const CHIP =
  "truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-[11px] font-semibold";

type BoardProps = {
  /** Seven `YYYY-MM-DD` strings, Monday first. */
  weekDates: string[];
  todayISO: string;
  tasks: BoardTask[];
  /** date → holiday names on that date. */
  holidays: Record<string, string[]>;
  /** The mini month, rendered on the server and slotted into the sidebar. */
  thumb: ReactNode;
};

/**
 * Placement lives here rather than in the page because a drop has to take
 * effect before the server has heard about it. The server component now only
 * fetches and serialises; deciding which block sits where is a client concern
 * the moment it can change under the pointer.
 */
export default function WeekBoard(props: BoardProps) {
  const router = useRouter();
  const [moves, setMoves] = useState<Record<string, TaskMove>>({});

  // Retire each optimistic move once the server render shows it landed. Keyed
  // on the placement rather than a timer: a fixed delay would expire mid-request
  // on a slow connection and snap the block back before the server had actually
  // rejected anything. Adjusted during render — React's documented way to reset
  // state from props, and the same pattern useTaskActions uses.
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
      // Send it back where it came from. Leaving the block at the drop point
      // would show a move that never happened, and the next refresh would
      // yank it back with no explanation.
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
      <QuickAddProvider>
        <Board {...props} tasks={tasks} />
      </QuickAddProvider>
    </DragProvider>
  );
}

function Board({ weekDates, todayISO, tasks, holidays, thumb }: BoardProps) {
  const { item: held, target, begin } = useDrag();
  const { open: openQuickAdd } = useQuickAdd();
  const weekDateObjects = weekDates.map(parseDateISO);

  /** Empty space in a day column: add a task starting at the hour clicked. */
  function addAtTime(
    event: React.MouseEvent<HTMLDivElement>,
    dateISO: string
  ) {
    if (!opensQuickAdd(event.target)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const slot =
      Math.floor(
        (event.clientY - rect.top) / PX_PER_MINUTE / CREATE_SLOT_MINUTES
      ) * CREATE_SLOT_MINUTES;
    const offset = Math.min(
      Math.max(slot, 0),
      GRID_RANGE_MINUTES - DEFAULT_DURATION_MINUTES
    );
    const start = GRID_START_HOUR * 60 + offset;
    const startTime = minutesToTime(start);

    openQuickAdd(
      {
        kind: "dated",
        dueDate: dateISO,
        startTime,
        endTime: minutesToTime(start + DEFAULT_DURATION_MINUTES),
        weekdays: [],
      },
      dayCaption(dateISO, startTime),
      // Anchored at the pointer's height rather than the column's, which is
      // 900px tall and would put the popover far below the hour clicked.
      { left: rect.left, top: event.clientY, width: rect.width, height: 0 }
    );
  }

  /** The 종일 row: same day, no time. */
  function addAllDay(event: React.MouseEvent<HTMLDivElement>, dateISO: string) {
    if (!opensQuickAdd(event.target)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    openQuickAdd(
      {
        kind: "dated",
        dueDate: dateISO,
        startTime: "",
        endTime: "",
        weekdays: [],
      },
      dayCaption(dateISO),
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    );
  }

  const days = weekDates.map((dateISO) => {
    const date = parseDateISO(dateISO);
    const routines = tasks.filter(
      (t) => t.weekdays && routineOccursOn(t.weekdays, date)
    );
    const datedHere = tasks.filter((t) => !t.weekdays && t.dueDate === dateISO);
    const timedDated = datedHere.filter((t) => t.startTime);

    const placed = [
      ...routines.map((task) => ({ task, kind: "routine" as const })),
      ...timedDated.map((task) => ({ task, kind: "dated" as const })),
    ]
      // A routine with no start time has no position in the grid; including it
      // would place it at NaN.
      .filter((e) => e.task.startTime)
      .map((e) => {
        const start = minutesFromGridStart(e.task.startTime)!;
        const rawEnd = e.task.endTime
          ? minutesFromGridStart(e.task.endTime)!
          : start + DEFAULT_DURATION_MINUTES;
        return { ...e, start, end: Math.max(rawEnd, start + 1) };
      });

    return {
      dateISO,
      date,
      timedEvents: layoutOverlaps(
        placed,
        (e) => e.start,
        (e) => e.end
      ),
      allDayDated: datedHere.filter((t) => !t.startTime),
      capacity: capacityPercent([...routines, ...timedDated]),
      dayHolidays: holidays[dateISO] ?? [],
    };
  });

  const backlog = tasks.filter((t) => !t.weekdays && !t.dueDate);
  const overBacklog = target?.type === "backlog";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[248px_1fr] lg:items-start">
      <div className="flex flex-col gap-4">
        {thumb}

        <aside
          data-drop="backlog"
          className={cn(
            "flex flex-col gap-3 rounded-xl border bg-surface p-3 shadow-sm",
            "transition-colors duration-150",
            overBacklog
              ? "border-floating bg-floating-soft"
              : "border-border"
          )}
        >
          <h2 className="text-xs font-bold tracking-wide text-ink-faint">
            미배치함
          </h2>

          {overBacklog && (
            <p className="text-[11px] font-semibold text-floating-ink">
              여기 놓으면 날짜가 해제됩니다
            </p>
          )}

          {backlog.length === 0 ? (
            <p className="text-sm text-ink-faint">쌓아둔 할 일이 없어요.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {backlog.map((t, i) => (
                <TaskItem
                  key={t.id}
                  kind="floating"
                  index={i}
                  dragging={held?.taskId === t.id}
                  onDragPointerDown={(event) =>
                    begin(
                      {
                        taskId: t.id,
                        title: t.title,
                        kind: "floating",
                        durationMinutes: null,
                        hasEnd: false,
                        grabOffsetMinutes: 0,
                        originDate: null,
                      },
                      event
                    )
                  }
                  task={{
                    id: t.id,
                    title: t.title,
                    startTime: null,
                    endTime: null,
                    done: t.completions.length > 0,
                    xp: t.xp,
                  }}
                  extra={
                    <DayAssignPicker taskId={t.id} weekDates={weekDateObjects} />
                  }
                />
              ))}
            </div>
          )}
        </aside>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <div className="min-w-[760px]">
          <div
            className="grid border-b border-border"
            style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}
          >
            <div />
            {days.map(({ dateISO, date, capacity, dayHolidays }) => {
              const isToday = dateISO === todayISO;
              const isHoliday = dayHolidays.length > 0;
              return (
                <div
                  key={dateISO}
                  className={cn(
                    "border-r border-border px-2 py-2.5 text-center last:border-r-0",
                    isToday
                      ? "bg-dated-soft"
                      : isHoliday
                        ? "bg-holiday-soft"
                        : ""
                  )}
                >
                  <div
                    className={cn(
                      "text-[11px] font-bold tracking-wide",
                      isToday
                        ? "text-dated-ink"
                        : isHoliday
                          ? "text-holiday"
                          : "text-ink-faint"
                    )}
                  >
                    {formatKo(date, { weekday: "short" })}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-[15px] font-bold tabular-nums",
                      isToday
                        ? "text-dated-ink"
                        : isHoliday
                          ? "text-holiday"
                          : ""
                    )}
                  >
                    {date.getUTCDate()}
                  </div>
                  <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-surface-sunk">
                    <span
                      className={cn(
                        "block h-full",
                        isToday ? "bg-dated-ink" : "bg-dated"
                      )}
                      style={{ width: `${capacity}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="grid border-b border-border bg-surface-sunk"
            style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}
          >
            <div className="flex items-center justify-center border-r border-border text-[10px] text-ink-faint">
              종일
            </div>
            {days.map(({ dateISO, allDayDated, dayHolidays }) => {
              const over = target?.type === "allday" && target.date === dateISO;
              return (
                <div
                  key={dateISO}
                  data-drop="allday"
                  data-date={dateISO}
                  onClick={(event) => addAllDay(event, dateISO)}
                  // min-w-0: grid items default to min-width:auto, so a long
                  // chip widens its own 1fr column and shoves the row out of
                  // step with the header — making a task look like it sits on
                  // the neighbouring day.
                  className={cn(
                    "flex min-h-[34px] min-w-0 cursor-pointer flex-col gap-1 border-r border-border p-1.5 last:border-r-0",
                    "transition-colors duration-150",
                    over && "bg-dated-soft ring-1 ring-dated ring-inset"
                  )}
                >
                  {dayHolidays.map((name) => (
                    <span
                      key={name}
                      className={cn(
                        CHIP,
                        "border-holiday bg-holiday-soft text-holiday"
                      )}
                    >
                      {name}
                    </span>
                  ))}
                  {allDayDated.map((t) => (
                    <span
                      key={t.id}
                      data-nq
                      onPointerDown={(event) =>
                        begin(
                          {
                            taskId: t.id,
                            title: t.title,
                            kind: "dated",
                            durationMinutes: null,
                            hasEnd: false,
                            grabOffsetMinutes: 0,
                            originDate: dateISO,
                          },
                          event
                        )
                      }
                      style={{ touchAction: "none" }}
                      className={cn(
                        CHIP,
                        "cursor-grab border-dated bg-dated-soft text-dated-ink active:cursor-grabbing",
                        held?.taskId === t.id && "opacity-25"
                      )}
                    >
                      {t.title}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>

          <div
            className="grid"
            style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}
          >
            <div
              className="relative border-r border-border"
              style={{ height: GRID_HEIGHT }}
            >
              {HOUR_MARKS.map((h) => (
                <span
                  key={h}
                  style={{ top: (h - GRID_START_HOUR) * 60 * PX_PER_MINUTE }}
                  className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-ink-faint"
                >
                  {String(h % 24).padStart(2, "0")}
                </span>
              ))}
            </div>

            {days.map(({ dateISO, date, timedEvents }) => {
              const isToday = dateISO === todayISO;
              const preview =
                held && target?.type === "timed" && target.date === dateISO
                  ? target
                  : null;

              return (
                <div
                  key={dateISO}
                  data-drop="timed"
                  data-date={dateISO}
                  // Read back by the hit test to turn a pointer position into a
                  // time, so the geometry is declared once, here, next to the
                  // element it actually describes.
                  data-px-per-minute={PX_PER_MINUTE}
                  data-range-minutes={GRID_RANGE_MINUTES}
                  onClick={(event) => addAtTime(event, dateISO)}
                  className={cn(
                    "relative cursor-pointer border-r border-border last:border-r-0",
                    isToday && "bg-dated-soft/30"
                  )}
                  style={{
                    height: GRID_HEIGHT,
                    backgroundImage:
                      "repeating-linear-gradient(to bottom, transparent 0, transparent 49px, var(--surface-sunk) 49px, var(--surface-sunk) 50px)",
                  }}
                >
                  {isToday && <NowLine pxPerMinute={PX_PER_MINUTE} />}

                  {preview && held && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-[3px] right-[3px] z-20 rounded-lg border-2 border-dashed border-dated bg-dated-soft/80"
                      style={{
                        top: preview.startMinutes * PX_PER_MINUTE,
                        height: Math.max(
                          16,
                          (held.durationMinutes ?? DEFAULT_DURATION_MINUTES) *
                            PX_PER_MINUTE
                        ),
                      }}
                    >
                      <span className="block truncate px-1.5 pt-px text-[9.5px] font-bold tabular-nums text-dated-ink">
                        {minutesToTime(
                          GRID_START_HOUR * 60 + preview.startMinutes
                        )}
                      </span>
                    </span>
                  )}

                  {timedEvents.map(({ task: t, kind, start, end, col, cols }) => (
                    <TaskBlock
                      key={t.id}
                      kind={kind}
                      occurrenceDate={date}
                      top={start * PX_PER_MINUTE}
                      height={Math.max(1, (end - start) * PX_PER_MINUTE)}
                      col={col}
                      cols={cols}
                      dragging={held?.taskId === t.id}
                      onDragPointerDown={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        begin(
                          {
                            taskId: t.id,
                            title: t.title,
                            kind,
                            durationMinutes: end - start,
                            hasEnd: Boolean(t.endTime),
                            grabOffsetMinutes:
                              (event.clientY - rect.top) / PX_PER_MINUTE,
                            originDate: dateISO,
                          },
                          event
                        );
                      }}
                      task={{
                        id: t.id,
                        title: t.title,
                        startTime: t.startTime,
                        endTime: t.endTime,
                        done: t.completions.includes(dateISO),
                      }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
