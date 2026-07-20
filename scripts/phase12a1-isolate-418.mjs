import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  path.join(process.env.TEMP || "/tmp", "nazma-pw-cert", "node_modules", "playwright"),
);

const errs = [];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (e) => {
    errs.push(`${page.url()} :: ${e.message.slice(0, 160)}`);
  });

  await page.goto("http://127.0.0.1:3000/login", { waitUntil: "load", timeout: 60000 });
  await page.evaluate(() => {
    localStorage.clear();
    document.cookie = "nazma-locale=;path=/;max-age=0";
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(500);
  console.log("AFTER_CLEAN_LOGIN", errs.length);

  await page.evaluate(() => {
    localStorage.setItem("nazma-locale", "bn");
    document.cookie = "nazma-locale=en;path=/;max-age=31536000;SameSite=Lax";
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  console.log("AFTER_MISMATCH", errs.length, errs.at(-1) || "none");

  await page.fill('input[type="email"]', "admin@nazma.local");
  await page.fill('input[type="password"]', "Admin123!");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  console.log("AFTER_AUTH", page.url(), errs.length, errs.at(-1) || "none");

  for (const route of [
    "/dashboard",
    "/dealers/new",
    "/settings/territory-assignments",
    "/reports/sr-performance",
  ]) {
    const before = errs.length;
    await page.goto(`http://127.0.0.1:3000${route}`, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(1200);
    console.log(
      `AFTER_${route}`,
      errs.length - before,
      errs.length > before ? errs[errs.length - 1] : "none",
    );
  }

  console.log("ALL");
  for (const e of errs) console.log(" -", e);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
