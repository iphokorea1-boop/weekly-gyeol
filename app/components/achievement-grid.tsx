import { Lock, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Achievement } from "@/lib/gamification";

export default function AchievementGrid({
  achievements,
}: {
  achievements: Achievement[];
}) {
  const earned = achievements.filter((a) => a.earned).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-xs font-bold tracking-wide text-ink-faint">배지</h2>
        <span className="text-xs font-semibold tabular-nums text-ink-faint">
          {earned}/{achievements.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={cn(
              "flex flex-col gap-1.5 rounded-xl border p-3 transition-all duration-300 ease-[var(--ease-smooth)] hover:-translate-y-0.5 hover:shadow-sm",
              a.earned
                ? "border-routine-line bg-routine-soft text-routine-ink"
                : "border-border bg-surface text-ink-soft"
            )}
          >
            <div className="flex items-center gap-1.5">
              {a.earned ? (
                <Medal className="h-4 w-4 flex-none" strokeWidth={2.25} />
              ) : (
                <Lock className="h-3.5 w-3.5 flex-none opacity-60" strokeWidth={2.25} />
              )}
              <span className="truncate text-[13px] font-bold">{a.name}</span>
            </div>
            <p className="text-[11px] leading-snug opacity-80">{a.hint}</p>
            {!a.earned && a.progress > 0 && (
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-surface-sunk">
                <span
                  className="block h-full rounded-full bg-dated transition-[width] duration-700 ease-[var(--ease-smooth)]"
                  style={{ width: `${Math.round(a.progress * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
