import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { TerritoryScope } from "@/lib/rbac/territory";

import {
  ZERO,
  buildDealerFinancials,
  calculateBalanceDue,
  sumTotals,
} from "./sr-performance-calculations";
import { SrPerformanceError } from "./sr-performance-errors";
import {
  aggregateDealerLedgerMetrics,
  buildAttributionDiagnostics,
  emptyAttributionDiagnostics,
  findOverlappingTerritoryAssignments,
  findScopedActiveSalesRepresentatives,
  findScopedDealersForReport,
  findTerritoryOptionsForScope,
  type SrPerformanceReadClient,
} from "./sr-performance-query";
import type {
  SrAttributionDiagnostics,
  SrDealerStatementResult,
  SrDealerStatementRow,
  SrPerformanceDiagnostics,
  SrPerformanceFilterParams,
  SrPerformanceOverviewResult,
  SrPerformanceOverviewRow,
  SrPerformancePrintMode,
  SrPerformancePrintPayload,
  SrPerformanceTotals,
} from "./sr-performance-types";
import { SR_PERFORMANCE_PRINT_DEALER_CAP } from "./sr-performance-types";
import {
  assertScopedReportAccess,
  assertTerritoryInScope,
  normalizeFilters,
  resolveSrIdInScope,
  toExclusiveDateBounds,
} from "./sr-performance-validation";

/**
 * SR Performance reporting orchestration — PHASE_12A.1 / ADR-060.
 *
 * Read-only. Never mutates LedgerEntry, Dealer balances, or audit state.
 */

function emptyDiagnostics(
  attribution: SrAttributionDiagnostics = emptyAttributionDiagnostics(),
  overlappingTerritoryIds: string[] = [],
): SrPerformanceDiagnostics {
  const attributionWarnings: string[] = [];
  if (
    attribution.duplicateDealerAttributionCount > 0 ||
    attribution.ambiguousOwnershipCount > 0 ||
    attribution.missingOwnershipCount > 0
  ) {
    attributionWarnings.push("srPerformance.diagnostics.attributionWarning");
  }

  return {
    unsupportedPostingCount: 0,
    attributionWarnings,
    reconciliationWarnings: [],
    overlappingTerritoryIds,
    attribution,
  };
}

function mergeDiagnostics(
  base: SrPerformanceDiagnostics,
  rows: ReadonlyArray<{
    reconciliationDelta: Prisma.Decimal;
    unsupportedPostingCount: number;
  }>,
): SrPerformanceDiagnostics {
  let unsupportedPostingCount = 0;
  const reconciliationWarnings: string[] = [...base.reconciliationWarnings];

  for (const row of rows) {
    unsupportedPostingCount += row.unsupportedPostingCount;
    if (!row.reconciliationDelta.isZero()) {
      reconciliationWarnings.push("srPerformance.diagnostics.reconciliationDelta");
    }
  }

  return {
    ...base,
    unsupportedPostingCount,
    reconciliationWarnings: [...new Set(reconciliationWarnings)],
  };
}

async function resolveAllowedSrIds(
  client: SrPerformanceReadClient,
  scope: TerritoryScope,
  territoryId: string | null,
): Promise<{
  srs: Awaited<ReturnType<typeof findScopedActiveSalesRepresentatives>>;
  allowed: Set<string>;
}> {
  const srs = await findScopedActiveSalesRepresentatives(client, scope, {
    territoryId,
  });
  return { srs, allowed: new Set(srs.map((sr) => sr.srId)) };
}

function buildDealerRows(
  dealers: Awaited<ReturnType<typeof findScopedDealersForReport>>,
  metrics: Map<
    string,
    Awaited<ReturnType<typeof aggregateDealerLedgerMetrics>> extends Map<
      string,
      infer V
    >
      ? V
      : never
  >,
): SrDealerStatementRow[] {
  return dealers.map((dealer) => {
    const aggregate = metrics.get(dealer.dealerCode) ?? {
      dealerCode: dealer.dealerCode,
      previousDue: ZERO,
      sales: ZERO,
      collection: ZERO,
      ledgerMovement: ZERO,
      unsupportedPostingCount: 0,
    };
    const financials = buildDealerFinancials(aggregate);
    return {
      dealerCode: dealer.dealerCode,
      partyName: dealer.partyName,
      territoryId: dealer.territoryId,
      territoryName: dealer.territoryName,
      previousDue: financials.previousDue,
      sales: financials.sales,
      collection: financials.collection,
      balanceDue: financials.balanceDue,
      reconciliationDelta: financials.reconciliationDelta,
      unsupportedPostingCount: financials.unsupportedPostingCount,
    };
  });
}

