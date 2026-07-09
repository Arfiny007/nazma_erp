"use client";

import { DealerStatementView } from "@/components/ledger/dealer-statement-view";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";

export function LedgerPageClient() {
  const { t } = useLanguage();

  return (
    <PageContainer
      title={t("ledgerStatement.title")}
      description={t("ledgerStatement.subtitle")}
    >
      <DealerStatementView />
    </PageContainer>
  );
}
