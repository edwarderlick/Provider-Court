import { chromium } from "playwright";
import path from "path";

const BASE = "http://localhost:3100";
const OUT = path.join(process.cwd(), "_verify");

(async () => {
  const browser = await chromium.launch();
  // Fresh context = no localStorage carried over from the earlier session.
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  await page.goto(BASE + "/dashboard/buyer", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "dashboard_buyer_after_pricing.png"), fullPage: true });

  const totalText = await page.textContent("text=TOTAL VALUE HELD >> xpath=..");
  console.log("Buyer dashboard header block text:", totalText?.replace(/\s+/g, " "));

  const rows = await page.$$eval("table tbody tr", (trs) =>
    trs.map((tr) => tr.innerText.replace(/\s+/g, " ").trim())
  );
  console.log("Ledger rows:\n" + rows.join("\n"));

  await page.goto(BASE + "/jobs/browse", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "jobs_browse_after_pricing.png"), fullPage: true });

  await page.goto(BASE + `/jobs/8829-ASIMOV-R4/appeal`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "job_appeal_after_pricing.png"), fullPage: true });

  await browser.close();
})();
