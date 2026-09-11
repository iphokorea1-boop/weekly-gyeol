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
};

/** RRULE weekday codes, indexed the way the database stores them: 0 = Sunday. */
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

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
 * One task as its VEVENT lines, or null when it does not belong on a calendar.
 *
 * 언젠가 할 일 is the null. It has neither a date nor a weekday, which is the
 * entire point of it; a calendar has nowhere to put such a thing, and choosing
 * a day on its behalf would quietly turn the backlog into a pile of
 * appointments nobody made.
 */
function eventFor(
  task: CalendarTask,
  uidHost: string,
  appHref: string,
  stamp: string
): string[] | null {
  const minutes = parseTimeToMinutes(task.startTime);
  const length = durationMinutes(task.startTime, task.endTime);
  const weekdays = parseWeekdays(task.weekdays);

  const when: string[] = [];

  if (weekdays.length > 0) {
    const first = firstOccurrence(weekdays, task.createdAt);
    if (minutes === null) {
      when.push(
        `DTSTART;VALUE=DATE:${stampDate(first)}`,
        `DTEND;VALUE=DATE:${stampDate(addDays(first, 1))}`
      );
    } else {
      const start = seoulInstant(first, minutes);
      when.push(
        `DTSTART:${stampUtc(start)}`,
        `DTEND:${stampUtc(new Date(start.getTime() + length * 60_000))}`
      );
    }
    when.push(
      `RRULE:FREQ=WEEKLY;BYDAY=${weekdays.map((d) => BYDAY[d]).join(",")}`
    );
  } else if (task.dueDate) {
    const day = toDateOnly(new Date(task.dueDate));
    if (minutes === null) {
      // DTEND is exclusive for an all-day event: a one-day event ends the
      // following morning, and saying otherwise draws it across two days.
      when.push(
        `DTSTART;VALUE=DATE:${stampDate(day)}`,
        `DTEND;VALUE=DATE:${stampDate(addDays(day, 1))}`
      );
    } else {
      const start = seoulInstant(day, minutes);
      when.push(
        `DTSTART:${stampUtc(start)}`,
        `DTEND:${stampUtc(new Date(start.getTime() + length * 60_000))}`
      );
    }
  } else {
    return null;
  }

  return [
    "BEGIN:VEVENT",
    // A UID has to stay the same for the life of an event, or every refresh
    // files the whole feed again as new events beside the old ones.
    `UID:${task.id}@${uidHost}`,
    `DTSTAMP:${stamp}`,
    fold(`SUMMARY:${escapeText(task.title)}`),
    ...(task.memo ? [fold(`DESCRIPTION:${escapeText(task.memo)}`)] : []),
    ...when,
    fold(`URL:${appHref}`),
    "END:VEVENT",
  ];
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
    const block = eventFor(task, uidHost, appHref, stamp);
    if (block) lines.push(...block);
  }

  lines.push("END:VCALENDAR");

  // CRLF is not a preference here — RFC 5545 defines the line break, and the
  // stricter parsers reject a feed that uses bare newlines.
  return lines.join("\r\n") + "\r\n";
}
