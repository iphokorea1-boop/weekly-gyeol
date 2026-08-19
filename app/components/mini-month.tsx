import Link from "next/link";
import {
  addDays,
  formatDateISO,
  formatKo,
  getMonthGrid,
  isSameDay,
  weekdayLabel,
} from "@/lib/task-utils";
import { holidayLabel, holidayMap } from "@/lib/holidays";

// Compact month for orientation in the weekly view: shows where the displayed
// week sits in the month and jumps to any other week.
export default function MiniMonth({
  monthStart,
  weekStart,
  today,
}: {
  monthStart: Date;
  weekStart: Date;
  today: Date;
}) {
  const grid = getMonthGrid(monthStart);
  const weekEnd = addDays(weekStart, 6);
  const holidays = holidayMap(grid[0], grid[grid.length - 1]);

  return (
    // Capped: below the lg breakpoint this drops out of its 248px column and
    // would otherwise stretch edge to edge, blowing the aspect-square day cells
    // up to a size that dwarfs the schedule it's meant to be a thumbnail of.
    <section className="w-full max-w-[272px] rounded-xl border border-border bg-surface p-3 shadow-sm">
      <h2 className="text-xs font-bold tracking-wide">
        {formatKo(monthStart, { year: "numeric", month: "long" })}
      </h2>

      <div className="mt-2 grid grid-cols-7 gap-y-1">
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className="text-center text-[9px] font-semibold text-ink-faint"
          >
            {weekdayLabel((i + 1) % 7)}
          </span>
        ))}

        {grid.map((date) => {
          const inWeek = date >= weekStart && date <= weekEnd;
          const inMonth = date.getUTCMonth() === monthStart.getUTCMonth();
          const isToday = isSameDay(date, today);
          const dayHolidays = holidays.get(formatDateISO(date)) ?? [];

          return (
            <Link
              key={date.toISOString()}
              href={`/week?week=${formatDateISO(date)}`}
              title={holidayLabel(dayHolidays) || undefined}
              // Text colour is one ternary chain rather than several classes:
              // two competing `text-*` utilities are resolved by their order in
              // the generated stylesheet, which nothing here controls.
              className={`pressable press-deep grid aspect-square place-items-center rounded-md text-[10px] font-semibold tabular-nums ${
                inWeek ? "bg-dated-soft" : "hover:bg-surface-sunk"
              } ${
                dayHolidays.length > 0
                  ? "text-holiday"
                  : inWeek
                    ? "text-dated-ink"
                    : ""
              } ${inMonth ? "" : "opacity-35"} ${
                isToday ? "ring-1 ring-dated" : ""
              }`}
            >
              {date.getUTCDate()}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
