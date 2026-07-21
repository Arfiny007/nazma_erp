import { InvoiceStatus, Prisma } from "@prisma/client";

import type { TerritoryScope } from "@/lib/rbac/territory";

import { ZERO, normalizeQuantity } from "./product-sales-calculations";
import type {
  ProductSalesAttributionDiagnostics,
  TerritoryProductSalesAggregateRow,
} from "./product-sales-types";

/**
 * Read-only Prisma / SQL queries for Territory Product Sales — PHASE_12B / ADR-061.
 *
 * Sold quantity = SUM(InvoiceItem.quantity) for eligible issued invoices.
 * Historical territory from DealerOwnershipHistory as-of Invoice.issueDate.
 * Avoids relation-filtered groupBy + _count.id (ADR-059).
 */

/** Issued financial invoices — matches dashboard / ledger sales eligibility. */
export const ELIGIBLE_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.Issued,
  InvoiceStatus.Paid,
  InvoiceStatus.Partial,
  InvoiceStatus.Overdue,
];

export type ProductSalesReadClient = Pick<
  Prisma.TransactionClient,
  "territory" | "product" | "category" | "dealer"
> & {
  $queryRaw: Prisma.TransactionClient["$queryRaw"];
};

export function emptyAttributionDiagnostics(): ProductSalesAttributionDiagnostics {
  return {
    missingHistoricalTerritoryCount: 0,
    ambiguousHistoricalOwnershipCount: 0,
    currentTerritoryFallbackCount: 0,
    excludedRecordCount: 0,
  };
}

export function resolveAllowedTerritoryIds(
  scope: TerritoryScope,
  territoryId: string | null,
): string[] | "ALL" | "NONE" {
  if (scope.mode === "NONE") {
    return "NONE";
  }
  if (scope.mode === "ALL") {
    if (territoryId) {
      return [territoryId];
    }
    return "ALL";
  }
  if (territoryId) {
    return scope.territoryIds.includes(territoryId) ? [territoryId] : "NONE";
  }
  return [...scope.territoryIds];
}

interface AggregateRawRow {
  territoryId: string | null;
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string | null;
  categoryName: string | null;
  soldQuantity: Prisma.Decimal | string | null;
  invoiceCount: bigint | number | null;
  dealerCount: bigint | number | null;
}

interface DiagnosticsRawRow {
  missingHistoricalTerritoryCount: bigint | number | null;
  ambiguousHistoricalOwnershipCount: bigint | number | null;
  currentTerritoryFallbackCount: bigint | number | null;
  excludedRecordCount: bigint | number | null;
}

function toInt(value: bigint | number | null | undefined): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
}

function buildTerritoryFilterSql(
  allowed: string[] | "ALL" | "NONE",
): Prisma.Sql {
  if (allowed === "NONE") {
    return Prisma.sql`FALSE`;
  }
  if (allowed === "ALL") {
    return Prisma.sql`TRUE`;
  }
  if (allowed.length === 0) {
    return Prisma.sql`FALSE`;
  }
  return Prisma.sql`ha."resolvedTerritoryId" IN (${Prisma.join(allowed)})`;
}

export type EligibleInvoiceItemFilterOptions = {
  productId: string | null;
  categoryId: string | null;
  productSearch: string;
};

/**
 * Filters for the `eligible_invoice_items` CTE only.
 *
 * Allowed aliases at this stage: ii, i, d, p, c
 * Must NEVER reference later CTE aliases (eii, ha).
 */
export function buildEligibleInvoiceItemFilters(
  options: EligibleInvoiceItemFilterOptions,
): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];
  if (options.productId) {
    clauses.push(Prisma.sql`ii."productId" = ${options.productId}`);
  }
  if (options.categoryId) {
    clauses.push(Prisma.sql`p."categoryId" = ${options.categoryId}`);
  }
  if (options.productSearch) {
    const term = `%${options.productSearch}%`;
    clauses.push(Prisma.sql`(
      LOWER(ii."productName") LIKE LOWER(${term})
      OR LOWER(ii."productCode") LIKE LOWER(${term})
      OR LOWER(c."name") LIKE LOWER(${term})
    )`);
  }
  if (clauses.length === 0) {
    return Prisma.sql`TRUE`;
  }
  return Prisma.join(clauses, " AND ");
}

