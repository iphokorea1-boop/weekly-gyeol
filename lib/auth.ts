/**
 * Passwords and sessions.
 *
 * No auth dependency is used here on purpose: scrypt ships with Node and is an
 * OWASP-recommended password KDF, and opaque database sessions need no signing
 * secret to configure or leak. This module imports `next/headers`, so importing
 * it from a client component fails at build time — the same guard the
 * `server-only` package would give.
 */
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;
const KEY_LENGTH = 64;

/**
 * Hangul has both composed and decomposed Unicode forms — macOS keyboards
 * produce one and Windows the other for the same visible password — so the
 * input is normalised before hashing or the same password would fail to match
 * across devices.
 */
function normalize(password: string): string {
  return password.normalize("NFKC");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(normalize(password), salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;

  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(
    normalize(password),
    Buffer.from(saltB64, "base64"),
    expected.length
  );
  // timingSafeEqual throws rather than returning false on a length mismatch.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** The cookie carries the raw token; only its digest is ever stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Not forced on in development, where the dev server is plain http and a
    // secure cookie would simply never be sent back.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    // deleteMany rather than delete: a stale cookie whose row is already gone
    // should log out cleanly instead of throwing.
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}
