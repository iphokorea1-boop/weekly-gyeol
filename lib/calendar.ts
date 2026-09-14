/**
 * The subscribable calendar feed.
 *
 * Notion Calendar does not subscribe to an arbitrary ICS address — it shows
 * the calendars of a connected Google, Outlook or iCloud account, and Notion
 * databases. So the way into it is to publish a feed one of those accounts can
 * subscribe to, and let Notion Calendar display that account. The same address
 * works in Apple Calendar, Outlook and Fantastical, which is the part of this
 * worth having even if Notion is never involved.
 *
 * Everything here is a pure function of its arguments — no database, no clock
 * of its own — like lib/nudge.ts and lib/digest.ts, so the awkward parts
 * (folding, escaping, which day a routine's series starts on) can be reasoned
 * about without a request.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  addDays,
  durationMinutes,
  isSameDay,
  KST_OFFSET_MINUTES,
  parseTimeToMinutes,
  parseWeekdays,
  toDateOnly,
} from "@/lib/task-utils";

/**
 * Signed with the account's own password hash, exactly as the unsubscribe link
 * is: no new secret to configure, no new column to migrate, and changing the
 * password rotates the address — the nearest thing to "revoke" that a URL
 * handed to a client which will never log in can have.
 *
 * Domain-separated from the unsubscribe token by the prefix. A calendar
 * address is pasted into Google's settings and lives in that account for
 * years; it must not also be a link that turns somebody's mail off.
 */
export function calendarToken(userId: string, passwordHash: string): string {
  return createHmac("sha256", passwordHash)
    .update(`calendar:${userId}`)
    .digest("base64url");
}

export function verifyCalendarToken(
  userId: string,
  passwordHash: string,
  token: string
): boolean {
  const expected = Buffer.from(calendarToken(userId, passwordHash));
  const actual = Buffer.from(token);
  // timingSafeEqual throws on a length mismatch rather than returning false.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** The columns the feed reads. Free of Prisma types, like ScheduledTask. */
export type CalendarTask = {
  id: string;
  title: string;
  memo: string | null;
  dueDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  weekdays: string | null;
  createdAt: Date;
  /** One entry per day the task was ticked, as date-only values. */
  completions: { date: Date }[];
};

/** RRULE weekday codes, indexed the way the database stores them: 0 = Sunday. */
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * What a finished item is prefixed with.
 *
 * A calendar has no strike-through and no checkbox, so the title is the only
 * place "done" can be said. Left unmarked, a finished task and an unfinished
 * one look identical on the day — which turned a month of calendar into a
 * month of things that all appeared to still need doing.
 */
const DONE = "✓";

/**
 * RFC 5545 escaping for a TEXT value.
 *
 * Not a theoretical concern: a title like "동인이 형 일정 공유, 할일, 중국어"
 * carries commas, and a comma is how this format separates two values. Left
 * alone it would arrive in the calendar as three events' worth of nonsense in
 * one field.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * A content line may be 75 octets long, continued on the next line after a
 * single space.
 *
 * Octets, not characters. One Hangul syllable is three bytes in UTF-8, so a
 * 26-character Korean title already overruns the limit — and a fold placed
 * mid-character would hand the client half a code point. Walking by code point
 * while counting bytes is what keeps the break between characters.
 */
function fold(line: string): string {
  const pieces: string[] = [];
  let current = "";
  let bytes = 0;
  // A continuation spends one of its 75 octets on the leading space.
  let limit = 75;

  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > limit) {
      pieces.push(current);
      current = "";
      bytes = 0;
      limit = 74;
    }
    current += character;
    bytes += size;
  }
  pieces.push(current);

  return pieces.join("\r\n ");
}

