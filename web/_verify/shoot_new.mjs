import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto("http://localhost:3100/jobs/new", { waitUntil: "networkidle" });
  const val = await page.inputValue('input[type="number"]');
  console.log("Default reward input value:", val);
  await browser.close();
})();
