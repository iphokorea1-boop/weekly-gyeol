/**
 * The single place session cookies are turned into a user identity.
 *
 * Every page and route handler must go through here rather than reading the
 * cookie itself, so authorization lives next to the data access it guards
 * instead of being scattered across the UI.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, hashToken } from "@/lib/auth";

export type CurrentUser = { id: string; email: string; name: string | null };

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
      user: { select: { id: true, email: true, name: true } },
    },
  });

  // Expiry is enforced here rather than trusting the cookie's own lifetime: the
  // client controls when it sends a cookie, but not what the database says.
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
});

/** For pages: sends anonymous visitors to the login screen. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
