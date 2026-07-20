import type { SrPerformancePrintPayloadDTO } from "@/types/sr-performance";

export interface SrPerformanceDocumentLabels {
  title: string;
  individualTitle: string;
  overviewTitle: string;
  dateRange: string;
  territory: string;
  allTerritories: string;
  selectedSr: string;
  noSelectedSr: string;
  generatedAt: string;
  partySearch: string;
  srSearch: string;
  sl: string;
  partyName: string;
  srName: string;
  previousDue: string;
  sales: string;
  collection: string;
  balanceDue: string;
  netBalance: string;
  totals: string;
  notesTitle: string;
  readOnly: string;
  unsupportedPostings: string;
  attributionWarning: string;
  reconciliationWarning: string;
}

export interface SrPerformanceDocumentFormatters {
  formatMoney: (value: string) => string;
  formatDate: (isoDate: string) => string;
  formatDateTime: (iso: string) => string;
}

export type SrPerformanceDocumentSource = SrPerformancePrintPayloadDTO;
