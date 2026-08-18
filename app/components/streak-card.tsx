import { Flame, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAILY_GOAL_RATE, levelFromXp } from "@/lib/gamification";

export default function StreakCard({
  streak,
  longest,
  xp,
  todayDone,
  todayTotal,
}: {
  streak: number;
  longest: number;
  xp: number;
  todayDone: number;
  todayTotal: number;
}) {
  const { level, into, need, pct } = levelFromXp(xp);
  const goalCount = Math.max(1, Math.ceil(todayTotal * DAILY_GOAL_RATE));
  const goalMet = todayTotal > 0 && todayDone >= goalCount;
  const remaining = Math.max(0, goalCount - todayDone);

  const message =
    todayTotal === 0
      ? "오늘은 잡힌 일정이 없어요. 쉬어가도 기록은 그대로예요."
      : goalMet
        ? streak > 0
          ? `오늘 목표 달성! ${streak}일째 이어가는 중이에요.`
          : "오늘 목표 달성! 여기서부터 다시 쌓아봐요."
        : `${remaining}건만 더 하면 오늘 목표 달성이에요.`;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div
          className={cn(
            "flex flex-none items-center gap-2 rounded-2xl px-4 py-3 transition-colors duration-500 ease-[var(--ease-smooth)]",
            streak > 0
              ? "bg-routine-soft text-routine-ink"
              : "bg-surface-sunk text-ink-faint"
          )}
        >
          <Flame
            className={cn("h-7 w-7", streak > 0 && "fill-current")}
            strokeWidth={2}
          />
          <div className="leading-none">
            <div className="text-2xl font-extrabold tabular-nums">{streak}</div>
            <div className="mt-1 text-[11px] font-semibold">일 연속</div>
          </div>
        </div>

        <div className="min-w-[180px] flex-1">
          <p className="text-sm font-semibold text-balance">{message}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-soft">
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3" strokeWidth={2.5} />
              최장 <b className="tabular-nums text-foreground">{longest}일</b>
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" strokeWidth={2.5} />
              누적 <b className="tabular-nums text-foreground">{xp} XP</b>
            </span>
          </div>
        </div>

        <div className="min-w-[150px] flex-1">
          <div className="flex items-baseline justify-between text-[11px] font-semibold text-ink-soft">
            <span>
              레벨 <b className="tabular-nums text-foreground">{level}</b>
            </span>
            <span className="tabular-nums">
              {into} / {need}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunk">
            <span
              className="block h-full rounded-full bg-dated transition-[width] duration-700 ease-[var(--ease-smooth)]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {todayTotal > 0 && (
        <div className="flex items-center gap-2 border-t border-border bg-surface-sunk px-5 py-2.5">
          <span className="text-[11px] font-semibold text-ink-soft">
            오늘 목표
          </span>
          <div className="flex flex-1 gap-1">
            {Array.from({ length: todayTotal }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-300 ease-[var(--ease-smooth)]",
                  i < todayDone
                    ? "bg-floating"
                    : i < goalCount
                      ? "bg-border-strong"
                      : "bg-border"
                )}
              />
            ))}
          </div>
          <span className="text-[11px] font-bold tabular-nums">
            {todayDone}/{goalCount}
          </span>
        </div>
      )}
    </section>
  );
}
