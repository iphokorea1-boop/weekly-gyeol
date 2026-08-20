import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import {
  daySummary,
  formatDateISO,
  formatMonthISO,
  getMonthEnd,
  isSameDay,
  makeDate,
  mondayIndex,
  parseYearParam,
  todayInSeoul,
} from "@/lib/task-utils";
import { holidayLabel, holidayMap } from "@/lib/holidays";
import { computeAchievements, computeStreaks } from "@/lib/gamification";
import PeriodNav from "@/app/components/period-nav";
import AchievementGrid from "@/app/components/achievement-grid";
import YearHeatmap, { type HeatMonth } from "@/app/components/year-heatmap";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ year?: string }> };

export default async function YearPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const year = parseYearParam(params.year);

  const user = await requireUser();

  // Achievements and streaks span the user's whole history, so completions are
  // fetched unfiltered; the heatmap only ever asks about dates inside `year`.
  const tasks = await prisma.task.findMany({
    where: { archived: false, userId: user.id },
    include: { completions: true },
  });

  const today = todayInSeoul();
  const { current: streak, longest } = computeStreaks(tasks, today);
  const achievements = computeAchievements(tasks, today);

  // The heatmap stays about completion, so holidays only reach the tooltip —
  // colouring 19 squares red would compete with the scale that carries meaning.
  const holidays = holidayMap(makeDate(year, 0, 1), makeDate(year, 11, 31));

  // Serialised here rather than in the component: the grid is a client
  // component so each square can open the add form, and Date objects would be
  // re-read in the browser's own timezone on the way across.
  const months: HeatMonth[] = Array.from({ length: 12 }, (_, m) => {
    const monthStart = makeDate(year, m, 1);
    const days = Array.from(
      { length: getMonthEnd(monthStart).getUTCDate() },
      (_, i) => {
        const date = makeDate(year, m, i + 1);
        // Routines recur into every future day, so tinting those as 0% would
        // make the rest of the year look like failure.
        const future = date > today;
        const { items, done } = daySummary(tasks, date);
        return {
          dateISO: formatDateISO(date),
          total: future ? 0 : items.length,
          done: future ? 0 : done,
          future,
          isToday: isSameDay(date, today),
          holiday: holidayLabel(holidays.get(formatDateISO(date)) ?? []),
        };
      }
    );
    return {
      monthISO: formatMonthISO(monthStart),
      label: `${m + 1}월`,
      lead: mondayIndex(monthStart),
      days,
    };
  });

  const yearTotals = months
    .flatMap((m) => m.days)
    .reduce(
      (acc, d) => ({ total: acc.total + d.total, done: acc.done + d.done }),
      { total: 0, done: 0 }
    );
  const yearRate =
    yearTotals.total === 0
      ? 0
      : Math.round((yearTotals.done / yearTotals.total) * 100);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-4 pb-10 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-balance">
            {year}년
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {yearTotals.total}건 중{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {yearTotals.done}건
            </span>{" "}
            완료 · 실천율{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {yearRate}%
            </span>
            {" · "}
            연속{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {streak}일
            </span>
            {longest > streak && ` (최장 ${longest}일)`}
          </p>
        </div>
        <PeriodNav
          prevHref={`/year?year=${year - 1}`}
          nextHref={`/year?year=${year + 1}`}
          currentHref="/year"
          currentLabel="올해"
          prevLabel="이전 해"
          nextLabel="다음 해"
        />
      </header>

      <YearHeatmap months={months} />

      <AchievementGrid achievements={achievements} />
    </div>
  );
}