function emptyTotals(): SrPerformanceTotals {
  return {
    previousDue: ZERO,
    sales: ZERO,
    collection: ZERO,
    netBalance: ZERO,
  };
}

function attributionFromDealers(
  dealers: Awaited<ReturnType<typeof findScopedDealersForReport>>,
): SrAttributionDiagnostics {
  return buildAttributionDiagnostics(dealers);
}

export async function getAllowedTerritoryOptions(
  scope: TerritoryScope,
  client: SrPerformanceReadClient = prisma,
): Promise<Array<{ id: string; name: string }>> {
  assertScopedReportAccess(scope);
  return findTerritoryOptionsForScope(client, scope);
}

export async function getSrPerformanceOverview(
  params: Partial<SrPerformanceFilterParams>,
  scope: TerritoryScope,
  client: SrPerformanceReadClient = prisma,
): Promise<SrPerformanceOverviewResult> {
  assertScopedReportAccess(scope);
  const filters = normalizeFilters(params);
  assertTerritoryInScope(scope, filters.territoryId);

  const [{ srs, allowed }, overlappingTerritoryIds] = await Promise.all([
    resolveAllowedSrIds(client, scope, filters.territoryId ?? null),
    findOverlappingTerritoryAssignments(
      client,
      scope,
      filters.territoryId ?? null,
    ),
  ]);

  // srId is selection/highlight only for overview — never fail the query.
  const effectiveSrId = resolveSrIdInScope(allowed, filters.srId);

  const filteredSrs = filters.srSearch
    ? await findScopedActiveSalesRepresentatives(client, scope, {
        territoryId: filters.territoryId,
        srSearch: filters.srSearch,
      })
    : srs;

  const srIds = filteredSrs.map((sr) => sr.srId);
  const dealers = await findScopedDealersForReport(client, scope, {
    territoryId: filters.territoryId,
    srIds,
  });

  const { fromInclusive, toExclusive } = toExclusiveDateBounds(
    filters.from,
    filters.to,
  );
  const dealerCodes = dealers.map((d) => d.dealerCode);
  const metrics = await aggregateDealerLedgerMetrics(
    client,
    dealerCodes,
    fromInclusive,
    toExclusive,
  );

  const dealerRows = buildDealerRows(dealers, metrics);
  const dealersBySr = new Map<string, SrDealerStatementRow[]>();
  for (const row of dealerRows) {
    const dealer = dealers.find((d) => d.dealerCode === row.dealerCode);
    const srId = dealer?.assignedSrId;
    if (!srId) {
      continue;
    }
    const list = dealersBySr.get(srId) ?? [];
    list.push(row);
    dealersBySr.set(srId, list);
  }

  const overviewRows: SrPerformanceOverviewRow[] = filteredSrs.map((sr) => {
    const srDealers = dealersBySr.get(sr.srId) ?? [];
    const totals = sumTotals(srDealers);
    let reconciliationDelta = ZERO;
    for (const row of srDealers) {
      reconciliationDelta = reconciliationDelta.plus(row.reconciliationDelta);
    }
    return {
      srId: sr.srId,
      srName: sr.srName,
      territoryIds: sr.territoryIds,
      territoryNames: sr.territoryNames,
      dealerCount: srDealers.length,
      previousDue: totals.previousDue,
      sales: totals.sales,
      collection: totals.collection,
      netBalance: totals.netBalance,
      reconciliationDelta,
    };
  });

  const diagnostics = mergeDiagnostics(
    emptyDiagnostics(
      attributionFromDealers(dealers),
      overlappingTerritoryIds,
    ),
    dealerRows,
  );

  return {
    rows: overviewRows,
    totals: sumTotals(overviewRows),
    diagnostics,
    generatedAt: new Date(),
    filters: {
      from: filters.from,
      to: filters.to,
      territoryId: filters.territoryId ?? null,
      srId: effectiveSrId,
      srSearch: filters.srSearch ?? "",
      // partySearch does not apply to overview queries.
      partySearch: "",
    },
  };
}

