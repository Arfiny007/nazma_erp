import { Suspense } from "react";

import { enforcePermission, requirePermission } from "@/lib/rbac/guards";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import {
  getSrPerformancePrintPayload,
  parseSrPerformanceFilters,
  toPrintPayloadDTO,
} from "@/lib/reports/sr-performance";
import type { SrPerformancePrintPayloadDTO } from "@/types/sr-performance";

import { SrPerformancePrintPageClient } from "./page-client";

interface PrintPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SrPerformancePrintPage({
  searchParams,
}: PrintPageProps) {
  await enforcePermission("reports:sr-performance:view");
  const user = await requirePermission("reports:sr-performance:view");
  const scope = await buildTerritoryScope(user.id);

  const params = await searchParams;
  const filters = parseSrPerformanceFilters(params);

  let payload: SrPerformancePrintPayloadDTO | null = null;
  let errorKey: string | null = null;

  if (!filters.mode) {
    errorKey = "srPerformance.error.printModeRequired";
  } else {
    try {
      const result = await getSrPerformancePrintPayload(
        {
          from: filters.from,
          to: filters.to,
          territoryId: filters.territoryId,
          srId: filters.srId,
          srSearch: filters.srSearch,
          partySearch: filters.partySearch,
          mode: filters.mode,
        },
        scope,
      );
      payload = toPrintPayloadDTO(result);
    } catch {
      errorKey = "srPerformance.error.generic";
      payload = null;
    }
  }

  return (
    <Suspense>
      <SrPerformancePrintPageClient payload={payload} errorKey={errorKey} />
    </Suspense>
  );
}
