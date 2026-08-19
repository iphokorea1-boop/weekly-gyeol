import { GRID_START_HOUR, minutesToTime } from "@/lib/task-utils";
import {
  DEFAULT_DURATION_MINUTES,
  type DragItem,
  type DropTarget,
} from "@/app/components/drag-context";

/**
 * A task as the calendar boards see it: plain strings only, because these cross
 * the server/client boundary as props. Dates travel as `YYYY-MM-DD` rather than
 * `Date` so nothing gets re-parsed in the browser's timezone on the way.
 */
export type BoardTask = {
  id: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  /** `YYYY-MM-DD`, or null for routines and backlog items. */
  dueDate: string | null;
  weekdays: string | null;
  xp: number;
  /** `YYYY-MM-DD` for every day this task is completed on. */
  completions: string[];
};

/**
 * The fields a drop changes. Fields left `undefined` are not sent, so the API's
 * partial-update semantics leave them alone; an explicit `null` clears them.
 */
export type TaskMove = {
  dueDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

export function buildMove(item: DragItem, target: DropTarget): TaskMove | null {
  switch (target.type) {
    case "timed": {
      // startMinutes is measured from the grid's 06:00 origin, not midnight.
      const start = GRID_START_HOUR * 60 + target.startMinutes;
      const duration = item.durationMinutes ?? DEFAULT_DURATION_MINUTES;
      const times = {
        startTime: minutesToTime(start),
        // A task that only ever had a start time keeps it that way; inventing
        // an end would change how long it looks on every other screen.
        endTime: item.hasEnd ? minutesToTime(start + duration) : null,
      };
      return item.kind === "routine"
        ? times
        : { dueDate: target.date, ...times };
    }
    case "allday":
      return { dueDate: target.date, startTime: null, endTime: null };
    case "backlog":
      return { dueDate: null, startTime: null, endTime: null };
    case "month":
      // Only the day changes here — the time of day is not something the month
      // grid can express, so dropping in it must not silently discard one.
      return { dueDate: target.date };
    default:
      return null;
  }
}

/** The task as it should look while the server catches up with a drop. */
export function withMove(task: BoardTask, move: TaskMove | undefined): BoardTask {
  if (!move) return task;
  return {
    ...task,
    dueDate: move.dueDate !== undefined ? move.dueDate : task.dueDate,
    startTime: move.startTime !== undefined ? move.startTime : task.startTime,
    endTime: move.endTime !== undefined ? move.endTime : task.endTime,
  };
}

/**
 * Drops the optimistic moves the server has now confirmed, and keeps the rest.
 *
 * Clearing all of them on any server change is the obvious version and it is
 * wrong: drag two tasks in quick succession and the first one's refresh throws
 * away the second one's override, snapping it back to where it started until
 * its own request lands.
 */
export function reconcileMoves(
  moves: Record<string, TaskMove>,
  serverTasks: BoardTask[]
): Record<string, TaskMove> {
  const byId = new Map(serverTasks.map((t) => [t.id, t]));
  const pending: Record<string, TaskMove> = {};

  for (const [id, move] of Object.entries(moves)) {
    const task = byId.get(id);
    // A task the server no longer returns has moved out of view entirely —
    // to another month, say. Nothing left to override.
    if (!task) continue;
    const settled =
      (move.dueDate === undefined || move.dueDate === task.dueDate) &&
      (move.startTime === undefined || move.startTime === task.startTime) &&
      (move.endTime === undefined || move.endTime === task.endTime);
    if (!settled) pending[id] = move;
  }
  return pending;
}

/**
 * Changes only when something a board renders by position has moved, so it can
 * be compared to decide whether a refreshed server render has caught up.
 */
export function placementSignature(tasks: BoardTask[]): string {
  return tasks
    .map((t) => `${t.id}:${t.dueDate}:${t.startTime}:${t.endTime}`)
    .join("|");
}
