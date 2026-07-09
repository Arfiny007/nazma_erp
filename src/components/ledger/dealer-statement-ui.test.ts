import { describe, expect, it } from "vitest";

import {
  buildDealerStatementQueryPayload,
  getStatementRowAccent,
  mapLedgerStatementErrorKey,
  resolveStatementQuickFilter,
  STATEMENT_PAGE_SIZE,
  statementFiltersActive,
} from "@/components/ledger/statement-row-styles";
import type { DealerStatementDTO, StatementRowDTO } from "@/types/ledger-statement";

/**
 * Presentation-layer tests for PHASE_07D2 Dealer Statement UI helpers.
 * No React Testing Library in this repo — verify filter payload construction,
 * row accents, pagination math inputs, and empty/populated DTO contracts
 * without duplicating financial logic.
 */

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

describe("Dealer Statement UI — presentation helpers", () => {
  describe("row accents (visual only)", () => {
    it("marks opening balance rows", () => {
      expect(getStatementRowAccent("OpeningBalance", true)).toBe("opening");
      expect(getStatementRowAccent("Issue", true)).toBe("opening");
    });

    it("marks collection and reversal accents", () => {
      expect(getStatementRowAccent("Collection", false)).toBe("collection");
      expect(getStatementRowAccent("Reversal", false)).toBe("reversal");
    });

    it("uses default accent for invoice issue", () => {
      expect(getStatementRowAccent("Issue", false)).toBe("default");
    });
  });

  describe("query payload — no duplicated business logic", () => {
    it("sends only dealer, dates, and pagination to the read engine", () => {
      const payload = buildDealerStatementQueryPayload({
        dealerCode: "D-001",
        fromDate: "2026-01-01",
        toDate: "2026-03-31",
        postingType: "Issue",
        referenceType: "Invoice",
        search: "INV",
        page: 2,
        pageSize: STATEMENT_PAGE_SIZE,
      });

      expect(payload).toEqual({
        dealerCode: "D-001",
        fromDate: "2026-01-01",
        toDate: "2026-03-31",
        page: 2,
        pageSize: STATEMENT_PAGE_SIZE,
      });
      expect(payload).not.toHaveProperty("postingType");
      expect(payload).not.toHaveProperty("search");
    });

    it("omits empty date strings", () => {
      const payload = buildDealerStatementQueryPayload({
        dealerCode: "D-002",
        fromDate: "",
        toDate: "",
        postingType: "",
        referenceType: "",
        search: "",
        page: 1,
        pageSize: 25,
      });

      expect(payload.fromDate).toBeUndefined();
      expect(payload.toDate).toBeUndefined();
    });
  });

  describe("date filtering presets", () => {
    it("resolves this-month and last-30 without money math", () => {
      const now = new Date(2026, 6, 9); // 9 Jul 2026
      expect(resolveStatementQuickFilter("all", now)).toBeNull();
      expect(resolveStatementQuickFilter("thisMonth", now)).toEqual({
        fromDate: "2026-07-01",
        toDate: "2026-07-09",
      });
      expect(resolveStatementQuickFilter("last30", now)).toEqual({
        fromDate: "2026-06-10",
        toDate: "2026-07-09",
      });
      expect(resolveStatementQuickFilter("ytd", now)).toEqual({
        fromDate: "2026-01-01",
        toDate: "2026-07-09",
      });
    });

    it("detects active date filters for empty-state copy", () => {
      expect(
        statementFiltersActive({
          fromDate: "2026-01-01",
          toDate: "",
          postingType: "",
          referenceType: "",
          search: "",
        }),
      ).toBe(true);
      expect(
        statementFiltersActive({
          fromDate: "",
          toDate: "",
          postingType: "",
          referenceType: "",
          search: "",
        }),
      ).toBe(false);
    });
  });

  describe("error mapping", () => {
    it("maps dealer / date / permission / backend failures", () => {
      expect(mapLedgerStatementErrorKey("DEALER_NOT_FOUND")).toBe(
        "ledgerStatement.error.dealerNotFound",
      );
      expect(mapLedgerStatementErrorKey("INVALID_DATE_RANGE")).toBe(
        "ledgerStatement.error.invalidDateRange",
      );
      expect(mapLedgerStatementErrorKey("FORBIDDEN", "rbac.noAccess")).toBe(
        "ledgerStatement.error.forbidden",
      );
      expect(mapLedgerStatementErrorKey("INTERNAL_ERROR")).toBe(
        "ledgerStatement.error.generic",
      );
    });
  });

  describe("DTO contracts — loading / empty / populated / pagination", () => {
    it("represents an empty dealer ledger without treating it as an error", () => {
      const empty = makeStatement();
      expect(empty.rows).toHaveLength(0);
      expect(empty.totals.entryCount).toBe(0);
      expect(empty.meta.ledgerIntegrity.isConsistent).toBe(true);
    });

    it("represents a populated statement with verbatim running balances", () => {
      const populated = makeStatement({
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
          makeRow({
            id: "3",
            postingType: "Collection",
            referenceType: "Collection",
            debit: "0.00",
            credit: "500.00",
            runningBalance: "7500.00",
          }),
        ],
        totals: {
          totalDebit: "8000.00",
          totalCredit: "500.00",
          netMovement: "7500.00",
          entryCount: 3,
        },
        pagination: {
          page: 1,
          pageSize: STATEMENT_PAGE_SIZE,
          total: 3,
          pageCount: 1,
        },
      });

      expect(populated.rows.map((r) => r.runningBalance)).toEqual([
        "5000.00",
        "8000.00",
        "7500.00",
      ]);
      expect(populated.totals.totalDebit).toBe("8000.00");
      expect(populated.meta.currentBalance).toBe("7500.00");
    });

    it("supports long statements via pagination metadata", () => {
      const longStatement = makeStatement({
        rows: Array.from({ length: 50 }, (_, index) =>
          makeRow({
            id: `row-${index + 1}`,
            runningBalance: String(1000 + index),
          }),
        ),
        totals: {
          totalDebit: "100000.00",
          totalCredit: "20000.00",
          netMovement: "80000.00",
          entryCount: 250,
        },
        pagination: {
          page: 2,
          pageSize: STATEMENT_PAGE_SIZE,
          total: 250,
          pageCount: 5,
        },
      });

      expect(longStatement.rows).toHaveLength(50);
      expect(longStatement.pagination.pageCount).toBe(5);
      expect(longStatement.pagination.total).toBe(250);

      const nextPagePayload = buildDealerStatementQueryPayload({
        dealerCode: longStatement.meta.dealerCode,
        fromDate: "",
        toDate: "",
        postingType: "",
        referenceType: "",
        search: "",
        page: 3,
        pageSize: STATEMENT_PAGE_SIZE,
      });
      expect(nextPagePayload.page).toBe(3);
    });

    it("supports dealer switch by rebuilding payload with a new dealerCode", () => {
      const switched = buildDealerStatementQueryPayload({
        dealerCode: "D-999",
        fromDate: "2026-01-01",
        toDate: "2026-12-31",
        postingType: "",
        referenceType: "",
        search: "",
        page: 1,
        pageSize: STATEMENT_PAGE_SIZE,
      });
      expect(switched.dealerCode).toBe("D-999");
      expect(switched.fromDate).toBe("2026-01-01");
    });

    it("exposes summary card fields from DTO only", () => {
      const statement = makeStatement({
        openingBalanceForRange: "1000.00",
        totals: {
          totalDebit: "4000.00",
          totalCredit: "1500.00",
          netMovement: "2500.00",
          entryCount: 12,
        },
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
      });

      // Cards consume these fields directly — no arithmetic in the UI layer.
      expect(statement.openingBalanceForRange).toBe("1000.00");
      expect(statement.totals.totalDebit).toBe("4000.00");
      expect(statement.totals.totalCredit).toBe("1500.00");
      expect(statement.meta.currentBalance).toBe("3500.00");
      expect(statement.totals.entryCount).toBe(12);
      expect(statement.meta.ledgerIntegrity.isConsistent).toBe(false);
    });
  });
});
