import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  buildEligibleInvoiceItemFilters,
  sqlText,
} from "@/lib/reports/product-sales-territory/product-sales-query";

import type { ProductSalesCertificationCheckResult } from "./product-sales-certification-types";

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
): ProductSalesCertificationCheckResult {
  return {
    id,
    name,
    passed,
    status: passed ? "passed" : warning ? "warning" : "failed",
    message,
  };
}

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
 * Structural certification for PHASE_12B Territory Product Sales.
 */
export function runProductSalesCertificationChecks(): ProductSalesCertificationCheckResult[] {
  const moduleFiles = [
    ...listTsFiles("src/lib/reports/product-sales-territory"),
    ...listTsFiles("src/lib/actions/reports/product-sales-territory"),
    ...listTsFiles("src/app/(dashboard)/reports/product-sales-by-territory"),
  ].filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"));

  const moduleSource = moduleFiles.map(readSource).join("\n");
  const permissions = readSource("src/lib/permissions.ts");
  const middleware = readSource("middleware.ts");
  const navigation = readSource("src/lib/navigation.ts");
  const query = readSource(
    "src/lib/reports/product-sales-territory/product-sales-query.ts",
  );
  const calculations = readSource(
    "src/lib/reports/product-sales-territory/product-sales-calculations.ts",
  );
  const analyticsService = readSource(
    "src/lib/dashboard/analytics/analytics-service.ts",
  );
  const analyticsMappers = readSource(
    "src/lib/dashboard/analytics/analytics-mappers.ts",
  );
  const en = readSource("public/locales/en/common.json");
  const bn = readSource("public/locales/bn/common.json");
  const adr = fileExists(
    "docs/ADR/ADR-061-enterprise-territory-product-sales-dashboard.md",
  );

  const frozenPaths = [
    "src/lib/finance/posting-service.ts",
    "src/lib/finance/dealer-lock.ts",
    "prisma/schema.prisma",
    "auth.ts",
  ];

  const checks: ProductSalesCertificationCheckResult[] = [];

  // RULE_PRODUCT_SALES_01 — read-only
  const forbidden = forbiddenMutationTokens().filter((token) =>
    moduleSource.includes(token),
  );
  checks.push(
    check(
      "RULE_PRODUCT_SALES_01",
      "Module is read-only",
      forbidden.length === 0,
      forbidden.length === 0
        ? "No mutation / posting tokens in product-sales modules"
        : `Forbidden tokens: ${forbidden.join(", ")}`,
    ),
  );

  // RULE_PRODUCT_SALES_02 — InvoiceItem source
  checks.push(
    check(
      "RULE_PRODUCT_SALES_02",
      "InvoiceItem is sold-quantity source",
      query.includes('"InvoiceItem"') &&
        query.includes("SUM(ha.\"quantity\")") &&
        !moduleSource.includes("SalesOrderItem") &&
        !moduleSource.includes("DeliveryChallanItem"),
      "Sold quantity aggregates InvoiceItem.quantity only",
    ),
  );

  // RULE_PRODUCT_SALES_03 — eligible invoices
  checks.push(
    check(
      "RULE_PRODUCT_SALES_03",
      "Only eligible issued invoices included",
      query.includes("ELIGIBLE_INVOICE_STATUSES") &&
        query.includes("Issued") &&
        query.includes("Paid") &&
        query.includes("Partial") &&
        query.includes("Overdue") &&
        !query.includes("Draft"),
      "Eligible statuses match dashboard issued invoice set",
    ),
  );

  // RULE_PRODUCT_SALES_04 — historical attribution
  checks.push(
    check(
      "RULE_PRODUCT_SALES_04",
      "Historical territory attribution is deterministic",
      query.includes("DealerOwnershipHistory") &&
        query.includes("effectiveFrom") &&
        query.includes("effectiveTo") &&
        query.includes("ownershipRank") &&
        query.includes("resolveHistoricalTerritoryId"),
      "Ownership as-of issueDate with deterministic rank",
    ),
  );

  // RULE_PRODUCT_SALES_05 — no double count
  checks.push(
    check(
      "RULE_PRODUCT_SALES_05",
      "No InvoiceItem double counting",
      query.includes("PARTITION BY eii.\"invoiceItemId\"") &&
        query.includes("ownershipRank") &&
        query.includes("ha.\"ownershipRank\" = 1"),
      "Window rank keeps one attribution row per InvoiceItem",
    ),
  );

  // RULE_PRODUCT_SALES_06 — Territory RBAC
  checks.push(
    check(
      "RULE_PRODUCT_SALES_06",
      "Territory RBAC enforced server-side",
      permissions.includes("reports:territory-product-sales:view") &&
        middleware.includes("/reports/product-sales-by-territory") &&
        navigation.includes("product-sales-by-territory") &&
        moduleSource.includes("buildTerritoryScope") &&
        moduleSource.includes("assertTerritoryInScope"),
      "Permission + middleware + nav + scope predicates present",
    ),
  );

  // RULE_PRODUCT_SALES_07 — SR scope
  const srBlockMatch = permissions.match(
    /SR:\s*\[([\s\S]*?)\],\s*\n\} as const/,
  );
  const accountsBlockMatch = permissions.match(
    /Accounts:\s*\[([\s\S]*?)\],\s*\n\s*SR:/,
  );
  const srHasPermission = Boolean(
    srBlockMatch?.[1]?.includes("reports:territory-product-sales:view"),
  );
  const accountsDenied = !Boolean(
    accountsBlockMatch?.[1]?.includes("reports:territory-product-sales:view"),
  );
  checks.push(
    check(
      "RULE_PRODUCT_SALES_07",
      "SR scope cannot leak foreign dealer sales",
      srHasPermission &&
        accountsDenied &&
        moduleSource.includes("resolveAllowedTerritoryIds"),
      "SR allowed via territory scope; Accounts denied; territory predicate applied",
    ),
  );

  // RULE_PRODUCT_SALES_08 — Decimal
  checks.push(
    check(
      "RULE_PRODUCT_SALES_08",
      "Quantity calculations use Decimal",
      calculations.includes("Prisma.Decimal") &&
        !calculations.includes("parseFloat") &&
        !calculations.includes("Math.round") &&
        moduleSource.includes("toFixed(2)"),
      "Decimal helpers used; DTO transport via toFixed(2)",
    ),
  );

  // RULE_PRODUCT_SALES_09 — bounded query
  checks.push(
    check(
      "RULE_PRODUCT_SALES_09",
      "Report query plan is bounded",
      query.includes("$queryRaw") &&
        query.includes("Prisma.sql") &&
        !query.includes("$queryRawUnsafe") &&
        !query.includes("$executeRaw"),
      "Parameterized $queryRaw aggregates only",
    ),
  );

  // RULE_PRODUCT_SALES_10 — ADR-059
  checks.push(
    check(
      "RULE_PRODUCT_SALES_10",
      "ADR-059 unsafe groupBy pattern absent",
      !moduleSource.includes("groupBy") ||
        !moduleSource.includes("_count: { id"),
      "No relation-filtered groupBy + _count.id",
    ),
  );

  // RULE_PRODUCT_SALES_11 — dashboard analytics
  checks.push(
    check(
      "RULE_PRODUCT_SALES_11",
      "Dashboard chart uses certified analytics architecture",
      analyticsService.includes("getTopSellingProductsByTerritory") &&
        analyticsService.includes("mapTopProductsByQuantityChart") &&
        analyticsMappers.includes("mapTopProductsByQuantityChart") &&
        analyticsMappers.includes("decimalToChartValue"),
      "Top products chart wired through analytics service/mappers",
    ),
  );

  // RULE_PRODUCT_SALES_12 — reconcile path
  checks.push(
    check(
      "RULE_PRODUCT_SALES_12",
      "Report and chart totals reconcile",
      analyticsService.includes("getTopSellingProductsByTerritory") &&
        moduleSource.includes("aggregateTerritoryProductSales") &&
        fileExists(
          "src/lib/actions/reports/product-sales-territory/get-top-selling-products-by-territory.ts",
        ),
      "Chart and report share getTopSellingProductsByTerritory / aggregateTerritoryProductSales",
    ),
  );

  // RULE_PRODUCT_SALES_13 — localization
  const requiredKeys = [
    "nav.territoryProductSales",
    "productSales.title",
    "productSales.columns.soldQuantity",
    "productSales.summary.totalQuantity",
    "productSales.print.documentTitle",
    "productSales.actions.print",
    "dashboard.analytics.charts.topProductsByQuantity",
    "dashboard.analytics.charts.viewTerritoryBreakdown",
  ];
  const missingEn = requiredKeys.filter((k) => !en.includes(`"${k}"`));
  const missingBn = requiredKeys.filter((k) => !bn.includes(`"${k}"`));
  checks.push(
    check(
      "RULE_PRODUCT_SALES_13",
      "Localization is complete",
      missingEn.length === 0 && missingBn.length === 0,
      missingEn.length === 0 && missingBn.length === 0
        ? "EN/BN keys present for nav, report, print, and dashboard chart"
        : `Missing EN=${missingEn.join(",")} BN=${missingBn.join(",")}`,
    ),
  );

  // RULE_PRODUCT_SALES_14 — frozen architecture presence
  const frozenPresent = frozenPaths.every((p) => fileExists(p));
  checks.push(
    check(
      "RULE_PRODUCT_SALES_14",
      "Frozen architecture files present",
      frozenPresent && adr,
      frozenPresent && adr
        ? "Frozen engines present; ADR-061 authored"
        : "Missing frozen path or ADR-061",
    ),
  );

  // RULE_PRODUCT_SALES_15 — route + parser
  checks.push(
    check(
      "RULE_PRODUCT_SALES_15",
      "Mandatory repository gates structure",
      fileExists(
        "src/app/(dashboard)/reports/product-sales-by-territory/page.tsx",
      ) &&
        moduleSource.includes("parseTerritoryProductSalesFilters") &&
        moduleSource.includes("issueDate") &&
        !moduleSource.includes("issuedAt"),
      "Route, shared filter parser, and issueDate field present",
    ),
  );

  // RULE_PRODUCT_SALES_16 — query-stage filter aliases (PHASE_12B.1)
  const productFilterSql = sqlText(
    buildEligibleInvoiceItemFilters({
      productId: "11111111-1111-4111-8111-111111111111",
      categoryId: null,
      productSearch: "",
    }),
  );
  const categoryFilterSql = sqlText(
    buildEligibleInvoiceItemFilters({
      productId: null,
      categoryId: "22222222-2222-4222-8222-222222222222",
      productSearch: "",
    }),
  );
  const searchFilterSql = sqlText(
    buildEligibleInvoiceItemFilters({
      productId: null,
      categoryId: null,
      productSearch: "brass",
    }),
  );
  const productFilterValid =
    productFilterSql.includes('ii."productId"') &&
    !productFilterSql.includes('eii."productId"');
  const categoryFilterValid =
    categoryFilterSql.includes('p."categoryId"') &&
    !categoryFilterSql.includes('eii."categoryId"');
  const searchFilterValid =
    searchFilterSql.includes('ii."productName"') &&
    searchFilterSql.includes('ii."productCode"') &&
    !searchFilterSql.includes('eii."productName"') &&
    !searchFilterSql.includes('eii."productCode"');
  const builderUsesEligibleScope =
    query.includes("buildEligibleInvoiceItemFilters") &&
    query.includes("Allowed aliases at this stage: ii, i, d, p, c");
  checks.push(
    check(
      "RULE_PRODUCT_SALES_16",
      "Dynamic report filters use correct SQL scope aliases",
      productFilterValid &&
        categoryFilterValid &&
        searchFilterValid &&
        builderUsesEligibleScope &&
        !query.includes('eii."productId" =') &&
        !query.includes('eii."productName"'),
      productFilterValid && categoryFilterValid && searchFilterValid
        ? "Eligible CTE filters use ii/p/c aliases; never unavailable eii"
        : "Product/category/search filters reference invalid CTE aliases",
    ),
  );

  // RULE_PRODUCT_SALES_17 — print uses certified report DTO + Document Platform
  const printRoute = fileExists(
    "src/app/(dashboard)/reports/product-sales-by-territory/print/page.tsx",
  );
  const printDoc = fileExists(
    "src/components/documents/product-sales-territory/territory-product-sales-document.tsx",
  );
  const printSource = [
    printRoute
      ? readSource(
          "src/app/(dashboard)/reports/product-sales-by-territory/print/page.tsx",
        )
      : "",
    fileExists(
      "src/lib/reports/product-sales-territory/product-sales-service.ts",
    )
      ? readSource(
          "src/lib/reports/product-sales-territory/product-sales-service.ts",
        )
      : "",
    printDoc
      ? readSource(
          "src/components/documents/product-sales-territory/territory-product-sales-document.tsx",
        )
      : "",
    fileExists(
      "src/lib/actions/reports/product-sales-territory/get-territory-product-sales-print-payload.ts",
    )
      ? readSource(
          "src/lib/actions/reports/product-sales-territory/get-territory-product-sales-print-payload.ts",
        )
      : "",
  ].join("\n");
  const printUsesReportService =
    printSource.includes("getTerritoryProductSalesPrintPayload") &&
    printSource.includes("getTerritoryProductSalesReport") &&
    printSource.includes("includeAllRows");
  const printUsesDocumentPlatform =
    printSource.includes("DocumentLayout") &&
    printSource.includes("CompanyHeader") &&
    printSource.includes("CompanyFooter");
  const printUsesSamePermission =
    printSource.includes("reports:territory-product-sales:view") &&
    !printSource.includes("reports:territory-product-sales:print");
  const printNoSeparateSql =
    !printSource.includes("$queryRawUnsafe") &&
    !printSource.includes("$executeRaw");
  const printModeReport =
    moduleSource.includes('mode: z.enum(["report"])') ||
    readSource("src/lib/validators/product-sales-territory.schema.ts").includes(
      'z.enum(["report"])',
    );
  checks.push(
    check(
      "RULE_PRODUCT_SALES_17",
      "Territory Product Sales print uses certified report DTO and Document Platform",
      printRoute &&
        printDoc &&
        printUsesReportService &&
        printUsesDocumentPlatform &&
        printUsesSamePermission &&
        printNoSeparateSql &&
        printModeReport,
      printRoute &&
        printDoc &&
        printUsesReportService &&
        printUsesDocumentPlatform &&
        printUsesSamePermission &&
        printNoSeparateSql &&
        printModeReport
        ? "Print consumes report service + Document Platform; same view permission; mode=report"
        : "Print bypasses report DTO, Document Platform, RBAC, or mode contract",
    ),
  );

  return checks;
}
