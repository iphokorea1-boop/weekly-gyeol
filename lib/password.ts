/**
 * Whether a password is bad enough to refuse outright.
 *
 * "8자 이상" was the only rule, and `12345678` is eight characters. The login
 * throttle already makes online guessing slow — five tries per account per
 * quarter of an hour — so this is not an argument about entropy in general. It
 * is about the handful of strings that get guessed *first*, by anyone, inside
 * those five tries, before a rate limit has had a chance to bite.
 *
 * Deliberately a short list rather than a downloaded corpus of a million
 * leaked passwords. The long tail of such a list is unreachable through a
 * throttled form; shipping a megabyte to refuse strings nobody can get to
 * would be cost without a benefit. What is here is the top of the guess order,
 * plus the shapes — one repeated character, a run of digits, the address
 * itself — that a list of literals cannot cover.
 */

export const MIN_PASSWORD = 8;

/**
 * scrypt's cost comes from its work factor rather than its input, so a very
 * long password is not itself expensive to hash — but there is no reason to
 * accept one, and an unbounded field is an unbounded field.
 */
const MAX_PASSWORD = 200;

/**
 * Lower-cased, and compared after the candidate is lower-cased too: `Password`
 * is guessed as readily as `password`, and treating them as different would
 * refuse one and accept the other.
 *
 * The last few are Korean typed on a QWERTY keyboard without switching input
 * modes — 안녕하세요, 사랑해 — which is a real and very common choice here and
 * would sail past any English-only list.
 */
const COMMON = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "87654321",
  "password",
  "password1",
  "password123",
  "passw0rd",
  "qwertyui",
  "qwerty123",
  "asdfasdf",
  "asdfghjk",
  "zxcvbnm1",
  "1q2w3e4r",
  "1qaz2wsx",
  "qazwsxedc",
  "iloveyou",
  "abc12345",
  "letmein1",
  "admin123",
  "welcome1",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "computer",
  "superman",
  "trustno1",
  "starwars",
  "dkssudgktpdy",
  "tkfkdgo",
]);

/** `aaaaaaaa`, `11111111` — long, and one guess. */
function singleCharacter(value: string): boolean {
  return new Set(value).size === 1;
}

/** `12345678`, `98765432`, `abcdefgh` — a run in either direction. */
function sequential(value: string): boolean {
  let up = true;
  let down = true;
  for (let i = 1; i < value.length; i++) {
    const step = value.charCodeAt(i) - value.charCodeAt(i - 1);
    if (step !== 1) up = false;
    if (step !== -1) down = false;
  }
  return up || down;
}

/**
 * @param email the address being registered, so the password cannot simply be
 *   it. Someone who learns one has learned the other, and the address is the
 *   half that gets written down in other people's inboxes.
 * @returns a reason to show, or null if the password is acceptable.
 */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `비밀번호는 ${MIN_PASSWORD}자 이상이어야 해요.`;
  }
  if (password.length > MAX_PASSWORD) {
    return `비밀번호는 ${MAX_PASSWORD}자를 넘을 수 없어요.`;
  }

  const lower = password.toLowerCase();
  const local = email.toLowerCase().split("@")[0] ?? "";

  if (COMMON.has(lower) || singleCharacter(lower) || sequential(lower)) {
    return "너무 흔한 비밀번호예요. 다른 걸로 정해 주세요.";
  }
  if (lower === email.toLowerCase() || (local.length >= 4 && lower === local)) {
    return "비밀번호를 이메일과 다르게 정해 주세요.";
  }
  return null;
}
