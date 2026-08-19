import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { toDateOnly } from "@/lib/task-utils";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { title, memo, dueDate, startTime, endTime, weekdays, priority, archived } = body;

  // updateMany rather than update: it takes a non-unique filter, so ownership
  // is enforced inside the same statement. `update({ where: { id } })` would
  // happily edit another account's task for anyone who guessed an id.
  const result = await prisma.task.updateMany({
    where: { id, userId: user.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(memo !== undefined ? { memo } : {}),
      ...(dueDate !== undefined
        ? { dueDate: dueDate ? toDateOnly(new Date(dueDate)) : null }
        : {}),
      ...(startTime !== undefined ? { startTime } : {}),
      ...(endTime !== undefined ? { endTime } : {}),
      ...(weekdays !== undefined ? { weekdays } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(archived !== undefined ? { archived } : {}),
    },
  });

  // Same response whether the task is missing or simply not theirs, so the API
  // doesn't confirm that an id exists.
  if (result.count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await prisma.task.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
