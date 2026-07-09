import { describe, expect, it } from "vitest";

import {
  mapDealerStatementToDocument,
  mergeDealerStatementPages,
  STATEMENT_PRINT_ROW_ACCENT_CLASS,
} from "@/components/documents/statement/statement-mapper";
import { STATEMENT_PAGE_SIZE } from "@/components/ledger/statement-row-styles";
import type { DealerStatementDTO, StatementRowDTO } from "@/types/ledger-statement";

function makeRow(
  overrides: Partial<StatementRowDTO> & Pick<StatementRowDTO, "id" | "runningBalance">,
): StatementRowDTO {
  return {
    transactionDate: "2026-01-15T00:00:00.000Z",
    postingDate: "2026-01-15T00:00:00.000Z",
    postingType: "Issue",
    referenceType: "Invoice",
    referenceId: "inv-1",
    referenceNo: "INV-000001",
    description: "Invoice issue",
    debit: "1000.00",
    credit: "0.00",
    createdById: "user-1",
    createdByName: "Accounts User",
    isOpeningBalance: false,
    ...overrides,
  };
}

function makeStatement(
  overrides: Partial<DealerStatementDTO> = {},
): DealerStatementDTO {
  return {
    meta: {
      dealerCode: "D-001",
      dealerName: "Nazma Dealer",
      currentBalance: "7500.00",
      creditLimit: "100000.00",
      hasOpeningBalance: true,
      openingBalanceAmount: "5000.00",
      openingBalanceEffectiveDate: "2026-01-01T00:00:00.000Z",
      openingBalanceStatus: "Locked",
      dateRange: { fromDate: null, toDate: null },
      ledgerIntegrity: {
        isChainValid: true,
        isReplayValid: true,
        isCacheValid: true,
        isConsistent: true,
      },
      generatedAt: "2026-07-09T00:00:00.000Z",
    },
    openingBalanceForRange: "0.00",
    rows: [],
    totals: {
      totalDebit: "0.00",
      totalCredit: "0.00",
      netMovement: "0.00",
      entryCount: 0,
    },
    pagination: {
      page: 1,
      pageSize: STATEMENT_PAGE_SIZE,
      total: 0,
      pageCount: 0,
    },
    ...overrides,
  };
}

const formatters = {
  formatMoney: (value: string) => `BDT ${value}`,
  formatDate: (iso: string) => iso.slice(0, 10),
  formatPeriodDate: (value: string | null) => value?.slice(0, 10) ?? "Open",
  postingTypeLabel: (postingType: StatementRowDTO["postingType"]) => postingType,
  integrityLabel: (consistent: boolean) => (consistent ? "OK" : "Warning"),
};

