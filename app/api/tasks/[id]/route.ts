import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { title, memo, dueDate, startTime, endTime, weekdays, priority, archived } = body;

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(memo !== undefined ? { memo } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(startTime !== undefined ? { startTime } : {}),
      ...(endTime !== undefined ? { endTime } : {}),
      ...(weekdays !== undefined ? { weekdays } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(archived !== undefined ? { archived } : {}),
    },
  });

  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
