import type { SrPerformancePrintPayloadDTO } from "@/types/sr-performance";

import type {
  SrPerformanceDocumentFormatters,
  SrPerformanceDocumentLabels,
} from "./sr-performance-document-types";

/**
 * Presentation mapping only — no financial arithmetic.
 * Money/date strings come from server DTOs / formatters.
 */

export interface SrPerformanceMappedDocument {
  title: string;
  dateRangeLabel: string;
  territoryLabel: string;
  selectedSrLabel: string;
  generatedAtLabel: string;
  readOnlyLabel: string;
  partySearchLabel: string | null;
  srSearchLabel: string | null;
  notes: string[];
  individualRows: Array<{
    sl: string;
    partyName: string;
    previousDue: string;
    sales: string;
    collection: string;
    balanceDue: string;
  }>;
  individualTotals: {
    previousDue: string;
    sales: string;
    collection: string;
    balanceDue: string;
  };
  overviewRows: Array<{
    sl: string;
    srName: string;
    territories: string;
    previousDue: string;
    sales: string;
    collection: string;
    netBalance: string;
  }>;
  overviewTotals: {
    previousDue: string;
    sales: string;
    collection: string;
    netBalance: string;
  };
}

export function mapSrPerformanceToDocument(
  payload: SrPerformancePrintPayloadDTO,
  labels: SrPerformanceDocumentLabels,
  formatters: SrPerformanceDocumentFormatters,
): SrPerformanceMappedDocument {
  const territoryLabel =
    payload.filters.territoryName ??
    (payload.filters.territoryId ? payload.filters.territoryId : labels.allTerritories);

  const selectedSrLabel = payload.selectedSr
    ? `${payload.selectedSr.name}${
        payload.selectedSr.territoryNames.length > 0
          ? ` (${payload.selectedSr.territoryNames.join(", ")})`
          : ""
      }`
    : labels.noSelectedSr;

  const notes: string[] = [labels.readOnly];
  if (payload.diagnostics.unsupportedPostingCount > 0) {
    notes.push(
      `${labels.unsupportedPostings}: ${payload.diagnostics.unsupportedPostingCount}`,
    );
  }
  const attribution = payload.diagnostics.attribution;
  if (
    attribution.duplicateDealerAttributionCount > 0 ||
    attribution.ambiguousOwnershipCount > 0 ||
    attribution.missingOwnershipCount > 0
  ) {
    notes.push(labels.attributionWarning);
  }
  if (payload.diagnostics.reconciliationWarnings.length > 0) {
    notes.push(labels.reconciliationWarning);
  }

  const title =
    payload.mode === "individual"
      ? labels.individualTitle
      : labels.overviewTitle;

  return {
    title,
    dateRangeLabel: `${labels.dateRange}: ${formatters.formatDate(payload.filters.from)} – ${formatters.formatDate(payload.filters.to)}`,
    territoryLabel: `${labels.territory}: ${territoryLabel}`,
    selectedSrLabel: `${labels.selectedSr}: ${selectedSrLabel}`,
    generatedAtLabel: `${labels.generatedAt}: ${formatters.formatDateTime(payload.generatedAt)}`,
    readOnlyLabel: labels.readOnly,
    partySearchLabel: payload.filters.partySearch
      ? `${labels.partySearch}: ${payload.filters.partySearch}`
      : null,
    srSearchLabel: payload.filters.srSearch
      ? `${labels.srSearch}: ${payload.filters.srSearch}`
      : null,
    notes,
    individualRows: payload.individualRows.map((row, index) => ({
      sl: String(index + 1),
      partyName: row.partyName,
      previousDue: formatters.formatMoney(row.previousDue),
      sales: formatters.formatMoney(row.sales),
      collection: formatters.formatMoney(row.collection),
      balanceDue: formatters.formatMoney(row.balanceDue),
    })),
    individualTotals: {
      previousDue: formatters.formatMoney(payload.individualTotals.previousDue),
      sales: formatters.formatMoney(payload.individualTotals.sales),
      collection: formatters.formatMoney(payload.individualTotals.collection),
      balanceDue: formatters.formatMoney(payload.individualTotals.netBalance),
    },
    overviewRows: payload.overviewRows.map((row, index) => ({
      sl: String(index + 1),
      srName: row.srName,
      territories: row.territoryNames.join(", "),
      previousDue: formatters.formatMoney(row.previousDue),
      sales: formatters.formatMoney(row.sales),
      collection: formatters.formatMoney(row.collection),
      netBalance: formatters.formatMoney(row.netBalance),
    })),
    overviewTotals: {
      previousDue: formatters.formatMoney(payload.overviewTotals.previousDue),
      sales: formatters.formatMoney(payload.overviewTotals.sales),
      collection: formatters.formatMoney(payload.overviewTotals.collection),
      netBalance: formatters.formatMoney(payload.overviewTotals.netBalance),
    },
  };
}
