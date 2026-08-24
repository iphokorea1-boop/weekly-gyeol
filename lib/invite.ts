/**
 * Who is allowed to create an account.
 *
 * Signing up needed nothing but an address and eight characters, which was
 * right while the only person who knew the URL was the one who wrote it. A
 * landing page ends that: the address gets pasted into messages, and an open
 * form that mails a briefing every morning to whatever address it is handed is
 * a way to send unsolicited mail to strangers using this app's sending
 * reputation to do it. The stranger reports it as spam, and the next morning
 * nobody's briefing arrives.
 *
 * An invite code is the smallest thing that closes that. It proves nothing
 * about who is holding it — it is not identity, and it is not a substitute for
 * verifying an address — but it means every account here came from someone who
 * was handed a code by hand, which is the property that matters until address
 * verification exists.
 */
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Read at call time rather than captured at module load, so a test can set the
 * variable per case and a deployment does not depend on import order.
 *
 * Lower-cased on both sides of the comparison below. A code is typed off a
 * message on a phone, where the keyboard capitalises the first letter without
 * being asked; a code that is "wrong" for that reason produces a message to
 * the person who handed it out, not a second attempt.
 */
function codes(): string[] {
  return (process.env.INVITE_CODES ?? "")
    .split(",")
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Whether invites are configured at all.
 *
 * With none set the form is closed rather than open. A missing secret has to
 * fail toward refusing people and never toward admitting everyone — forgetting
 * this variable on a deploy is precisely the moment the difference is worth
 * something, and the owner already has an account, so the cost of being wrong
 * in this direction is a message rather than a stranger's mail.
 */
export function invitesConfigured(): boolean {
  return codes().length > 0;
}

/**
 * Compared through SHA-256 digests rather than the strings themselves: digests
 * are the same length whatever the codes are, so `timingSafeEqual` never throws
 * on a mismatch and the comparison cannot be used to learn how long a code is.
 * Every candidate is checked even once one has matched, so the work done does
 * not depend on which code was given.
 */
export function inviteAccepted(supplied: string): boolean {
  const given = createHash("sha256")
    .update(supplied.trim().toLowerCase())
    .digest();

  let matched = false;
  for (const code of codes()) {
    const expected = createHash("sha256").update(code).digest();
    if (timingSafeEqual(expected, given)) matched = true;
  }
  return matched;
}
