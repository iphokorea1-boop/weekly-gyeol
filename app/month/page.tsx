import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  addMonths,
  daySummary,
  formatDateISO,
  formatMonthISO,
  getMonthGrid,
  isDoneOn,
  isSameDay,
  parseMonthParam,
  routineOccursOn,
  taskKind,
  toDateOnly,
  weekdayLabel,
} from "@/lib/task-utils";
import PeriodNav from "@/app/components/period-nav";

export const dynamic = "force-dynamic";

const MAX_CHIPS_PER_DAY = 3;

type PageProps = { searchParams: Promise<{ month?: string }> };

export default async function MonthPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const monthStart = parseMonthParam(params.month);
  const grid = getMonthGrid(monthStart);
  const gridStart = grid[0];
  const gridEnd = grid[grid.length - 1];

  const tasks = await prisma.task.findMany({
    where: { archived: false },
    include: {
      completions: { where: { date: { gte: gridStart, lte: gridEnd } } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  const today = toDateOnly(new Date());
  const weeks = Array.from({ length: grid.length / 7 }, (_, i) =>
    grid.slice(i * 7, i * 7 + 7)
  );

  const monthLabel = monthStart.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });

  const monthDays = grid.filter(
    (d) => d.getMonth() === monthStart.getMonth()
  );
  const monthTotals = monthDays.reduce(
    (acc, d) => {
      const { items, done } = daySummary(tasks, d);
      return { total: acc.total + items.length, done: acc.done + done };
    },
    { total: 0, done: 0 }
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-4 pb-10 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-balance">
            {monthLabel}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            이번 달 {monthTotals.total}건 중{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {monthTotals.done}건
            </span>{" "}
            완료
          </p>
        </div>
        <PeriodNav
          prevHref={`/month?month=${formatMonthISO(addMonths(monthStart, -1))}`}
          nextHref={`/month?month=${formatMonthISO(addMonths(monthStart, 1))}`}
          currentHref="/month"
          currentLabel="이번 달"
          prevLabel="이전 달"
          nextLabel="다음 달"
        />
      </header>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-b border-border">
            {grid.slice(0, 7).map((d) => (
              <div
                key={d.toISOString()}
                className="border-r border-border px-2 py-2 text-center text-[11px] font-bold tracking-wide text-ink-faint last:border-r-0"
              >
                {weekdayLabel(d.getDay())}
              </div>
            ))}
          </div>

          {weeks.map((week) => (
            <div
              key={week[0].toISOString()}
              className="grid grid-cols-7 border-b border-border last:border-b-0"
            >
              {week.map((date) => {
                const inMonth = date.getMonth() === monthStart.getMonth();
                const isToday = isSameDay(date, today);
                const dated = tasks.filter(
                  (t) =>
                    taskKind(t) === "dated" &&
                    t.dueDate &&
                    isSameDay(new Date(t.dueDate), date)
                );
                const routines = tasks.filter(
                  (t) =>
                    taskKind(t) === "routine" && routineOccursOn(t.weekdays, date)
                );
                const routinesDone = routines.filter((t) =>
                  isDoneOn(t, date)
                ).length;

                return (
                  <Link
                    key={date.toISOString()}
                    href={`/week?week=${formatDateISO(date)}`}
                    className={`flex min-h-[104px] flex-col gap-1 border-r border-border p-1.5 transition-colors last:border-r-0 hover:bg-surface-sunk ${
                      inMonth ? "" : "opacity-45"
                    } ${isToday ? "bg-dated-soft/40" : ""}`}
                  >
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full text-xs font-bold tabular-nums ${
                        isToday ? "bg-dated text-white" : ""
                      }`}
                    >
                      {date.getDate()}
                    </span>

                    <div className="flex flex-col gap-1">
                      {dated.slice(0, MAX_CHIPS_PER_DAY).map((t) => {
                        const done = isDoneOn(t, date);
                        return (
                          <span
                            key={t.id}
                            className={`truncate rounded-md border-l-[3px] border-dated bg-dated-soft px-1.5 py-0.5 text-[11px] font-semibold text-dated-ink ${
                              done ? "opacity-50 line-through" : ""
                            }`}
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

      <footer className="text-center text-[11px] text-ink-faint">
        날짜를 누르면 그 주의 시간표로 이동합니다 · 칸 아래 막대 = 그날 루틴 완료율
      </footer>
    </div>
  );
}
