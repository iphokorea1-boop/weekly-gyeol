/**
 * The single place session cookies are turned into a user identity.
 *
 * Every page and route handler must go through here rather than reading the
 * cookie itself, so authorization lives next to the data access it guards
 * instead of being scattered across the UI.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, hashToken } from "@/lib/auth";

export type CurrentUser = { id: string; email: string; name: string | null };

/**
 * How stale `lastActiveAt` may get before it is rewritten. Without a throttle
 * this would be a database write on every page view and prefetch; an hour is
 * far finer than the days the inactivity nudge measures in.
 */
const ACTIVITY_THROTTLE_MS = 60 * 60 * 1000;

/**
 * Records that the account did something, after the response has already been
 * sent. `after` exists precisely so a side effect like this cannot add latency
 * to the page the person is waiting for.
 */
function recordActivity(userId: string, lastActiveAt: Date | null): void {
  if (lastActiveAt && Date.now() - lastActiveAt.getTime() < ACTIVITY_THROTTLE_MS) {
    return;
  }
  try {
    after(async () => {
      // A missed heartbeat costs one nudge sent a day early. A thrown error
      // here would cost the whole page, so it is swallowed deliberately.
      await prisma.user
        .update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
        .catch(() => {});
    });
  } catch {
    // `after` throws outside a request scope — a script importing the DAL, say.
    // Nothing to record in that case.
  }
}

/**
 * Wrapped in React's `cache` so several components rendering the same request
 * share one lookup instead of each hitting the database.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: {
        select: { id: true, email: true, name: true, lastActiveAt: true },
      },
    },
  });

  // Expiry is enforced here rather than trusting the cookie's own lifetime: the
  // client controls when it sends a cookie, but not what the database says.
  if (!session || session.expiresAt <= new Date()) return null;

  const { lastActiveAt, ...user } = session.user;
  recordActivity(user.id, lastActiveAt);
  return user;
});

/** For pages: sends anonymous visitors to the login screen. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
