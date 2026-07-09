"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { OpeningBalanceWizard } from "@/components/opening-balances/opening-balance-wizard";
import { useLanguage } from "@/contexts/LanguageContext";

export function NewOpeningBalancePageClient() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const dealerCode = searchParams.get("dealerCode") ?? undefined;

  return (
    <PageContainer
      title={t("openingBalance.wizard.title")}
      description={t("openingBalance.wizard.subtitle")}
      actions={
        <Link
          href="/opening-balances"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("openingBalance.actions.backToList")}
        </Link>
      }
    >
      <OpeningBalanceWizard initialDealerCode={dealerCode} />
    </PageContainer>
  );
}
