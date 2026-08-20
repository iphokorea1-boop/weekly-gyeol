import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { statSync } from "node:fs";

const DOCS = [
  { html: "docs/handover.html", pdf: "docs/주간결-인수인계-문서.pdf", title: "주간결 인수인계 문서" },
  { html: "docs/guide.html",    pdf: "docs/주간결-코드-안내서.pdf",   title: "주간결 코드 안내서" },
  { html: "docs/changelog.html", pdf: "docs/주간결-변경-사항.pdf",   title: "주간결 변경 사항" },
];

// 저장소 루트에서 실행하십시오: node docs/make-pdf.mjs
const browser = await chromium.launch();
const page = await browser.newPage();

const foot = (title) => `
  <div style="width:100%;font-family:'Malgun Gothic',sans-serif;font-size:8pt;
              color:#82827c;padding:0 17mm;display:flex;justify-content:space-between;">
    <span>${title}</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;

for (const doc of DOCS) {
  await page.goto(pathToFileURL(resolve(doc.html)).href, { waitUntil: "networkidle" });
  // Chromium needs fonts settled before laying out pages, or Korean metrics shift.
  await page.evaluate(() => document.fonts.ready);

  await page.pdf({
    path: doc.pdf,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: foot(doc.title),
    margin: { top: "18mm", bottom: "20mm", left: "17mm", right: "17mm" },
  });
  const kb = Math.round(statSync(doc.pdf).size / 1024);
  console.log(`${doc.pdf}  —  ${kb} KB`);
}
await browser.close();
