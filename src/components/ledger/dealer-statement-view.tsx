"use client";

import { useEffect, useState } from "react";

import { DealerStatementDocumentPreview } from "@/components/documents/statement/dealer-statement-document-preview";
import { DealerStatementAlert } from "@/components/ledger/dealer-statement-alert";
import { DealerStatementEmptyState } from "@/components/ledger/dealer-statement-empty-state";
import { DealerStatementFilters } from "@/components/ledger/dealer-statement-filters";
import { DealerStatementHeader } from "@/components/ledger/dealer-statement-header";
import { DealerStatementSkeleton } from "@/components/ledger/dealer-statement-skeleton";
import { DealerStatementSummaryCards } from "@/components/ledger/dealer-statement-summary-cards";
import { DealerStatementTable } from "@/components/ledger/dealer-statement-table";
import {
  buildDealerStatementQueryPayload,
  mapLedgerStatementErrorKey,
  STATEMENT_PAGE_SIZE,
  statementFiltersActive,
  type StatementQuickFilter,
} from "@/components/ledger/statement-row-styles";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchDealerStatementForPrint } from "@/lib/documents/fetch-dealer-statement-for-print";
import { getDealerStatement } from "@/lib/actions/ledger-statement/get-dealer-statement";
import type { DealerDTO } from "@/types/dealer";
import type { DealerStatementDTO } from "@/types/ledger-statement";

type FetchStatus = "idle" | "loading" | "success" | "error";

/**
 * Production Dealer Statement workspace — PHASE_07D2.
 *
 * Presentation only. All financial truth comes from `getDealerStatement()`.
 * Never recalculates running balances or monetary totals in React.
 */
export function DealerStatementView() {
  const { t } = useLanguage();

  const [dealer, setDealer] = useState<DealerDTO | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [postingType, setPostingType] = useState("");
  const [referenceType, setReferenceType] = useState("");
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<StatementQuickFilter>("all");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [statement, setStatement] = useState<DealerStatementDTO | null>(null);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [printStatement, setPrintStatement] = useState<DealerStatementDTO | null>(null);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);

  // Only date filters affect the read engine today. Posting type / reference /
  // search are future-ready UI controls and must not drive empty-state copy.
  const filtersActive = statementFiltersActive({
    fromDate,
    toDate,
    postingType: "",
    referenceType: "",
    search: "",
  });

  const toolbarFiltersActive = statementFiltersActive({
    fromDate,
    toDate,
    postingType,
    referenceType,
    search,
  });

  useEffect(() => {
    if (!dealer?.dealerCode) {
      return;
    }

    let cancelled = false;
    const dealerCode = dealer.dealerCode;

    // Same list-fetch idiom as CollectionTable / InvoiceTable: mark loading,
    // then resolve via the server action. setStatus here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async list fetch bootstrap
    setStatus((prev) => (prev === "success" ? "success" : "loading"));
    setErrorKey(null);

    void (async () => {
      const payload = buildDealerStatementQueryPayload({
        dealerCode,
        fromDate,
        toDate,
        postingType,
        referenceType,
        search,
        page,
        pageSize: STATEMENT_PAGE_SIZE,
      });

      try {
        const result = await getDealerStatement(payload);
        if (cancelled) {
          return;
        }

        if (!result.success) {
          setErrorKey(
            mapLedgerStatementErrorKey(
              result.error.code,
              result.error.messageKey,
            ),
          );
          setStatus("error");
          return;
        }

        setStatement(result.data);
        setStatus("success");
      } catch {
        if (!cancelled) {
          setErrorKey("ledgerStatement.error.generic");
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Future-ready filters (postingType / referenceType / search) are UI-only
    // until the read engine accepts them — omit from deps intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealer?.dealerCode, fromDate, toDate, page, reloadToken]);

  const handleDealerChange = (next: DealerDTO | null) => {
    setDealer(next);
    setPage(1);
    if (!next) {
      setStatement(null);
      setStatus("idle");
      setErrorKey(null);
    } else {
      setStatement(null);
      setStatus("loading");
      setErrorKey(null);
    }
  };

  const handleFromDateChange = (value: string) => {
    setFromDate(value);
    setPage(1);
  };

  const handleToDateChange = (value: string) => {
    setToDate(value);
    setPage(1);
  };

  const handleClear = () => {
    setFromDate("");
    setToDate("");
    setPostingType("");
    setReferenceType("");
    setSearch("");
    setQuickFilter("all");
    setPage(1);
  };

  const handleRefresh = () => {
    setReloadToken((token) => token + 1);
  };

  const handlePrintStatement = async () => {
    if (!dealer?.dealerCode) {
      return;
    }

    setPrintLoading(true);
    setErrorKey(null);

    try {
      const payload = buildDealerStatementQueryPayload({
        dealerCode: dealer.dealerCode,
        fromDate,
        toDate,
        postingType,
        referenceType,
        search,
        page: 1,
        pageSize: STATEMENT_PAGE_SIZE,
      });

      const result = await fetchDealerStatementForPrint(payload);
      if (!result.success) {
        setErrorKey(
          mapLedgerStatementErrorKey(
            result.error.code,
            result.error.messageKey,
          ),
        );
        return;
      }

      setPrintStatement(result.data);
      setPrintPreviewOpen(true);
    } catch {
      setErrorKey("ledgerStatement.error.generic");
    } finally {
      setPrintLoading(false);
    }
  };

  const isInitialLoading = status === "loading" && !statement;
  const isRefreshing = status === "loading" && Boolean(statement);

  return (
    <div className="space-y-4">
      <DealerStatementFilters
        dealer={dealer}
        fromDate={fromDate}
        toDate={toDate}
        postingType={postingType}
        referenceType={referenceType}
        search={search}
        quickFilter={quickFilter}
        filtersActive={toolbarFiltersActive}
        onDealerChange={handleDealerChange}
        onFromDateChange={handleFromDateChange}
        onToDateChange={handleToDateChange}
        onPostingTypeChange={setPostingType}
        onReferenceTypeChange={setReferenceType}
        onSearchChange={setSearch}
        onQuickFilterChange={setQuickFilter}
        onClear={handleClear}
        onRefresh={handleRefresh}
        onPrint={handlePrintStatement}
        printLoading={printLoading}
      />

      {status === "error" && errorKey && (
        <DealerStatementAlert messageKey={errorKey} onRetry={handleRefresh} />
      )}

      {!dealer && status === "idle" && (
        <DealerStatementEmptyState noDealerSelected filtersActive={false} />
      )}

      {isInitialLoading && <DealerStatementSkeleton />}

      {statement && !isInitialLoading && (
        <>
          <DealerStatementHeader meta={statement.meta} />
          <DealerStatementSummaryCards statement={statement} />

          {statement.rows.length === 0 ? (
            <DealerStatementEmptyState filtersActive={filtersActive} />
          ) : (
            <DealerStatementTable
              statement={statement}
              refreshing={isRefreshing}
              onPageChange={setPage}
            />
          )}

          {isRefreshing && (
            <p className="sr-only" aria-live="polite">
              {t("common.loading")}
            </p>
          )}
        </>
      )}

      {printStatement && (
        <DealerStatementDocumentPreview
          statement={printStatement}
          open={printPreviewOpen}
          onClose={() => setPrintPreviewOpen(false)}
        />
      )}
    </div>
  );
}
