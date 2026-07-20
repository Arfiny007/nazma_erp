import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  path.join(process.env.TEMP || "/tmp", "nazma-pw-cert", "node_modules", "playwright"),
);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(`${page.url()} :: ${e.message.slice(0, 140)}`));

  await page.goto("http://127.0.0.1:3000/login", { waitUntil: "load", timeout: 60000 });
  await page.fill('input[type="email"]', "admin@nazma.local");
  await page.fill('input[type="password"]', "Admin123!");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1000);

  // Ensure EN first
  await page.locator("#language-switcher").selectOption("en");
  await page.waitForTimeout(500);
  await page.goto("http://127.0.0.1:3000/reports/sr-performance", {
    waitUntil: "load",
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
  console.log("SR_EN", errs.length, errs.at(-1) || "none");

  // Switch to BN on SR page (client-side), then hard reload
  await page.locator("#language-switcher").selectOption("bn");
  await page.waitForTimeout(800);
  console.log("SR_BN_SWITCH", errs.length, errs.at(-1) || "none");
  await page.reload({ waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(1500);
  console.log("SR_BN_RELOAD", errs.length, errs.at(-1) || "none");

  // Navigate away and back in BN
  await page.goto("http://127.0.0.1:3000/dashboard", { waitUntil: "load", timeout: 60000 });
  await page.goto("http://127.0.0.1:3000/reports/sr-performance", {
    waitUntil: "load",
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
  console.log("SR_BN_NAV", errs.length, errs.at(-1) || "none");

  for (const e of errs) console.log(" -", e);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