/**
 * Serialize Prisma.sql fragments for regression tests / certification.
 * Uses `$n` placeholders — never interpolates bound values into SQL text.
 */
export function sqlText(fragment: Prisma.Sql): string {
  return fragment.text;
}

/**
 * Core attributed aggregation CTE shared by report + chart queries.
 * One InvoiceItem → exactly one attribution row (rank 1) or excluded.
 */
function attributedItemsCte(
  fromInclusive: Date,
  toExclusive: Date,
  productFilters: Prisma.Sql,
): Prisma.Sql {
  const statuses = ELIGIBLE_INVOICE_STATUSES.map((s) => s);
  return Prisma.sql`
    eligible_invoice_items AS (
      SELECT
        ii."id" AS "invoiceItemId",
        ii."productId",
        ii."quantity",
        ii."productCode",
        ii."productName",
        i."id" AS "invoiceId",
        i."dealerCode",
        i."issueDate" AS "invoiceDate",
        d."id" AS "dealerId",
        d."territoryId" AS "currentTerritoryId",
        p."categoryId",
        c."name" AS "categoryName"
      FROM "InvoiceItem" ii
      INNER JOIN "Invoice" i ON i."id" = ii."invoiceId"
      INNER JOIN "Dealer" d ON d."dealerCode" = i."dealerCode"
      LEFT JOIN "Product" p ON p."id" = ii."productId"
      LEFT JOIN "Category" c ON c."id" = p."categoryId"
      WHERE
        i."issueDate" >= ${fromInclusive}
        AND i."issueDate" < ${toExclusive}
        AND i."status"::text IN (${Prisma.join(statuses)})
        AND (${productFilters})
    ),
    historical_attribution AS (
      SELECT
        eii.*,
        doh."territoryId" AS "historyTerritoryId",
        ROW_NUMBER() OVER (
          PARTITION BY eii."invoiceItemId"
          ORDER BY doh."effectiveFrom" DESC, doh."id" DESC
        ) AS "ownershipRank",
        COUNT(doh."id") OVER (
          PARTITION BY eii."invoiceItemId"
        ) AS "ownershipMatchCount"
      FROM eligible_invoice_items eii
      LEFT JOIN "DealerOwnershipHistory" doh
        ON doh."dealerId" = eii."dealerId"
        AND doh."effectiveFrom" <= eii."invoiceDate"
        AND (
          doh."effectiveTo" IS NULL
          OR doh."effectiveTo" > eii."invoiceDate"
        )
    ),
    attributed AS (
      SELECT
        ha.*,
        CASE
          WHEN ha."ownershipMatchCount" > 0 AND ha."ownershipRank" = 1
            THEN ha."historyTerritoryId"
          WHEN ha."ownershipMatchCount" = 0 AND ha."currentTerritoryId" IS NOT NULL
            THEN ha."currentTerritoryId"
          ELSE NULL
        END AS "resolvedTerritoryId",
        CASE
          WHEN ha."ownershipMatchCount" > 1 AND ha."ownershipRank" = 1
            THEN 'ambiguous'
          WHEN ha."ownershipMatchCount" = 1 AND ha."ownershipRank" = 1
            THEN 'history'
          WHEN ha."ownershipMatchCount" = 0 AND ha."currentTerritoryId" IS NOT NULL
            THEN 'fallback'
          ELSE 'excluded'
        END AS "attributionSource"
      FROM historical_attribution ha
      WHERE ha."ownershipRank" = 1
    )
  `;
}

