import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { parseTaskInput, readJson } from "@/lib/task-input";

/**
 * Rows one account may hold, archived ones included.
 *
 * task-input.ts caps how big a single task can be; nothing capped how many of
 * them there could be. Someone using this every day for years does not come
 * near a thousand — a loop pointed at this endpoint reaches it in seconds, and
 * the database is one free-tier instance shared by every account, so one
 * account filling it is an outage for all of them.
 */
const TASK_LIMIT = 1000;

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

  // Counted after the body is checked, so a malformed request still gets the
  // reason it was malformed rather than a quota message that explains nothing.
  const held = await prisma.task.count({ where: { userId: user.id } });
  if (held >= TASK_LIMIT) {
    return NextResponse.json(
      {
        error: `할 일은 계정당 ${TASK_LIMIT}개까지예요. 오래된 항목을 지우고 다시 시도해 주세요.`,
      },
      { status: 403 }
    );
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
