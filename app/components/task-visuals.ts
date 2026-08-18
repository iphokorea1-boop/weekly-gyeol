import { Clock3, Inbox, Repeat2, type LucideIcon } from "lucide-react";
import type { TaskKind } from "@/lib/task-utils";

// Kind is carried by an icon plus a coloured rail rather than by hue alone,
// so the three categories stay distinguishable without relying on colour
// vision — and without the diagonal hatching, which turned to mush at chip size.
export const KIND_VISUALS: Record<
  TaskKind,
  {
    icon: LucideIcon;
    label: string;
    surface: string;
    rail: string;
    check: string;
    checkIdle: string;
  }
> = {
  routine: {
    icon: Repeat2,
    label: "정기 루틴",
    surface: "border-routine-line bg-routine-soft text-routine-ink",
    rail: "bg-routine",
    check: "bg-routine-ink text-routine-soft",
    checkIdle: "border-routine-line hover:border-routine-ink",
  },
  dated: {
    icon: Clock3,
    label: "날짜 있는 할 일",
    surface: "border-dated-line bg-dated-soft text-dated-ink",
    rail: "bg-dated",
    check: "bg-dated-ink text-dated-soft",
    checkIdle: "border-dated-line hover:border-dated-ink",
  },
  floating: {
    icon: Inbox,
    label: "언젠가 할 일",
    surface: "border-dashed border-floating-line bg-floating-soft text-floating-ink",
    rail: "bg-floating",
    check: "bg-floating-ink text-floating-soft",
    checkIdle: "border-floating-line hover:border-floating-ink",
  },
};