describe("Dealer Statement Document — mapper and print pipeline", () => {
  describe("mapDealerStatementToDocument", () => {
    it("maps a statement with opening balance row without recalculating balances", () => {
      const dto = makeStatement({
        openingBalanceForRange: "5000.00",
        rows: [
          makeRow({
            id: "1",
            postingType: "OpeningBalance",
            referenceType: "OpeningBalance",
            referenceNo: "OB-D-001",
            debit: "5000.00",
            runningBalance: "5000.00",
            isOpeningBalance: true,
          }),
          makeRow({
            id: "2",
            debit: "3000.00",
            runningBalance: "8000.00",
          }),
        ],
        totals: {
          totalDebit: "8000.00",
          totalCredit: "500.00",
          netMovement: "7500.00",
          entryCount: 2,
        },
      });

      const document = mapDealerStatementToDocument(dto, formatters, "All time");

      expect(document.openingBalance).toBe("BDT 5000.00");
      expect(document.totalDebit).toBe("BDT 8000.00");
      expect(document.totalCredit).toBe("BDT 500.00");
      expect(document.closingBalance).toBe("BDT 7500.00");
      expect(document.transactionCount).toBe("2");
      expect(document.rows[0].runningBalance).toBe("BDT 5000.00");
      expect(document.rows[1].runningBalance).toBe("BDT 8000.00");
      expect(document.rows[0].accent).toBe("opening");
      expect(document.rows[1].accent).toBe("default");
    });

    it("maps a statement without opening balance initialization", () => {
      const dto = makeStatement({
        meta: {
          ...makeStatement().meta,
          hasOpeningBalance: false,
          openingBalanceAmount: null,
          openingBalanceEffectiveDate: null,
          openingBalanceStatus: null,
          currentBalance: "0.00",
        },
        openingBalanceForRange: "0.00",
        rows: [
          makeRow({
            id: "1",
            debit: "1000.00",
            runningBalance: "1000.00",
          }),
        ],
        totals: {
          totalDebit: "1000.00",
          totalCredit: "0.00",
          netMovement: "1000.00",
          entryCount: 1,
        },
      });

      const document = mapDealerStatementToDocument(dto, formatters, "All time");

      expect(document.openingBalance).toBe("BDT 0.00");
      expect(document.rows).toHaveLength(1);
    });

    it("renders collection and reversal row accents for print", () => {
      const dto = makeStatement({
        rows: [
          makeRow({
            id: "1",
            postingType: "Collection",
            referenceType: "Collection",
            debit: "0.00",
            credit: "500.00",
            runningBalance: "4500.00",
          }),
          makeRow({
            id: "2",
            postingType: "Reversal",
            debit: "500.00",
            credit: "0.00",
            runningBalance: "5000.00",
          }),
        ],
      });

      const document = mapDealerStatementToDocument(dto, formatters, "All time");

      expect(document.rows[0].accent).toBe("collection");
      expect(document.rows[1].accent).toBe("reversal");
      expect(STATEMENT_PRINT_ROW_ACCENT_CLASS.collection).toBe(
        "doc-statement-row-collection",
      );
      expect(STATEMENT_PRINT_ROW_ACCENT_CLASS.reversal).toBe(
        "doc-statement-row-reversal",
      );
    });

    it("maps an empty statement without fabricating rows or totals", () => {
      const dto = makeStatement();

      const document = mapDealerStatementToDocument(dto, formatters, "All time");

      expect(document.rows).toHaveLength(0);
      expect(document.transactionCount).toBe("0");
      expect(document.closingBalance).toBe("BDT 7500.00");
      expect(document.ledgerIntegrityConsistent).toBe(true);
    });

    it("preserves summary fields verbatim from the DTO", () => {
      const dto = makeStatement({
        openingBalanceForRange: "1000.00",
        meta: {
          ...makeStatement().meta,
          currentBalance: "3500.00",
          ledgerIntegrity: {
            isChainValid: false,
            isReplayValid: true,
            isCacheValid: true,
            isConsistent: false,
          },
        },
        totals: {
          totalDebit: "4000.00",
          totalCredit: "1500.00",
          netMovement: "2500.00",
          entryCount: 12,
        },
      });

      const document = mapDealerStatementToDocument(dto, formatters, "All time");

      expect(document.openingBalance).toBe("BDT 1000.00");
      expect(document.totalDebit).toBe("BDT 4000.00");
      expect(document.totalCredit).toBe("BDT 1500.00");
      expect(document.closingBalance).toBe("BDT 3500.00");
      expect(document.transactionCount).toBe("12");
      expect(document.ledgerIntegrityLabel).toBe("Warning");
    });
  });

  describe("mergeDealerStatementPages — long statement pagination", () => {
    it("merges additional pages without altering totals or meta", () => {
      const base = makeStatement({
        rows: Array.from({ length: 200 }, (_, index) =>
          makeRow({
            id: `row-${index + 1}`,
            runningBalance: `${1000 + index}.00`,
          }),
        ),
        pagination: {
          page: 1,
          pageSize: 200,
          total: 450,
          pageCount: 3,
        },
        totals: {
          totalDebit: "500000.00",
          totalCredit: "100000.00",
          netMovement: "400000.00",
          entryCount: 450,
        },
      });

      const pageTwoRows = Array.from({ length: 200 }, (_, index) =>
        makeRow({
          id: `row-${index + 201}`,
          runningBalance: `${1200 + index}.00`,
        }),
      );

      const merged = mergeDealerStatementPages(base, pageTwoRows);

      expect(merged.rows).toHaveLength(400);
      expect(merged.rows[399].id).toBe("row-400");
      expect(merged.totals.entryCount).toBe(450);
      expect(merged.meta.currentBalance).toBe(base.meta.currentBalance);
      expect(merged.pagination.pageCount).toBe(1);
      expect(merged.pagination.pageSize).toBe(450);
    });

    it("supports large transaction history row counts for print", () => {
      const rows = Array.from({ length: 600 }, (_, index) =>
        makeRow({
          id: `row-${index + 1}`,
          runningBalance: `${index + 1}.00`,
        }),
      );

      let merged = makeStatement({
        rows: rows.slice(0, 200),
        pagination: { page: 1, pageSize: 200, total: 600, pageCount: 3 },
        totals: {
          totalDebit: "600000.00",
          totalCredit: "0.00",
          netMovement: "600000.00",
          entryCount: 600,
        },
      });

      merged = mergeDealerStatementPages(merged, rows.slice(200, 400));
      merged = mergeDealerStatementPages(merged, rows.slice(400, 600));

      expect(merged.rows).toHaveLength(600);
      expect(merged.rows[599].runningBalance).toBe("600.00");
      expect(merged.totals.entryCount).toBe(600);
    });
  });
});
