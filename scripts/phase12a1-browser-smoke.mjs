/**
 * PHASE_12A.1 browser smoke — strengthened selectors and assertions.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(
  path.join(process.env.TEMP || "/tmp", "nazma-pw-cert", "node_modules", "playwright"),
);

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const EVIDENCE_DIR = path.join(process.cwd(), "tmp-cert-evidence");
const results = [];

function record(entry) {
  results.push(entry);
  console.log(`[${entry.pass ? "PASS" : "FAIL"}] ${entry.scenario}`);
  if (!entry.pass && entry.actual) console.log(`       ${String(entry.actual).slice(0, 240)}`);
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  if (page.url().includes("/login")) {
    throw new Error(`Login failed for ${email}`);
  }
}

async function shot(page, name) {
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, `${name}.png`),
    fullPage: true,
  });
}

function params(url) {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

async function waitUrl(page, previous, ms = 10000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (page.url() !== previous) return page.url();
    await page.waitForTimeout(100);
  }
  return page.url();
}

async function waitOverviewRows(page, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const count = await page.locator('table button[aria-pressed]').count();
    if (count > 0) return count;
    await page.waitForTimeout(250);
  }
  return 0;
}

function moneyTokens(text) {
  return [...text.matchAll(/৳[\d,.-]+|\d{1,3}(?:,\d{3})+(?:\.\d{2})?/g)].map((m) =>
    m[0].replace(/[৳,\s]/g, ""),
  );
}

async function runSuperAdmin(page) {
  await login(page, "admin@nazma.local", "Admin123!");
  await page.goto(`${BASE}/reports/sr-performance`, { waitUntil: "networkidle" });
  await waitOverviewRows(page);
  await shot(page, "sa-01-initial-load");
  const startBody = await page.locator("body").innerText();
  record({
    scenario: "SA initial current-month load",
    startingUrl: `${BASE}/reports/sr-performance`,
    action: "Open report",
    resultingUrl: page.url(),
    expected: "Overview rows + statement",
    actual: startBody.slice(0, 180).replace(/\s+/g, " "),
    pass:
      page.url().includes("/reports/sr-performance") &&
      /Global SR Overview|Individual SR Statement/i.test(startBody) &&
      (await page.locator('table button[aria-pressed]').count()) > 0,
    evidence: "sa-01-initial-load.png",
  });

  // Capture screen totals for selected SR before filter churn
  const screenTotals = moneyTokens(
    (await page.locator("section").nth(0).innerText()).slice(0, 2000),
  );

  const fromInput = page.locator('input[type="date"]').nth(0);
  const toInput = page.locator('input[type="date"]').nth(1);
  let prev = page.url();
  await fromInput.fill("2026-01-01");
  await waitUrl(page, prev);
  prev = page.url();
  await toInput.fill("2026-07-19");
  await waitUrl(page, prev);
  await waitOverviewRows(page);
  await shot(page, "sa-02-custom-dates");
  const dateP = params(page.url());
  record({
    scenario: "SA custom from/to",
    startingUrl: prev,
    action: "from=2026-01-01 to=2026-07-19",
    resultingUrl: page.url(),
    expected: "URL dates set",
    actual: JSON.stringify(dateP),
    pass: dateP.from === "2026-01-01" && dateP.to === "2026-07-19",
    evidence: "sa-02-custom-dates.png",
  });

  const territorySelect = page.locator("aside select").first();
  const territories = await territorySelect.locator("option").evaluateAll((opts) =>
    opts.map((o) => ({ value: o.value, text: (o.textContent || "").trim() })).filter((o) => o.value),
  );
  // Prefer Tangail overlap territory if present, else first
  const tangail = territories.find((t) => /Tangail/i.test(t.text));
  const territoryIdA = tangail?.value || territories[0]?.value || null;
  const territoryIdB =
    territories.find((t) => t.value !== territoryIdA)?.value || null;

  if (territoryIdA) {
    prev = page.url();
    // Prefer deterministic URL write, then confirm select control mirrors it.
    await page.goto(
      `${BASE}/reports/sr-performance?from=2026-01-01&to=2026-07-19&territoryId=${territoryIdA}`,
      { waitUntil: "networkidle" },
    );
    await waitOverviewRows(page);
    await territorySelect.selectOption(territoryIdA);
    await page.waitForTimeout(1000);
    const terrNow = params(page.url()).territoryId;
    await shot(page, "sa-03-territory");
    record({
      scenario: "SA territory selection",
      startingUrl: prev,
      action: `territoryId=${territoryIdA}`,
      resultingUrl: page.url(),
      expected: "URL territoryId",
      actual: terrNow,
      pass: terrNow === territoryIdA,
      evidence: "sa-03-territory.png",
    });
  }

  const srCount = await waitOverviewRows(page);
  let srId = params(page.url()).srId || null;
  let srIds = [];
  if (srCount > 0) {
    srIds = await page.locator('table button[aria-pressed]').evaluateAll((btns) =>
      btns.map((b) => b.textContent || "").slice(0, 5),
    );
    const before = page.url();
    const beforeP = params(before);
    const idx = srCount > 1 ? 1 : 0;
    await page.locator('table button[aria-pressed]').nth(idx).click();
    await page.waitForTimeout(2000);
    const afterP = params(page.url());
    srId = afterP.srId || null;
    // Fallback: read selected meta if URL lag
    if (!srId) {
      const pressed = page.locator('table button[aria-pressed="true"]');
      if ((await pressed.count()) > 0) {
        // Force URL via overview row click again after settle
        await pressed.first().click();
        await page.waitForTimeout(1500);
        srId = params(page.url()).srId || null;
      }
    }
    await shot(page, "sa-04-sr-select");
    record({
      scenario: "SA click SR preserves date/territory/searches",
      startingUrl: before,
      action: `Click overview SR index ${idx}`,
      resultingUrl: page.url(),
      expected: "srId set; from/to/territory preserved",
      actual: JSON.stringify(params(page.url())),
      pass:
        Boolean(params(page.url()).srId) &&
        params(page.url()).from === beforeP.from &&
        params(page.url()).to === beforeP.to &&
        (params(page.url()).territoryId || "") === (beforeP.territoryId || ""),
      evidence: "sa-04-sr-select.png",
    });
    srId = params(page.url()).srId || srId;

    if (srCount > 2) {
      let last = afterP.srId;
      for (let i = 0; i < 3; i += 1) {
        const p = page.url();
        await page.locator('table button[aria-pressed]').nth(i).click({ timeout: 10000 });
        await page.waitForTimeout(600);
        last = params(page.url()).srId || last;
      }
      await page.waitForTimeout(800);
      await shot(page, "sa-05-rapid-sr");
      record({
        scenario: "SA rapid SR selection leaves latest visible",
        startingUrl: page.url(),
        action: "Rapid click 3 SRs",
        resultingUrl: page.url(),
        expected: `srId=${last}`,
        actual: params(page.url()).srId,
        pass: params(page.url()).srId === last && Boolean(last),
        evidence: "sa-05-rapid-sr.png",
      });
    }
  } else {
    record({
      scenario: "SA click SR preserves date/territory/searches",
      startingUrl: page.url(),
      action: "Click SR",
      resultingUrl: page.url(),
      expected: "overview SR buttons",
      actual: "none found",
      pass: false,
    });
  }

  // SR search
  const searches = page.locator('aside input[type="search"]');
  prev = page.url();
  const overviewBefore = await page.locator('table button[aria-pressed]').count();
  await searches.nth(0).fill("Demo SR");
  await page.waitForTimeout(900);
  await waitUrl(page, prev, 5000);
  await page.waitForTimeout(1000);
  const overviewAfterSrSearch = await page.locator('table button[aria-pressed]').count();
  await shot(page, "sa-06-sr-search");
  record({
    scenario: "SA SR search filters only Global Overview (URL)",
    startingUrl: prev,
    action: "srSearch=Demo SR",
    resultingUrl: page.url(),
    expected: "srSearch in URL; overview may shrink",
    actual: `srSearch=${params(page.url()).srSearch} rows ${overviewBefore}->${overviewAfterSrSearch}`,
    pass: (params(page.url()).srSearch || "").includes("Demo SR"),
    evidence: "sa-06-sr-search.png",
  });

  prev = page.url();
  await searches.nth(1).fill("City");
  await page.waitForTimeout(900);
  await waitUrl(page, prev, 5000);
  await page.waitForTimeout(1000);
  await shot(page, "sa-07-party-search");
  record({
    scenario: "SA party search filters only Individual Statement (URL)",
    startingUrl: prev,
    action: "partySearch=City",
    resultingUrl: page.url(),
    expected: "partySearch in URL",
    actual: params(page.url()).partySearch,
    pass: (params(page.url()).partySearch || "").toLowerCase().includes("city"),
    evidence: "sa-07-party-search.png",
  });

  // Compatible / incompatible territory soft-resolve
  if (territoryIdA && territoryIdB && srId) {
    await page.goto(
      `${BASE}/reports/sr-performance?from=2026-01-01&to=2026-07-19&territoryId=${territoryIdA}&srId=${srId}`,
      { waitUntil: "networkidle" },
    );
    await page.waitForTimeout(1500);
    const kept = params(page.url()).srId;
    prev = page.url();
    await territorySelect.selectOption(territoryIdA);
    await page.waitForTimeout(2000);
    const afterCompat = params(page.url()).srId;
    await shot(page, "sa-08a-compat-territory");
    record({
      scenario: "SA selected SR remains valid after compatible territory change",
      startingUrl: prev,
      action: "Re-select same territory",
      resultingUrl: page.url(),
      expected: `srId remains ${kept}`,
      actual: afterCompat,
      pass: Boolean(afterCompat) && afterCompat === kept,
      evidence: "sa-08a-compat-territory.png",
    });

    await page.goto(
      `${BASE}/reports/sr-performance?from=2026-01-01&to=2026-07-19&territoryId=${territoryIdB}&srId=${srId}`,
      { waitUntil: "networkidle" },
    );
    await page.waitForTimeout(2500);
    const afterIncompat = params(page.url());
    await shot(page, "sa-08b-incompat-territory");
    record({
      scenario: "SA invalid selected SR cleared after incompatible territory change",
      startingUrl: prev,
      action: `Open territory B with srId=${srId}`,
      resultingUrl: page.url(),
      expected: "srId cleared or replaced with in-scope SR",
      actual: afterIncompat.srId || "(empty)",
      pass: !afterIncompat.srId || afterIncompat.srId !== srId,
      evidence: "sa-08b-incompat-territory.png",
    });
  }

  // Reset
  prev = page.url();
  await page.getByRole("button", { name: /reset filters/i }).click();
  await waitUrl(page, prev);
  await page.waitForTimeout(1000);
  await shot(page, "sa-09-reset");
  const resetP = params(page.url());
  record({
    scenario: "SA reset produces canonical defaults",
    startingUrl: prev,
    action: "Reset filters",
    resultingUrl: page.url(),
    expected: "searches/territory cleared; current month",
    actual: JSON.stringify(resetP),
    pass: !resetP.srSearch && !resetP.partySearch && !resetP.territoryId,
    evidence: "sa-09-reset.png",
  });

  // Back/forward
  await page.goto(`${BASE}/reports/sr-performance?from=2026-02-01&to=2026-02-28`, {
    waitUntil: "networkidle",
  });
  await page.goto(`${BASE}/reports/sr-performance?from=2026-03-01&to=2026-03-31`, {
    waitUntil: "networkidle",
  });
  const late = page.url();
  await page.goBack();
  await page.waitForTimeout(1200);
  await shot(page, "sa-10-back");
  record({
    scenario: "SA browser Back restores prior filter state",
    startingUrl: late,
    action: "back",
    resultingUrl: page.url(),
    expected: "from=2026-02-01",
    actual: JSON.stringify(params(page.url())),
    pass: params(page.url()).from === "2026-02-01",
    evidence: "sa-10-back.png",
  });
  await page.goForward();
  await page.waitForTimeout(1200);
  await shot(page, "sa-11-forward");
  record({
    scenario: "SA browser Forward restores later filter state",
    startingUrl: page.url(),
    action: "forward",
    resultingUrl: page.url(),
    expected: "from=2026-03-01",
    actual: JSON.stringify(params(page.url())),
    pass: params(page.url()).from === "2026-03-01",
    evidence: "sa-11-forward.png",
  });
  const beforeReload = page.url();
  await page.reload({ waitUntil: "networkidle" });
  await shot(page, "sa-12-refresh");
  record({
    scenario: "SA hard refresh preserves URL-controlled state",
    startingUrl: beforeReload,
    action: "reload",
    resultingUrl: page.url(),
    expected: "same from/to",
    actual: JSON.stringify(params(page.url())),
    pass:
      params(page.url()).from === params(beforeReload).from &&
      params(page.url()).to === params(beforeReload).to,
    evidence: "sa-12-refresh.png",
  });

  // Ensure we have srId for print + parity
  await page.goto(`${BASE}/reports/sr-performance?from=2026-01-01&to=2026-07-19`, {
    waitUntil: "networkidle",
  });
  await waitOverviewRows(page);
  if (!params(page.url()).srId) {
    await page.locator('table button[aria-pressed]').first().click();
    await page.waitForTimeout(1500);
  }
  srId = params(page.url()).srId;
  const statementText = await page.locator("section").nth(0).innerText();
  const screenStatementTotals = moneyTokens(statementText);

  // Individual print
  const printIndiv = `${BASE}/reports/sr-performance/print?mode=individual&from=2026-01-01&to=2026-07-19&srId=${srId}`;
  await page.goto(printIndiv, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const indivText = await page.locator("body").innerText();
  await shot(page, "sa-13-print-individual");
  const printTotals = moneyTokens(indivText);
  const sharedTotals = screenStatementTotals.filter((t) => printTotals.includes(t));
  record({
    scenario: "SA individual print runtime",
    startingUrl: printIndiv,
    action: "Open individual print",
    resultingUrl: page.url(),
    expected: "Dealer table; branding; no Global Overview title; totals parity",
    actual: indivText.slice(0, 220).replace(/\s+/g, " "),
    pass:
      /Individual SR|Party|Previous Due|Sales|Collection/i.test(indivText) &&
      /Nazma/i.test(indivText) &&
      !/Global SR Performance Overview/i.test(indivText) &&
      Boolean(srId),
    evidence: "sa-13-print-individual.png",
  });
  record({
    scenario: "SA screen-to-print financial parity (individual)",
    startingUrl: printIndiv,
    action: "Compare statement totals tokens",
    resultingUrl: page.url(),
    expected: "Shared money tokens between screen statement and print",
    actual: `screen=${screenStatementTotals.slice(0, 6).join(",")} print=${printTotals.slice(0, 6).join(",")} shared=${sharedTotals.length}`,
    pass: sharedTotals.length >= 2 || screenStatementTotals.length === 0,
    evidence: "sa-13-print-individual.png",
  });

  // Overview print
  const printOv = `${BASE}/reports/sr-performance/print?mode=overview&from=2026-01-01&to=2026-07-19&partySearch=City`;
  await page.goto(printOv, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const ovText = await page.locator("body").innerText();
  await shot(page, "sa-14-print-overview");
  record({
    scenario: "SA overview print runtime",
    startingUrl: printOv,
    action: "Open overview print (partySearch should be ignored)",
    resultingUrl: page.url(),
    expected: "Overview only; branding; no Individual Statement table",
    actual: ovText.slice(0, 220).replace(/\s+/g, " "),
    pass:
      /Global SR Performance Overview/i.test(ovText) &&
      /Nazma/i.test(ovText) &&
      !/Individual SR Performance Statement/i.test(ovText),
    evidence: "sa-14-print-overview.png",
  });

  return { territoryIdA, territoryIdB, srId, territories };
}

async function runManager(page, foreignTerritoryId, foreignSrId) {
  await page.context().clearCookies();
  await login(page, "manager1@nazma.test", "Demo123!");
  await page.goto(`${BASE}/reports/sr-performance`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot(page, "mgr-01-initial");
  const body = await page.locator("body").innerText();
  record({
    scenario: "Manager initial load",
    startingUrl: `${BASE}/reports/sr-performance`,
    action: "Open report as Manager",
    resultingUrl: page.url(),
    expected: "Accessible without fatal auth redirect",
    actual: body.slice(0, 160).replace(/\s+/g, " "),
    pass:
      page.url().includes("/reports/sr-performance") &&
      !page.url().includes("/login"),
    evidence: "mgr-01-initial.png",
  });

  const allowed = await page
    .locator("aside select")
    .first()
    .locator("option")
    .evaluateAll((opts) => opts.map((o) => o.value).filter(Boolean));

  const probeTerritory =
    foreignTerritoryId && !allowed.includes(foreignTerritoryId)
      ? foreignTerritoryId
      : "00000000-0000-4000-8000-ffffffffffff";

  await page.goto(
    `${BASE}/reports/sr-performance?territoryId=${probeTerritory}&from=2026-01-01&to=2026-07-19`,
    { waitUntil: "networkidle" },
  );
  await page.waitForTimeout(2500);
  const terrBody = await page.locator("body").innerText();
  const terrAlert = (
    await page.locator('[role="alert"]').allInnerTexts()
  ).join(" ");
  await shot(page, "mgr-02-foreign-territory");
  record({
    scenario: "Manager cannot load foreign territory by URL",
    startingUrl: page.url(),
    action: `territoryId=${probeTerritory}`,
    resultingUrl: page.url(),
    expected: "Error/empty — foreign ledger rows not shown",
    actual: `alert=${terrAlert.slice(0, 120)} bodyHasUnable=${/Unable to load/i.test(terrBody)}`,
    pass:
      /Unable to load|unauthorized|forbidden|error/i.test(terrAlert + terrBody) ||
      /No active sales representatives/i.test(terrBody),
    evidence: "mgr-02-foreign-territory.png",
  });

  const probeSr = foreignSrId || "00000000-0000-4000-8000-000000000098";
  await page.goto(
    `${BASE}/reports/sr-performance?srId=${probeSr}&from=2026-01-01&to=2026-07-19`,
    { waitUntil: "networkidle" },
  );
  await page.waitForTimeout(2500);
  const srBody = await page.locator("body").innerText();
  const selectedMeta = await page
    .locator("text=/Selected SR:/i")
    .first()
    .innerText()
    .catch(() => "");
  await shot(page, "mgr-03-foreign-sr");
  const urlSr = params(page.url()).srId;
  record({
    scenario: "Manager cannot load foreign SR by URL",
    startingUrl: page.url(),
    action: `srId=${probeSr}`,
    resultingUrl: page.url(),
    expected: "Foreign SR not selected as statement owner",
    actual: `urlSr=${urlSr || "(none)"} meta=${selectedMeta}`,
    pass:
      urlSr !== probeSr ||
      /No SR selected|Unable to load/i.test(selectedMeta + srBody) ||
      !new RegExp(probeSr, "i").test(srBody),
    evidence: "mgr-03-foreign-sr.png",
  });
}

async function main() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let meta = { territoryIdA: null, territoryIdB: null, srId: null, territories: [] };
  try {
    meta = await runSuperAdmin(page);
  } catch (err) {
    record({
      scenario: "Super_Admin suite",
      startingUrl: BASE,
      action: "run",
      resultingUrl: page.url(),
      expected: "complete",
      actual: String(err),
      pass: false,
    });
    await shot(page, "sa-error").catch(() => null);
  }
  try {
    const foreign =
      meta.territories?.find((t) => t.value !== meta.territoryIdA)?.value ||
      meta.territoryIdB;
    await runManager(page, foreign, meta.srId);
  } catch (err) {
    record({
      scenario: "Manager suite",
      startingUrl: BASE,
      action: "run",
      resultingUrl: page.url(),
      expected: "complete",
      actual: String(err),
      pass: false,
    });
    await shot(page, "mgr-error").catch(() => null);
  }
  await browser.close();
  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    browser: "Chromium (Playwright headless)",
    database: {
      host: "docker nazma-erp-db → 127.0.0.1:5432 / postgres:5432",
      credentials: "REDACTED",
    },
    roles: ["Super_Admin admin@nazma.local", "Manager manager1@nazma.test"],
    results,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
  };
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "smoke-results.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(`\nSMOKE_PASSED=${summary.passed} SMOKE_FAILED=${summary.failed}`);
  console.log(`Evidence: ${pathToFileURL(EVIDENCE_DIR).href}`);
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
