import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appUrl, verifyUnsubscribeToken } from "@/lib/nudge";

export const dynamic = "force-dynamic";

/**
 * Turning the app's emails off, and back on.
 *
 * Two of them now, and `k` says which link was clicked. They are separate
 * switches on purpose: silencing a mail that arrives every morning must not
 * also silence the one that only appears after the app has been ignored for
 * days. `k` defaults to the nudge, so links already sitting in an inbox from
 * before the briefing existed still mean what they meant when they were sent.
 *
 * The link in the email is a GET, but a GET here only *offers* the change — the
 * switch is thrown by the POST behind the button. Mail scanners and link
 * previewers fetch every URL they find, and a GET that acted immediately would
 * let one of them unsubscribe the account on the reader's behalf.
 *
 * Authorisation is the signed token alone; the reader is not logged in, and
 * requiring them to be would defeat the purpose of a link in an email.
 */
function page(body: string, status = 200): NextResponse {
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>주간결 · 메일 설정</title>
</head>
<body style="margin:0;padding:24px;background:#f1f0ef;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#21201c">
  <div style="max-width:460px;margin:8vh auto;background:#fdfdfc;border:1px solid #dad9d6;border-radius:12px;padding:28px">
    <div style="font-size:12px;font-weight:700;color:#82827c;letter-spacing:.04em">주간결</div>
    ${body}
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

const BUTTON =
  "display:inline-block;border:0;background:#3e63dd;color:#fff;font-size:14px;font-weight:700;padding:11px 20px;border-radius:8px;cursor:pointer";
const LINK = "color:#63635e;font-size:12px";

type Kind = "nudge" | "digest";

const COPY: Record<Kind, { name: string; on: string; off: string }> = {
  nudge: {
    name: "활동 알림 메일",
    on: "며칠간 활동이 없을 때만 메일이 갑니다.",
    off: "며칠간 활동이 없을 때 보내드리는 메일입니다. 끄면 더 이상 보내지 않아요.",
  },
  digest: {
    name: "오늘 할 일 메일",
    on: "매일 아침, 그날 할 일이 있을 때 보내드립니다.",
    off: "매일 아침 그날 할 일을 보내드리는 메일입니다. 끄면 더 이상 보내지 않아요.",
  },
};

async function authenticate(request: NextRequest, form?: FormData) {
  const params = request.nextUrl.searchParams;
  const id = String(form?.get("u") ?? params.get("u") ?? "");
  const token = String(form?.get("t") ?? params.get("t") ?? "");
  const kind: Kind =
    String(form?.get("k") ?? params.get("k") ?? "") === "digest"
      ? "digest"
      : "nudge";
  if (!id || !token) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      passwordHash: true,
      nudgeEmails: true,
      dailyDigest: true,
    },
  });
  if (!user || !verifyUnsubscribeToken(user.id, user.passwordHash, token)) {
    return null;
  }
  const enabled = kind === "digest" ? user.dailyDigest : user.nudgeEmails;
  return { user, id, token, kind, enabled, copy: COPY[kind] };
}

const INVALID = `<h1 style="margin:6px 0 12px;font-size:18px">링크가 올바르지 않아요</h1>
  <p style="margin:0;font-size:14px;line-height:1.7;color:#63635e">
    주소가 잘렸거나, 비밀번호를 바꾸신 뒤라 예전 링크가 만료됐을 수 있어요.
    가장 최근에 받은 메일의 링크를 다시 눌러 보세요.
  </p>`;

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return page(INVALID, 400);

  const off = !auth.enabled;
  return page(`
    <h1 style="margin:6px 0 12px;font-size:18px">
      ${off ? `지금은 ${auth.copy.name}을 받지 않고 있어요` : `${auth.copy.name}을 끌까요?`}
    </h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#63635e">
      ${off ? `다시 켜면 ${auth.copy.on}` : auth.copy.off}
    </p>
    <form method="post">
      <input type="hidden" name="u" value="${auth.id}">
      <input type="hidden" name="t" value="${auth.token}">
      <input type="hidden" name="k" value="${auth.kind}">
      <input type="hidden" name="action" value="${off ? "on" : "off"}">
      <button type="submit" style="${BUTTON}">${off ? "다시 받기" : "그만 받기"}</button>
    </form>
    <p style="margin:20px 0 0"><a href="${appUrl()}" style="${LINK}">주간결 열기</a></p>
  `);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const auth = await authenticate(request, form);
  if (!auth) return page(INVALID, 400);

  const enable = String(form.get("action")) === "on";
  await prisma.user.update({
    where: { id: auth.id },
    // Only the switch the link belongs to. The other mail is left alone.
    data:
      auth.kind === "digest" ? { dailyDigest: enable } : { nudgeEmails: enable },
  });

  return page(`
    <h1 style="margin:6px 0 12px;font-size:18px">
      ${enable ? "다시 보내드릴게요" : "이제 보내지 않을게요"}
    </h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#63635e">
      ${
        enable
          ? auth.copy.on
          : `${auth.copy.name}이 꺼졌습니다. 마음이 바뀌면 아래에서 다시 켤 수 있어요.`
      }
    </p>
    <form method="post">
      <input type="hidden" name="u" value="${auth.id}">
      <input type="hidden" name="t" value="${auth.token}">
      <input type="hidden" name="k" value="${auth.kind}">
      <input type="hidden" name="action" value="${enable ? "off" : "on"}">
      <button type="submit" style="${BUTTON}">${enable ? "역시 그만 받기" : "다시 받기"}</button>
    </form>
    <p style="margin:20px 0 0"><a href="${appUrl()}" style="${LINK}">주간결 열기</a></p>
  `);
}
