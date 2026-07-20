"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { SrPerformanceDocumentPreview } from "@/components/documents/sr-performance";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getSrDealerStatement,
  getSrPerformanceOverview,
  getSrPerformancePrintPayload,
} from "@/lib/actions/reports/sr-performance";
import {
  buildSrPerformanceQuery,
  defaultUrlFilters,
  formatLocalDateOnly,
  mergeSrPerformanceFilters,
  parseLocalDateOnly,
  parseSrPerformanceFilters,
} from "@/lib/reports/sr-performance/sr-performance-validation";
import type { SrPerformanceUrlFilters } from "@/lib/reports/sr-performance/sr-performance-types";
import {
  createMoneyFormatter,
  formatMoney,
} from "@/lib/utils/format-money";
import type {
  SrDealerStatementResultDTO,
  SrPerformanceOverviewResultDTO,
  SrPerformancePrintMode,
  SrPerformancePrintPayloadDTO,
  TerritoryOptionDTO,
} from "@/types/sr-performance";

interface FilterState {
  from: string;
  to: string;
  territoryId: string | null;
  srId: string | null;
  srSearch: string;
  partySearch: string;
  page: number;
  pageSize: number;
}

interface SrPerformancePageClientProps {
  initialOverview: SrPerformanceOverviewResultDTO | null;
  initialStatement: SrDealerStatementResultDTO | null;
  territories: TerritoryOptionDTO[];
  initialFilters: FilterState;
  initialErrorKey: string | null;
}

function toUrlFilters(state: FilterState): SrPerformanceUrlFilters {
  return {
    from: parseLocalDateOnly(state.from),
    to: parseLocalDateOnly(state.to),
    territoryId: state.territoryId,
    srId: state.srId,
    srSearch: state.srSearch,
    partySearch: state.partySearch,
    page: state.page,
    pageSize: state.pageSize as 25 | 50 | 100,
    mode: null,
  };
}

