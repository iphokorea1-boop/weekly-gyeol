import { addDays, isDoneOn, occursOn, toDateOnly, type ScheduledTask } from "@/lib/task-utils";

export type GamifiedTask = ScheduledTask & {
  priority: number;
  createdAt: Date;
  completions: { date: Date; completedAt: Date }[];
};

/**
 * A day counts as kept if you finished most of it — not all of it. An
 * all-or-nothing bar is what makes streaks brittle: one 90% day resets you to
 * zero and the whole thing stops being worth protecting.
 */
export const DAILY_GOAL_RATE = 0.7;

const XP_BY_PRIORITY = [5, 10, 15];

export function xpFor(priority: number): number {
  return XP_BY_PRIORITY[priority] ?? 5;
}

export const XP_PER_LEVEL = 150;

export function levelFromXp(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const into = xp % XP_PER_LEVEL;
  return { level, into, need: XP_PER_LEVEL, pct: Math.round((into / XP_PER_LEVEL) * 100) };
}

// A task only counts toward a date it existed for; otherwise adding a routine
// today would retroactively mark every past day as missed.
function scheduledOn(tasks: GamifiedTask[], date: Date) {
  return tasks.filter(
    (t) => occursOn(t, date) && toDateOnly(new Date(t.createdAt)) <= date
  );
}

export type DayOutcome = "kept" | "missed" | "empty";

export function dayStatus(tasks: GamifiedTask[], date: Date) {
  const items = scheduledOn(tasks, date);
  if (items.length === 0) {
    return { outcome: "empty" as DayOutcome, total: 0, done: 0, rate: 0 };
  }
  const done = items.filter((t) => isDoneOn(t, date)).length;
  const rate = done / items.length;
  return {
    outcome: (rate >= DAILY_GOAL_RATE ? "kept" : "missed") as DayOutcome,
    total: items.length,
    done,
    rate,
  };
}

function earliestDay(tasks: GamifiedTask[], fallback: Date): Date {
  if (tasks.length === 0) return fallback;
  return tasks.reduce((min, t) => {
    const d = toDateOnly(new Date(t.createdAt));
    return d < min ? d : min;
  }, fallback);
}

export function computeStreaks(tasks: GamifiedTask[], today: Date) {
  const start = earliestDay(tasks, today);

  // Today stays neutral until it's actually kept — an unfinished morning
  // shouldn't read as a broken streak.
  let current = 0;
  let cursor = dayStatus(tasks, today).outcome === "kept" ? today : addDays(today, -1);
  while (cursor >= start) {
    const { outcome } = dayStatus(tasks, cursor);
    if (outcome === "missed") break;
    if (outcome === "kept") current++;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  for (let d = new Date(start); d <= today; d = addDays(d, 1)) {
    const { outcome } = dayStatus(tasks, d);
    if (outcome === "kept") {
      run++;
      longest = Math.max(longest, run);
    } else if (outcome === "missed") {
      run = 0;
    }
  }
  longest = Math.max(longest, current);

  return { current, longest };
}

export function totalXp(tasks: GamifiedTask[]): number {
  return tasks.reduce(
    (sum, t) => sum + t.completions.length * xpFor(t.priority),
    0
  );
}

export function xpInRange(tasks: GamifiedTask[], from: Date, to: Date): number {
  return tasks.reduce((sum, t) => {
    const hits = t.completions.filter((c) => {
      const d = toDateOnly(new Date(c.date));
      return d >= from && d <= to;
    }).length;
    return sum + hits * xpFor(t.priority);
  }, 0);
}

export type Achievement = {
  id: string;
  name: string;
  hint: string;
  earned: boolean;
  progress: number; // 0..1
};

export function computeAchievements(
  tasks: GamifiedTask[],
  today: Date
): Achievement[] {
  const completions = tasks.flatMap((t) => t.completions);
  const totalDone = completions.length;
  const { longest } = computeStreaks(tasks, today);

  const start = earliestDay(tasks, today);
  let perfectDays = 0;
  for (let d = new Date(start); d <= today; d = addDays(d, 1)) {
    const s = dayStatus(tasks, d);
    if (s.total > 0 && s.done === s.total) perfectDays++;
  }

  const earlyBirds = completions.filter(
    (c) => new Date(c.completedAt).getHours() < 9
  ).length;

  const backlogEmpty =
    tasks.filter((t) => !t.dueDate && !t.weekdays).length === 0 && tasks.length > 0;

  const bar = (value: number, target: number) =>
    Math.max(0, Math.min(1, value / target));

  return [
    {
      id: "first",
      name: "첫 걸음",
      hint: "무엇이든 하나 완료하기",
      earned: totalDone >= 1,
      progress: bar(totalDone, 1),
    },
    {
      id: "streak3",
      name: "사흘의 힘",
      hint: "3일 연속 목표 달성",
      earned: longest >= 3,
      progress: bar(longest, 3),
    },
    {
      id: "streak7",
      name: "한 주 완주",
      hint: "7일 연속 목표 달성",
      earned: longest >= 7,
      progress: bar(longest, 7),
    },
    {
      id: "streak30",
      name: "한 달의 관성",
      hint: "30일 연속 목표 달성",
      earned: longest >= 30,
      progress: bar(longest, 30),
    },
    {
      id: "perfect",
      name: "완벽한 하루",
      hint: "하루 일정을 100% 끝내기",
      earned: perfectDays >= 1,
      progress: bar(perfectDays, 1),
    },
    {
      id: "perfect10",
      name: "완벽한 열흘",
      hint: "100% 달성한 날 10일 모으기",
      earned: perfectDays >= 10,
      progress: bar(perfectDays, 10),
    },
    {
      id: "done50",
      name: "쌓인 50건",
      hint: "누적 50건 완료",
      earned: totalDone >= 50,
      progress: bar(totalDone, 50),
    },
    {
      id: "early",
      name: "아침형 인간",
      hint: "오전 9시 전에 10건 완료",
      earned: earlyBirds >= 10,
      progress: bar(earlyBirds, 10),
    },
    {
      id: "backlog",
      name: "비워낸 서랍",
      hint: "미배치함을 전부 비우기",
      earned: backlogEmpty,
      progress: backlogEmpty ? 1 : 0,
    },
  ].map((a) => ({ ...a, progress: a.earned ? 1 : a.progress })) as Achievement[];
}
