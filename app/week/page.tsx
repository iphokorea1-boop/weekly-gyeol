import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  capacityPercent,
  formatDateISO,
  getWeekStart,
  GRID_END_HOUR,
  GRID_START_HOUR,
  isSameDay,
  layoutOverlaps,
  minutesFromGridStart,
  routineOccursOn,
  taskKind,
  toDateOnly,
} from "@/lib/task-utils";
import TaskBlock from "@/app/components/task-block";
import TaskItem, { type TaskItemData } from "@/app/components/task-item";
import DayAssignPicker from "@/app/components/day-assign-picker";

export const dynamic = "force-dynamic";

const PX_PER_MINUTE = 50 / 60;
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * 60 * PX_PER_MINUTE; // 900

type PageProps = { searchParams: Promise<{ week?: string }> };

function formatRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric" };
  return `${start.toLocaleDateString("ko-KR", opts)} – ${end.toLocaleDateString(
    "ko-KR",
    opts
  )}`;
}

export default async function WeekPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const base = params.week ? new Date(params.week) : new Date();
  const weekStart = getWeekStart(base);
  const weekEnd = addDays(weekStart, 6);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const tasks = await prisma.task.findMany({
    where: { archived: false },
    include: { completions: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  const routines = tasks.filter((t) => taskKind(t) === "routine");
  const datedInWeek = tasks.filter((t) => {
    if (taskKind(t) !== "dated" || !t.dueDate) return false;
    const d = toDateOnly(new Date(t.dueDate));
    return d >= weekStart && d <= weekEnd;
  });
  const floating = tasks.filter((t) => taskKind(t) === "floating");

  const doneOn = (t: (typeof tasks)[number], date: Date) =>
    t.completions.some((c) => isSameDay(new Date(c.date), date));

  const days = weekDates.map((date) => {
    const dayRoutines = routines.filter((t) => routineOccursOn(t.weekdays, date));
    const timedDated = datedInWeek.filter(
      (t) => t.dueDate && isSameDay(new Date(t.dueDate), date) && t.startTime
    );
    const allDayDated = datedInWeek.filter(
      (t) => t.dueDate && isSameDay(new Date(t.dueDate), date) && !t.startTime
    );

    const rawEvents = [
      ...dayRoutines.map((t) => ({ task: t, kind: "routine" as const })),
      ...timedDated.map((t) => ({ task: t, kind: "dated" as const })),
    ].map((e) => {
      const start = minutesFromGridStart(e.task.startTime)!;
      const end =
        start +
        (e.task.endTime ? minutesFromGridStart(e.task.endTime)! - start : 30);
      return { ...e, start, end };
    });
    const timedEvents = layoutOverlaps(
      rawEvents,
      (e) => e.start,
      (e) => e.end
    );

    return {
      date,
      timedEvents,
      allDayDated,
      capacity: capacityPercent([...dayRoutines, ...timedDated]),
    };
  });

  const hourMarks = Array.from(
    { length: (GRID_END_HOUR - GRID_START_HOUR) / 2 + 1 },
    (_, i) => GRID_START_HOUR + i * 2
  );

  const toFloatingItem = (t: (typeof tasks)[number]): TaskItemData => ({
    id: t.id,
    title: t.title,
    startTime: null,
    endTime: null,
    done: t.completions.length > 0,
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-4 pb-10 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-balance">
          이번 주
        </h1>
        <div className="flex items-center gap-2 text-sm tabular-nums text-ink-soft">
          <Link
            href={`/week?week=${formatDateISO(addDays(weekStart, -7))}`}
            aria-label="이전 주"
            className="grid h-7 w-7 place-items-center rounded-md border border-border hover:border-border-strong"
          >
            ‹
          </Link>
          <span>{formatRange(weekStart, weekEnd)}</span>
          <Link
            href={`/week?week=${formatDateISO(addDays(weekStart, 7))}`}
            aria-label="다음 주"
            className="grid h-7 w-7 place-items-center rounded-md border border-border hover:border-border-strong"
          >
            ›
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr] lg:items-start">
        <aside className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm">
          <h2 className="text-xs font-bold tracking-wide text-ink-faint">
            미배치함
          </h2>
          {floating.length === 0 ? (
            <p className="text-sm text-ink-faint">쌓아둔 할 일이 없어요.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {floating.map((t) => (
                <TaskItem
                  key={t.id}
                  kind="floating"
                  task={toFloatingItem(t)}
                  extra={
                    <DayAssignPicker taskId={t.id} weekDates={weekDates} />
                  }
                />
              ))}
            </div>
          )}
        </aside>

        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <div className="min-w-[760px]">
            <div
              className="grid border-b border-border"
              style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}
            >
              <div />
              {days.map(({ date, capacity }) => {
                const isToday = isSameDay(date, toDateOnly(new Date()));
                return (
                  <div
                    key={date.toISOString()}
                    className={`border-r border-border px-2 py-2.5 text-center last:border-r-0 ${
                      isToday ? "bg-dated-soft" : ""
                    }`}
                  >
                    <div
                      className={`text-[11px] font-bold tracking-wide ${
                        isToday ? "text-dated-ink" : "text-ink-faint"
                      }`}
                    >
                      {date.toLocaleDateString("ko-KR", { weekday: "short" })}
                    </div>
                    <div
                      className={`mt-0.5 text-[15px] font-bold tabular-nums ${
                        isToday ? "text-dated-ink" : ""
                      }`}
                    >
                      {date.getDate()}
                    </div>
                    <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-surface-sunk">
                      <span
                        className={`block h-full ${
                          isToday ? "bg-dated-ink" : "bg-dated"
                        }`}
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
              {days.map(({ date, allDayDated }) => (
                <div
                  key={date.toISOString()}
                  className="flex min-h-[34px] flex-col gap-1 border-r border-border p-1.5 last:border-r-0"
                >
                  {allDayDated.map((t) => (
                    <span
                      key={t.id}
                      className="truncate rounded-md border-l-[3px] border-dated bg-dated-soft px-1.5 py-0.5 text-[11px] font-semibold text-dated-ink"
                    >
                      {t.title}
                    </span>
                  ))}
                </div>
              ))}
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: "44px repeat(7, 1fr)" }}
            >
              <div className="relative border-r border-border" style={{ height: GRID_HEIGHT }}>
                {hourMarks.map((h) => (
                  <span
                    key={h}
                    style={{ top: (h - GRID_START_HOUR) * 60 * PX_PER_MINUTE }}
                    className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-ink-faint"
                  >
                    {String(h % 24).padStart(2, "0")}
                  </span>
                ))}
              </div>

              {days.map(({ date, timedEvents }) => {
                const isToday = isSameDay(date, toDateOnly(new Date()));
                return (
                  <div
                    key={date.toISOString()}
                    className={`relative border-r border-border last:border-r-0 ${
                      isToday ? "bg-dated-soft/30" : ""
                    }`}
                    style={{
                      height: GRID_HEIGHT,
                      backgroundImage:
                        "repeating-linear-gradient(to bottom, transparent 0, transparent 49px, var(--surface-sunk) 49px, var(--surface-sunk) 50px)",
                    }}
                  >
                    {timedEvents.map(({ task: t, kind, start, end, col, cols }) => (
                      <TaskBlock
                        key={t.id}
                        kind={kind}
                        occurrenceDate={date}
                        top={start * PX_PER_MINUTE}
                        height={Math.max(1, (end - start) * PX_PER_MINUTE)}
                        col={col}
                        cols={cols}
                        task={{
                          id: t.id,
                          title: t.title,
                          startTime: t.startTime,
                          endTime: t.endTime,
                          done: doneOn(t, date),
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

      <footer className="text-center text-[11px] text-ink-faint">
        빗금 = 반복 루틴 · 실선 = 날짜 있는 할 일 · 점선 = 언젠가 할 일
      </footer>
    </div>
  );
}
