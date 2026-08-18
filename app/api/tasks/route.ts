import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/task-utils";

export async function GET() {
  const tasks = await prisma.task.findMany({
    where: { archived: false },
    include: { completions: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, memo, dueDate, startTime, endTime, weekdays, priority } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      memo: memo || null,
      // Normalised so a due date always means the same Seoul day, whether it
      // arrived as "2026-08-19" from a date input or as a full instant.
      dueDate: dueDate ? toDateOnly(new Date(dueDate)) : null,
      startTime: startTime || null,
      endTime: endTime || null,
      weekdays: weekdays || null,
      priority: typeof priority === "number" ? priority : 0,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