function toFilterState(filters: SrPerformanceUrlFilters): FilterState {
  return {
    from: formatLocalDateOnly(filters.from),
    to: formatLocalDateOnly(filters.to),
    territoryId: filters.territoryId,
    srId: filters.srId,
    srSearch: filters.srSearch,
    partySearch: filters.partySearch,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

function filtersKey(filters: FilterState): string {
  return buildSrPerformanceQuery(toUrlFilters(filters));
}

export function SrPerformancePageClient({
  initialOverview,
  initialStatement,
  territories,
  initialFilters,
  initialErrorKey,
}: SrPerformancePageClientProps) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlKey = searchParams.toString();
  const filters = useMemo(
    () => toFilterState(parseSrPerformanceFilters(searchParams)),
    // searchParams identity changes; urlKey is the stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional urlKey sync
    [urlKey],
  );

  const [srSearchDraft, setSrSearchDraft] = useState(initialFilters.srSearch);
  const [partySearchDraft, setPartySearchDraft] = useState(
    initialFilters.partySearch,
  );
  const [draftUrlKey, setDraftUrlKey] = useState(urlKey);
  if (draftUrlKey !== urlKey) {
    setDraftUrlKey(urlKey);
    setSrSearchDraft(filters.srSearch);
    setPartySearchDraft(filters.partySearch);
  }

  const [overview, setOverview] =
    useState<SrPerformanceOverviewResultDTO | null>(initialOverview);
  const [statement, setStatement] =
    useState<SrDealerStatementResultDTO | null>(initialStatement);
  const [errorKey, setErrorKey] = useState<string | null>(initialErrorKey);
  const [overviewPending, setOverviewPending] = useState(false);
  const [statementPending, setStatementPending] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printPayload, setPrintPayload] =
    useState<SrPerformancePrintPayloadDTO | null>(null);

  const moneyFormatter = useMemo(
    () => createMoneyFormatter(locale === "bn" ? "bn" : "en"),
    [locale],
  );
  const displayMoney = (value: string) => formatMoney(value, moneyFormatter);

  const overviewRequestId = useRef(0);
  const statementRequestId = useRef(0);
  const individualHeadingRef = useRef<HTMLHeadingElement>(null);
  const srSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipUrlLoadRef = useRef(true);
  const lastLoadedKeyRef = useRef(filtersKey(initialFilters));

  const syncUrl = (next: FilterState) => {
    const query = buildSrPerformanceQuery(toUrlFilters(next));
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const loadOverview = async (next: FilterState) => {
    const requestId = ++overviewRequestId.current;
    setOverviewPending(true);
    const result = await getSrPerformanceOverview(next);
    if (requestId !== overviewRequestId.current) {
      return;
    }
    setOverviewPending(false);
    if (!result.success) {
      setErrorKey(result.error.messageKey);
      return;
    }
    setOverview(result.data);
  };

  const loadStatement = async (next: FilterState) => {
    const requestId = ++statementRequestId.current;
    setStatementPending(true);
    const result = await getSrDealerStatement(next);
    if (requestId !== statementRequestId.current) {
      return;
    }
    setStatementPending(false);
    if (!result.success) {
      setErrorKey(result.error.messageKey);
      return;
    }
    setStatement(result.data);
    // Soft-resolve: sync URL when server clears/replaces an out-of-scope srId.
    if ((result.data.filters.srId ?? null) !== (next.srId ?? null)) {
      const resolved = {
        ...next,
        srId: result.data.filters.srId,
      };
      lastLoadedKeyRef.current = filtersKey(resolved);
      syncUrl(resolved);
    }
  };

  const applyFilters = (
    patch: Partial<FilterState>,
    options?: { reloadOverview?: boolean; reloadStatement?: boolean },
  ) => {
    const next = { ...filters, ...patch };
    syncUrl(next);
    lastLoadedKeyRef.current = filtersKey(next);
    startTransition(async () => {
      setErrorKey(null);
      const tasks: Promise<void>[] = [];
      if (options?.reloadOverview !== false) {
        tasks.push(loadOverview(next));
      }
      if (options?.reloadStatement !== false) {
        tasks.push(loadStatement(next));
      }
      await Promise.all(tasks);
    });
  };

  const selectSr = (srId: string) => {
    const next = { ...filters, srId, page: 1 };
    syncUrl(next);
    lastLoadedKeyRef.current = filtersKey(next);
    startTransition(async () => {
      setErrorKey(null);
      await loadStatement(next);
      individualHeadingRef.current?.focus();
    });
  };

  // Back / forward: reload data when URL changes outside applyFilters/selectSr.
  useEffect(() => {
    const fromUrl = toFilterState(parseSrPerformanceFilters(searchParams));
    const key = filtersKey(fromUrl);

    if (skipUrlLoadRef.current) {
      skipUrlLoadRef.current = false;
      lastLoadedKeyRef.current = key;
      return;
    }

    if (key === lastLoadedKeyRef.current) {
      return;
    }
    lastLoadedKeyRef.current = key;

    startTransition(async () => {
      setErrorKey(null);
      await Promise.all([loadOverview(fromUrl), loadStatement(fromUrl)]);
    });
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (srSearchTimer.current) clearTimeout(srSearchTimer.current);
      if (partySearchTimer.current) clearTimeout(partySearchTimer.current);
    };
  }, []);

  const onSrSearchChange = (value: string) => {
    setSrSearchDraft(value);
    if (srSearchTimer.current) clearTimeout(srSearchTimer.current);
    srSearchTimer.current = setTimeout(() => {
      applyFilters(
        { srSearch: value, page: 1 },
        { reloadOverview: true, reloadStatement: false },
      );
    }, 300);
  };

  const onPartySearchChange = (value: string) => {
    setPartySearchDraft(value);
    if (partySearchTimer.current) clearTimeout(partySearchTimer.current);
    partySearchTimer.current = setTimeout(() => {
      applyFilters(
        { partySearch: value, page: 1 },
        { reloadOverview: false, reloadStatement: true },
      );
    }, 300);
  };

  const handlePrint = (mode: SrPerformancePrintMode) => {
    startTransition(async () => {
      const result = await getSrPerformancePrintPayload({
        from: filters.from,
        to: filters.to,
        territoryId: filters.territoryId,
        srId: filters.srId,
        srSearch: filters.srSearch,
        partySearch: mode === "overview" ? "" : filters.partySearch,
        mode,
      });
      if (!result.success) {
        setErrorKey(result.error.messageKey);
        return;
      }
      setPrintPayload(result.data);
      setPrintOpen(true);
    });
  };

  const printHref = (mode: SrPerformancePrintMode) => {
    const merged = mergeSrPerformanceFilters(toUrlFilters(filters), {
      mode,
      partySearch: mode === "overview" ? "" : filters.partySearch,
      srId: mode === "overview" ? null : filters.srId,
    });
    return `/reports/sr-performance/print?${buildSrPerformanceQuery(merged, {
      includeMode: true,
    })}`;
  };

  const resetFilters = () => {
    const defaults = defaultUrlFilters();
    const next = toFilterState(defaults);
    applyFilters(next);
  };

  const diagnostics = statement?.diagnostics ?? overview?.diagnostics;
  const selectedSrId = filters.srId ?? statement?.selectedSr?.id ?? null;
  const showAttributionWarning =
    diagnostics &&
    (diagnostics.attribution.duplicateDealerAttributionCount > 0 ||
      diagnostics.attribution.ambiguousOwnershipCount > 0 ||
      diagnostics.attribution.missingOwnershipCount > 0);

  return (
    <PageContainer>
      <div className="mb-4 flex flex-col gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              {t("srPerformance.title")}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t("srPerformance.subtitle")}
            </p>
          </div>
          <span className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {t("srPerformance.readOnly")}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>
            {t("srPerformance.meta.dateRange")}: {filters.from} – {filters.to}
          </span>
          <span>
            {t("srPerformance.meta.selectedSr")}:{" "}
            {statement?.selectedSr?.name ?? t("srPerformance.empty.noSelectedSr")}
          </span>
          {overview?.generatedAt ? (
            <span suppressHydrationWarning>
              {t("srPerformance.meta.generatedAt")}:{" "}
              {new Date(overview.generatedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>

      {errorKey ? (
        <div
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {t(errorKey)}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => applyFilters({})}
          >
            {t("srPerformance.actions.retry")}
          </button>
        </div>
      ) : null}

      {diagnostics &&
      (diagnostics.unsupportedPostingCount > 0 ||
        diagnostics.reconciliationWarnings.length > 0 ||
        showAttributionWarning) ? (
        <div
          className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
          role="status"
        >
          {diagnostics.unsupportedPostingCount > 0
            ? t("srPerformance.diagnostics.unsupportedPostingsBanner").replace(
                "{count}",
                String(diagnostics.unsupportedPostingCount),
              )
            : null}
          {diagnostics.reconciliationWarnings.length > 0
            ? ` ${t("srPerformance.diagnostics.reconciliationWarning")}`
            : null}
          {showAttributionWarning
            ? ` ${t("srPerformance.diagnostics.attributionWarning")}`
            : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="order-2 space-y-4 lg:order-1 lg:col-span-9">
          <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <h2
                  ref={individualHeadingRef}
                  tabIndex={-1}
                  className="text-sm font-semibold text-slate-900 outline-none dark:text-slate-50"
                >
                  {t("srPerformance.individual.title")}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {statement?.selectedSr
                    ? `${statement.selectedSr.name} · ${statement.selectedSr.territoryNames.join(", ") || t("srPerformance.filters.allTerritories")} · ${statement.total} ${t("srPerformance.individual.dealers")}`
                    : t("srPerformance.empty.noSelectedSr")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline dark:text-slate-300"
                  disabled={isPending || !filters.srId}
                  onClick={() => handlePrint("individual")}
                >
                  {t("srPerformance.actions.printIndividual")}
                </button>
                <Link
                  href={printHref("individual")}
                  className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline dark:text-slate-300"
                >
                  {t("srPerformance.actions.openPrintIndividual")}
                </Link>
              </div>
            </div>

            <div className="relative overflow-x-auto">
              {statementPending ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-slate-600 dark:bg-slate-950/70">
                  {t("common.loading")}
                </div>
              ) : null}
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 text-center">{t("srPerformance.columns.sl")}</th>
                    <th className="px-3 py-2 text-left">{t("srPerformance.columns.partyName")}</th>
                    <th className="px-3 py-2 text-right">{t("srPerformance.columns.previousDue")}</th>
                    <th className="px-3 py-2 text-right">{t("srPerformance.columns.sales")}</th>
                    <th className="px-3 py-2 text-right">{t("srPerformance.columns.collection")}</th>
                    <th className="px-3 py-2 text-right">{t("srPerformance.columns.balanceDue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {!statement || statement.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        {t("srPerformance.empty.individual")}
                      </td>
                    </tr>
                  ) : (
                    statement.rows.map((row, index) => (
                      <tr
                        key={row.dealerCode}
                        className="border-t border-slate-100 dark:border-slate-900"
                      >
                        <td className="px-3 py-2 text-center tabular-nums">
                          {(statement.page - 1) * statement.pageSize + index + 1}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {row.partyName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {row.dealerCode}
                            {row.territoryName ? ` · ${row.territoryName}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {displayMoney(row.previousDue)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {displayMoney(row.sales)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {displayMoney(row.collection)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {displayMoney(row.balanceDue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {statement && statement.rows.length > 0 ? (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-800 dark:bg-slate-900">
                      <td className="px-3 py-2" colSpan={2}>
                        {t("srPerformance.totals")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {displayMoney(statement.totals.previousDue)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {displayMoney(statement.totals.sales)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {displayMoney(statement.totals.collection)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {displayMoney(statement.totals.netBalance)}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>

            {statement && statement.pageCount > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-2 text-xs dark:border-slate-800">
                <button
                  type="button"
                  disabled={statement.page <= 1 || isPending}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                  onClick={() =>
                    applyFilters(
                      { page: statement.page - 1 },
                      { reloadOverview: false, reloadStatement: true },
                    )
                  }
                >
                  {t("common.previous")}
                </button>
                <span>
                  {statement.page} / {statement.pageCount}
                </span>
                <button
                  type="button"
                  disabled={statement.page >= statement.pageCount || isPending}
                  className="rounded border px-2 py-1 disabled:opacity-40"
                  onClick={() =>
                    applyFilters(
                      { page: statement.page + 1 },
                      { reloadOverview: false, reloadStatement: true },
                    )
                  }
                >
                  {t("common.next")}
                </button>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {t("srPerformance.overview.title")}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t("srPerformance.overview.subtitle")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline dark:text-slate-300"
                  disabled={isPending}
                  onClick={() => handlePrint("overview")}
                >
                  {t("srPerformance.actions.printOverview")}
                </button>
                <Link
                  href={printHref("overview")}
                  className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline dark:text-slate-300"
                >
                  {t("srPerformance.actions.openPrintOverview")}
                </Link>
              </div>
            </div>
            <div className="relative overflow-x-auto">
              {overviewPending ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-slate-600 dark:bg-slate-950/70">
                  {t("common.loading")}
                </div>
              ) : null}
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 text-center">{t("srPerformance.columns.sl")}</th>
                    <th className="px-3 py-2 text-left">{t("srPerformance.columns.srName")}</th>
                    <th className="px-3 py-2 text-right">{t("srPerformance.columns.previousDue")}</th>
                    <th className="px-3 py-2 text-right">{t("srPerformance.columns.sales")}</th>
                    <th className="px-3 py-2 text-right">{t("srPerformance.columns.collection")}</th>
                    <th className="px-3 py-2 text-right">{t("srPerformance.columns.netBalance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {!overview || overview.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        {t("srPerformance.empty.overview")}
                      </td>
                    </tr>
                  ) : (
                    overview.rows.map((row, index) => {
                      const selected = row.srId === selectedSrId;
                      return (
                        <tr
                          key={row.srId}
                          className={`border-t border-slate-100 dark:border-slate-900 ${
                            selected
                              ? "bg-slate-100 dark:bg-slate-900"
                              : "hover:bg-slate-50 dark:hover:bg-slate-900/60"
                          }`}
                        >
                          <td className="px-3 py-2 text-center tabular-nums">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="w-full text-left"
                              aria-pressed={selected}
                              onClick={() => selectSr(row.srId)}
                            >
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {row.srName}
                              </div>
                              <div className="text-xs text-slate-500">
                                {row.territoryNames.join(", ")}
                                {` · ${row.dealerCount} ${t("srPerformance.individual.dealers")}`}
                              </div>
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {displayMoney(row.previousDue)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {displayMoney(row.sales)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {displayMoney(row.collection)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {displayMoney(row.netBalance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {overview && overview.rows.length > 0 ? (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-800 dark:bg-slate-900">
                      <td className="px-3 py-2" colSpan={2}>
                        {t("srPerformance.totals")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {displayMoney(overview.totals.previousDue)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {displayMoney(overview.totals.sales)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {displayMoney(overview.totals.collection)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {displayMoney(overview.totals.netBalance)}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </section>
        </div>

        <aside className="order-1 lg:order-2 lg:col-span-3">
          <div className="sticky top-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {t("srPerformance.filters.title")}
            </h2>

            <label className="block text-xs text-slate-600 dark:text-slate-400">
              {t("srPerformance.filters.from")}
              <input
                type="date"
                value={filters.from}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                onChange={(event) =>
                  applyFilters({ from: event.target.value, page: 1 })
                }
              />
            </label>

            <label className="block text-xs text-slate-600 dark:text-slate-400">
              {t("srPerformance.filters.to")}
              <input
                type="date"
                value={filters.to}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                onChange={(event) =>
                  applyFilters({ to: event.target.value, page: 1 })
                }
              />
            </label>

            <label className="block text-xs text-slate-600 dark:text-slate-400">
              {t("srPerformance.filters.territory")}
              <select
                value={filters.territoryId ?? ""}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                onChange={(event) =>
                  applyFilters({
                    territoryId: event.target.value || null,
                    // Keep srId; server soft-resolves invalid selections.
                    page: 1,
                  })
                }
              >
                <option value="">
                  {t("srPerformance.filters.allTerritories")}
                </option>
                {territories.map((territory) => (
                  <option key={territory.id} value={territory.id}>
                    {territory.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-slate-600 dark:text-slate-400">
              {t("srPerformance.filters.srSearch")}
              <input
                type="search"
                value={srSearchDraft}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                onChange={(event) => onSrSearchChange(event.target.value)}
              />
            </label>

            <label className="block text-xs text-slate-600 dark:text-slate-400">
              {t("srPerformance.filters.partySearch")}
              <input
                type="search"
                value={partySearchDraft}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                onChange={(event) => onPartySearchChange(event.target.value)}
              />
            </label>

            <label className="block text-xs text-slate-600 dark:text-slate-400">
              {t("srPerformance.filters.pageSize")}
              <select
                value={filters.pageSize}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                onChange={(event) =>
                  applyFilters(
                    {
                      pageSize: Number(event.target.value),
                      page: 1,
                    },
                    { reloadOverview: false, reloadStatement: true },
                  )
                }
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
                onClick={() =>
                  applyFilters(
                    { srId: null, page: 1 },
                    { reloadOverview: false, reloadStatement: true },
                  )
                }
              >
                {t("srPerformance.actions.clearSr")}
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
                onClick={resetFilters}
              >
                {t("srPerformance.actions.reset")}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {printPayload ? (
        <SrPerformanceDocumentPreview
          payload={printPayload}
          open={printOpen}
          onClose={() => setPrintOpen(false)}
        />
      ) : null}
    </PageContainer>
  );
}
