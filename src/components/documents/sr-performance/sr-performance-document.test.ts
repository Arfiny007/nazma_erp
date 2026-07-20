import { describe, expect, it } from "vitest";

import { mapSrPerformanceToDocument } from "./sr-performance-document-mapper";
import type { SrPerformanceDocumentLabels } from "./sr-performance-document-types";
import type { SrPerformancePrintPayloadDTO } from "@/types/sr-performance";

const labels: SrPerformanceDocumentLabels = {
  title: "SR Performance",
  individualTitle: "Individual SR Performance Statement",
  overviewTitle: "Global SR Performance Overview",
  dateRange: "Date range",
  territory: "Territory",
  allTerritories: "All territories",
  selectedSr: "Selected SR",
  noSelectedSr: "No SR",
  generatedAt: "Generated",
  partySearch: "Party search",
  srSearch: "SR search",
  sl: "SL",
  partyName: "Party",
  srName: "SR",
  previousDue: "Previous Due",
  sales: "Sales",
  collection: "Collection",
  balanceDue: "Balance Due",
  netBalance: "Net Balance",
  totals: "Totals",
  notesTitle: "Notes",
  readOnly: "Read-only",
  unsupportedPostings: "Unsupported",
  attributionWarning: "Attribution",
  reconciliationWarning: "Reconciliation",
};

const emptyAttribution = {
  duplicateDealerAttributionCount: 0,
  missingOwnershipCount: 0,
  ambiguousOwnershipCount: 0,
  affectedDealerCodes: [] as string[],
};

const individualPayload: SrPerformancePrintPayloadDTO = {
  generatedAt: "2026-07-19T00:00:00.000Z",
  mode: "individual",
  filters: {
    from: "2026-07-01",
    to: "2026-07-19",
    territoryId: null,
    territoryName: null,
    srId: "sr-1",
    srSearch: "",
    partySearch: "Alpha",
  },
  selectedSr: {
    id: "sr-1",
    name: "SR One",
    territoryNames: ["Dhaka North"],
  },
  individualRows: [
    {
      dealerCode: "D001",
      partyName: "Alpha Traders",
      territoryId: "t-1",
      territoryName: "Dhaka North",
      previousDue: "100.00",
      sales: "50.00",
      collection: "20.00",
      balanceDue: "130.00",
      reconciliationDelta: "0.00",
    },
  ],
  individualTotals: {
    previousDue: "100.00",
    sales: "50.00",
    collection: "20.00",
    netBalance: "130.00",
  },
  overviewRows: [],
  overviewTotals: {
    previousDue: "0.00",
    sales: "0.00",
    collection: "0.00",
    netBalance: "0.00",
  },
  diagnostics: {
    unsupportedPostingCount: 0,
    attributionWarnings: [],
    reconciliationWarnings: [],
    overlappingTerritoryIds: [],
    attribution: emptyAttribution,
  },
};

const overviewPayload: SrPerformancePrintPayloadDTO = {
  ...individualPayload,
  mode: "overview",
  selectedSr: null,
  filters: {
    ...individualPayload.filters,
    srId: null,
    partySearch: "",
    srSearch: "One",
  },
  individualRows: [],
  individualTotals: {
    previousDue: "0.00",
    sales: "0.00",
    collection: "0.00",
    netBalance: "0.00",
  },
  overviewRows: [
    {
      srId: "sr-1",
      srName: "SR One",
      territoryIds: ["t-1"],
      territoryNames: ["Dhaka North"],
      dealerCount: 1,
      previousDue: "100.00",
      sales: "50.00",
      collection: "20.00",
      netBalance: "130.00",
      reconciliationDelta: "0.00",
    },
  ],
  overviewTotals: {
    previousDue: "100.00",
    sales: "50.00",
    collection: "20.00",
    netBalance: "130.00",
  },
};

describe("sr-performance document mapper", () => {
  it("passes financial strings through formatters without arithmetic", () => {
    const seen: string[] = [];
    const mapped = mapSrPerformanceToDocument(individualPayload, labels, {
      formatMoney: (value) => {
        seen.push(value);
        return `FMT(${value})`;
      },
      formatDate: (iso) => iso,
      formatDateTime: (iso) => iso,
    });

    expect(mapped.individualRows[0]?.balanceDue).toBe("FMT(130.00)");
    expect(seen).toContain("130.00");
    expect(seen).toContain("100.00");
  });

  it("individual mode uses individual title and party search metadata", () => {
    const mapped = mapSrPerformanceToDocument(individualPayload, labels, {
      formatMoney: (value) => value,
      formatDate: (iso) => iso,
      formatDateTime: (iso) => iso,
    });
    expect(mapped.title).toBe("Individual SR Performance Statement");
    expect(mapped.partySearchLabel).toContain("Alpha");
    expect(mapped.individualRows).toHaveLength(1);
    expect(mapped.overviewRows).toHaveLength(0);
  });

  it("overview mode uses overview title and sr search metadata", () => {
    const mapped = mapSrPerformanceToDocument(overviewPayload, labels, {
      formatMoney: (value) => value,
      formatDate: (iso) => iso,
      formatDateTime: (iso) => iso,
    });
    expect(mapped.title).toBe("Global SR Performance Overview");
    expect(mapped.srSearchLabel).toContain("One");
    expect(mapped.overviewRows).toHaveLength(1);
    expect(mapped.individualRows).toHaveLength(0);
  });
});
