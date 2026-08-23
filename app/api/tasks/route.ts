import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseTaskInput, readJson } from "@/lib/task-input";

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

  const parsed = parseTaskInput(await readJson(req), "create");
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      ...parsed.fields,
      // parseTaskInput guarantees a title in "create" mode; TypeScript only
      // knows the field is optional on the shared type.
      title: parsed.fields.title!,
      // Ownership comes from the session, never from the request body.
      userId: user.id,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
