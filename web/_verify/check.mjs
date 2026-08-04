import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto("http://localhost:3100/", { waitUntil: "networkidle" });
  const h1 = await page.$("h1");
  const styles = await h1.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { fontSize: cs.fontSize, fontFamily: cs.fontFamily, lineHeight: cs.lineHeight };
  });
  console.log(styles);
  await browser.close();
})();
