"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

export type AuthState = { error?: string } | undefined;

const MIN_PASSWORD = 8;
// Deliberately loose. Anything stricter mostly rejects addresses that are in
// fact valid; the real check is whether the person can use it to sign in.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const name = String(formData.get("name") ?? "").trim() || null;

  if (!EMAIL_RE.test(email)) return { error: "이메일 형식이 올바르지 않아요." };
  if (password.length < MIN_PASSWORD) {
    return { error: `비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요.` };
  }

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "이미 가입된 이메일이에요." };
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    // Rows created before accounts existed have no owner. The very first
    // account adopts them — guarded on there being no users at all, so it can
    // never hand one person's data to someone who signs up later.
    const isFirstAccount = (await tx.user.count()) === 0;
    const created = await tx.user.create({
      data: { email, passwordHash, name },
      select: { id: true },
    });
    if (isFirstAccount) {
      await tx.task.updateMany({
        where: { userId: null },
        data: { userId: created.id },
      });
    }
    return created;
  });

  await createSession(user.id);
  redirect("/");
}

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const { email, password } = readCredentials(formData);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // One message for both "no such account" and "wrong password". Splitting them
  // would turn this form into an oracle for which emails are registered.
  const failed = { error: "이메일 또는 비밀번호가 올바르지 않아요." };
  if (!user) {
    // Still spend the hashing time, so response latency doesn't reveal whether
    // the address exists.
    await hashPassword(password);
    return failed;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return failed;

  await createSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
