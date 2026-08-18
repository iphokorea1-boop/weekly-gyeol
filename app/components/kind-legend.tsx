import { cn } from "@/lib/utils";
import { KIND_VISUALS } from "@/app/components/task-visuals";
import type { TaskKind } from "@/lib/task-utils";

const ORDER: TaskKind[] = ["routine", "dated", "floating"];

export default function KindLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-medium",
        className
      )}
    >
      {ORDER.map((kind) => {
        const visuals = KIND_VISUALS[kind];
        const Icon = visuals.icon;
        return (
          <span
            key={kind}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2 py-1",
              visuals.surface
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={2.5} />
            {visuals.label}
          </span>
        );
      })}
    </div>
  );
}
