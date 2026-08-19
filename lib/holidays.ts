import { addDays, formatDateISO, makeDate, weekdayOf } from "./task-utils";

/**
 * 대한민국 관공서 공휴일.
 *
 * 공휴일은 할 일이 아니라 배경이므로 데이터베이스에 넣지 않는다. Task 행으로
 * 만들면 체크·삭제가 가능해지고 XP와 연속 기록에까지 섞여 들어가며, 계정이
 * 늘어날 때마다 같은 날짜가 중복 저장된다. 대신 연도만 주면 결과가 나오는 순수
 * 함수로 두어 과거·미래 어느 연도든 즉시 계산되게 한다.
 *
 * 날짜는 이 앱의 다른 모든 날짜와 같은 모양(UTC 자정 = 한국 달력의 그 날)으로
 * 만든다. `lib/task-utils.ts`의 설명을 참고할 것.
 */
export type Holiday = {
  date: Date;
  name: string;
  /** 대체공휴일이면 true. */
  substitute: boolean;
};

/**
 * 대체공휴일이 생기는 조건. 「관공서의 공휴일에 관한 규정」 제3조 기준.
 */
type Trigger =
  /** 대체공휴일 규정이 없는 날 — 신정, 현충일. */
  | "none"
  /** 토요일이나 일요일과 겹치면 대체공휴일. */
  | "weekend"
  /** 설·추석 연휴는 일요일과 겹칠 때만. 토요일은 해당 없음. */
  | "sunday"
  /** 어린이날은 토·일뿐 아니라 다른 공휴일과 겹쳐도 대체공휴일. */
  | "childrens";

/** 날짜가 고정된 양력 공휴일. `month`는 0부터 센다. */
const SOLAR: { month: number; day: number; name: string; trigger: Trigger }[] = [
  { month: 0, day: 1, name: "신정", trigger: "none" },
  { month: 2, day: 1, name: "삼일절", trigger: "weekend" },
  { month: 4, day: 5, name: "어린이날", trigger: "childrens" },
  { month: 5, day: 6, name: "현충일", trigger: "none" },
  { month: 7, day: 15, name: "광복절", trigger: "weekend" },
  { month: 9, day: 3, name: "개천절", trigger: "weekend" },
  { month: 9, day: 9, name: "한글날", trigger: "weekend" },
  { month: 11, day: 25, name: "성탄절", trigger: "weekend" },
];

/**
 * 음력에서 오는 세 공휴일의 양력 날짜. `[month, day]`, month는 0부터.
 *
 * 음력→양력 변환기를 직접 구현하는 대신 표로 둔다. 정확한 변환에는 한국천문
 * 연구원이 발표하는 삭(朔) 시각 데이터가 필요해서, 직접 구현하면 코드는 몇 배로
 * 늘고 어느 해 하루가 틀려도 알아차릴 방법이 없다. 표는 틀리면 눈에 보인다.
 *
 * **표에 없는 연도**는 양력 공휴일만 계산된다. 조용히 빠뜨리면 거짓말이 되므로
 * `hasLunarData()`로 확인해 화면에 알려 준다. 연도를 추가할 때는 한국천문연구원
 * 또는 공공데이터포털의 특일 정보를 확인할 것.
 */
type LunarAnchors = {
  /** 설날 (음력 1월 1일) — 앞뒤 하루씩이 함께 공휴일이다. */
  seollal: [month: number, day: number];
  /** 부처님오신날 (음력 4월 8일) */
  buddha: [month: number, day: number];
  /** 추석 (음력 8월 15일) — 앞뒤 하루씩이 함께 공휴일이다. */
  chuseok: [month: number, day: number];
};

const LUNAR: Record<number, LunarAnchors> = {
  2024: { seollal: [1, 10], buddha: [4, 15], chuseok: [8, 17] },
  2025: { seollal: [0, 29], buddha: [4, 5], chuseok: [9, 6] },
  2026: { seollal: [1, 17], buddha: [4, 24], chuseok: [8, 25] },
  2027: { seollal: [1, 6], buddha: [4, 13], chuseok: [8, 15] },
  2028: { seollal: [0, 26], buddha: [4, 2], chuseok: [9, 3] },
  2029: { seollal: [1, 13], buddha: [4, 20], chuseok: [8, 22] },
  2030: { seollal: [1, 3], buddha: [4, 9], chuseok: [8, 12] },
};

/** 설·추석·부처님오신날까지 계산 가능한 연도인지. */
export function hasLunarData(year: number): boolean {
  return year in LUNAR;
}

/** 하나의 공휴일. 연휴는 여러 날이 한 덩어리로 대체공휴일 하나를 만든다. */
type Observance = {
  days: { date: Date; name: string }[];
  trigger: Trigger;
};

function observancesOf(year: number): Observance[] {
  const list: Observance[] = SOLAR.map((s) => ({
    days: [{ date: makeDate(year, s.month, s.day), name: s.name }],
    trigger: s.trigger,
  }));

  const lunar = LUNAR[year];
  if (lunar) {
    const streak = (anchor: Date, name: string): Observance => ({
      days: [
        { date: addDays(anchor, -1), name: `${name} 연휴` },
        { date: anchor, name },
        { date: addDays(anchor, 1), name: `${name} 연휴` },
      ],
      trigger: "sunday",
    });

    list.push(streak(makeDate(year, ...lunar.seollal), "설날"));
    list.push(streak(makeDate(year, ...lunar.chuseok), "추석"));
    list.push({
      days: [{ date: makeDate(year, ...lunar.buddha), name: "부처님오신날" }],
      trigger: "weekend",
    });
  }

  return list.sort((a, b) => a.days[0].date.getTime() - b.days[0].date.getTime());
}

