import Link from "next/link";
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
  weekdayLabel,
} from "@/lib/task-utils";
import { holidayLabel, holidayMap } from "@/lib/holidays";
import { computeAchievements, computeStreaks } from "@/lib/gamification";
import PeriodNav from "@/app/components/period-nav";
import AchievementGrid from "@/app/components/achievement-grid";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ year?: string }> };

// The heatmap reads as "how much of what I planned did I actually do", so it
// ramps toward the completion green. Floating chips never appear here (they
// have no date), so the colour carries no other meaning in this view.
// Days that haven't happened yet stay blank — routines recur into every future
// day, and tinting them as 0% would make the future look like failure.
function heatBackground(total: number, done: number): string {
  if (total === 0) return "var(--surface-sunk)";
  const pct = Math.round(18 + (done / total) * 82);
  return `color-mix(in srgb, var(--floating) ${pct}%, var(--surface-sunk))`;
}

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

  const months = Array.from({ length: 12 }, (_, m) => {
    const monthStart = makeDate(year, m, 1);
    const days = Array.from(
      { length: getMonthEnd(monthStart).getUTCDate() },
      (_, i) => {
        const date = makeDate(year, m, i + 1);
        const future = date > today;
        const { items, done } = daySummary(tasks, date);
        return {
          date,
          total: future ? 0 : items.length,
          done: future ? 0 : done,
          future,
          holiday: holidayLabel(holidays.get(formatDateISO(date)) ?? []),
        };
      }
    );
    return { monthStart, days, lead: mondayIndex(monthStart) };
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {months.map(({ monthStart, days, lead }) => (
          <section
            key={monthStart.toISOString()}
            className="rounded-xl border border-border bg-surface p-3 shadow-sm"
          >
            <Link
              href={`/month?month=${formatMonthISO(monthStart)}`}
              className="pressable text-sm font-bold hover:text-dated-ink"
            >
              {monthStart.getUTCMonth() + 1}월
            </Link>

            <div className="mt-2 grid max-w-[168px] grid-cols-7 gap-1">
              {Array.from({ length: 7 }, (_, i) => (
                <span
                  key={i}
                  className="text-center text-[9px] font-semibold text-ink-faint"
                >
                  {weekdayLabel((i + 1) % 7)}
                </span>
              ))}

              {Array.from({ length: lead }, (_, i) => (
                <span key={`lead-${i}`} />
              ))}

              {days.map(({ date, total, done, future, holiday }) => (
                <span
                  key={date.toISOString()}
                  title={`${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일${
                    holiday ? ` · ${holiday}` : ""
                  } · ${
                    future
                      ? "예정"
                      : total === 0
                        ? "일정 없음"
                        : `${done}/${total} 완료`
                  }`}
                  style={{ background: heatBackground(total, done) }}
                  className={`aspect-square rounded-[3px] ${
                    isSameDay(date, today)
                      ? "ring-2 ring-dated ring-offset-1 ring-offset-[var(--surface)]"
                      : ""
                  }`}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-ink-faint">
        <span>적게 완료</span>
        {[0, 0.34, 0.67, 1].map((r) => (
          <span
            key={r}
            style={{ background: heatBackground(1, r) }}
            className="h-3 w-3 rounded-[3px]"
          />
        ))}
        <span>많이 완료</span>
        <span className="mx-1 opacity-50">·</span>
        <span
          style={{ background: heatBackground(0, 0) }}
          className="h-3 w-3 rounded-[3px]"
        />
        <span>예정 · 일정 없음</span>
      </footer>

      <AchievementGrid achievements={achievements} />
    </div>
  );
}