export async function getSrDealerStatement(
  params: Partial<SrPerformanceFilterParams>,
  scope: TerritoryScope,
  client: SrPerformanceReadClient = prisma,
): Promise<SrDealerStatementResult> {
  assertScopedReportAccess(scope);
  const filters = normalizeFilters(params);
  assertTerritoryInScope(scope, filters.territoryId);

  const [{ srs, allowed }, overlappingTerritoryIds] = await Promise.all([
    resolveAllowedSrIds(client, scope, filters.territoryId ?? null),
    findOverlappingTerritoryAssignments(
      client,
      scope,
      filters.territoryId ?? null,
    ),
  ]);

  // Invalid srId after territory change → clear deterministically.
  const resolvedRequested = resolveSrIdInScope(allowed, filters.srId);
  const selectedSrId =
    resolvedRequested ?? (srs.length > 0 ? srs[0]!.srId : null);

  const selectedSrMeta = selectedSrId
    ? (srs.find((sr) => sr.srId === selectedSrId) ?? null)
    : null;

  if (!selectedSrId || !selectedSrMeta) {
    return {
      selectedSr: null,
      rows: [],
      totals: emptyTotals(),
      total: 0,
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 25,
      pageCount: 0,
      diagnostics: emptyDiagnostics(
        emptyAttributionDiagnostics(),
        overlappingTerritoryIds,
      ),
      generatedAt: new Date(),
      filters: {
        from: filters.from,
        to: filters.to,
        territoryId: filters.territoryId ?? null,
        srId: null,
        srSearch: filters.srSearch ?? "",
        partySearch: filters.partySearch ?? "",
      },
    };
  }

  // partySearch applies here; srSearch must not filter dealer rows.
  const dealers = await findScopedDealersForReport(client, scope, {
    territoryId: filters.territoryId,
    srId: selectedSrId,
    partySearch: filters.partySearch,
  });

  const { fromInclusive, toExclusive } = toExclusiveDateBounds(
    filters.from,
    filters.to,
  );
  const metrics = await aggregateDealerLedgerMetrics(
    client,
    dealers.map((d) => d.dealerCode),
    fromInclusive,
    toExclusive,
  );

  const allRows = buildDealerRows(dealers, metrics);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const total = allRows.length;
  const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const rows = allRows.slice(start, start + pageSize);
  const totals = sumTotals(allRows);

  return {
    selectedSr: {
      id: selectedSrMeta.srId,
      name: selectedSrMeta.srName,
      territoryIds: selectedSrMeta.territoryIds,
      territoryNames: selectedSrMeta.territoryNames,
    },
    rows,
    totals: {
      previousDue: totals.previousDue,
      sales: totals.sales,
      collection: totals.collection,
      netBalance: totals.netBalance,
    },
    total,
    page,
    pageSize,
    pageCount,
    diagnostics: mergeDiagnostics(
      emptyDiagnostics(
        attributionFromDealers(dealers),
        overlappingTerritoryIds,
      ),
      allRows,
    ),
    generatedAt: new Date(),
    filters: {
      from: filters.from,
      to: filters.to,
      territoryId: filters.territoryId ?? null,
      srId: selectedSrId,
      srSearch: filters.srSearch ?? "",
      partySearch: filters.partySearch ?? "",
    },
  };
}

/** Default individual statement: first in-scope SR (or empty). */
export async function getDefaultSrDealerStatement(
  params: Partial<SrPerformanceFilterParams>,
  scope: TerritoryScope,
  client: SrPerformanceReadClient = prisma,
): Promise<SrDealerStatementResult> {
  return getSrDealerStatement(
    { ...params, srId: params.srId ?? null },
    scope,
    client,
  );
}

function resolvePrintMode(
  mode: SrPerformancePrintMode | null | undefined,
): SrPerformancePrintMode {
  if (mode === "individual" || mode === "overview") {
    return mode;
  }
  throw new SrPerformanceError(
    "VALIDATION_ERROR",
    "Print mode must be individual or overview",
  );
}