const SUNDAY = 0;
const SATURDAY = 6;

function needsSubstitute(o: Observance, sharedDays: Set<string>): boolean {
  const first = o.days[0].date;
  switch (o.trigger) {
    case "none":
      return false;
    case "weekend":
      return weekdayOf(first) === SUNDAY || weekdayOf(first) === SATURDAY;
    case "sunday":
      return o.days.some((d) => weekdayOf(d.date) === SUNDAY);
    case "childrens":
      return (
        weekdayOf(first) === SUNDAY ||
        weekdayOf(first) === SATURDAY ||
        sharedDays.has(formatDateISO(first))
      );
  }
}

function buildYear(year: number): Holiday[] {
  const list = observancesOf(year);
  const out: Holiday[] = [];
  const taken = new Set<string>();
  /** 두 공휴일이 같은 날에 겹치는 날짜 — 어린이날 규정이 이걸 묻는다. */
  const sharedDays = new Set<string>();

  for (const o of list) {
    for (const d of o.days) {
      const key = formatDateISO(d.date);
      if (taken.has(key)) sharedDays.add(key);
      taken.add(key);
      out.push({ date: d.date, name: d.name, substitute: false });
    }
  }

  // 대체공휴일은 본래 공휴일이 모두 놓인 뒤에, 날짜 순서대로 정한다. 순서가
  // 중요한 이유는 두 가지다. 어린이날 규정은 "다른 공휴일과 겹치는가"를 묻기
  // 때문에 판이 다 깔려야 답할 수 있고, 며칠 사이에 놓인 두 공휴일이 같은
  // 월요일을 대체휴일로 가져가면 안 되기 때문이다.
  const alreadySubstituted = new Set<string>();
  for (const o of list) {
    if (!needsSubstitute(o, sharedDays)) continue;

    const anchor = o.days[o.days.length - 1].date;
    const anchorKey = formatDateISO(anchor);
    // 같은 날 겹친 두 공휴일이 대체휴일을 하나씩 받아 이틀이 되는 것을 막는다.
    if (alreadySubstituted.has(anchorKey)) continue;
    alreadySubstituted.add(anchorKey);

    // 대체공휴일은 "그 공휴일 다음의 첫 번째 비공휴일"이다. 일요일은 규정
    // 제2조가 그 자체로 공휴일이라 절대 대체휴일이 될 수 없어 건너뛴다.
    let d = addDays(anchor, 1);
    while (weekdayOf(d) === SUNDAY || taken.has(formatDateISO(d))) {
      d = addDays(d, 1);
    }
    taken.add(formatDateISO(d));
    out.push({ date: d, name: "대체공휴일", substitute: true });
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// 한 해를 계산하는 비용은 작지만, 월간 화면 하나가 42칸을 각각 물어보므로
// 연도 단위로 기억해 둔다. 순수 함수라 캐시가 낡을 일이 없다.
const cache = new Map<number, Holiday[]>();

export function holidaysInYear(year: number): Holiday[] {
  let found = cache.get(year);
  if (!found) {
    found = buildYear(year);
    cache.set(year, found);
  }
  return found;
}

/**
 * 주어진 기간(양끝 포함)의 공휴일을 날짜별로 묶은 표. 키는 `YYYY-MM-DD`.
 *
 * 한 날짜에 이름이 둘일 수 있어서(2025년 5월 5일 = 어린이날 + 부처님오신날)
 * 값이 배열이다.
 */
export function holidayMap(start: Date, end: Date): Map<string, Holiday[]> {
  const map = new Map<string, Holiday[]>();
  // 설 연휴는 해를 넘길 수 있고 성탄절 대체휴일은 12월 말에 생기므로, 경계에
  // 걸친 날을 놓치지 않도록 앞뒤 한 해씩 넉넉히 훑고 범위로 잘라낸다.
  const from = start.getUTCFullYear() - 1;
  const to = end.getUTCFullYear() + 1;

  for (let year = from; year <= to; year++) {
    for (const h of holidaysInYear(year)) {
      if (h.date < start || h.date > end) continue;
      const key = formatDateISO(h.date);
      const bucket = map.get(key);
      if (bucket) bucket.push(h);
      else map.set(key, [h]);
    }
  }
  return map;
}

/** 그 날의 공휴일들. 공휴일이 아니면 빈 배열. */
export function holidaysOn(date: Date): Holiday[] {
  // holidayMap을 거치는 이유는 설 연휴가 해를 넘길 수 있어서다. 그 해만 보면
  // 1월 1일이 전해의 섣달그믐 연휴인 경우를 놓친다.
  return holidayMap(date, date).get(formatDateISO(date)) ?? [];
}

/** 이름들을 사람이 읽을 한 줄로. 이름이 둘이면 가운뎃점으로 잇는다. */
export function holidayLabel(holidays: Holiday[]): string {
  return holidays.map((h) => h.name).join(" · ");
}
