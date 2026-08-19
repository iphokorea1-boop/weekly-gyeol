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

/**
 * The whole app is anchored to Korea Standard Time. "Today" has to mean today
 * in Seoul no matter where the code runs — Vercel's servers are UTC, so relying
 * on the machine's local time made the app think it was still yesterday between
 * midnight and 09:00 KST. Korea has had no daylight saving since 1988, so a
 * fixed offset is exact and needs no timezone database.
 *
 * Every calendar helper below is deliberately written with UTC getters rather
 * than local ones. That keeps results identical on a UTC server and on a KST
 * laptop, which is what the local-time versions failed to do.
 */
export const KST_OFFSET_MINUTES = 9 * 60;

/** The instant shifted so UTC getters read out Seoul wall-clock values. */
function seoulClock(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MINUTES * 60_000);
}

/**
 * Canonical date-only value: UTC midnight of the Seoul calendar day the given
 * instant falls on. Every date column in the database holds this shape, which
 * makes the function idempotent — re-normalising a stored date is a no-op.
 */
export function toDateOnly(date: Date): Date {
  const k = seoulClock(date);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
}

/** Today in Seoul, as a date-only value. */
export function todayInSeoul(): Date {
  return toDateOnly(new Date());
}

/** Minutes elapsed since Seoul midnight — used to place the "now" line. */
export function minutesOfDayInSeoul(date: Date = new Date()): number {
  const k = seoulClock(date);
  return k.getUTCHours() * 60 + k.getUTCMinutes();
}

/** Hour of the Seoul day (0–23) for the given instant. */
export function hourInSeoul(date: Date): number {
  return seoulClock(date).getUTCHours();
}

/** Builds a date-only value from calendar parts. `month` is 0-indexed. */
export function makeDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Day of week (0 Sun .. 6 Sat) on the Seoul calendar. */
export function weekdayOf(date: Date): number {
  return toDateOnly(date).getUTCDay();
}

/**
 * Formats a date-only value in Korean. These are UTC midnight, so the formatter
 * must be told to read them in UTC — left to the runtime's local zone it would
 * render the previous day for anyone west of Greenwich.
 */
export function formatKo(
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleDateString("ko-KR", { ...options, timeZone: "UTC" });
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateOnly(a).getTime() === toDateOnly(b).getTime();
}

export function parseWeekdays(weekdays: string | null): number[] {
  if (!weekdays) return [];
  return weekdays
    .split(",")
    .map((w) => Number(w.trim()))
    .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6);
}

export function routineOccursOn(weekdays: string | null, date: Date): boolean {
  return parseWeekdays(weekdays).includes(weekdayOf(date));
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
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
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
  const d = toDateOnly(date);
  return makeDate(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function getMonthEnd(date: Date): Date {
  const d = toDateOnly(date);
  return makeDate(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
}

export function addMonths(date: Date, n: number): Date {
  const d = toDateOnly(date);
  return makeDate(d.getUTCFullYear(), d.getUTCMonth() + n, 1);
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
  return (weekdayOf(date) + 6) % 7;
}

export function formatMonthISO(date: Date): string {
  const d = toDateOnly(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Parses ?month=YYYY-MM; falls back to the current Seoul month when absent or
// malformed. The explicit Z keeps parsing off the runtime's local zone.
export function parseMonthParam(month: string | undefined): Date {
  if (month) {
    const parsed = new Date(`${month}-01T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) return getMonthStart(parsed);
  }
  return getMonthStart(todayInSeoul());
}

export function parseYearParam(year: string | undefined): number {
  const parsed = Number(year);
  if (Number.isInteger(parsed) && parsed >= 1970 && parsed <= 9999) return parsed;
  return todayInSeoul().getUTCFullYear();
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

/** Inverse of `formatDateISO`. Parsed by parts so no timezone is consulted. */
export function parseDateISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return makeDate(y, m - 1, d);
}

/** Minutes since midnight → `HH:MM`. 1440 renders as `24:00`, not `00:00`. */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDateISO(date: Date): string {
  const d = toDateOnly(date);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
