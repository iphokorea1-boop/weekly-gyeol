/**
 * Rate limiting for the two forms anyone can reach without an account.
 *
 * scrypt already makes a single password guess expensive. Nothing made a
 * *million* guesses expensive: the login action would hash whatever it was
 * handed, as often as it was handed it, and the only cost to the attacker was
 * patience. Counting attempts and refusing them is the part a password hash
 * cannot do on its own.
 *
 * The counters live in Postgres rather than in a module-level Map. On Vercel a
 * request may land on any instance and instances are recycled between deploys,
 * so in-process memory would forget an attacker about as fast as it noticed
 * one — protection that reads as real in the code and is not.
 */
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/** How long strikes accumulate before the count starts over. */
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Strikes tolerated inside one window, per kind of key.
 *
 * The account limit is tight: someone who knows their own password does not
 * miss five times in a quarter of an hour. The address limit is deliberately
 * far looser, because a school or a household behind one NAT shares an address,
 * and locking the address would lock everyone sitting next to the attacker.
 */
const ACCOUNT_STRIKES = 5;
const ADDRESS_STRIKES = 30;
/** Accounts one address may create per window. */
const SIGNUP_STRIKES = 5;

/**
 * The lock doubles with every strike past the threshold, from a minute up to an
 * hour. The curve is the point: a person who fumbles their password a sixth
 * time waits two minutes and barely notices, while a script that keeps going
 * buys a minute of delay per guess and gets nowhere.
 */
const LOCK_BASE_MS = 60 * 1000;
const LOCK_MAX_MS = 60 * 60 * 1000;

export type ThrottleKey = { id: string; threshold: number };

export type Verdict = { ok: true } | { ok: false; retryAfterSec: number };

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function accountKey(email: string): ThrottleKey {
  return { id: digest(`account:${email}`), threshold: ACCOUNT_STRIKES };
}

/**
 * The caller's address, as the edge saw it.
 *
 * Vercel sets `x-forwarded-for`, and its left-most entry is the client. Entries
 * further right were appended by proxies in between and are attacker-controlled,
 * so only the first is read. Off Vercel — `next dev` on a laptop — there is no
 * such header and every attempt shares one key, which is correct: there is only
 * one caller.
 */
async function clientAddress(): Promise<string> {
  const jar = await headers();
  const forwarded = jar.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || jar.get("x-real-ip") || "unknown";
}

export async function addressKey(): Promise<ThrottleKey> {
  return {
    id: digest(`address:${await clientAddress()}`),
    threshold: ADDRESS_STRIKES,
  };
}

/**
 * Separate from `addressKey` on purpose: these count different things. A failed
 * sign-in and a created account are not interchangeable, and sharing one
 * counter would let a burst of one silence the other.
 */
export async function signupKey(): Promise<ThrottleKey> {
  return {
    id: digest(`signup:${await clientAddress()}`),
    threshold: SIGNUP_STRIKES,
  };
}

/** Whether any of these keys is currently locked, and for how much longer. */
export async function checkLimit(keys: ThrottleKey[]): Promise<Verdict> {
  const now = new Date();
  const locked = await prisma.authThrottle.findMany({
    where: { key: { in: keys.map((k) => k.id) }, lockedUntil: { gt: now } },
    select: { lockedUntil: true },
  });

  if (locked.length === 0) return { ok: true };

  // The longest lock wins. Reporting the shortest would invite a retry that is
  // still refused, which reads as the app being broken rather than strict.
  const until = Math.max(...locked.map((r) => r.lockedUntil!.getTime()));
  return {
    ok: false,
    retryAfterSec: Math.max(1, Math.ceil((until - now.getTime()) / 1000)),
  };
}

async function strike(key: ThrottleKey, now: Date): Promise<void> {
  const existing = await prisma.authThrottle.findUnique({
    where: { key: key.id },
  });

  const expired =
    !existing || now.getTime() - existing.windowStart.getTime() > WINDOW_MS;
  const strikes = expired ? 1 : existing.strikes + 1;
  const windowStart = expired ? now : existing.windowStart;

  const over = strikes - key.threshold;
  const lockedUntil =
    over >= 0
      ? new Date(now.getTime() + Math.min(LOCK_BASE_MS * 2 ** over, LOCK_MAX_MS))
      : null;

  await prisma.authThrottle.upsert({
    where: { key: key.id },
    create: { key: key.id, strikes, windowStart, lockedUntil },
    update: { strikes, windowStart, lockedUntil },
  });
}

/**
 * Counts one attempt against every key given.
 *
 * Two requests arriving together can read the same count and each write back
 * the same increment, costing the attacker one extra guess. Serialising this
 * would mean a transaction on the hot path of every failed login to buy back a
 * single guess out of five — not a trade worth making.
 */
export async function recordStrike(keys: ThrottleKey[]): Promise<void> {
  const now = new Date();
  await Promise.all(keys.map((key) => strike(key, now)));
}

/** Called on a successful sign-in: the person is who they said they were. */
export async function clearStrikes(keys: ThrottleKey[]): Promise<void> {
  await prisma.authThrottle.deleteMany({
    where: { key: { in: keys.map((k) => k.id) } },
  });
}

/**
 * Drops rows nobody is counting any more. Called from the daily cron, which is
 * already awake and is the natural janitor for this.
 */
export async function sweepThrottles(now: Date = new Date()): Promise<number> {
  const { count } = await prisma.authThrottle.deleteMany({
    where: {
      windowStart: { lt: new Date(now.getTime() - WINDOW_MS) },
      // A lock can outlive its window by up to an hour; deleting the row would
      // hand the attacker a clean slate early.
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
  });
  return count;
}

/** "3분", for a message telling someone when to come back. */
export function waitLabel(seconds: number): string {
  return `${Math.max(1, Math.ceil(seconds / 60))}분`;
}
