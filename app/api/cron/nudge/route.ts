import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import {
  appUrl,
  buildNudgeEmail,
  decideNudge,
  nudgeAfterDays,
  unsubscribeToken,
} from "@/lib/nudge";
import { computeStreaks } from "@/lib/gamification";
import { isSameDay, toDateOnly, todayInSeoul } from "@/lib/task-utils";

export const dynamic = "force-dynamic";

/**
 * Daily job: mail anyone whose account has gone quiet.
 *
 * Scheduled by `vercel.json`. Vercel sends `Authorization: Bearer $CRON_SECRET`
 * with every cron request, which is the only thing separating this from a URL
 * anyone could hit to make the app send mail.
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

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // 503 rather than 401: the request may well have been legitimate, and the
    // thing that is wrong is the deployment, not the caller.
    return NextResponse.json(
      { error: "CRON_SECRET 미설정 — 스케줄러를 인증할 수 없습니다" },
      { status: 503 }
    );
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = todayInSeoul();
  const afterDays = nudgeAfterDays();
  const base = appUrl();

  const accounts = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      lastActiveAt: true,
      lastNudgeAt: true,
      nudgeEmails: true,
      passwordHash: true,
    },
  });

  const results: {
    account: string;
    outcome: string;
    detail?: string;
  }[] = [];

  for (const account of accounts) {
    const decision = decideNudge(account, now, afterDays);
    if (!decision.nudge) {
      results.push({ account: mask(account.email), outcome: "건너뜀", detail: decision.reason });
      continue;
    }

    const tasks = await prisma.task.findMany({
      where: { userId: account.id, archived: false },
      include: { completions: true },
    });

    const overdue = tasks
      .filter((t) => !t.weekdays && t.dueDate)
      .filter((t) => toDateOnly(new Date(t.dueDate!)) < today)
      .filter(
        (t) => !t.completions.some((c) => isSameDay(new Date(c.date), new Date(t.dueDate!)))
      )
      .map((t) => ({ title: t.title, dueDate: new Date(t.dueDate!) }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const { current, longest } = computeStreaks(tasks, today);
    const token = unsubscribeToken(account.id, account.passwordHash);

    const mail = buildNudgeEmail({
      name: account.name,
      quiet: decision.quiet,
      lastActive: account.lastActiveAt,
      overdue,
      backlog: tasks.filter((t) => !t.weekdays && !t.dueDate).length,
      streak: current,
      longest,
      appUrl: base,
      unsubscribeUrl: `${base}/api/nudge/unsubscribe?u=${account.id}&t=${token}`,
    });

    const sent = await sendMail({ to: account.email, ...mail });
    // lastNudgeAt is only advanced on a real send, so a provider outage means
    // the account is tried again tomorrow rather than silently skipped for the
    // whole cooldown.
    if (sent.status === "sent") {
      await prisma.user.update({
        where: { id: account.id },
        data: { lastNudgeAt: now },
      });
    }

    results.push({
      account: mask(account.email),
      outcome: sent.status,
      detail: sent.status === "sent" ? `${decision.quiet}일 조용` : sent.reason,
    });
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    afterDays,
    checked: accounts.length,
    results,
  });
}