export async function getSrPerformancePrintPayload(
  params: Partial<SrPerformanceFilterParams>,
  scope: TerritoryScope,
  client: SrPerformanceReadClient = prisma,
): Promise<SrPerformancePrintPayload> {
  assertScopedReportAccess(scope);
  const filters = normalizeFilters({ ...params, page: 1, pageSize: 100 });
  assertTerritoryInScope(scope, filters.territoryId);
  const mode = resolvePrintMode(filters.mode ?? params.mode);

  let territoryName: string | null = null;
  if (filters.territoryId) {
    const options = await findTerritoryOptionsForScope(client, scope);
    territoryName =
      options.find((row) => row.id === filters.territoryId)?.name ?? null;
  }

  if (mode === "overview") {
    // Overview print: ignore partySearch and do not render individual table.
    const overview = await getSrPerformanceOverview(
      {
        ...filters,
        partySearch: "",
        srId: null,
      },
      scope,
      client,
    );

    return {
      generatedAt: new Date(),
      mode,
      filters: {
        from: filters.from,
        to: filters.to,
        territoryId: filters.territoryId ?? null,
        territoryName,
        srId: null,
        srSearch: filters.srSearch ?? "",
        partySearch: "",
      },
      selectedSr: null,
      individualRows: [],
      individualTotals: emptyTotals(),
      overviewRows: overview.rows,
      overviewTotals: overview.totals,
      diagnostics: overview.diagnostics,
    };
  }

  // Individual print: srId mandatory and authorized.
  const { srs, allowed } = await resolveAllowedSrIds(
    client,
    scope,
    filters.territoryId ?? null,
  );
  const selectedSrId = resolveSrIdInScope(allowed, filters.srId);
  if (!selectedSrId) {
    throw new SrPerformanceError(
      "VALIDATION_ERROR",
      "Individual print requires an authorized srId",
    );
  }

  const dealers = await findScopedDealersForReport(client, scope, {
    territoryId: filters.territoryId,
    srId: selectedSrId,
    partySearch: filters.partySearch,
  });

  if (dealers.length > SR_PERFORMANCE_PRINT_DEALER_CAP) {
    throw new SrPerformanceError(
      "REPORT_CAP_EXCEEDED",
      `Print dealer rows exceed safe cap of ${SR_PERFORMANCE_PRINT_DEALER_CAP}`,
    );
  }

  const { fromInclusive, toExclusive } = toExclusiveDateBounds(
    filters.from,
    filters.to,
  );
  const metrics = await aggregateDealerLedgerMetrics(
    client,
    dealers.map((d) => d.dealerCode),
    fromInclusive,
    toExclusive,
  );
  const individualRows = buildDealerRows(dealers, metrics);
  const totals = sumTotals(individualRows);
  const individualTotals: SrPerformanceTotals = {
    previousDue: totals.previousDue,
    sales: totals.sales,
    collection: totals.collection,
    netBalance: totals.netBalance,
  };
  const meta = srs.find((sr) => sr.srId === selectedSrId);
  const selectedSr = meta
    ? {
        id: meta.srId,
        name: meta.srName,
        territoryNames: meta.territoryNames,
      }
    : null;

  // Optional parity check against overview row when partySearch is empty.
  const diagnostics = mergeDiagnostics(
    emptyDiagnostics(
      attributionFromDealers(dealers),
      [],
    ),
    individualRows,
  );

  if (selectedSr && filters.partySearch === "") {
    const overview = await getSrPerformanceOverview(
      {
        ...filters,
        srSearch: "",
        partySearch: "",
        srId: selectedSrId,
      },
      scope,
      client,
    );
    const overviewRow = overview.rows.find((row) => row.srId === selectedSrId);
    if (overviewRow) {
      const expected = calculateBalanceDue(
        overviewRow.previousDue,
        overviewRow.sales,
        overviewRow.collection,
      );
      if (!expected.equals(individualTotals.netBalance)) {
        diagnostics.reconciliationWarnings.push(
          "srPerformance.diagnostics.overviewDetailMismatch",
        );
      }
    }
    diagnostics.overlappingTerritoryIds =
      overview.diagnostics.overlappingTerritoryIds;
    diagnostics.attribution = overview.diagnostics.attribution;
    if (overview.diagnostics.attributionWarnings.length > 0) {
      diagnostics.attributionWarnings = [
        ...new Set([
          ...diagnostics.attributionWarnings,
          ...overview.diagnostics.attributionWarnings,
        ]),
      ];
    }
  }

  return {
    generatedAt: new Date(),
    mode,
    filters: {
      from: filters.from,
      to: filters.to,
      territoryId: filters.territoryId ?? null,
      territoryName,
      srId: selectedSrId,
      srSearch: filters.srSearch ?? "",
      partySearch: filters.partySearch ?? "",
    },
    selectedSr,
    individualRows,
    individualTotals,
    overviewRows: [],
    overviewTotals: emptyTotals(),
    diagnostics,
  };
}
