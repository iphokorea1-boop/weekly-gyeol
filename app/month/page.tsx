import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import {
  addMonths,
  daySummary,
  formatDateISO,
  formatKo,
  formatMonthISO,
  getMonthGrid,
  parseMonthParam,
  todayInSeoul,
} from "@/lib/task-utils";
import { hasLunarData, holidayMap } from "@/lib/holidays";
import { xpFor } from "@/lib/gamification";
import PeriodNav from "@/app/components/period-nav";
import MonthBoard from "@/app/components/month-board";
import type { BoardTask } from "@/app/components/board-task";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ month?: string }> };

export default async function MonthPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const monthStart = parseMonthParam(params.month);
  const grid = getMonthGrid(monthStart);
  const gridStart = grid[0];
  const gridEnd = grid[grid.length - 1];

  const user = await requireUser();

  const tasks = await prisma.task.findMany({
    where: { archived: false, userId: user.id },
    include: {
      completions: { where: { date: { gte: gridStart, lte: gridEnd } } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  const today = todayInSeoul();
  const monthLabel = formatKo(monthStart, { year: "numeric", month: "long" });

  const monthDays = grid.filter(
    (d) => d.getUTCMonth() === monthStart.getUTCMonth()
  );
  const monthTotals = monthDays.reduce(
    (acc, d) => {
      const { items, done } = daySummary(tasks, d);
      return { total: acc.total + items.length, done: acc.done + done };
    },
    { total: 0, done: 0 }
  );

  const boardTasks: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    startTime: t.startTime,
    endTime: t.endTime,
    dueDate: t.dueDate ? formatDateISO(new Date(t.dueDate)) : null,
    weekdays: t.weekdays,
    xp: xpFor(t.priority),
    completions: t.completions.map((c) => formatDateISO(new Date(c.date))),
  }));

  // Public holidays are computed, not stored — see lib/holidays.ts.
  const holidays: Record<string, string[]> = {};
  for (const [date, list] of holidayMap(gridStart, gridEnd)) {
    holidays[date] = list.map((h) => h.name);
  }
  const lunarKnown = hasLunarData(monthStart.getUTCFullYear());

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

      <MonthBoard
        gridDates={grid.map(formatDateISO)}
        monthISO={formatMonthISO(monthStart)}
        todayISO={formatDateISO(today)}
        tasks={boardTasks}
        holidays={holidays}
      />

      <footer className="flex flex-col items-center gap-1 text-center text-[11px] text-ink-faint">
        <span>
          칩을 끌어 다른 날짜로 옮길 수 있어요 · 날짜를 누르면 그 주의 시간표로
          이동합니다 · 칸 아래 막대 = 그날 루틴 완료율
        </span>
        {/* Saying nothing here would quietly turn a missing 추석 into "there is
            no 추석 that year". */}
        {!lunarKnown && (
          <span className="text-holiday">
            {monthStart.getUTCFullYear()}년은 음력 공휴일(설날 · 추석 ·
            부처님오신날) 자료가 없어 양력 공휴일만 표시됩니다
          </span>
        )}
      </footer>
    </div>
  );
}
