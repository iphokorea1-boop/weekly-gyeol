export type TaskKind = "routine" | "dated" | "floating";

export type TaskLike = {
  dueDate: Date | string | null;
  weekdays: string | null;
};

export function taskKind(task: TaskLike): TaskKind {
  if (task.weekdays) return "routine";
  if (task.dueDate) return "dated";
  return "floating";
}

export function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function parseWeekdays(weekdays: string | null): number[] {
  if (!weekdays) return [];
  return weekdays
    .split(",")
    .map((w) => Number(w.trim()))
    .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6);
}

export function routineOccursOn(weekdays: string | null, date: Date): boolean {
  return parseWeekdays(weekdays).includes(date.getDay());
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function weekdayLabel(day: number): string {
  return WEEKDAY_LABELS[day] ?? "?";
}

export function formatWeekdays(weekdays: string | null): string {
  return parseWeekdays(weekdays)
    .sort((a, b) => a - b)
    .map(weekdayLabel)
    .join(", ");
}

export function parseTimeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Falls back to a 30-minute block when only a start time is given.
export function durationMinutes(
  startTime: string | null,
  endTime: string | null
): number {
  const start = parseTimeToMinutes(startTime);
  if (start === null) return 0;
  const end = parseTimeToMinutes(endTime);
  if (end === null || end <= start) return 30;
  return end - start;
}

// The weekly grid spans 06:00–24:00, matching the approved weekly-view mockup.
export const GRID_START_HOUR = 6;
export const GRID_END_HOUR = 24;
export const GRID_RANGE_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;

// Minutes from the grid's 06:00 origin; null when untimed.
export function minutesFromGridStart(time: string | null): number | null {
  const m = parseTimeToMinutes(time);
  if (m === null) return null;
  return m - GRID_START_HOUR * 60;
}

export function capacityPercent(
  items: { startTime: string | null; endTime: string | null }[]
): number {
  const bookedMinutes = items
    .filter((t) => t.startTime)
    .reduce((sum, t) => sum + durationMinutes(t.startTime, t.endTime), 0);
  return Math.min(100, Math.round((bookedMinutes / GRID_RANGE_MINUTES) * 100));
}

export function getWeekStart(date: Date): Date {
  const d = toDateOnly(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Minimal shape the calendar views need; keeps this module free of Prisma types.
export type ScheduledTask = {
  dueDate: Date | null;
  weekdays: string | null;
  completions: { date: Date }[];
};

export function occursOn(task: ScheduledTask, date: Date): boolean {
  if (task.weekdays) return routineOccursOn(task.weekdays, date);
  if (task.dueDate) return isSameDay(new Date(task.dueDate), date);
  return false; // floating tasks aren't on the calendar until they get a date
}

export function isDoneOn(task: ScheduledTask, date: Date): boolean {
  return task.completions.some((c) => isSameDay(new Date(c.date), date));
}

export function daySummary<T extends ScheduledTask>(tasks: T[], date: Date) {
  const items = tasks.filter((t) => occursOn(t, date));
  return { items, done: items.filter((t) => isDoneOn(t, date)).length };
}

export function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

// Days of the printed month grid: whole weeks (Mon-start) covering the month.
export function getMonthGrid(monthStart: Date): Date[] {
  const monthEnd = getMonthEnd(monthStart);
  const days: Date[] = [];
  let cursor = getWeekStart(monthStart);
  while (cursor <= monthEnd || days.length % 7 !== 0) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

// Weekday index with Monday as 0, matching the grid column order.
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function formatMonthISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Parses ?month=YYYY-MM as a local date; falls back to today when absent or malformed.
export function parseMonthParam(month: string | undefined): Date {
  if (month) {
    const parsed = new Date(`${month}-01T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return getMonthStart(parsed);
  }
  return getMonthStart(new Date());
}

export function parseYearParam(year: string | undefined): number {
  const parsed = Number(year);
  if (Number.isInteger(parsed) && parsed >= 1970 && parsed <= 9999) return parsed;
  return new Date().getFullYear();
}

// Assigns side-by-side columns to time-overlapping items (classic day-view
// calendar layout: greedy column packing within each collision cluster).
export function layoutOverlaps<T>(
  items: T[],
  getStart: (item: T) => number,
  getEnd: (item: T) => number
): Array<T & { col: number; cols: number }> {
  const sorted = [...items].sort(
    (a, b) => getStart(a) - getStart(b) || getEnd(a) - getEnd(b)
  );

  const groups: T[][] = [];
  let current: T[] = [];
  let groupEnd = -Infinity;
  for (const item of sorted) {
    if (current.length === 0 || getStart(item) < groupEnd) {
      current.push(item);
      groupEnd = Math.max(groupEnd, getEnd(item));
    } else {
      groups.push(current);
      current = [item];
      groupEnd = getEnd(item);
    }
  }
  if (current.length) groups.push(current);

  const result: Array<T & { col: number; cols: number }> = [];
  for (const group of groups) {
    const columnEnds: number[] = [];
    const colOf = new Map<T, number>();
    for (const item of group) {
      const s = getStart(item);
      let placed = false;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= s) {
          columnEnds[c] = getEnd(item);
          colOf.set(item, c);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columnEnds.push(getEnd(item));
        colOf.set(item, columnEnds.length - 1);
      }
    }
    const cols = columnEnds.length;
    for (const item of group) {
      result.push({ ...item, col: colOf.get(item)!, cols });
    }
  }
  return result;
}

export function formatDateISO(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
