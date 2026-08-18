import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/task-utils";

type Params = { params: Promise<{ id: string }> };

// Toggles completion for a given occurrence date (defaults to today).
// The instant is resolved to a Seoul calendar day, not the server's own — the
// server runs in UTC, so a tick at 01:00 KST would otherwise be filed under
// yesterday and never line up with the day the user was looking at.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const dateOnly = toDateOnly(body.date ? new Date(body.date) : new Date());

  const existing = await prisma.taskCompletion.findUnique({
    where: { taskId_date: { taskId: id, date: dateOnly } },
  });

  if (existing) {
    await prisma.taskCompletion.delete({ where: { id: existing.id } });
    return NextResponse.json({ completed: false });
  }

  await prisma.taskCompletion.create({
    data: { taskId: id, date: dateOnly },
  });
  return NextResponse.json({ completed: true });
}
