import { prisma } from "@/lib/prisma";
import {
  capacityPercent,
  formatWeekdays,
  isSameDay,
  routineOccursOn,
  taskKind,
  toDateOnly,
} from "@/lib/task-utils";
import TaskItem, { type TaskItemData } from "@/app/components/task-item";
import AddTaskForm from "@/app/components/add-task-form";
import KindLegend from "@/app/components/kind-legend";

export const dynamic = "force-dynamic";

function formatToday(d: Date) {
  return d.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
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

  const today = toDateOnly(new Date());

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
      overdue: toDateOnly(due) < today,
    };
  };

  const toFloatingItem = (t: (typeof tasks)[number]): TaskItemData => ({
    id: t.id,
    title: t.title,
    startTime: null,
    endTime: null,
    done: t.completions.length > 0,
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-4 pt-5 pb-10 sm:px-6">
      <section className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-balance">
            오늘
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{formatToday(today)}</p>
          <p className="mt-3 text-xs text-ink-faint">
            일정 {scheduled.length}건 · 하루의{" "}
            <span className="font-semibold tabular-nums">{capacityPct}%</span>가
            채워졌어요
          </p>
        </div>

        <div className="relative grid h-[76px] w-[76px] flex-none place-items-center">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(var(--dated) ${donePct}%, var(--surface-sunk) 0)`,
            }}
          />
          <div aria-hidden className="absolute inset-[7px] rounded-full bg-surface" />
          <div className="relative text-center leading-none">
            <div className="text-[15px] font-extrabold tabular-nums">
              {donePct}%
            </div>
            <div className="mt-0.5 text-[10px] tabular-nums text-ink-faint">
              {doneCount}/{scheduled.length}
            </div>
          </div>
        </div>
      </section>

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
