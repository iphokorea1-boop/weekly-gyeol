import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import {
  capacityPercent,
  formatKo,
  formatWeekdays,
  isSameDay,
  routineOccursOn,
  taskKind,
  todayInSeoul,
  toDateOnly,
} from "@/lib/task-utils";
import { holidayLabel, holidaysOn } from "@/lib/holidays";
import { computeStreaks, totalXp, xpFor } from "@/lib/gamification";
import { type TaskItemData } from "@/app/components/task-item";
import TodayBoard from "@/app/components/today-board";
import AddTaskForm from "@/app/components/add-task-form";
import KindLegend from "@/app/components/kind-legend";
import StreakCard from "@/app/components/streak-card";
import Landing from "@/app/components/landing";

export const dynamic = "force-dynamic";

function formatToday(d: Date) {
  return formatKo(d, { month: "long", day: "numeric", weekday: "long" });
}

/**
 * Two pages behind one address.
 *
 * A stranger gets the pitch; the owner gets today's board. They share a URL
 * because that URL is the one that gets pasted into a message — sending someone
 * to a login screen to explain what the app is has never worked, and a separate
 * /about that nobody links to works no better.
 *
 * `getCurrentUser` rather than `requireUser`: this is the one route that must
 * render something for a visitor with no session instead of redirecting. The
 * matching exemption lives in proxy.ts, and neither half works alone.
 */
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return <Landing />;

  const tasks = await prisma.task.findMany({
    where: { archived: false, userId: user.id },
    include: { completions: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  const today = todayInSeoul();
  const todayHolidays = holidaysOn(today);

  const routines = tasks.filter(
    (t) => taskKind(t) === "routine" && routineOccursOn(t.weekdays, today)
  );
  /**
   * A dated task is finished when a completion is filed against its own due
   * date — never against today, which is why an overdue row ticked this
   * morning still reads as "done on 8월 21일".
   */
  const datedDone = (t: (typeof tasks)[number]) =>
    t.completions.some((c) => isSameDay(new Date(c.date), new Date(t.dueDate!)));

  /**
   * Which dated tasks belong on today's board.
   *
   * The rule was nothing but `dueDate <= today`, which quietly meant every
   * dated task ever completed stayed here for good: one account had nineteen
   * rows on this page with fourteen of them finished weeks earlier, and the
   * 완료 pile only ever grew. The weekly board hid that — its 종일 chips drew
   * finished and unfinished identically — so the page looked like it had lost
   * the two it had actually filed away.
   *
   * So the past is carried over only while it is still unfinished. The one
   * exception is a row finished *today*: its completion is filed under its own
   * due date, so without this it would vanish mid-tap instead of settling into
   * 완료 where the person just put it.
   */
  const dated = tasks.filter((t) => {
    if (taskKind(t) !== "dated" || !t.dueDate) return false;
    const due = toDateOnly(new Date(t.dueDate));
    if (due > today) return false;
    if (isSameDay(due, today)) return true;
    if (!datedDone(t)) return true;
    return t.completions.some((c) => isSameDay(new Date(c.completedAt), today));
  });
  const floating = tasks.filter((t) => taskKind(t) === "floating");

  const toRoutineItem = (t: (typeof tasks)[number]): TaskItemData => {
    const days = t.weekdays?.split(",").length ?? 0;
    return {
      id: t.id,
      title: t.title,
      startTime: t.startTime,
      endTime: t.endTime,
      weekdaysLabel: days < 7 ? formatWeekdays(t.weekdays) : undefined,
      done: t.completions.some((c) => isSameDay(new Date(c.date), today)),
      xp: xpFor(t.priority),
    };
  };

  const toDatedItem = (t: (typeof tasks)[number]): TaskItemData => {
    const due = new Date(t.dueDate!);
    return {
      id: t.id,
      title: t.title,
      startTime: t.startTime,
      endTime: t.endTime,
      done: datedDone(t),
      xp: xpFor(t.priority),
      occurrenceDate: due,
      overdue: toDateOnly(due) < today,
    };
  };

  const toFloatingItem = (t: (typeof tasks)[number]): TaskItemData => ({
    id: t.id,
    title: t.title,
    startTime: null,
    endTime: null,
    done: t.completions.length > 0,
    xp: xpFor(t.priority),
  });

  const scheduled = [...dated, ...routines];
  const doneCount =
    dated.filter((t) => toDatedItem(t).done).length +
    routines.filter((t) => toRoutineItem(t).done).length;
  const donePct =
    scheduled.length === 0
      ? 0
      : Math.round((doneCount / scheduled.length) * 100);
  const capacityPct = capacityPercent(scheduled);
  const { current: streak, longest } = computeStreaks(tasks, today);
  const xp = totalXp(tasks);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-4 pt-5 pb-10 sm:px-6">
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-balance">
            오늘
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
            <span className={todayHolidays.length > 0 ? "text-holiday" : ""}>
              {formatToday(today)}
            </span>
            {todayHolidays.length > 0 && (
              <span className="rounded-full border border-holiday-line bg-holiday-soft px-2 py-0.5 text-[11px] font-semibold text-holiday">
                {holidayLabel(todayHolidays)}
              </span>
            )}
          </p>
        </div>
        <p className="flex-none text-right text-xs text-ink-faint">
          <span className="font-semibold tabular-nums text-foreground">
            {donePct}%
          </span>{" "}
          완료
          <br />
          하루의 {capacityPct}% 사용
        </p>
      </header>

      <StreakCard
        streak={streak}
        longest={longest}
        xp={xp}
        todayDone={doneCount}
        todayTotal={scheduled.length}
      />

      {/* The three lists and the finished pile are one component: checking a
          row moves it between them, and that has to happen on the tap rather
          than on the next server render. */}
      <TodayBoard
        dated={dated.map(toDatedItem)}
        routines={routines.map(toRoutineItem)}
        floating={floating.map(toFloatingItem)}
      />

      <section>
        <AddTaskForm />
      </section>

      <KindLegend className="mt-auto pt-4" />
    </div>
  );
}
