/**
 * PHASE_12A.1 warning verification (valid overlap + invalid attribution).
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  path.join(process.env.TEMP || "/tmp", "nazma-pw-cert", "node_modules", "playwright"),
);

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const EVIDENCE_DIR = path.join(process.cwd(), "tmp-cert-evidence");
const DHAKA = "909fa9ea-3179-480f-9b89-a02233500b93";

function psqlFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  return execFileSync(
    "docker",
    ["exec", "-i", "nazma-erp-db", "psql", "-U", "postgres", "-d", "nazma_erp", "-tA"],
    { input: sql, encoding: "utf8" },
  ).trim();
}

function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", "nazma-erp-db", "psql", "-U", "postgres", "-d", "nazma_erp", "-tA", "-c", sql],
    { encoding: "utf8" },
  ).trim();
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "admin@nazma.local");
  await page.fill('input[type="password"]', "Admin123!");
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1000);
}

async function main() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  // Cleanup any leftover probes
  psql(
    `DELETE FROM "DealerOwnershipHistory" WHERE reason LIKE 'PHASE_12A.1 cert probe%';`,
  );

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page);

  // --- Valid overlap (multi-SR territory, unique ownership) ---
  await page.goto(
    `${BASE}/reports/sr-performance?from=2026-01-01&to=2026-07-19&territoryId=${DHAKA}`,
    { waitUntil: "networkidle" },
  );
  await page.waitForTimeout(2500);
  let banners = (await page.locator('[role="status"], [role="alert"]').allInnerTexts()).join(" | ");
  let body = await page.locator("body").innerText();
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, "warn-01-valid-overlap.png"),
    fullPage: true,
  });
  const validPass =
    !/attribution/i.test(banners) &&
    !/overlappingTerritoryIds/i.test(body) &&
    !/territory overlap/i.test(body);
  console.log(`[${validPass ? "PASS" : "FAIL"}] Valid overlap banners=${JSON.stringify(banners)}`);

  // --- Invalid attribution probe ---
  const probeId = psqlFile(path.join(process.cwd(), "tmp-cert-insert-probe.sql"));
  if (!probeId) throw new Error("Failed to insert attribution probe");
  console.log(`Inserted probe ${probeId}`);

  try {
    await page.goto(
      `${BASE}/reports/sr-performance?from=2026-01-01&to=2026-07-19&territoryId=${DHAKA}`,
      { waitUntil: "networkidle" },
    );
    await page.waitForTimeout(2500);
    banners = (await page.locator('[role="status"], [role="alert"]').allInnerTexts()).join(" | ");
    body = await page.locator("body").innerText();
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "warn-02-invalid-attribution.png"),
      fullPage: true,
    });
    const mentions = (body.match(/DLR-0010/g) || []).length;
    const invalidPass =
      /attribution/i.test(banners) &&
      !/overlappingTerritoryIds/i.test(body) &&
      mentions <= 3;
    console.log(
      `[${invalidPass ? "PASS" : "FAIL"}] Invalid attribution banners=${JSON.stringify(banners)} mentions=${mentions}`,
    );

    const summary = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE,
      database: "docker nazma-erp-db (credentials REDACTED)",
      results: [
        {
          scenario: "Valid multi-SR territory — no attribution/overlap warning",
          pass: validPass,
          evidence: "warn-01-valid-overlap.png",
        },
        {
          scenario: "Invalid attribution — warning shown, no double count",
          pass: invalidPass,
          dealerCode: "DLR-0010",
          mentions,
          banners,
          evidence: "warn-02-invalid-attribution.png",
        },
      ],
      passed: [validPass, invalidPass].filter(Boolean).length,
      failed: [validPass, invalidPass].filter((x) => !x).length,
    };
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "warning-results.json"),
      JSON.stringify(summary, null, 2),
    );
    process.exitCode = summary.failed > 0 ? 1 : 0;
  } finally {
    psql(`DELETE FROM "DealerOwnershipHistory" WHERE id = '${probeId}';`);
    console.log(`Removed probe ${probeId}`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  try {
    psql(
      `DELETE FROM "DealerOwnershipHistory" WHERE reason LIKE 'PHASE_12A.1 cert probe%';`,
    );
  } catch {
    /* ignore */
  }
  process.exit(1);
});
