import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import {
  addDays,
  formatDateISO,
  formatKo,
  getMonthStart,
  getWeekStart,
  todayInSeoul,
} from "@/lib/task-utils";
import { holidayMap } from "@/lib/holidays";
import { xpFor } from "@/lib/gamification";
import MiniMonth from "@/app/components/mini-month";
import PeriodNav from "@/app/components/period-nav";
import KindLegend from "@/app/components/kind-legend";
import WeekBoard from "@/app/components/week-board";
import type { BoardTask } from "@/app/components/board-task";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ week?: string }> };

function formatRange(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric" };
  return `${formatKo(start, opts)} – ${formatKo(end, opts)}`;
}

export default async function WeekPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const today = todayInSeoul();
  const base = params.week ? new Date(params.week) : today;
  const weekStart = getWeekStart(base);
  const weekEnd = addDays(weekStart, 6);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const user = await requireUser();

  const tasks = await prisma.task.findMany({
    where: { archived: false, userId: user.id },
    include: { completions: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  // Which block sits where is decided in the browser now, because a drop has to
  // land before the server has heard about it. This page's job stops at handing
  // over plain, timezone-free strings.
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

  const holidays: Record<string, string[]> = {};
  for (const [date, list] of holidayMap(weekStart, weekEnd)) {
    holidays[date] = list.map((h) => h.name);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-4 pb-10 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-balance">
            주간 시간표
          </h1>
          <p className="mt-1 text-sm tabular-nums text-ink-soft">
            {formatRange(weekStart, weekEnd)}
          </p>
        </div>
        <PeriodNav
          prevHref={`/week?week=${formatDateISO(addDays(weekStart, -7))}`}
          nextHref={`/week?week=${formatDateISO(addDays(weekStart, 7))}`}
          currentHref="/week"
          currentLabel="이번 주"
          prevLabel="이전 주"
          nextLabel="다음 주"
        />
      </header>

      <WeekBoard
        weekDates={weekDates.map(formatDateISO)}
        todayISO={formatDateISO(today)}
        tasks={boardTasks}
        holidays={holidays}
        thumb={
          <MiniMonth
            monthStart={getMonthStart(weekStart)}
            weekStart={weekStart}
            today={today}
          />
        }
      />

      <KindLegend />

      <p className="text-center text-[11px] text-ink-faint">
        빈 칸을 누르면 그 시각에 바로 추가돼요 · 블록을 끌어 다른 날·시간으로
        옮길 수 있어요 · 미배치함 항목은 손잡이를 잡고 끌면 됩니다 · 정기 루틴은
        같은 요일 안에서 시간만 옮겨집니다
      </p>
    </div>
  );
}
