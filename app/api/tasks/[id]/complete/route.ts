import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// Toggles completion for a given occurrence date (defaults to today).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const date = body.date ? new Date(body.date) : new Date();
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

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
