import { createHmac, timingSafeEqual } from "node:crypto";
import { formatKo, toDateOnly } from "@/lib/task-utils";

/**
 * Deciding when an account has gone quiet, and what to say to it.
 *
 * Everything here is a pure function of its arguments — no database, no clock
 * of its own, no network. The cron job supplies the rows and `now`, which is
 * what makes the boundaries (exactly N days, cooldown, opt-out) testable
 * without a database or a fake calendar.
 */

export type NudgeAccount = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  lastActiveAt: Date | null;
  lastNudgeAt: Date | null;
  nudgeEmails: boolean;
};

export type NudgeDecision =
  | { nudge: true; quiet: number }
  | { nudge: false; reason: string };

export const DEFAULT_AFTER_DAYS = 3;

export function nudgeAfterDays(): number {
  const raw = Number(process.env.NUDGE_AFTER_DAYS);
  return Number.isInteger(raw) && raw >= 1 ? raw : DEFAULT_AFTER_DAYS;
}

/**
 * Whole Seoul calendar days between two instants — not 24-hour blocks. "3일째
 * 안 들어왔다" is a statement about the calendar, and measuring in elapsed hours
 * would make the answer depend on what time of day someone last visited.
 */
export function daysApart(from: Date, to: Date): number {
  const ms = toDateOnly(to).getTime() - toDateOnly(from).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function decideNudge(
  account: NudgeAccount,
  now: Date,
  afterDays: number
): NudgeDecision {
  if (!account.nudgeEmails) return { nudge: false, reason: "수신 거부" };

  // No recorded activity means the account has done nothing since signing up,
  // so signup is the clock. Falling back to "now" instead would make a
  // never-used account permanently exempt.
  const since = account.lastActiveAt ?? account.createdAt;
  const quiet = daysApart(since, now);
  if (quiet < afterDays) return { nudge: false, reason: `${quiet}일 전 활동` };

  // The cron runs daily; without a cooldown a quiet account would be mailed
  // every single morning. Reusing afterDays keeps it to one knob.
  if (account.lastNudgeAt) {
    const sinceNudge = daysApart(account.lastNudgeAt, now);
    if (sinceNudge < afterDays) {
      return { nudge: false, reason: `${sinceNudge}일 전 발송` };
    }
  }

  return { nudge: true, quiet };
}

/**
 * Signed with the account's own password hash, so this needs no extra secret to
 * configure and the link stops working if the password is ever changed.
 */
export function unsubscribeToken(userId: string, passwordHash: string): string {
  return createHmac("sha256", passwordHash).update(userId).digest("base64url");
}

export function verifyUnsubscribeToken(
  userId: string,
  passwordHash: string,
  token: string
): boolean {
  const expected = Buffer.from(unsubscribeToken(userId, passwordHash));
  const actual = Buffer.from(token);
  // timingSafeEqual throws on a length mismatch rather than returning false.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export type NudgeContent = {
  name: string | null;
  quiet: number;
  lastActive: Date | null;
  /** Dated tasks whose day has passed with no completion recorded. */
  overdue: { title: string; dueDate: Date }[];
  backlog: number;
  streak: number;
  longest: number;
  appUrl: string;
  unsubscribeUrl: string;
};

const SHOWN_OVERDUE = 3;

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

/**
 * The message leads with what is actually waiting rather than with a greeting.
 * A nudge that only says "돌아오세요" is indistinguishable from spam; one that
 * names the two overdue items is a reason to open the app.
 */
export function buildNudgeEmail(content: NudgeContent): {
  subject: string;
  html: string;
  text: string;
} {
  const { overdue, backlog, quiet, streak, longest } = content;

  const subject =
    overdue.length > 0
      ? `기한이 지난 할 일 ${overdue.length}건이 있어요 · 주간결`
      : `${quiet}일째 들르지 않으셨어요 · 주간결`;

  const shown = overdue.slice(0, SHOWN_OVERDUE);
  const rest = overdue.length - shown.length;

  const lines: string[] = [];
  lines.push(
    content.lastActive
      ? `마지막 활동: ${dayLabel(content.lastActive)} (${quiet}일 전)`
      : `가입하신 뒤 아직 한 번도 들르지 않으셨어요.`
  );
  if (overdue.length > 0) {
    lines.push(`기한이 지난 할 일 ${overdue.length}건`);
    for (const t of shown) lines.push(`  · ${t.title} — ${dayLabel(t.dueDate)}`);
    if (rest > 0) lines.push(`  · 그리고 ${rest}건 더`);
  }
  if (backlog > 0) lines.push(`미배치함에 ${backlog}건이 쌓여 있어요`);
  if (longest > 0) {
    lines.push(
      streak > 0
        ? `연속 기록 ${streak}일 (최장 ${longest}일)`
        : `연속 기록이 끊겼어요. 최장 기록은 ${longest}일이었습니다`
    );
  }

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
      ? `<ul style="margin:0 0 18px;padding-left:18px;color:#21201c;font-size:14px;line-height:1.7">
          ${shown
            .map(
              (t) =>
                `<li><strong>${escapeHtml(t.title)}</strong>
                 <span style="color:#82827c">— ${dayLabel(t.dueDate)}</span></li>`
            )
            .join("")}
          ${rest > 0 ? `<li style="color:#82827c">그리고 ${rest}건 더</li>` : ""}
        </ul>`
      : "";

  const facts = [
    content.lastActive
      ? `마지막 활동 <strong>${dayLabel(content.lastActive)}</strong> · ${quiet}일 전`
      : `가입 후 아직 첫 방문 전`,
    backlog > 0 ? `미배치함 <strong>${backlog}건</strong>` : "",
    longest > 0
      ? streak > 0
        ? `연속 <strong>${streak}일</strong>`
        : `연속 기록 끊김 · 최장 <strong>${longest}일</strong>`
      : "",
  ].filter(Boolean);

  // Inline styles and a single-column layout: Gmail strips <style> blocks, and
  // anything relying on flex or grid degrades unpredictably across clients.
  const html = `<div style="margin:0;padding:24px;background:#f1f0ef;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#fdfdfc;border:1px solid #dad9d6;border-radius:12px;padding:28px">
    <div style="font-size:12px;font-weight:700;color:#82827c;letter-spacing:.04em">주간결</div>
    <h1 style="margin:6px 0 16px;font-size:20px;line-height:1.4;color:#21201c">
      ${
        overdue.length > 0
          ? `기한이 지난 할 일이 ${overdue.length}건 있어요`
          : `${quiet}일째 조용하네요`
      }
    </h1>
    ${overdueHtml}
    <p style="margin:0 0 20px;font-size:13px;line-height:1.8;color:#63635e">
      ${facts.join(" · ")}
    </p>
    <a href="${content.appUrl}"
       style="display:inline-block;background:#3e63dd;color:#ffffff;text-decoration:none;
              font-size:14px;font-weight:700;padding:11px 20px;border-radius:8px">
      주간결 열기
    </a>
    <p style="margin:24px 0 0;font-size:11px;color:#82827c">
      이 메일이 성가시면
      <a href="${content.unsubscribeUrl}" style="color:#82827c">여기서 끌 수 있어요</a>.
    </p>
  </div>
</div>`;

  return { subject, html, text };
}