/** An instant in the UTC stamp form: 20260908T000000Z. */
function stampUtc(instant: Date): string {
  return instant.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** A date-only value in the DATE form: 20260908. */
function stampDate(dateOnly: Date): string {
  const yyyy = dateOnly.getUTCFullYear();
  const mm = String(dateOnly.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dateOnly.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

/**
 * A Seoul wall-clock time on a given day, as a real instant.
 *
 * Written out in UTC rather than as `TZID=Asia/Seoul`, which would oblige the
 * feed to carry a VTIMEZONE block describing the zone. Korea has had no
 * daylight saving since 1988, so the offset is a constant and the conversion
 * is exact — and for the same reason a weekly RRULE hung on a UTC stamp lands
 * on the same wall-clock time every week.
 */
function seoulInstant(day: Date, minutesOfDay: number): Date {
  return new Date(day.getTime() + (minutesOfDay - KST_OFFSET_MINUTES) * 60_000);
}

/**
 * The first day on or after `from` that the routine actually falls on.
 *
 * A recurring event's DTSTART has to *be* an occurrence. Starting the series
 * on the day the task was created would shift every occurrence in it whenever
 * that day is not one of the chosen weekdays.
 */
function firstOccurrence(weekdays: number[], from: Date): Date {
  let cursor = toDateOnly(from);
  for (let i = 0; i < 7; i++) {
    if (weekdays.includes(cursor.getUTCDay())) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

/**
 * How one occurrence sits on its day: the DTSTART/DTEND pair, and the
 * matching RECURRENCE-ID form for when that occurrence has to be named.
 *
 * Both come from the same place so they cannot disagree. A RECURRENCE-ID that
 * does not match the master's DTSTART for that day — a DATE against a
 * date-time, or a time one minute off — is silently ignored by clients, and
 * the override it was carrying simply never appears.
 */
function placement(day: Date, minutes: number | null, length: number) {
  if (minutes === null) {
    return {
      span: [
        `DTSTART;VALUE=DATE:${stampDate(day)}`,
        // DTEND is exclusive for an all-day event: a one-day event ends the
        // following morning, and saying otherwise draws it across two days.
        `DTEND;VALUE=DATE:${stampDate(addDays(day, 1))}`,
      ],
      recurrenceId: `RECURRENCE-ID;VALUE=DATE:${stampDate(day)}`,
    };
  }
  const start = seoulInstant(day, minutes);
  const end = new Date(start.getTime() + length * 60_000);
  return {
    span: [`DTSTART:${stampUtc(start)}`, `DTEND:${stampUtc(end)}`],
    recurrenceId: `RECURRENCE-ID:${stampUtc(start)}`,
  };
}

function vevent(
  uid: string,
  stamp: string,
  summary: string,
  memo: string | null,
  when: string[],
  appHref: string
): string[] {
  return [
    "BEGIN:VEVENT",
    // A UID has to stay the same for the life of an event, or every refresh
    // files the whole feed again as new events beside the old ones.
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    fold(`SUMMARY:${escapeText(summary)}`),
    ...(memo ? [fold(`DESCRIPTION:${escapeText(memo)}`)] : []),
    ...when,
    fold(`URL:${appHref}`),
    "END:VEVENT",
  ];
}

/**
 * One task as its VEVENT blocks — usually one, but a routine with ticked days
 * carries one more per tick — or nothing when it does not belong on a
 * calendar.
 *
 * 언젠가 할 일 is the nothing. It has neither a date nor a weekday, which is
 * the entire point of it; a calendar has nowhere to put such a thing, and
 * choosing a day on its behalf would quietly turn the backlog into a pile of
 * appointments nobody made.
 */
function eventsFor(
  task: CalendarTask,
  uidHost: string,
  appHref: string,
  stamp: string
): string[] {
  const uid = `${task.id}@${uidHost}`;
  const minutes = parseTimeToMinutes(task.startTime);
  const length = durationMinutes(task.startTime, task.endTime);
  const weekdays = parseWeekdays(task.weekdays);
  const done = `${DONE} ${task.title}`;

  if (weekdays.length > 0) {
    const first = firstOccurrence(weekdays, task.createdAt);
    const rule = `RRULE:FREQ=WEEKLY;BYDAY=${weekdays.map((d) => BYDAY[d]).join(",")}`;
    const master = placement(first, minutes, length);
    const out = vevent(uid, stamp, task.title, task.memo, [...master.span, rule], appHref);

    // A recurring event is one VEVENT, so a single occurrence cannot be
    // renamed in place. What the format offers instead is an override: a
    // second VEVENT with the same UID and a RECURRENCE-ID naming the
    // occurrence it replaces. One per ticked day, and only for days the
    // series actually lands on — a completion recorded before the weekdays
    // were changed has no occurrence to override, and naming one that does
    // not exist is ignored at best.
    for (const completion of task.completions) {
      const day = toDateOnly(new Date(completion.date));
      if (day < first || !weekdays.includes(day.getUTCDay())) continue;
      const occurrence = placement(day, minutes, length);
      out.push(
        ...vevent(
          uid,
          stamp,
          done,
          task.memo,
          [occurrence.recurrenceId, ...occurrence.span],
          appHref
        )
      );
    }
    return out;
  }

  if (!task.dueDate) return [];

  const day = toDateOnly(new Date(task.dueDate));
  // Finished means ticked against its own due date — the same rule the today
  // board applies, so a task overdue and ticked late reads as done on the day
  // it was for, not on the day the box was pressed.
  const finished = task.completions.some((c) => isSameDay(new Date(c.date), day));
  return vevent(
    uid,
    stamp,
    finished ? done : task.title,
    task.memo,
    placement(day, minutes, length).span,
    appHref
  );
}

/**
 * @param uidHost the host events are identified against. Fixed rather than
 *   taken from the request, so the same task keeps one identity however the
 *   feed was reached.
 * @param appHref where an event links back to.
 */
export function buildCalendar(
  tasks: CalendarTask[],
  now: Date,
  uidHost: string,
  appHref: string
): string {
  const stamp = stampUtc(now);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    // ASCII, because PRODID is read by machines. The name people see is
    // X-WR-CALNAME below, which is where the Hangul belongs.
    "PRODID:-//weekly-gyeol//Jugangyeol//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold("X-WR-CALNAME:주간결"),
    "X-WR-TIMEZONE:Asia/Seoul",
    // Neither is in RFC 5545, and between them they cover what the common
    // clients actually read when deciding how often to come back.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const task of tasks) {
    lines.push(...eventsFor(task, uidHost, appHref, stamp));
  }

  lines.push("END:VCALENDAR");

  // CRLF is not a preference here — RFC 5545 defines the line break, and the
  // stricter parsers reject a feed that uses bare newlines.
  return lines.join("\r\n") + "\r\n";
}
