"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useFormatMoney } from "@/lib/utils/use-format-money";
import type { DealerStatementDTO } from "@/types/ledger-statement";

interface DealerStatementSummaryCardsProps {
  statement: DealerStatementDTO;
}

/**
 * Summary KPI cards — values come exclusively from the statement DTO.
 * Never recalculates money. Closing/current balance uses `meta.currentBalance`
 * (Tier-3 AR cache, asserted equal to ledger on every post).
 */
export function DealerStatementSummaryCards({
  statement,
}: DealerStatementSummaryCardsProps) {
  const { t, locale } = useLanguage();
  const formatMoney = useFormatMoney(locale);

  const cards = [
    {
      id: "opening",
      label: t("ledgerStatement.cards.openingBalance"),
      value: formatMoney(statement.openingBalanceForRange),
    },
    {
      id: "debit",
      label: t("ledgerStatement.cards.totalDebit"),
      value: formatMoney(statement.totals.totalDebit),
    },
    {
      id: "credit",
      label: t("ledgerStatement.cards.totalCredit"),
      value: formatMoney(statement.totals.totalCredit),
    },
    {
      id: "closing",
      label: t("ledgerStatement.cards.closingBalance"),
      value: formatMoney(statement.meta.currentBalance),
    },
    {
      id: "count",
      label: t("ledgerStatement.cards.transactionCount"),
      value: String(statement.totals.entryCount),
      isCount: true as const,
    },
  ];

  return (
    <section
      aria-label={t("ledgerStatement.cards.sectionLabel")}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    >
      {cards.map((card) => (
        <article
          key={card.id}
          className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {card.label}
          </p>
          <p
            className={
              "isCount" in card && card.isCount
                ? "mt-1.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50"
                : "mt-1.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50"
            }
          >
            {card.value}
          </p>
        </article>
      ))}
    </section>
  );
}
