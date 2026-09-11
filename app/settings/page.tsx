import { CalendarPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { appUrl } from "@/lib/nudge";
import { calendarToken } from "@/lib/calendar";
import CalendarLink from "@/app/components/calendar-link";

export const dynamic = "force-dynamic";

export const metadata = { title: "설정 · 주간결" };

/**
 * Where the calendar feed address is handed over.
 *
 * A page of its own rather than a corner of the today board: the address is a
 * credential, and the today board is the screen that gets photographed and
 * sent to someone. Behind its own route it is somewhere you go on purpose.
 */
export default async function SettingsPage() {
  const user = await requireUser();

  // The token is signed with the password hash, which getCurrentUser has no
  // business carrying around, so it is fetched here and nowhere else.
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) throw new Error("계정을 찾을 수 없습니다");

  const url = `${appUrl()}/api/calendar?u=${user.id}&t=${calendarToken(
    user.id,
    row.passwordHash
  )}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-4 pt-5 pb-10 sm:px-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-balance">
          설정
        </h1>
        <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-start gap-2.5">
          <CalendarPlus
            className="mt-0.5 h-5 w-5 flex-none text-dated-ink"
            strokeWidth={2.25}
          />
          <div>
            <h2 className="text-base font-bold tracking-tight">
              캘린더에서 구독하기
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              주간결의 일정을 Google·Apple·Outlook 캘린더에서 볼 수 있습니다.
              정기 루틴은 주간 반복 일정으로, 날짜 있는 할 일은 그 날의 일정으로
              나갑니다.
            </p>
          </div>
        </div>

        <CalendarLink url={url} />

        <div className="flex flex-col gap-3 border-t border-border pt-4 text-[13px] leading-relaxed text-ink-soft">
          <div>
            <b className="text-foreground">노션 캘린더에서 보려면</b>
            <p className="mt-1">
              노션 캘린더는 이런 주소를 직접 구독하지 못하고, 연결된 Google·
              Outlook·iCloud 계정의 캘린더를 보여줍니다. 그래서 한 단계를
              거칩니다 — Google 캘린더에서 <b>다른 캘린더 → URL로 추가</b>에 위
              주소를 넣으면, 노션 캘린더에 그 Google 계정이 연결되어 있는 한
              목록에 함께 나타납니다.
            </p>
          </div>

          <div>
            <b className="text-foreground">Apple 캘린더라면</b>
            <p className="mt-1">
              파일 → 새로운 캘린더 구독에 같은 주소를 넣으면 됩니다. 갱신 주기를
              직접 정할 수 있어서 Google보다 빠릅니다.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-surface-sunk p-3.5 text-[12px] leading-relaxed text-ink-soft">
          <p>
            <b className="text-foreground">주소를 아는 사람은 누구나</b> 로그인
            없이 일정을 볼 수 있습니다. 함부로 공유하지 마세요. 비밀번호를
            바꾸면 주소가 새로 발급되고, 예전 주소로 구독한 캘린더는 그 순간
            멈춥니다.
          </p>
          <p>
            <b className="text-foreground">읽기 전용입니다.</b> 캘린더 쪽에서
            일정을 고쳐도 주간결로 돌아오지 않습니다.
          </p>
          <p>
            <b className="text-foreground">미배치함은 나가지 않습니다.</b> 날짜가
            없는 것이 언젠가 할 일의 정의라, 캘린더에 놓을 자리가 없습니다.
            주간결에서 한 주로 끌어다 놓으면 그때 따라갑니다.
          </p>
          <p>
            Google은 자기 주기대로 가져가서 바뀐 내용이 보이기까지 몇 시간,
            길게는 하루가 걸립니다. 주간결이 늦는 것이 아니라 Google이 늦게
            묻는 것이고, 구독하는 쪽에서 정할 수 없습니다.
          </p>
        </div>
      </section>
    </div>
  );
}
