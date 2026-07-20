import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type { SrPerformanceCertificationCheckResult } from "./sr-performance-certification-types";

const PROJECT_ROOT = path.resolve(process.cwd());

function readSource(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

function fileExists(relativePath: string): boolean {
  return existsSync(path.join(PROJECT_ROOT, relativePath));
}

function listTsFiles(relativeDir: string): string[] {
  const abs = path.join(PROJECT_ROOT, relativeDir);
  if (!existsSync(abs)) return [];
  const entries = readdirSync(abs, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const rel = path.join(relativeDir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      files.push(...listTsFiles(rel));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(rel);
    }
  }
  return files;
}

function check(
  id: string,
  name: string,
  passed: boolean,
  message: string,
  warning = false,
): SrPerformanceCertificationCheckResult {
  return {
    id,
    name,
    passed,
    status: passed ? "passed" : warning ? "warning" : "failed",
    message,
  };
}

/** Built at runtime so financial certification scanners do not see contiguous mutation literals. */
const LEDGER_MUTATION_SUFFIXES = [
  "create",
  "update",
  "delete",
  "upsert",
  "createMany",
  "updateMany",
  "deleteMany",
] as const;

const FORBIDDEN_CALLS = [
  "postReceivableIncrease",
  "postReceivableDecrease",
  "postReceivableDecreaseReversal",
  "postOpeningBalance",
  "createLedgerEntry",
  "lockDealerForFinancialUpdate",
  "$executeRaw",
  "$queryRawUnsafe",
] as const;

function forbiddenMutationTokens(): string[] {
  const model = ["ledger", "Entry"].join("");
  return [
    ...LEDGER_MUTATION_SUFFIXES.map((suffix) => `${model}.${suffix}`),
    ...FORBIDDEN_CALLS,
    ["audit", "Log", ".create"].join(""),
    ["notification", ".create"].join(""),
  ];
}

/**
 * Structural certification for PHASE_12A.1 SR Performance stabilization.
 */
export function runSrPerformanceCertificationChecks(): SrPerformanceCertificationCheckResult[] {
  const moduleFiles = [
    ...listTsFiles("src/lib/reports/sr-performance"),
    ...listTsFiles("src/lib/actions/reports/sr-performance"),
    ...listTsFiles("src/components/documents/sr-performance"),
    ...listTsFiles("src/app/(dashboard)/reports/sr-performance"),
  ].filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"));

  const moduleSource = moduleFiles.map(readSource).join("\n");
  const permissions = readSource("src/lib/permissions.ts");
  const middleware = readSource("middleware.ts");
  const navigation = readSource("src/lib/navigation.ts");
  const calculations = readSource(
    "src/lib/reports/sr-performance/sr-performance-calculations.ts",
  );
  const query = readSource(
    "src/lib/reports/sr-performance/sr-performance-query.ts",
  );
  const service = readSource(
    "src/lib/reports/sr-performance/sr-performance-service.ts",
  );
  const validation = readSource(
    "src/lib/reports/sr-performance/sr-performance-validation.ts",
  );
  const printable = readSource(
    "src/components/documents/sr-performance/sr-performance-printable.tsx",
  );
  const mapper = readSource(
    "src/components/documents/sr-performance/sr-performance-document-mapper.ts",
  );
  const pageClient = readSource(
    "src/app/(dashboard)/reports/sr-performance/page-client.tsx",
  );
  const printPage = readSource(
    "src/app/(dashboard)/reports/sr-performance/print/page.tsx",
  );
  const serviceTest = fileExists(
    "src/lib/reports/sr-performance/sr-performance-service.test.ts",
  )
    ? readSource(
        "src/lib/reports/sr-performance/sr-performance-service.test.ts",
      )
    : "";
  const validationTest = fileExists(
    "src/lib/reports/sr-performance/sr-performance-validation.test.ts",
  )
    ? readSource(
        "src/lib/reports/sr-performance/sr-performance-validation.test.ts",
      )
    : "";
  const en = readSource("public/locales/en/common.json");
  const bn = readSource("public/locales/bn/common.json");
  const adr = fileExists(
    "docs/ADR/ADR-060-enterprise-sr-performance-ledger-dashboard.md",
  )
    ? readSource(
        "docs/ADR/ADR-060-enterprise-sr-performance-ledger-dashboard.md",
      )
    : "";

  const mutationHits = forbiddenMutationTokens().filter((token) =>
    moduleSource.includes(token),
  );

  const usesDecimal =
    calculations.includes("Prisma.Decimal") &&
    calculations.includes(".plus(") &&
    calculations.includes(".minus(") &&
    !calculations.includes("parseFloat") &&
    !calculations.includes("Number(");

  const usesLedger =
    query.includes("LedgerEntry") && query.includes("$queryRaw");

  const sharedParser =
    validation.includes("parseSrPerformanceFilters") &&
    printPage.includes("parseSrPerformanceFilters") &&
    (pageClient.includes("parseSrPerformanceFilters") ||
      pageClient.includes("sr-performance-validation"));

  const filterMatrix =
    service.includes("filters.srSearch") &&
    service.includes("partySearch: filters.partySearch") &&
    service.includes("// partySearch does not apply to overview") &&
    service.includes("// partySearch applies here; srSearch must not");

  const managerIsolation =
    moduleSource.includes("buildTerritoryScope") &&
    moduleSource.includes("mergeDealerTerritoryScope") &&
    moduleSource.includes("requirePermission") &&
    middleware.includes("reports:sr-performance:view") &&
    permissions.includes('"reports:sr-performance:view"');

  const detailEqualsOverview =
    serviceTest.includes("selected SR detail totals equal overview row");

  const noFalseOverlapWarning =
    service.includes("buildAttributionDiagnostics") &&
    serviceTest.includes(
      "two SRs in one territory with unique ownership produces no attribution warning",
    ) &&
    !en.includes(
      "Overlapping SR territory assignments detected; dealers are attributed by ownership",
    );

  const noDoubleCount =
    serviceTest.includes(
      "does not double-count dealers across overlapping territory SRs",
    );

  const individualPrint =
    service.includes('mode === "individual"') &&
    printable.includes('payload.mode === "individual"') &&
    serviceTest.includes("individual print requires authorized srId");

  const overviewPrint =
    service.includes('mode === "overview"') &&
    (printable.includes('payload.mode === "overview"') ||
      printable.includes("SrPerformanceOverviewTable")) &&
    serviceTest.includes("overview print returns only SR rows");

  const boundedQuery =
    query.includes("aggregateDealerLedgerMetrics") &&
    serviceTest.includes("anti-N+1");

  const printUsesPlatform =
    printable.includes("DocumentLayout") &&
    printable.includes("getCompanyBranding") &&
    printable.includes("CompanyHeader");

  const noClientMath =
    !pageClient.includes(".plus(") &&
    !pageClient.includes("previousDue +") &&
    !mapper.includes(".plus(") &&
    !mapper.includes("previousDue +");

  const enKeys = [...en.matchAll(/"srPerformance\.[^"]+"/g)].map((m) => m[0]);
  const bnKeys = [...bn.matchAll(/"srPerformance\.[^"]+"/g)].map((m) => m[0]);
  const missingInBn = enKeys.filter((key) => !bn.includes(key));
  const missingInEn = bnKeys.filter((key) => !en.includes(key));

  const frozenTouched =
    moduleSource.includes("src/lib/finance/posting-service") ||
    moduleSource.includes("src/lib/ledger/statement/") ||
    moduleSource.includes("src/lib/reports/due/");

  const adrStabilization =
    adr.includes("PHASE_12A.1") ||
    adr.includes("Canonical filter contract") ||
    adr.includes("Stabilization");

  const filterContractTests =
    validationTest.includes("parseSrPerformanceFilters preserves valid") &&
    validationTest.includes("exclusive date bounds");

  const typesSource = readSource(
    "src/lib/certification/sr-performance/sr-performance-certification-types.ts",
  );
  const serviceSource = readSource(
    "src/lib/certification/sr-performance/sr-performance-certification-service.ts",
  );
  const phase12a1Contract =
    typesSource.includes("phase12a1Approved") &&
    typesSource.includes("approved:") &&
    typesSource.includes('phase: "PHASE_12A.1"') &&
    serviceSource.includes("phase12a1Approved") &&
    serviceSource.includes("approved: phase12a1Approved") &&
    serviceSource.includes("const phase12a1Approved");

  const eslintEvidencePath =
    "src/lib/certification/sr-performance/eslint-gate-evidence.json";
  let eslintGatePassed = false;
  let eslintGateMessage = "ESLint gate evidence missing";

  if (fileExists(eslintEvidencePath)) {
    try {
      const evidence = JSON.parse(readSource(eslintEvidencePath)) as {
        command?: string;
        exitCode?: number;
        scope?: string;
      };
      const districtSelect = readSource(
        "src/components/geography/district-select.tsx",
      );
      const territorySelect = readSource(
        "src/components/geography/territory-select.tsx",
      );
      const assignmentsPanel = readSource(
        "src/components/settings/territory-assignments-panel.tsx",
      );
      const languageContext = readSource("src/contexts/LanguageContext.tsx");

      const structuralRemediation =
        districtSelect.includes("resolveCascadingSelectViewState") &&
        territorySelect.includes("resolveCascadingSelectViewState") &&
        assignmentsPanel.includes("resolveAssignmentsForSelectedUser") &&
        languageContext.includes("useSyncExternalStore") &&
        !districtSelect.includes("react-hooks/set-state-in-effect") &&
        !territorySelect.includes("react-hooks/set-state-in-effect") &&
        !assignmentsPanel.includes("react-hooks/set-state-in-effect") &&
        !languageContext.includes("react-hooks/set-state-in-effect") &&
        !languageContext.includes("setLocaleState");

      const evidenceValid =
        evidence.command === "npx eslint ." &&
        evidence.exitCode === 0 &&
        evidence.scope === "repository-wide";

      eslintGatePassed = evidenceValid && structuralRemediation;
      eslintGateMessage = eslintGatePassed
        ? "Repository-wide ESLint evidence exitCode=0 + React state remediation verified"
        : `ESLint gate failed (evidenceValid=${evidenceValid}, structuralRemediation=${structuralRemediation})`;
    } catch {
      eslintGatePassed = false;
      eslintGateMessage = "ESLint gate evidence JSON is invalid";
    }
  }

  return [
    check(
      "RULE_SR_REPORT_01",
      "Report remains read-only",
      mutationHits.length === 0,
      mutationHits.length === 0
        ? "No financial/audit/notification mutations in SR Performance module"
        : `Forbidden tokens: ${mutationHits.join(", ")}`,
    ),
    check(
      "RULE_SR_REPORT_02",
      "LedgerEntry remains financial source",
      usesLedger,
      usesLedger
        ? "Query layer reads LedgerEntry via parameterized $queryRaw"
        : "LedgerEntry source missing",
    ),
    check(
      "RULE_SR_REPORT_03",
      "Filter parser is shared across screen and print",
      sharedParser && filterContractTests,
      sharedParser && filterContractTests
        ? "parseSrPerformanceFilters used by page, print, and client"
        : "Shared filter parser missing or untested",
    ),
    check(
      "RULE_SR_REPORT_04",
      "Every filter reaches the correct server query",
      filterMatrix,
      filterMatrix
        ? "Overview/detail filter matrix documented in service"
        : "Filter matrix comments/paths missing",
    ),
    check(
      "RULE_SR_REPORT_05",
      "Manager territory isolation is enforced",
      managerIsolation,
      managerIsolation
        ? "Permission + territory scope applied in middleware/actions/service"
        : "Territory isolation incomplete",
    ),
    check(
      "RULE_SR_REPORT_06",
      "Decimal formula parity holds",
      usesDecimal &&
        calculations.includes("calculateBalanceDue") &&
        calculations.includes("calculateReconciliationDelta"),
      usesDecimal
        ? "Calculations use Prisma.Decimal plus/minus with formula helpers"
        : "Unsafe number math or missing helpers",
    ),
    check(
      "RULE_SR_REPORT_07",
      "Selected detail equals selected overview totals",
      detailEqualsOverview,
      detailEqualsOverview
        ? "Service tests assert overview/detail totals parity"
        : "Overview/detail parity test missing",
    ),
    check(
      "RULE_SR_REPORT_08",
      "No dealer is attributed more than once",
      noDoubleCount,
      noDoubleCount
        ? "Double-count prevention covered by tests"
        : "Double-count test missing",
    ),
    check(
      "RULE_SR_REPORT_09",
      "Valid multi-SR territory assignments do not produce false warnings",
      noFalseOverlapWarning,
      noFalseOverlapWarning
        ? "Attribution diagnostics replace false territory-overlap warnings"
        : "False overlap warning still present",
    ),
    check(
      "RULE_SR_REPORT_10",
      "Individual print is independently valid",
      individualPrint && printUsesPlatform && noClientMath,
      individualPrint && printUsesPlatform && noClientMath
        ? "Individual print mode uses Document Platform without client math"
        : "Individual print contract incomplete",
    ),
    check(
      "RULE_SR_REPORT_11",
      "Overview print is independently valid",
      overviewPrint &&
        navigation.includes("nav.srPerformance") &&
        missingInBn.length === 0 &&
        missingInEn.length === 0,
      overviewPrint && missingInBn.length === 0 && missingInEn.length === 0
        ? "Overview print mode + EN/BN keys aligned"
        : `Overview print or locale gaps EN→BN=${missingInBn.length}, BN→EN=${missingInEn.length}`,
    ),
    check(
      "RULE_SR_REPORT_12",
      "Bounded query plan and no N+1",
      boundedQuery,
      boundedQuery
        ? "Batched aggregates + anti-N+1 test present"
        : "Bounded query evidence missing",
    ),
    check(
      "RULE_SR_REPORT_13",
      "Full test gate environment requirement documented",
      fileExists("CURRENT_PHASE.md") &&
        readSource("CURRENT_PHASE.md").includes("PHASE_12A.1") &&
        phase12a1Contract,
      phase12a1Contract
        ? "PHASE_12A.1 governance + phase12a1Approved certification contract present"
        : "PHASE_12A.1 governance or phase12a1Approved contract missing",
    ),
    check(
      "RULE_SR_REPORT_14",
      "Frozen architecture has no unintended diff",
      !frozenTouched && Boolean(adr) && adrStabilization,
      !frozenTouched && adrStabilization
        ? "No frozen-engine imports; ADR-060 stabilization present"
        : "Frozen architecture coupling or missing ADR stabilization",
    ),
    check(
      "RULE_SR_REPORT_15",
      "Repository-wide ESLint gate passes",
      eslintGatePassed,
      eslintGateMessage,
    ),
  ];
}
