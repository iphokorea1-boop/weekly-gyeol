import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { toDateOnly } from "@/lib/task-utils";

type Params = { params: Promise<{ id: string }> };

// Toggles completion for a given occurrence date (defaults to today).
// The instant is resolved to a Seoul calendar day, not the server's own — the
// server runs in UTC, so a tick at 01:00 KST would otherwise be filed under
// yesterday and never line up with the day the user was looking at.
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const dateOnly = toDateOnly(body.date ? new Date(body.date) : new Date());

  // TaskCompletion has no owner of its own, so ownership is checked on the
  // parent task before anything is written.
  const owned = await prisma.task.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const existing = await prisma.taskCompletion.findUnique({
    where: { taskId_date: { taskId: id, date: dateOnly } },
  });

  if (existing) {
    await prisma.taskCompletion.delete({ where: { id: existing.id } });
    return NextResponse.json({ completed: false });
  }

  await prisma.taskCompletion.create({ data: { taskId: id, date: dateOnly } });
  return NextResponse.json({ completed: true });
}