export async function aggregateTerritoryProductSales(
  client: ProductSalesReadClient,
  scope: TerritoryScope,
  options: {
    fromInclusive: Date;
    toExclusive: Date;
    territoryId: string | null;
    productId: string | null;
    categoryId: string | null;
    productSearch: string;
  },
): Promise<{
  rows: TerritoryProductSalesAggregateRow[];
  diagnostics: ProductSalesAttributionDiagnostics;
}> {
  const allowed = resolveAllowedTerritoryIds(scope, options.territoryId);
  if (allowed === "NONE") {
    return { rows: [], diagnostics: emptyAttributionDiagnostics() };
  }

  const productFilters = buildEligibleInvoiceItemFilters({
    productId: options.productId,
    categoryId: options.categoryId,
    productSearch: options.productSearch,
  });
  const territoryFilter = buildTerritoryFilterSql(allowed);
  const cte = attributedItemsCte(
    options.fromInclusive,
    options.toExclusive,
    productFilters,
  );

  const [aggregateRows, diagnosticRows] = await Promise.all([
    client.$queryRaw<AggregateRawRow[]>`
      WITH ${cte}
      SELECT
        ha."resolvedTerritoryId" AS "territoryId",
        ha."productId" AS "productId",
        MAX(ha."productCode") AS "productCode",
        MAX(ha."productName") AS "productName",
        MAX(ha."categoryId") AS "categoryId",
        MAX(ha."categoryName") AS "categoryName",
        SUM(ha."quantity") AS "soldQuantity",
        COUNT(DISTINCT ha."invoiceId") AS "invoiceCount",
        COUNT(DISTINCT ha."dealerCode") AS "dealerCount"
      FROM attributed ha
      WHERE
        ha."resolvedTerritoryId" IS NOT NULL
        AND (${territoryFilter})
        AND ha."attributionSource" IN ('history', 'fallback', 'ambiguous')
      GROUP BY
        ha."resolvedTerritoryId",
        ha."productId"
    `,
    client.$queryRaw<DiagnosticsRawRow[]>`
      WITH ${cte}
      SELECT
        COUNT(*) FILTER (
          WHERE ha."attributionSource" = 'fallback'
        ) AS "missingHistoricalTerritoryCount",
        COUNT(*) FILTER (
          WHERE ha."attributionSource" = 'ambiguous'
        ) AS "ambiguousHistoricalOwnershipCount",
        COUNT(*) FILTER (
          WHERE ha."attributionSource" = 'fallback'
        ) AS "currentTerritoryFallbackCount",
        COUNT(*) FILTER (
          WHERE ha."attributionSource" = 'excluded'
            OR ha."resolvedTerritoryId" IS NULL
        ) AS "excludedRecordCount"
      FROM attributed ha
    `,
  ]);

  const diag = diagnosticRows[0];
  const diagnostics: ProductSalesAttributionDiagnostics = {
    missingHistoricalTerritoryCount: toInt(
      diag?.missingHistoricalTerritoryCount,
    ),
    ambiguousHistoricalOwnershipCount: toInt(
      diag?.ambiguousHistoricalOwnershipCount,
    ),
    currentTerritoryFallbackCount: toInt(diag?.currentTerritoryFallbackCount),
    excludedRecordCount: toInt(diag?.excludedRecordCount),
  };

  const rows: TerritoryProductSalesAggregateRow[] = aggregateRows
    .filter((row): row is AggregateRawRow & { territoryId: string } =>
      Boolean(row.territoryId),
    )
    .map((row) => ({
      territoryId: row.territoryId,
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      soldQuantity: normalizeQuantity(row.soldQuantity),
      invoiceCount: toInt(row.invoiceCount),
      dealerCount: toInt(row.dealerCount),
    }));

  return { rows, diagnostics };
}

