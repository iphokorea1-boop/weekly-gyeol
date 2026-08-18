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

export const dynamic = "force-dynamic";

function formatToday(d: Date) {
  return d.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
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

  const capacityPct = capacityPercent([...routines, ...dated]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pt-4 pb-10 sm:px-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-balance">
            오늘
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{formatToday(today)}</p>
        </div>
        <div className="text-right text-xs text-ink-faint">
          <div className="text-sm font-semibold tabular-nums text-foreground">
            {capacityPct}%
          </div>
          오늘 여유
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-bold tracking-wide text-ink-faint">
          오늘 할 일
        </h2>
        <div className="flex flex-col gap-1.5">
          {dated.length === 0 && (
            <p className="px-3 py-2 text-sm text-ink-faint">
              오늘 예정된 할 일이 없어요.
            </p>
          )}
          {dated.map((t) => (
            <TaskItem key={t.id} kind="dated" task={toDatedItem(t)} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-bold tracking-wide text-ink-faint">
          정기 루틴
        </h2>
        <div className="flex flex-col gap-1.5">
          {routines.length === 0 && (
            <p className="px-3 py-2 text-sm text-ink-faint">
              오늘 해당하는 루틴이 없어요.
            </p>
          )}
          {routines.map((t) => (
            <TaskItem key={t.id} kind="routine" task={toRoutineItem(t)} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-bold tracking-wide text-ink-faint">
          미배치함 · 언젠가 할 일
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {floating.length === 0 && (
            <p className="px-3 py-2 text-sm text-ink-faint">
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

      <footer className="mt-auto pt-6 text-center text-[11px] text-ink-faint">
        빗금 = 반복 루틴 · 실선 = 날짜 있는 할 일 · 점선 = 언젠가 할 일
      </footer>
    </div>
  );
}

