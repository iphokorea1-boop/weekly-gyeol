import { prisma } from "@/lib/prisma";
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
import { computeStreaks, totalXp, xpFor } from "@/lib/gamification";
import TaskItem, { type TaskItemData } from "@/app/components/task-item";
import AddTaskForm from "@/app/components/add-task-form";
import KindLegend from "@/app/components/kind-legend";
import StreakCard from "@/app/components/streak-card";

export const dynamic = "force-dynamic";

function formatToday(d: Date) {
  return formatKo(d, { month: "long", day: "numeric", weekday: "long" });
}

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

export default async function Home() {
  const tasks = await prisma.task.findMany({
    where: { archived: false },
    include: { completions: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  const today = todayInSeoul();

  const routines = tasks.filter(
    (t) => taskKind(t) === "routine" && routineOccursOn(t.weekdays, today)
  );
  const dated = tasks.filter((t) => {
    if (taskKind(t) !== "dated" || !t.dueDate) return false;
    return toDateOnly(new Date(t.dueDate)) <= today;
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
      done: t.completions.some((c) => isSameDay(new Date(c.date), due)),
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
          <p className="mt-1 text-sm text-ink-soft">{formatToday(today)}</p>
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

      <section className="flex flex-col gap-2">
        <SectionHeading title="오늘 할 일" count={dated.length} />
        <div className="flex flex-col gap-1.5">
          {dated.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-ink-faint">
              오늘 예정된 할 일이 없어요.
            </p>
          )}
          {dated.map((t) => (
            <TaskItem key={t.id} kind="dated" task={toDatedItem(t)} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading title="정기 루틴" count={routines.length} />
        <div className="flex flex-col gap-1.5">
          {routines.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-ink-faint">
              오늘 해당하는 루틴이 없어요.
            </p>
          )}
          {routines.map((t) => (
            <TaskItem key={t.id} kind="routine" task={toRoutineItem(t)} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading title="미배치함 · 언젠가 할 일" count={floating.length} />
        <div className="flex flex-wrap gap-1.5">
          {floating.length === 0 && (
            <p className="w-full rounded-lg border border-dashed border-border px-3 py-3 text-sm text-ink-faint">
              쌓아둔 할 일이 없어요.
            </p>
          )}
          {floating.map((t) => (
            <TaskItem key={t.id} kind="floating" task={toFloatingItem(t)} />
          ))}
        </div>
      </section>

      <section>
        <AddTaskForm />
      </section>

      <KindLegend className="mt-auto pt-4" />
    </div>
  );
}
