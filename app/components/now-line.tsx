"use client";

import { useEffect, useState } from "react";
import { GRID_RANGE_MINUTES, GRID_START_HOUR } from "@/lib/task-utils";

// Marks the current time across today's column. Rendered client-side so the
// line keeps moving after the server render.
export default function NowLine({ pxPerMinute }: { pxPerMinute: number }) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setMinutes(
        now.getHours() * 60 + now.getMinutes() - GRID_START_HOUR * 60
      );
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  if (minutes === null || minutes < 0 || minutes > GRID_RANGE_MINUTES) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
      style={{ top: minutes * pxPerMinute }}
    >
      <span className="h-1.5 w-1.5 flex-none rounded-full bg-routine" />
      <span className="h-px flex-1 bg-routine" />
    </div>
  );
}
