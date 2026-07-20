import { Suspense } from "react";
import { redirect } from "next/navigation";

import { enforcePermission, requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import {
  buildSrPerformanceQuery,
  formatLocalDateOnly,
  getAllowedTerritoryOptions,
  getSrDealerStatement,
  getSrPerformanceOverview,
  parseSrPerformanceFilters,
  toDealerStatementResultDTO,
  toOverviewResultDTO,
} from "@/lib/reports/sr-performance";
import type {
  SrDealerStatementResultDTO,
  SrPerformanceOverviewResultDTO,
  TerritoryOptionDTO,
} from "@/types/sr-performance";

import { SrPerformancePageClient } from "./page-client";

interface SrPerformancePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SrPerformancePage({
  searchParams,
}: SrPerformancePageProps) {
  await enforcePermission("reports:sr-performance:view");
  const user = await requirePermission("reports:sr-performance:view");
  const scope = await buildTerritoryScope(user.id);

  const params = await searchParams;
  const filters = parseSrPerformanceFilters(params);

  const filterInput = {
    from: filters.from,
    to: filters.to,
    territoryId: filters.territoryId,
    srId: filters.srId,
    srSearch: filters.srSearch,
    partySearch: filters.partySearch,
    page: filters.page,
    pageSize: filters.pageSize,
  };

  let territories: TerritoryOptionDTO[] = [];
  let overview: SrPerformanceOverviewResultDTO | null = null;
  let statement: SrDealerStatementResultDTO | null = null;
  let errorKey: string | null = null;
  let resolvedSrId = filters.srId;

  try {
    const [territoryRows, overviewResult, statementResult] = await Promise.all([
      getAllowedTerritoryOptions(scope),
      getSrPerformanceOverview(filterInput, scope),
      getSrDealerStatement(filterInput, scope),
    ]);
    territories = territoryRows;
    overview = toOverviewResultDTO(overviewResult);
    statement = toDealerStatementResultDTO(statementResult);
    resolvedSrId = statementResult.selectedSr?.id ?? null;
  } catch {
    errorKey = "srPerformance.error.generic";
  }

  // Soft-resolve: canonicalize URL when requested srId is out of scope.
  if (filters.srId && filters.srId !== resolvedSrId) {
    const query = buildSrPerformanceQuery({
      ...filters,
      srId: resolvedSrId,
    });
    redirect(query ? `/reports/sr-performance?${query}` : "/reports/sr-performance");
  }

  return (
    <Suspense>
      <SrPerformancePageClient
        initialOverview={overview}
        initialStatement={statement}
        territories={territories}
        initialFilters={{
          from: formatLocalDateOnly(filters.from),
          to: formatLocalDateOnly(filters.to),
          territoryId: filters.territoryId,
          srId: resolvedSrId,
          srSearch: filters.srSearch,
          partySearch: filters.partySearch,
          page: statement?.page ?? filters.page,
          pageSize: statement?.pageSize ?? filters.pageSize,
        }}
        initialErrorKey={errorKey}
      />
    </Suspense>
  );
}
