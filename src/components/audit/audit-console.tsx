"use client";

import { useCallback, useState, useTransition } from "react";

import { getAuditConsole } from "@/lib/actions/audit";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AuditConsoleDTO, AuditFilters } from "@/types/audit";

import { AuditEmptyState } from "./audit-empty-state";
import { AuditExportMenu } from "./audit-export-menu";
import { AuditFiltersBar } from "./audit-filters";
import { AuditSummaryCards } from "./audit-summary-cards";
import { AuditTable } from "./audit-table";
import { AuditTimeline } from "./audit-timeline";

interface AuditConsoleProps {
  initialData: AuditConsoleDTO;
}

export function AuditConsole({ initialData }: AuditConsoleProps) {
  const { t } = useLanguage();
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState<AuditFilters>({
    page: initialData.page,
    pageSize: initialData.pageSize,
  });
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadPage = useCallback(
    (nextFilters: AuditFilters) => {
      startTransition(async () => {
        const result = await getAuditConsole(nextFilters);
        if (!result.success) {
          setErrorKey(result.error.messageKey);
          return;
        }
        setErrorKey(null);
        setData(result.data);
        setFilters(nextFilters);
      });
    },
    [],
  );

  const handleSubmit = () => {
    loadPage({ ...filters, page: 1 });
  };

  const handlePageChange = (page: number) => {
    loadPage({ ...filters, page });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {t("audit.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("audit.subtitle")}
        </p>
      </div>

      <AuditSummaryCards summary={data.summary} />

      <AuditExportMenu disabled={isPending} filters={filters} />

      <AuditFiltersBar
        filters={filters}
        isLoading={isPending}
        onChange={setFilters}
        onSubmit={handleSubmit}
      />

      {errorKey ? (
        <p className="text-sm text-red-600 dark:text-red-400">{t(errorKey)}</p>
      ) : null}

      {data.records.length === 0 ? (
        <AuditEmptyState />
      ) : (
        <>
          <AuditTable records={data.records} />
          <AuditTimeline groups={data.timeline} />
        </>
      )}

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-600 dark:text-slate-300">
            {t("audit.pagination.page")} {data.page} {t("audit.pagination.of")}{" "}
            {data.totalPages} · {data.total} {t("audit.pagination.events")}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50 dark:border-slate-700"
              disabled={isPending || data.page <= 1}
              onClick={() => handlePageChange(data.page - 1)}
              type="button"
            >
              {t("audit.pagination.previous")}
            </button>
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50 dark:border-slate-700"
              disabled={isPending || data.page >= data.totalPages}
              onClick={() => handlePageChange(data.page + 1)}
              type="button"
            >
              {t("audit.pagination.next")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
