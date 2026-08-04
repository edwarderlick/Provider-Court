import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3100";
const OUT = path.join(process.cwd(), "_verify");
fs.mkdirSync(OUT, { recursive: true });

const consoleErrors = [];

async function shoot(page, url, name, { viewport } = {}) {
  if (viewport) await page.setViewportSize(viewport);
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
  console.log("saved", name, "for", url, viewport ?? "(desktop 1600)");
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[${page.url()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`[pageerror @ ${page.url()}] ${err.message}`));

  await shoot(page, "/", "landing_desktop.png");
  await shoot(page, "/", "landing_mobile.png", { viewport: { width: 390, height: 844 } });
  await page.setViewportSize({ width: 1600, height: 1000 });

  await shoot(page, "/jobs/browse", "jobs_browse_desktop.png");
  await shoot(page, "/jobs/browse", "jobs_browse_mobile.png", { viewport: { width: 390, height: 844 } });
  await page.setViewportSize({ width: 1600, height: 1000 });

  await shoot(page, "/jobs/new", "jobs_new.png");
  await shoot(page, "/providers/register", "providers_register.png");
  await shoot(page, "/providers/ep-sampler-01", "providers_profile.png");
  await shoot(page, "/dashboard/buyer", "dashboard_buyer.png");
  await shoot(page, "/dashboard/provider", "dashboard_provider.png");
  await shoot(page, "/activity", "activity.png");
  await shoot(page, "/jobs/AX-772", "job_detail_accepted.png");
  await shoot(page, "/jobs/8829-ASIMOV-R4", "job_detail_disputed.png");
  await shoot(page, "/jobs/PC-40-RIDDIM/verdict", "job_verdict_page.png");
  await shoot(page, "/jobs/AX-772/appeal", "job_appeal.png");

  // Flow: accept a job from Browse Jobs and confirm state transition
  await page.goto(BASE + "/jobs/browse", { waitUntil: "networkidle" });
  await page.waitForSelector("text=Accept Job");
  const [firstAcceptBtn] = await page.$$("text=Accept Job");
  await firstAcceptBtn.click();
  await page.waitForURL(/\/jobs\/[^/]+$/, { timeout: 10000 });
  await page.waitForTimeout(500);
  const bodyText = await page.textContent("body");
  const hasAcceptedBadge = /ACTIVE_ESCROW|ACCEPTED/i.test(bodyText || "");
  await page.screenshot({ path: path.join(OUT, "flow_accept_job.png"), fullPage: true });
  console.log("flow_accept_job.png saved, url=", page.url(), "acceptedBadgeFound=", hasAcceptedBadge);

  await browser.close();

  fs.writeFileSync(
    path.join(OUT, "console-errors.log"),
    consoleErrors.length ? consoleErrors.join("\n") : "(no console errors captured)"
  );
  console.log("---- console errors ----");
  console.log(consoleErrors.length ? consoleErrors.join("\n") : "(none)");
})();
