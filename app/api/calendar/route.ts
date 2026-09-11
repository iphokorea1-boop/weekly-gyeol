import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/nudge";
import { buildCalendar, verifyCalendarToken } from "@/lib/calendar";

export const dynamic = "force-dynamic";

/**
 * The calendar feed a subscriber polls.
 *
 * Authorisation is the signed token alone. A calendar client has no session
 * and no way to acquire one — Google fetches this from its own servers, hours
 * after the person who pasted the address has closed the tab — so requiring a
 * cookie would mean the feature could not exist. The token is an HMAC of the
 * account id under its password hash; see lib/calendar.ts for why that is the
 * key, and what changing the password does to addresses already handed out.
 *
 * `proxy.ts` does not run on /api, so this is reachable without a session by
 * design, and app/robots.ts already keeps crawlers out of /api entirely.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const id = params.get("u") ?? "";
  const token = params.get("t") ?? "";

  // 404, not 401, and the same 404 whether the account is missing or the token
  // is wrong: a feed address is a secret, and an endpoint that says "that
  // account exists, but no" is an endpoint that enumerates accounts.
  const denied = new NextResponse("not found", { status: 404 });
  if (!id || !token) return denied;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, passwordHash: true },
  });
  if (!user || !verifyCalendarToken(user.id, user.passwordHash, token)) {
    return denied;
  }

  const tasks = await prisma.task.findMany({
    where: { userId: user.id, archived: false },
    select: {
      id: true,
      title: true,
      memo: true,
      dueDate: true,
      startTime: true,
      endTime: true,
      weekdays: true,
      createdAt: true,
    },
  });

  const href = appUrl();
  const body = buildCalendar(tasks, new Date(), new URL(href).host, href);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // The body is one account's schedule. The address is unguessable, but
      // there is no reason for a CDN between here and Google to hold a copy.
      "Cache-Control": "private, no-store",
      // Names the file for anyone who opens the address in a browser instead
      // of subscribing to it, which is how most people check it works.
      "Content-Disposition": 'inline; filename="weekly-gyeol.ics"',
    },
  });
}
