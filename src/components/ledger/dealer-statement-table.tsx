"use client";

import { LedgerPostingTypeBadge } from "@/components/ledger/ledger-posting-type-badge";
import { LedgerReferenceTypeBadge } from "@/components/ledger/ledger-reference-type-badge";
import {
  getStatementRowAccent,
  STATEMENT_ROW_ACCENT_CLASS,
} from "@/components/ledger/statement-row-styles";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useFormatMoney } from "@/lib/utils/use-format-money";
import type {
  DealerStatementDTO,
  StatementRowDTO,
} from "@/types/ledger-statement";

interface DealerStatementTableProps {
  statement: DealerStatementDTO;
  refreshing?: boolean;
  onPageChange: (page: number) => void;
}

export function DealerStatementTable({
  statement,
  refreshing = false,
  onPageChange,
}: DealerStatementTableProps) {
  const { t, locale } = useLanguage();
  const formatMoney = useFormatMoney(locale);

  const dateFormatter = new Intl.DateTimeFormat(
    locale === "bn" ? "bn-BD" : "en-GB",
    { dateStyle: "medium" },
  );

  const { pagination, rows } = statement;
  const page = pagination.page;
  const pageCount = Math.max(pagination.pageCount, 1);
  const rangeStart =
    pagination.total === 0 ? 0 : (page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(page * pagination.pageSize, pagination.total);

  return (
    <section
      aria-labelledby="dealer-statement-table-title"
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition-opacity dark:border-slate-800 dark:bg-slate-900",
        refreshing && "opacity-60",
      )}
    >
      <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <h3
          id="dealer-statement-table-title"
          className="text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          {t("ledgerStatement.table.title")}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("ledgerStatement.pagination.showing")}{" "}
          <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
            {rangeStart}–{rangeEnd}
          </span>{" "}
          {t("ledgerStatement.pagination.of")}{" "}
          <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
            {pagination.total}
          </span>{" "}
          {t("ledgerStatement.pagination.entries")}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/80">
              <Th scope="col">{t("ledgerStatement.table.colDate")}</Th>
              <Th scope="col">{t("ledgerStatement.table.colPostingType")}</Th>
              <Th scope="col">{t("ledgerStatement.table.colReferenceNo")}</Th>
              <Th scope="col">{t("ledgerStatement.table.colReferenceType")}</Th>
              <Th scope="col">{t("ledgerStatement.table.colDescription")}</Th>
              <Th scope="col" className="text-right">
                {t("ledgerStatement.table.colDebit")}
              </Th>
              <Th scope="col" className="text-right">
                {t("ledgerStatement.table.colCredit")}
              </Th>
              <Th scope="col" className="text-right">
                {t("ledgerStatement.table.colRunningBalance")}
              </Th>
              <Th scope="col">{t("ledgerStatement.table.colCreatedBy")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <StatementRow
                key={row.id}
                row={row}
                formatMoney={formatMoney}
                formatDate={(iso) => dateFormatter.format(new Date(iso))}
              />
            ))}
          </tbody>
        </table>
      </div>

      {pagination.pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("ledgerStatement.pagination.page")}{" "}
            <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
              {page}
            </span>{" "}
            {t("ledgerStatement.pagination.of")}{" "}
            <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">
              {pageCount}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || refreshing}
              onClick={() => onPageChange(page - 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t("ledgerStatement.pagination.previous")}
            </button>
            <button
              type="button"
              disabled={page >= pageCount || refreshing}
              onClick={() => onPageChange(page + 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t("ledgerStatement.pagination.next")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Th({
  children,
  className,
  scope = "col",
}: {
  children: React.ReactNode;
  className?: string;
  scope?: "col" | "row";
}) {
  return (
    <th
      scope={scope}
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400",
        className,
      )}
    >
      {children}
    </th>
  );
}

function StatementRow({
  row,
  formatMoney,
  formatDate,
}: {
  row: StatementRowDTO;
  formatMoney: (value: string) => string;
  formatDate: (iso: string) => string;
}) {
  const accent = getStatementRowAccent(row.postingType, row.isOpeningBalance);
  const debitIsZero = row.debit === "0" || row.debit === "0.00";
  const creditIsZero = row.credit === "0" || row.credit === "0.00";

  return (
    <tr
      className={cn(
        "border-t border-slate-100 dark:border-slate-800",
        STATEMENT_ROW_ACCENT_CLASS[accent],
      )}
    >
      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-300">
        {formatDate(row.transactionDate)}
      </td>
      <td className="px-3 py-2.5">
        <LedgerPostingTypeBadge postingType={row.postingType} />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 font-medium tabular-nums text-slate-800 dark:text-slate-200">
        {row.referenceNo}
      </td>
      <td className="px-3 py-2.5">
        <LedgerReferenceTypeBadge referenceType={row.referenceType} />
      </td>
      <td className="max-w-[240px] truncate px-3 py-2.5 text-slate-600 dark:text-slate-400">
        {row.description}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-800 dark:text-slate-200">
        {debitIsZero ? "—" : formatMoney(row.debit)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-800 dark:text-slate-200">
        {creditIsZero ? "—" : formatMoney(row.credit)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-slate-900 dark:text-slate-50">
        {formatMoney(row.runningBalance)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-400">
        {row.createdByName ?? "—"}
      </td>
    </tr>
  );
}
