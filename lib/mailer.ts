/**
 * Outbound email.
 *
 * Resend's REST API is called directly with `fetch` rather than through their
 * SDK, so this adds no dependency — the same reasoning that keeps `lib/auth.ts`
 * free of an auth library.
 *
 * Nothing here throws. A mail provider is the least reliable part of any
 * feature that touches it, and a nudge failing to send must never take down the
 * job that was sending it, so every outcome comes back as a value.
 */
export type MailResult =
  | { status: "sent"; id: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

/**
 * Resend's shared sending address works without owning a domain, which is
 * enough to email yourself. Mailing anyone else needs a verified domain in
 * MAIL_FROM, or the messages land in spam.
 */
function sender(): string {
  return process.env.MAIL_FROM ?? "주간결 <onboarding@resend.dev>";
}

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(message: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  // Not an error: the feature is meant to be deployable before the key exists,
  // reporting itself as unconfigured instead of failing.
  if (!key) return { status: "skipped", reason: "RESEND_API_KEY 미설정" };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const detail =
        body && typeof body === "object" && "message" in body
          ? String((body as { message: unknown }).message)
          : `HTTP ${res.status}`;
      return { status: "failed", reason: detail.slice(0, 200) };
    }

    const id =
      body && typeof body === "object" && "id" in body
        ? String((body as { id: unknown }).id)
        : "(id 없음)";
    return { status: "sent", id };
  } catch (error) {
    return { status: "failed", reason: (error as Error).message.slice(0, 200) };
  }
}