export async function findTerritoryOptionsForScope(
  client: ProductSalesReadClient,
  scope: TerritoryScope,
): Promise<Array<{ id: string; name: string }>> {
  if (scope.mode === "NONE") {
    return [];
  }

  return client.territory.findMany({
    where: {
      isActive: true,
      ...(scope.mode === "TERRITORIES"
        ? { id: { in: [...scope.territoryIds] } }
        : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function findCategoryOptions(
  client: ProductSalesReadClient,
): Promise<Array<{ id: string; name: string }>> {
  return client.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function findProductOptions(
  client: ProductSalesReadClient,
  options?: { categoryId?: string | null; search?: string; take?: number },
): Promise<Array<{ id: string; code: string; name: string }>> {
  const take = options?.take ?? 200;
  const products = await client.product.findMany({
    where: {
      isActive: true,
      ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options?.search
        ? {
            OR: [
              { name: { contains: options.search, mode: "insensitive" } },
              { sku: { contains: options.search, mode: "insensitive" } },
              {
                modelNumber: {
                  contains: options.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },
    select: { id: true, sku: true, name: true },
    orderBy: { name: "asc" },
    take,
  });

  return products.map((p) => ({
    id: p.id,
    code: p.sku,
    name: p.name,
  }));
}

/** Pure helper for unit tests — attribute one ownership interval set. */
export function resolveHistoricalTerritoryId(params: {
  invoiceDate: Date;
  ownershipRows: ReadonlyArray<{
    territoryId: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  }>;
  currentTerritoryId: string | null;
}): {
  territoryId: string | null;
  source: "history" | "fallback" | "ambiguous" | "excluded";
} {
  const matches = params.ownershipRows.filter((row) => {
    if (row.effectiveFrom.getTime() > params.invoiceDate.getTime()) {
      return false;
    }
    if (
      row.effectiveTo != null &&
      row.effectiveTo.getTime() <= params.invoiceDate.getTime()
    ) {
      return false;
    }
    return true;
  });

  if (matches.length > 1) {
    const sorted = [...matches].sort((a, b) => {
      const from = b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
      if (from !== 0) return from;
      return a.territoryId.localeCompare(b.territoryId);
    });
    return { territoryId: sorted[0]!.territoryId, source: "ambiguous" };
  }

  if (matches.length === 1) {
    return { territoryId: matches[0]!.territoryId, source: "history" };
  }

  if (params.currentTerritoryId) {
    return {
      territoryId: params.currentTerritoryId,
      source: "fallback",
    };
  }

  return { territoryId: null, source: "excluded" };
}

export function sumSoldQuantity(
  rows: ReadonlyArray<{ soldQuantity: Prisma.Decimal }>,
): Prisma.Decimal {
  return rows.reduce(
    (acc, row) => acc.plus(row.soldQuantity),
    ZERO,
  );
}

interface DistinctCountRawRow {
  invoiceCount: bigint | number | null;
  dealerCount: bigint | number | null;
}

/**
 * Exact distinct invoice/dealer counts for the same attribution window.
 * Bounded — constant query count relative to result rows.
 */
export async function countDistinctInvoicesAndDealers(
  client: ProductSalesReadClient,
  scope: TerritoryScope,
  options: {
    fromInclusive: Date;
    toExclusive: Date;
    territoryId: string | null;
    productId: string | null;
    categoryId: string | null;
    productSearch: string;
  },
): Promise<{ invoiceCount: number; dealerCount: number }> {
  const allowed = resolveAllowedTerritoryIds(scope, options.territoryId);
  if (allowed === "NONE") {
    return { invoiceCount: 0, dealerCount: 0 };
  }

  const productFilters = buildEligibleInvoiceItemFilters({
    productId: options.productId,
    categoryId: options.categoryId,
    productSearch: options.productSearch,
  });
  const territoryFilter = buildTerritoryFilterSql(allowed);
  const cte = attributedItemsCte(
    options.fromInclusive,
    options.toExclusive,
    productFilters,
  );

  const rows = await client.$queryRaw<DistinctCountRawRow[]>`
    WITH ${cte}
    SELECT
      COUNT(DISTINCT ha."invoiceId") AS "invoiceCount",
      COUNT(DISTINCT ha."dealerCode") AS "dealerCount"
    FROM attributed ha
    WHERE
      ha."resolvedTerritoryId" IS NOT NULL
      AND ha."attributionSource" IN ('history', 'fallback', 'ambiguous')
      AND (${territoryFilter})
  `;

  return {
    invoiceCount: toInt(rows[0]?.invoiceCount),
    dealerCount: toInt(rows[0]?.dealerCount),
  };
}
