import type { SrPerformanceDocumentLabels } from "./sr-performance-document-types";

type Translate = (key: string) => string;

export function buildSrPerformanceDocumentLabels(
  t: Translate,
): SrPerformanceDocumentLabels {
  return {
    title: t("srPerformance.print.title"),
    individualTitle: t("srPerformance.print.individualTitle"),
    overviewTitle: t("srPerformance.print.overviewTitle"),
    dateRange: t("srPerformance.print.dateRange"),
    territory: t("srPerformance.print.territory"),
    allTerritories: t("srPerformance.filters.allTerritories"),
    selectedSr: t("srPerformance.print.selectedSr"),
    noSelectedSr: t("srPerformance.empty.noSelectedSr"),
    generatedAt: t("srPerformance.print.generatedAt"),
    partySearch: t("srPerformance.filters.partySearch"),
    srSearch: t("srPerformance.filters.srSearch"),
    sl: t("srPerformance.columns.sl"),
    partyName: t("srPerformance.columns.partyName"),
    srName: t("srPerformance.columns.srName"),
    previousDue: t("srPerformance.columns.previousDue"),
    sales: t("srPerformance.columns.sales"),
    collection: t("srPerformance.columns.collection"),
    balanceDue: t("srPerformance.columns.balanceDue"),
    netBalance: t("srPerformance.columns.netBalance"),
    totals: t("srPerformance.totals"),
    notesTitle: t("srPerformance.print.notes"),
    readOnly: t("srPerformance.readOnly"),
    unsupportedPostings: t("srPerformance.diagnostics.unsupportedPostings"),
    attributionWarning: t("srPerformance.diagnostics.attributionWarning"),
    reconciliationWarning: t("srPerformance.diagnostics.reconciliationWarning"),
  };
}
