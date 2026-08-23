/**
 * What the task API is willing to be told.
 *
 * The routes used to check that `title` was a non-empty string and pass the
 * rest of the body to Prisma untouched. That was fine while the only caller was
 * this app's own form, which can only produce well-formed values — but the
 * endpoints are reachable by anything holding a session cookie, and the failure
 * modes were quiet ones. A `memo` of ten megabytes is accepted and stored. A
 * `weekdays` of "nonsense" parses to an empty list, so the routine silently
 * never occurs. A `priority` of 99 earns the wrong XP for ever. None of these
 * throw; they just make the data wrong in a way no screen explains.
 *
 * So the shape is checked once, here, and both routes refuse what does not fit
 * rather than storing it. Nothing in this module touches the database or the
 * request — it maps a parsed body to either values or a reason.
 */
import { toDateOnly } from "@/lib/task-utils";

/** Long enough for a real title; short enough that nobody pastes an essay. */
const TITLE_MAX = 200;
const MEMO_MAX = 2000;
/** priority indexes XP_BY_PRIORITY in lib/gamification.ts, which has three. */
const PRIORITY_MAX = 2;

/** `HH:MM` on a 24-hour clock — exactly what <input type="time"> produces. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Only the keys actually present are set, so a PATCH can tell "leave this
 * alone" (absent) from "clear it" (null) — the distinction the route's spread
 * relies on.
 */
export type TaskFields = {
  title?: string;
  memo?: string | null;
  dueDate?: Date | null;
  startTime?: string | null;
  endTime?: string | null;
  weekdays?: string | null;
  priority?: number;
  archived?: boolean;
};

export type Parsed =
  | { ok: true; fields: TaskFields }
  | { ok: false; error: string };

function bad(error: string): Parsed {
  return { ok: false, error };
}

/** A field the client may send as null to mean "clear it". */
function nullableString(value: unknown): string | null | "invalid" {
  if (value === null || value === "") return null;
  return typeof value === "string" ? value : "invalid";
}

/**
 * @param mode create requires a title; update takes whichever keys are present.
 */
export function parseTaskInput(body: unknown, mode: "create" | "update"): Parsed {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return bad("본문이 올바르지 않습니다");
  }
  const raw = body as Record<string, unknown>;
  const fields: TaskFields = {};
  const has = (key: string) => raw[key] !== undefined;

  // --- title ---------------------------------------------------------------
  if (mode === "create" || has("title")) {
    if (typeof raw.title !== "string") return bad("제목이 필요합니다");
    const title = raw.title.trim();
    if (!title) return bad("제목이 필요합니다");
    if (title.length > TITLE_MAX) {
      return bad(`제목은 ${TITLE_MAX}자를 넘을 수 없습니다`);
    }
    fields.title = title;
  }

  // --- memo ----------------------------------------------------------------
  if (has("memo")) {
    const memo = nullableString(raw.memo);
    if (memo === "invalid") return bad("메모 형식이 올바르지 않습니다");
    if (memo !== null && memo.length > MEMO_MAX) {
      return bad(`메모는 ${MEMO_MAX}자를 넘을 수 없습니다`);
    }
    fields.memo = memo;
  }

  // --- dueDate -------------------------------------------------------------
  if (has("dueDate")) {
    if (raw.dueDate === null || raw.dueDate === "") {
      fields.dueDate = null;
    } else if (typeof raw.dueDate !== "string" && typeof raw.dueDate !== "number") {
      return bad("날짜 형식이 올바르지 않습니다");
    } else {
      const parsed = new Date(raw.dueDate);
      // `new Date("아무거나")` yields Invalid Date rather than throwing, and
      // handing that to Prisma is what turned a typo into a 500.
      if (Number.isNaN(parsed.getTime())) {
        return bad("날짜 형식이 올바르지 않습니다");
      }
      // Normalised so a due date always means the same Seoul day, whether it
      // arrived as "2026-08-19" from a date input or as a full instant.
      fields.dueDate = toDateOnly(parsed);
    }
  }

  // --- startTime / endTime -------------------------------------------------
  for (const key of ["startTime", "endTime"] as const) {
    if (!has(key)) continue;
    const time = nullableString(raw[key]);
    if (time === "invalid") return bad("시각 형식이 올바르지 않습니다");
    if (time !== null && !TIME_RE.test(time)) {
      return bad("시각은 HH:MM 형식이어야 합니다");
    }
    fields[key] = time;
  }

  // --- weekdays ------------------------------------------------------------
  if (has("weekdays")) {
    const weekdays = nullableString(raw.weekdays);
    if (weekdays === "invalid") return bad("반복 요일 형식이 올바르지 않습니다");
    if (weekdays === null) {
      fields.weekdays = null;
    } else {
      const days = weekdays.split(",").map((part) => Number(part.trim()));
      if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        return bad("반복 요일은 0(일)부터 6(토) 사이여야 합니다");
      }
      // Stored sorted and deduplicated so "3,1,1" and "1,3" are the same row.
      // lib/task-utils.ts reads this back with parseWeekdays.
      fields.weekdays = [...new Set(days)].sort((a, b) => a - b).join(",");
    }
  }

  // --- priority ------------------------------------------------------------
  if (has("priority")) {
    const priority = raw.priority;
    if (
      typeof priority !== "number" ||
      !Number.isInteger(priority) ||
      priority < 0 ||
      priority > PRIORITY_MAX
    ) {
      return bad(`중요도는 0부터 ${PRIORITY_MAX} 사이의 정수여야 합니다`);
    }
    fields.priority = priority;
  }

  // --- archived ------------------------------------------------------------
  if (has("archived")) {
    if (typeof raw.archived !== "boolean") {
      return bad("보관 여부는 true 또는 false여야 합니다");
    }
    fields.archived = raw.archived;
  }

  return { ok: true, fields };
}

/**
 * `await req.json()` throws on a malformed body, which the routes did not catch
 * — a stray character in the request turned into a 500 rather than a 400.
 */
export async function readJson(req: Request): Promise<unknown | undefined> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
