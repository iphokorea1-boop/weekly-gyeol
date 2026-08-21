import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { appUrl, unsubscribeToken } from "@/lib/nudge";
import {
  buildDigestEmail,
  hasSomethingToSay,
  type DigestItem,
} from "@/lib/digest";
import { holidaysOn } from "@/lib/holidays";
import { computeStreaks } from "@/lib/gamification";
import {
  formatDateISO,
  isSameDay,
  parseTimeToMinutes,
  routineOccursOn,
  toDateOnly,
  todayInSeoul,
} from "@/lib/task-utils";

export const dynamic = "force-dynamic";

/**
 * The morning briefing: one mail a day listing what the day holds.
 *
 * Scheduled by `vercel.json` for 22:00 UTC, which is 07:00 the following day in
 * Seoul — the day this is about. `todayInSeoul()` reads the same clock, so the
 * hour-wide window Vercel's free plan allows cannot land it on the wrong day.
 */
function authorized(request: NextRequest, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Enough to tell accounts apart in a log without printing addresses into it. */
function mask(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain ?? "?"}`;
}

/** Timed items first and in clock order; untimed ones keep their own order. */
function byTime(a: DigestItem, b: DigestItem): number {
  const at = parseTimeToMinutes(a.startTime);
  const bt = parseTimeToMinutes(b.startTime);
  if (at === null && bt === null) return 0;
  if (at === null) return 1;
  if (bt === null) return -1;
  return at - bt;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET 미설정 — 스케줄러를 인증할 수 없습니다" },
      { status: 503 }
    );
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = todayInSeoul();
  const todayISO = formatDateISO(today);
  const base = appUrl();
  const holidays = holidaysOn(today).map((h) => h.name);

  const accounts = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      dailyDigest: true,
      passwordHash: true,
    },
  });

  const results: { account: string; outcome: string; detail?: string }[] = [];

  for (const account of accounts) {
    if (!account.dailyDigest) {
      results.push({ account: mask(account.email), outcome: "건너뜀", detail: "수신 거부" });
      continue;
    }

    const tasks = await prisma.task.findMany({
      where: { userId: account.id, archived: false },
      include: { completions: true },
    });

    const doneToday = (id: string) =>
      tasks
        .find((t) => t.id === id)!
        .completions.some((c) => formatDateISO(new Date(c.date)) === todayISO);

    // Already-finished items are left out. A briefing you have to re-read past
    // the things you did yesterday evening stops being a briefing.
    const routines = tasks
      .filter((t) => t.weekdays && routineOccursOn(t.weekdays, today))
      .filter((t) => !doneToday(t.id))
      .map((t) => ({ title: t.title, startTime: t.startTime, endTime: t.endTime }))
      .sort(byTime);

    const todayItems = tasks
      .filter((t) => !t.weekdays && t.dueDate)
      .filter((t) => formatDateISO(new Date(t.dueDate!)) === todayISO)
      .filter((t) => !doneToday(t.id))
      .map((t) => ({ title: t.title, startTime: t.startTime, endTime: t.endTime }))
      .sort(byTime);

    const overdue = tasks
      .filter((t) => !t.weekdays && t.dueDate)
      .filter((t) => toDateOnly(new Date(t.dueDate!)) < today)
      .filter(
        (t) => !t.completions.some((c) => isSameDay(new Date(c.date), new Date(t.dueDate!)))
      )
      .map((t) => ({ title: t.title, dueDate: new Date(t.dueDate!) }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const { current } = computeStreaks(tasks, today);
    const token = unsubscribeToken(account.id, account.passwordHash);

    const content = {
      name: account.name,
      date: today,
      routines,
      today: todayItems,
      overdue,
      backlog: tasks.filter((t) => !t.weekdays && !t.dueDate).length,
      holidays,
      streak: current,
      appUrl: base,
      unsubscribeUrl: `${base}/api/nudge/unsubscribe?u=${account.id}&t=${token}&k=digest`,
    };

    // An empty day gets no mail. See lib/digest.ts for why.
    if (!hasSomethingToSay(content)) {
      results.push({ account: mask(account.email), outcome: "건너뜀", detail: "오늘 할 일 없음" });
      continue;
    }

    const mail = buildDigestEmail(content);
    const sent = await sendMail({ to: account.email, ...mail });

    results.push({
      account: mask(account.email),
      outcome: sent.status,
      detail:
        sent.status === "sent"
          ? `루틴 ${routines.length} · 오늘 ${todayItems.length} · 지남 ${overdue.length}`
          : sent.reason,
    });
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    forDate: todayISO,
    checked: accounts.length,
    results,
  });
}
