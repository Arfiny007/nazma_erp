"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useFormatMoney } from "@/lib/utils/use-format-money";
import { LedgerIntegrityBadge } from "@/components/ledger/ledger-integrity-badge";
import type { DealerStatementMetaDTO } from "@/types/ledger-statement";

interface DealerStatementHeaderProps {
  meta: DealerStatementMetaDTO;
}

export function DealerStatementHeader({ meta }: DealerStatementHeaderProps) {
  const { t, locale } = useLanguage();
  const formatMoney = useFormatMoney(locale);

  const dateFormatter = new Intl.DateTimeFormat(
    locale === "bn" ? "bn-BD" : "en-GB",
    { dateStyle: "medium" },
  );

  const formatPeriodDate = (value: string | null) =>
    value ? dateFormatter.format(new Date(value)) : t("ledgerStatement.header.openEnded");

  const periodLabel =
    !meta.dateRange.fromDate && !meta.dateRange.toDate
      ? t("ledgerStatement.header.allTime")
      : `${formatPeriodDate(meta.dateRange.fromDate)} — ${formatPeriodDate(meta.dateRange.toDate)}`;

  return (
    <section
      aria-labelledby="dealer-statement-header-title"
      className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between dark:border-slate-800">
        <div className="min-w-0 space-y-1">
          <h2
            id="dealer-statement-header-title"
            className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50"
          >
            {meta.dealerName}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {meta.dealerCode}
            </span>
            <span className="mx-2 text-slate-300 dark:text-slate-600" aria-hidden="true">
              ·
            </span>
            {t("ledgerStatement.header.statementPeriod")}: {periodLabel}
          </p>
        </div>
        <LedgerIntegrityBadge integrity={meta.ledgerIntegrity} />
      </div>

      <dl className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4 dark:bg-slate-800">
        <HeaderCell
          label={t("ledgerStatement.header.currentBalance")}
          value={formatMoney(meta.currentBalance)}
          highlight
        />
        <HeaderCell
          label={t("ledgerStatement.header.creditLimit")}
          value={formatMoney(meta.creditLimit)}
        />
        <HeaderCell
          label={t("ledgerStatement.header.openingBalanceStatus")}
          value={
            meta.hasOpeningBalance
              ? t("ledgerStatement.header.initialized")
              : t("ledgerStatement.header.notInitialized")
          }
          isText
        />
        <HeaderCell
          label={t("ledgerStatement.header.generatedAt")}
          value={dateFormatter.format(new Date(meta.generatedAt))}
          isText
        />
      </dl>
    </section>
  );
}

interface HeaderCellProps {
  label: string;
  value: string;
  isText?: boolean;
  highlight?: boolean;
}

function HeaderCell({ label, value, isText, highlight }: HeaderCellProps) {
  return (
    <div className="bg-white px-5 py-3.5 dark:bg-slate-900">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={
          isText
            ? "mt-1 text-sm font-medium text-slate-900 dark:text-slate-100"
            : highlight
              ? "mt-1 text-base font-semibold tabular-nums text-slate-900 dark:text-slate-50"
              : "mt-1 text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100"
        }
      >
        {value}
      </dd>
    </div>
  );
}
