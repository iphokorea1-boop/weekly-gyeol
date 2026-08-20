"use client";

import Link from "next/link";
import { weekdayLabel } from "@/lib/task-utils";
import {
  dayCaption,
  QuickAddProvider,
  useQuickAdd,
} from "@/app/components/quick-add";

export type HeatDay = {
  /** `YYYY-MM-DD`. */
  dateISO: string;
  total: number;
  done: number;
  /** Days that haven't happened yet stay blank rather than reading as failure. */
  future: boolean;
  isToday: boolean;
  /** "" when the day is not a public holiday. */
  holiday: string;
};

export type HeatMonth = {
  /** `YYYY-MM`. */
  monthISO: string;
  label: string;
  /** Blank squares before the 1st, so the month starts on the right weekday. */
  lead: number;
  days: HeatDay[];
};

// The heatmap reads as "how much of what I planned did I actually do", so it
// ramps toward the completion green. Floating chips never appear here (they
// have no date), so the colour carries no other meaning in this view.
function heatBackground(total: number, done: number): string {
  if (total === 0) return "var(--surface-sunk)";
  const pct = Math.round(18 + (done / total) * 82);
  return `color-mix(in srgb, var(--floating) ${pct}%, var(--surface-sunk))`;
}

function dayTitle(day: HeatDay): string {
  const [, month, date] = day.dateISO.split("-");
  const state = day.future
    ? "예정"
    : day.total === 0
      ? "일정 없음"
      : `${day.done}/${day.total} 완료`;
  return `${Number(month)}월 ${Number(date)}일${
    day.holiday ? ` · ${day.holiday}` : ""
  } · ${state} · 눌러서 추가`;
}

function Months({ months }: { months: HeatMonth[] }) {
  const { open: openQuickAdd } = useQuickAdd();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {months.map((month) => (
        <section
          key={month.monthISO}
          className="rounded-xl border border-border bg-surface p-3 shadow-sm"
        >
          <Link
            href={`/month?month=${month.monthISO}`}
            className="pressable text-sm font-bold hover:text-dated-ink"
          >
            {month.label}
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

            {Array.from({ length: month.lead }, (_, i) => (
              <span key={`lead-${i}`} />
            ))}

            {month.days.map((day) => (
              <button
                key={day.dateISO}
                type="button"
                title={dayTitle(day)}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  openQuickAdd(
                    {
                      kind: "dated",
                      dueDate: day.dateISO,
                      startTime: "",
                      endTime: "",
                      weekdays: [],
                    },
                    dayCaption(day.dateISO),
                    {
                      left: rect.left,
                      top: rect.top,
                      width: rect.width,
                      height: rect.height,
                    }
                  );
                }}
                style={{ background: heatBackground(day.total, day.done) }}
                className={`aspect-square rounded-[3px] transition-[outline] hover:outline hover:outline-2 hover:outline-offset-1 hover:outline-dated ${
                  day.isToday
                    ? "ring-2 ring-dated ring-offset-1 ring-offset-[var(--surface)]"
                    : ""
                }`}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * The year grid. A client component because each square opens the add form for
 * its own day — the same click the month and week views offer, on the smallest
 * target the app has.
 */
export default function YearHeatmap({ months }: { months: HeatMonth[] }) {
  return (
    <QuickAddProvider>
      <Months months={months} />

      <footer className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-ink-faint">
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
    </QuickAddProvider>
  );
}
