import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { toDateOnly } from "@/lib/task-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tasks = await prisma.task.findMany({
    where: { archived: false, userId: user.id },
    include: { completions: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
      // Ownership comes from the session, never from the request body.
      userId: user.id,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
