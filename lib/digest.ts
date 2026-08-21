import { formatKo } from "@/lib/task-utils";

/**
 * The morning briefing: what today actually holds.
 *
 * Pure, like lib/nudge.ts — the cron job supplies the rows and the date, which
 * is what makes "is there anything worth sending" and the wording testable
 * without a database or a fake clock.
 *
 * This is a different message from the nudge, not a variation of it. The nudge
 * fires when the app has been ignored and argues for opening it; the briefing
 * arrives every morning and is read *instead of* opening it. So it lists the
 * whole day rather than the three most overdue things.
 */

export type DigestItem = {
  title: string;
  /** `HH:MM`, or null for an all-day item. */
  startTime: string | null;
  endTime: string | null;
};

export type DigestContent = {
  name: string | null;
  /** The Seoul day being briefed. */
  date: Date;
  /** Routines that recur onto this weekday. */
  routines: DigestItem[];
  /** Dated tasks due today, timed ones first. */
  today: DigestItem[];
  /** Dated tasks whose day has passed with no completion recorded. */
  overdue: { title: string; dueDate: Date }[];
  backlog: number;
  holidays: string[];
  streak: number;
  appUrl: string;
  unsubscribeUrl: string;
};

const SHOWN_OVERDUE = 3;

/**
 * Whether the day has anything worth an email.
 *
 * A briefing that arrives on an empty day teaches you to ignore briefings, and
 * the habit carries over to the mornings that did have something in them. The
 * backlog deliberately does not count: it is always there, so counting it would
 * make every day non-empty and defeat the check.
 */
