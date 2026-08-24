import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { toDateOnly } from "@/lib/task-utils";

type Params = { params: Promise<{ id: string }> };

/** Prisma's code for a violated unique constraint. */
const UNIQUE_VIOLATION = "P2002";

/**
 * Records — or clears — a completion for a given occurrence date.
 *
 * The instant is resolved to a Seoul calendar day rather than the server's own:
 * the server runs in UTC, so a tick at 01:00 KST would otherwise be filed under
 * yesterday and never line up with the day the person was looking at.
 *
 * `completed` says which state the caller wants; without it the route falls
 * back to flipping whatever it finds, which is what older clients send. The
 * difference matters under a slow connection. Read-then-write meant two taps
 * arriving before the first write landed both saw "not completed": one created
 * the row, the other hit the unique constraint and returned a 500, leaving the
 * screen and the database disagreeing. Told the intended state, each request is
 * idempotent, the later one wins, and a repeat is not an error.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // An absent date means today. A present but unparseable one is a mistake
  // worth reporting: `new Date("아무거나")` is Invalid Date, and normalising
  // that produces a value Prisma rejects with a 500 rather than a 400.
  const raw = (body as { date?: unknown }).date;
  const occurrence = raw === undefined || raw === null ? new Date() : new Date(raw as string);
  if (Number.isNaN(occurrence.getTime())) {
    return NextResponse.json({ error: "날짜 형식이 올바르지 않습니다" }, { status: 400 });
  }
  const dateOnly = toDateOnly(occurrence);

  // TaskCompletion has no owner of its own, so ownership is checked on the
  // parent task before anything is written.
  const owned = await prisma.task.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "not found" }, { status: 404 });

  const wanted = (body as { completed?: unknown }).completed;
  if (wanted !== undefined && typeof wanted !== "boolean") {
    return NextResponse.json(
      { error: "completed는 true 또는 false여야 합니다" },
      { status: 400 }
    );
  }

  // deleteMany rather than find-then-delete: it takes the same filter and
  // reports how many rows it removed, so one statement both clears the
  // completion and answers whether there was one. That count is what makes the
  // fallback toggle below safe to run twice.
  const clear = async () =>
    (await prisma.taskCompletion.deleteMany({
      where: { taskId: id, date: dateOnly },
    })).count;

  if (wanted === false) {
    await clear();
    return NextResponse.json({ completed: false });
  }

  if (wanted === true) {
    try {
      await prisma.taskCompletion.create({ data: { taskId: id, date: dateOnly } });
    } catch (error) {
      // Someone else's request got there first. That is the state being asked
      // for, so it is an answer rather than a failure.
      const code = (error as { code?: string }).code;
      if (code !== UNIQUE_VIOLATION) throw error;
    }
    return NextResponse.json({ completed: true });
  }

  // No stated intent: flip whatever is there. Still two statements, but the
  // first one is the delete, so a concurrent pair cannot both reach the create.
  if ((await clear()) > 0) return NextResponse.json({ completed: false });

  try {
    await prisma.taskCompletion.create({ data: { taskId: id, date: dateOnly } });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== UNIQUE_VIOLATION) throw error;
  }
  return NextResponse.json({ completed: true });
}
