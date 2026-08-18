import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const arrowClass =
  "pressable press-deep lift grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-ink-soft hover:border-border-strong hover:text-foreground";

// Shared prev / "back to now" / next control used by the week, month and year views.
export default function PeriodNav({
  prevHref,
  nextHref,
  currentHref,
  currentLabel,
  prevLabel,
  nextLabel,
}: {
  prevHref: string;
  nextHref: string;
  currentHref: string;
  currentLabel: string;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Link href={prevHref} aria-label={prevLabel} className={arrowClass}>
        <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
      </Link>
      <Link
        href={currentHref}
        className="pressable lift rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-border-strong hover:text-foreground"
      >
        {currentLabel}
      </Link>
      <Link href={nextHref} aria-label={nextLabel} className={arrowClass}>
        <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