export function hasSomethingToSay(content: DigestContent): boolean {
  return (
    content.routines.length > 0 ||
    content.today.length > 0 ||
    content.overdue.length > 0
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dayLabel(date: Date): string {
  return formatKo(date, { month: "long", day: "numeric" });
}

function fullDayLabel(date: Date): string {
  return formatKo(date, { month: "long", day: "numeric", weekday: "long" });
}

/** "07:00–08:00", "07:00", or "" when the item has no time. */
export function timeLabel(item: DigestItem): string {
  if (!item.startTime) return "";
  return item.endTime ? `${item.startTime}–${item.endTime}` : item.startTime;
}

function itemLine(item: DigestItem): string {
  const time = timeLabel(item);
  return time ? `${time}  ${item.title}` : item.title;
}

function itemHtml(item: DigestItem): string {
  const time = timeLabel(item);
  return `<li style="margin-bottom:4px">
    ${
      time
        ? `<span style="display:inline-block;min-width:92px;color:#63635e;font-variant-numeric:tabular-nums">${time}</span>`
        : ""
    }<strong>${escapeHtml(item.title)}</strong>
  </li>`;
}

function section(title: string, items: DigestItem[], accent: string): string {
  if (items.length === 0) return "";
  return `<div style="margin:0 0 18px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.04em;color:${accent};margin-bottom:6px">
      ${title}
    </div>
    <ul style="margin:0;padding-left:18px;color:#21201c;font-size:14px;line-height:1.7">
      ${items.map(itemHtml).join("")}
    </ul>
  </div>`;
}

export function buildDigestEmail(content: DigestContent): {
  subject: string;
  html: string;
  text: string;
} {
  const { routines, today, overdue, backlog, holidays, streak } = content;
  const count = routines.length + today.length;

  // The subject line carries the whole message for anyone who only reads the
  // inbox list, so it states the number and the day rather than a greeting.
  const subject =
    count > 0
      ? `오늘 할 일 ${count}건 · ${dayLabel(content.date)}`
      : `기한이 지난 할 일 ${overdue.length}건 · ${dayLabel(content.date)}`;

  const shownOverdue = overdue.slice(0, SHOWN_OVERDUE);
  const restOverdue = overdue.length - shownOverdue.length;

  const lines: string[] = [fullDayLabel(content.date)];
  if (holidays.length > 0) lines.push(`공휴일: ${holidays.join(" · ")}`);
  lines.push("");

  if (today.length > 0) {
    lines.push(`오늘 일정 ${today.length}건`);
    for (const t of today) lines.push(`  · ${itemLine(t)}`);
    lines.push("");
  }
  if (routines.length > 0) {
    lines.push(`정기 루틴 ${routines.length}건`);
    for (const t of routines) lines.push(`  · ${itemLine(t)}`);
    lines.push("");
  }
  if (overdue.length > 0) {
    lines.push(`기한이 지난 할 일 ${overdue.length}건`);
    for (const t of shownOverdue) {
      lines.push(`  · ${t.title} — ${dayLabel(t.dueDate)}`);
    }
    if (restOverdue > 0) lines.push(`  · 그리고 ${restOverdue}건 더`);
    lines.push("");
  }

  const facts = [
    backlog > 0 ? `미배치함 ${backlog}건` : "",
    streak > 0 ? `연속 ${streak}일` : "",
  ].filter(Boolean);
  if (facts.length > 0) lines.push(facts.join(" · "));

  const text = [
    subject,
    "",
    ...lines,
    "",
    `열어보기: ${content.appUrl}`,
    "",
    `이 메일 그만 받기: ${content.unsubscribeUrl}`,
  ].join("\n");

  const overdueHtml =
    overdue.length > 0
      ? `<div style="margin:0 0 18px">
          <div style="font-size:11px;font-weight:700;letter-spacing:.04em;color:#ce2c31;margin-bottom:6px">
            기한이 지났어요
          </div>
          <ul style="margin:0;padding-left:18px;color:#21201c;font-size:14px;line-height:1.7">
            ${shownOverdue
              .map(
                (t) =>
                  `<li style="margin-bottom:4px"><strong>${escapeHtml(t.title)}</strong>
                   <span style="color:#82827c">— ${dayLabel(t.dueDate)}</span></li>`
              )
              .join("")}
            ${
              restOverdue > 0
                ? `<li style="color:#82827c">그리고 ${restOverdue}건 더</li>`
                : ""
            }
          </ul>
        </div>`
      : "";

  const holidayHtml =
    holidays.length > 0
      ? `<div style="margin:0 0 16px;padding:8px 12px;background:#feebec;border-left:3px solid #ce2c31;border-radius:6px;font-size:13px;font-weight:700;color:#ce2c31">
          ${escapeHtml(holidays.join(" · "))}
        </div>`
      : "";

  const footHtml =
    facts.length > 0
      ? `<p style="margin:0 0 20px;font-size:13px;line-height:1.8;color:#63635e">
          ${facts
            .map((f) => f.replace(/(\d+)(건|일)/, "<strong>$1$2</strong>"))
            .join(" · ")}
        </p>`
      : "";

  // Inline styles and a single-column layout: Gmail strips <style> blocks, and
  // anything relying on flex or grid degrades unpredictably across clients.
  const html = `<div style="margin:0;padding:24px;background:#f1f0ef;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#fdfdfc;border:1px solid #dad9d6;border-radius:12px;padding:28px">
    <div style="font-size:12px;font-weight:700;color:#82827c;letter-spacing:.04em">주간결</div>
    <h1 style="margin:6px 0 4px;font-size:20px;line-height:1.4;color:#21201c">
      ${
        count > 0
          ? `오늘 할 일 ${count}건`
          : `기한이 지난 할 일 ${overdue.length}건`
      }
    </h1>
    <p style="margin:0 0 18px;font-size:13px;color:#82827c">${fullDayLabel(content.date)}</p>
    ${holidayHtml}
    ${section("오늘 일정", today, "#3e63dd")}
    ${section("정기 루틴", routines, "#8e4ec6")}
    ${overdueHtml}
    ${footHtml}
    <a href="${content.appUrl}"
       style="display:inline-block;background:#3e63dd;color:#ffffff;text-decoration:none;
              font-size:14px;font-weight:700;padding:11px 20px;border-radius:8px">
      주간결 열기
    </a>
    <p style="margin:24px 0 0;font-size:11px;color:#82827c">
      매일 아침 보내드리는 메일이에요.
      <a href="${content.unsubscribeUrl}" style="color:#82827c">여기서 끌 수 있어요</a>.
    </p>
  </div>
</div>`;

  return { subject, html, text };
}
