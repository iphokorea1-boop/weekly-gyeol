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
