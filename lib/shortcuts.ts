/**
 * Keyboard shortcuts, as data.
 *
 * Kept apart from the component that listens for them so the same table both
 * decides what a key press means and draws the help panel. A shortcut that
 * works but is not listed is a shortcut nobody uses.
 */

export type ShortcutId =
  | "today"
  | "week"
  | "month"
  | "year"
  | "prev"
  | "next"
  | "new"
  | "help";

export type Shortcut = {
  id: ShortcutId;
  /** Rendered one chip per entry. "Ctrl" is spelled out; keys are not. */
  keys: string[];
  label: string;
  /** Shown under the keys when the behaviour is not obvious from the label. */
  note?: string;
  group: "화면 이동" | "기간 이동" | "그 밖에";
};

/**
 * Why the letters are pressed bare rather than with Ctrl.
 *
 * Ctrl+T opens a new tab and Ctrl+W closes the current one — the browser takes
 * both before a page can see them, and a web page must not try to win that
 * fight. Ctrl+M is the one combination in this set the browser leaves alone,
 * so it is accepted as well as the bare M.
 */
export const SHORTCUTS: Shortcut[] = [
  { id: "today", keys: ["T"], label: "오늘", group: "화면 이동" },
  { id: "week", keys: ["W"], label: "주간 시간표", group: "화면 이동" },
  {
    id: "month",
    keys: ["M"],
    label: "월간 달력",
    note: "Ctrl + M 으로도 됩니다",
    group: "화면 이동",
  },
  { id: "year", keys: ["Y"], label: "연간", group: "화면 이동" },
  {
    id: "prev",
    keys: ["←"],
    label: "이전 주 · 달 · 해",
    group: "기간 이동",
  },
  {
    id: "next",
    keys: ["→"],
    label: "다음 주 · 달 · 해",
    note: "보고 있는 화면의 단축키를 다시 누르면 이번 주·달·해로 돌아옵니다",
    group: "기간 이동",
  },
  { id: "new", keys: ["N"], label: "새 할 일", group: "그 밖에" },
  { id: "help", keys: ["?"], label: "이 목록 열고 닫기", group: "그 밖에" },
];

export const SHORTCUT_GROUPS = ["화면 이동", "기간 이동", "그 밖에"] as const;

/** Where each view shortcut goes. No query string, which is what makes
 *  pressing a view's own key a second time return to the current period. */
export const VIEW_HREF: Record<string, string> = {
  today: "/",
  week: "/week",
  month: "/month",
  year: "/year",
};

export type KeyPress = {
  key: string;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
};

/**
 * A key press → the thing it should do, or null for "not ours".
 *
 * Pure, and takes a plain object rather than a KeyboardEvent, so the mapping
 * can be reasoned about and tested without a browser.
 */
export function resolveShortcut(press: KeyPress): ShortcutId | null {
  const { key, ctrl, meta, alt } = press;

  // Alt opens the browser's own menus, and Meta is the system modifier on
  // macOS. Neither is ours to claim.
  if (meta || alt) return null;

  if (ctrl) return key.toLowerCase() === "m" ? "month" : null;

  switch (key) {
    case "ArrowLeft":
      return "prev";
    case "ArrowRight":
      return "next";
    case "?":
      return "help";
  }

  switch (key.toLowerCase()) {
    case "t":
      return "today";
    case "w":
      return "week";
    case "m":
      return "month";
    case "y":
      return "year";
    case "n":
      return "new";
    default:
      return null;
  }
}

/**
 * Whether the key press belongs to whatever the user is typing into.
 *
 * Without this, typing "월요일 운동" into the task title would navigate away
 * on the first character that happens to be a shortcut.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select, [contenteditable]")) return true;
  return false;
}
