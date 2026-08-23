import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  Inbox,
  Keyboard,
  Moon,
  Repeat2,
  Smartphone,
  Lock,
  Flame,
} from "lucide-react";

/**
 * What a stranger sees at "/".
 *
 * Everything else in the app is written for the one person who already knows
 * what it does. This page is written for someone who has never heard of it, so
 * it argues rather than informs: the problem first, then the structure that
 * answers it, then the one gesture the whole product is built around.
 *
 * There are no testimonials and no user counts, because there are none to
 * report. The section that would normally carry that proof carries the honest
 * limits instead — a list of what the app cannot do. It is the only claim on
 * the page that cannot be doubted, which is what makes it worth more here than
 * a number nobody can check.
 */

const WEEK = [
  { day: "월", blocks: [{ kind: "routine", label: "아침 달리기" }, { kind: "dated", label: "팀 회의" }] },
  { day: "화", blocks: [{ kind: "routine", label: "영어 단어" }] },
  { day: "수", blocks: [] },
  { day: "목", blocks: [{ kind: "dated", label: "치과 검진" }, { kind: "routine", label: "영어 단어" }] },
  { day: "금", blocks: [{ kind: "routine", label: "아침 달리기" }, { kind: "dated", label: "독서 모임" }] },
  { day: "토", blocks: [{ kind: "dated", label: "부모님 저녁" }] },
  { day: "일", blocks: [] },
] as const;

const BACKLOG = [
  "가계부 정리",
  "이력서 손보기",
  null, // the chip that flies; a dashed hole marks where it came from
  "자전거 수리",
  "안경 새로 맞추기",
  "책장 정리",
  "여행 알아보기",
];

const BLOCK_STYLE = {
  routine: "border-routine-line bg-routine-soft text-routine-ink",
  dated: "border-dated-line bg-dated-soft text-dated-ink",
} as const;

const KINDS = [
  {
    icon: Repeat2,
    label: "정기 루틴",
    chip: "border-routine-line bg-routine-soft text-routine-ink",
    body: "매주 같은 요일에 돌아오는 일. 한 번 정해두면 매주 다시 적을 필요가 없습니다.",
    why: "수가 가장 많아서 팔레트에서 가장 조용한 색을 씁니다.",
  },
  {
    icon: Clock3,
    label: "날짜 있는 할 일",
    chip: "border-dated-line bg-dated-soft text-dated-ink",
    body: "특정 날짜의 약속. 시각을 붙이면 주간 격자에서 자기 자리를 차지합니다.",
    why: "하루를 가장 크게 가르는 일이라 유일한 주조색을 받습니다.",
  },
  {
    icon: Inbox,
    label: "언젠가 할 일",
    chip: "border-dashed border-floating-line bg-floating-soft text-floating-ink",
    body: "하고는 싶은데 언제 할지 모르는 일. 미배치함에서 자리가 날 때까지 기다립니다.",
    why: "테두리가 점선인 것은 아직 확정되지 않았다는 뜻입니다.",
  },
];

const FEATURES = [
  {
    icon: CalendarDays,
    title: "한국 공휴일",
    body: "대체공휴일까지 자동으로 표시됩니다. 달력에서 빨강은 오직 쉬는 날에만 씁니다.",
  },
  {
    icon: Flame,
    title: "연속 기록",
    body: "며칠째 이어오고 있는지 셉니다. 끊겨도 나무라지 않고 다시 셉니다.",
  },
  {
    icon: Keyboard,
    title: "키보드 단축키",
    body: "손을 마우스로 옮기지 않고 추가하고 넘깁니다. ? 를 누르면 목록이 뜹니다.",
  },
  {
    icon: Moon,
    title: "어두운 모드",
    body: "기기 설정을 그대로 따릅니다. 따로 켜고 끌 것이 없습니다.",
  },
  {
    icon: Smartphone,
    title: "홈 화면에 설치",
    body: "휴대폰 홈 화면에 더하면 앱처럼 열립니다. 앱 스토어를 거치지 않습니다.",
  },
  {
    icon: Lock,
    title: "계정은 내 서버에",
    body: "외부 로그인 서비스를 쓰지 않습니다. 소셜 계정을 연결할 필요가 없습니다.",
  },
];

const LIMITS = [
  {
    title: "삭제에 되돌리기가 없습니다",
    body: "X 버튼은 즉시 영구 삭제입니다. 확인 창도 없습니다. 지우기 전에 한 번 더 보십시오.",
  },
  {
    title: "혼자 쓰는 앱입니다",
    body: "일정을 공유하거나 함께 편집하는 기능이 없습니다. 팀으로 쓰실 계획이라면 맞지 않습니다.",
  },
  {
    title: "메일이 스팸함으로 갈 수 있습니다",
    body: "아직 자체 발신 도메인이 없어 공용 주소로 보냅니다. 첫 메일이 안 보이면 스팸함을 확인해 주십시오.",
  },
  {
    title: "휴대폰 알림은 없습니다",
    body: "알림은 아침 메일 한 통이 전부입니다. 하루 종일 울리는 것을 원하신다면 다른 앱이 낫습니다.",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.04em] text-ink-faint">
      {children}
    </p>
  );
}

function StartButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/login"
      className={`pressable lift inline-flex items-center rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground ${className}`}
    >
      주간결 시작하기
    </Link>
  );
}

export default function Landing() {
  return (
    <div className="flex w-full flex-1 flex-col">
      {/* --- hero ------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-14 pb-10 sm:px-6 sm:pt-24">
        <div className="flex max-w-2xl flex-col items-start gap-5">
          <Eyebrow>주간 단위로 시간을 설계하는 개인 일정 관리</Eyebrow>
          <h1 className="text-5xl font-black tracking-[-0.05em] text-balance sm:text-7xl">
            쌓지 않고,
            <br />
            <span className="text-dated-ink">놓습니다.</span>
          </h1>
          <p className="max-w-lg text-base leading-relaxed font-medium text-pretty text-ink-soft sm:text-lg">
            할 일 앱은 날짜 없는 일을 목록 맨 아래에 쌓아둡니다. 주간결은
            미배치함에 모아두고, 한 주의 격자로 끌어다 놓습니다.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <StartButton />
            <span className="text-xs text-ink-faint">
              설치할 것 없이 브라우저에서 바로.
            </span>
          </div>
        </div>

        {/* The gesture the product is built around, running on a loop.
            Seven columns cannot shrink to a phone without cutting every label
            to one syllable, so the board keeps a real width and scrolls inside
            its own frame — the same answer week-board.tsx already gives. The
            fixed inner width is also what lets the chip's travel be one
            constant instead of a guess that drifts with the viewport. */}
        <div
          role="img"
          aria-label="주간 격자. 미배치함의 '사진 정리하기'가 수요일 칸으로 옮겨가 날짜 있는 할 일이 됩니다."
          className="mt-12 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg sm:mt-16"
        >
          <div className="overflow-x-auto">
            <div className="min-w-[680px] p-4 sm:p-5">
              <div className="grid grid-cols-7 gap-2" aria-hidden>
                {WEEK.map((c) => (
                  <div
                    key={c.day}
                    className={`pb-2 text-center text-[11px] font-bold ${
                      c.day === "일" ? "text-holiday" : "text-ink-faint"
                    }`}
                  >
                    {c.day}
                  </div>
                ))}

                {WEEK.map((c) => (
                  <div
                    key={c.day}
                    className={`flex min-h-32 flex-col gap-1 rounded-xl bg-surface-sunk p-1 ${
                      c.day === "수" ? "relative" : ""
                    }`}
                  >
                    {c.day === "수" && (
                      <>
                        <span className="animate-place absolute inset-x-1 top-1 truncate rounded-md border border-dated-line bg-dated-soft px-1.5 py-1 text-[10px] font-bold text-dated-ink">
                          사진 정리하기
                        </span>
                        {/* Holds the landing slot open; the chip above is out of flow. */}
                        <span className="h-[26px] flex-none" />
                      </>
                    )}
                    {c.blocks.map((b) => (
                      <span
                        key={b.label}
                        className={`truncate rounded-md border px-1.5 py-1 text-[10px] font-bold ${
                          BLOCK_STYLE[b.kind]
                        }`}
                      >
                        {b.label}
                      </span>
                    ))}
                    {c.day === "수" && (
                      <span className="truncate rounded-md border border-routine-line bg-routine-soft px-1.5 py-1 text-[10px] font-bold text-routine-ink">
                        아침 달리기
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="my-4 h-px bg-border" />

              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-bold tracking-[0.04em] text-floating-ink">
                  미배치함
                </span>
                <span className="text-[11px] text-ink-faint">
                  아직 날짜를 정하지 않은 것들
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2" aria-hidden>
                {BACKLOG.map((label, i) =>
                  label === null ? (
                    <span
                      key={i}
                      className="truncate rounded-md border border-dashed border-border-strong px-1.5 py-1 text-[10px] font-bold text-ink-faint opacity-55"
                    >
                      사진 정리하기
                    </span>
                  ) : (
                    <span
                      key={i}
                      className="truncate rounded-md border border-dashed border-floating-line bg-floating-soft px-1.5 py-1 text-[10px] font-bold text-floating-ink"
                    >
                      {label}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- problem ---------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex max-w-xl flex-col gap-4">
          <Eyebrow>문제</Eyebrow>
          <h2 className="text-3xl font-black tracking-[-0.038em] text-balance sm:text-4xl">
            목록 맨 아래는 무덤입니다
          </h2>
          <p className="text-pretty text-ink-soft">
            날짜를 정하지 않은 일은 어느 앱에서나 목록 맨 아래로 밀려납니다.
            거기서는 아무 일도 일어나지 않습니다. 다시 보이지 않으니 다시
            생각나지 않고, 생각나지 않으니 영영 미뤄집니다. 그러는 동안 목록은
            길어지기만 하고, 길어진 목록은 열어보기가 더 싫어집니다.
          </p>
          <p className="text-pretty text-ink-soft">
            문제는 의지가 아니라 <strong className="text-foreground">자리</strong>
            입니다. 언제 할지 정해지지 않은 일은 할 수 없는 일이 아니라{" "}
            <strong className="text-foreground">아직 놓이지 않은 일</strong>
            입니다.
          </p>
        </div>
      </section>

      {/* --- the three kinds -------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex max-w-xl flex-col gap-4">
          <Eyebrow>구조</Eyebrow>
          <h2 className="text-3xl font-black tracking-[-0.038em] text-balance sm:text-4xl">
            모든 일은 셋 중 하나입니다
          </h2>
          <p className="text-pretty text-ink-soft">
            화면도 데이터도 전부 이 구분 위에 서 있습니다. 세 번째가 이 앱이
            존재하는 이유입니다.
          </p>
        </div>

        <div className="mt-10 grid gap-3.5 sm:grid-cols-3">
          {KINDS.map((k) => {
            const Icon = k.icon;
            return (
              <div
                key={k.label}
                className="lift flex flex-col gap-3 rounded-xl border border-border bg-surface p-6"
              >
                <span
                  className={`flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-bold ${k.chip}`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {k.label}
                </span>
                <p className="text-sm leading-relaxed text-ink-soft">{k.body}</p>
                <p className="border-t border-border pt-3 text-xs text-ink-faint">
                  {k.why}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* --- the gesture, and the four distances ------------------------ */}
      <section className="mx-auto w-full max-w-6xl border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-10 sm:grid-cols-2 sm:gap-14">
          <div className="flex flex-col gap-4">
            <Eyebrow>핵심</Eyebrow>
            <h2 className="text-3xl font-black tracking-[-0.038em] text-balance sm:text-4xl">
              끌어다 놓으면 시간이 생깁니다
            </h2>
            <p className="text-pretty text-ink-soft">
              미배치함의 항목을 주간 격자로 끌어다 놓으면 그 순간 요일이
              붙습니다. 시각까지 정하면 하루 안에서의 자리도 정해집니다.
            </p>
            <p className="text-pretty text-ink-soft">
              목록에서 사라지는 것이 아니라{" "}
              <strong className="text-foreground">한 주 안에 자리를 얻는</strong>{" "}
              것입니다. 그래서 주간결에서는 할 일을 지우는 것보다 놓는 것이
              먼저입니다.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Eyebrow>네 가지 시야</Eyebrow>
            <h3 className="text-xl font-bold tracking-tight">
              오늘 · 주간 · 월간 · 연간
            </h3>
            <p className="text-pretty text-ink-soft">
              오늘은 지금 해야 할 것만. 주간은 시간을 배치하는 판. 월간은 약속이
              몰린 곳을 보는 눈. 연간은 이어온 기록을 한 장에.
            </p>
            <p className="text-pretty text-ink-soft">
              같은 데이터를 네 가지 거리에서 봅니다. 가까이서는 할 일이고,
              멀리서는 한 해의 결입니다.
            </p>
          </div>
        </div>
      </section>

      {/* --- the morning mail -------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-10 sm:grid-cols-2 sm:gap-14">
          <div className="flex flex-col gap-4">
            <Eyebrow>아침 7시</Eyebrow>
            <h2 className="text-3xl font-black tracking-[-0.038em] text-balance sm:text-4xl">
              그날 하루가 메일로 옵니다
            </h2>
            <p className="text-pretty text-ink-soft">
              앱을 열지 않아도 됩니다. 오늘의 일정, 오늘 돌아오는 루틴, 기한이
              지난 일, 공휴일까지 한 통에 담아 아침에 보내드립니다.
            </p>
            <p className="text-pretty text-ink-soft">
              <strong className="text-foreground">빈 날에는 오지 않습니다.</strong>{" "}
              아무것도 없는 아침에 도착한 알림은 알림을 무시하는 습관을
              가르치고, 그 습관은 내용이 있던 아침까지 넘어가기 때문입니다. 메일
              아래 링크 한 번이면 언제든 끕니다.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-sunk p-4 sm:p-6">
            <div className="rounded-xl border border-border bg-surface p-5 sm:p-6">
              <p className="text-xs font-bold tracking-[0.04em] text-ink-faint">
                주간결
              </p>
              <h4 className="mt-1.5 text-xl font-bold tracking-tight">
                오늘 할 일 4건
              </h4>
              <p className="mt-1 text-[13px] text-ink-faint">8월 23일 토요일</p>

              <p className="mt-4 rounded-md border-l-[3px] border-holiday bg-holiday-soft px-3 py-2 text-[13px] font-bold text-holiday">
                광복절 대체공휴일
              </p>

              <div className="mt-4">
                <p className="mb-1.5 text-[11px] font-bold tracking-[0.04em] text-dated-ink">
                  오늘 일정
                </p>
                <ul className="list-disc pl-[18px] text-sm leading-relaxed">
                  <li>
                    <span className="inline-block min-w-[88px] tabular-nums text-ink-soft">
                      11:00–12:30
                    </span>
                    <strong className="font-bold">치과 정기검진</strong>
                  </li>
                  <li>
                    <span className="inline-block min-w-[88px] tabular-nums text-ink-soft">
                      19:00
                    </span>
                    <strong className="font-bold">부모님 저녁 약속</strong>
                  </li>
                </ul>
              </div>

              <div className="mt-4">
                <p className="mb-1.5 text-[11px] font-bold tracking-[0.04em] text-routine-ink">
                  정기 루틴
                </p>
                <ul className="list-disc pl-[18px] text-sm leading-relaxed">
                  <li>
                    <span className="inline-block min-w-[88px] tabular-nums text-ink-soft">
                      07:00–08:00
                    </span>
                    <strong className="font-bold">아침 달리기</strong>
                  </li>
                  <li>
                    <strong className="font-bold">영어 단어 30개</strong>
                  </li>
                </ul>
              </div>

              <p className="mt-5 text-[13px] text-ink-soft">
                미배치함 <strong className="font-bold">7건</strong> · 연속{" "}
                <strong className="font-bold">12일</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- the smaller things ------------------------------------------ */}
      <section className="mx-auto w-full max-w-6xl border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex max-w-xl flex-col gap-4">
          <Eyebrow>그 밖에</Eyebrow>
          <h2 className="text-3xl font-black tracking-[-0.038em] text-balance sm:text-4xl">
            거슬리지 않게 챙기는 것들
          </h2>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="flex flex-col gap-2 bg-surface p-6"
              >
                <Icon
                  className="h-[19px] w-[19px] text-dated-ink"
                  strokeWidth={2.25}
                />
                <b className="text-[15px] font-bold tracking-tight">{f.title}</b>
                <p className="text-[13px] leading-relaxed text-ink-soft">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* --- what it cannot do ------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl border-t border-border px-4 py-16 sm:px-6 sm:py-24">
        <div className="flex max-w-xl flex-col gap-4">
          <Eyebrow>솔직하게</Eyebrow>
          <h2 className="text-3xl font-black tracking-[-0.038em] text-balance sm:text-4xl">
            아직 못 하는 것
          </h2>
          <p className="text-pretty text-ink-soft">
            쓰기 전에 아셔야 실망하지 않을 것들입니다. 고쳐지면 이 자리에서
            지우겠습니다.
          </p>
        </div>

        <dl className="mt-10 border-t border-border">
          {LIMITS.map((l) => (
            <div
              key={l.title}
              className="grid gap-1.5 border-b border-border py-5 sm:grid-cols-[15rem_1fr] sm:items-baseline sm:gap-7"
            >
              <dt className="text-[15px] font-bold">{l.title}</dt>
              <dd className="m-0 text-sm leading-relaxed text-ink-soft">
                {l.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* --- closing ------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="lift flex flex-col items-start gap-5 rounded-2xl border border-border bg-surface p-8 sm:p-14">
          <Eyebrow>시작하기</Eyebrow>
          <h2 className="text-3xl font-black tracking-[-0.038em] text-balance sm:text-4xl">
            이번 주부터 놓아보십시오
          </h2>
          <p className="max-w-md text-pretty text-ink-soft">
            가입에 필요한 것은 메일 주소 하나입니다. 미배치함에 세 가지만
            적어두고, 이번 주 격자로 하나만 끌어다 놓아 보십시오.
          </p>
          <StartButton />
          <div className="mt-2 grid w-full grid-cols-7 gap-1.5" aria-hidden>
            <i className="h-1.5 rounded-full bg-border" />
            <i className="h-1.5 rounded-full bg-routine" />
            <i className="h-1.5 rounded-full bg-dated" />
            <i className="h-1.5 rounded-full bg-border" />
            <i className="h-1.5 rounded-full bg-floating" />
            <i className="h-1.5 rounded-full bg-border" />
            <i className="h-1.5 rounded-full bg-border" />
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl border-t border-border px-4 py-10 sm:px-6">
        <p className="text-xs text-ink-faint">
          루틴, 할 일, 언젠가 할 일을 한 결로 정리합니다.
        </p>
      </footer>
    </div>
  );
}
