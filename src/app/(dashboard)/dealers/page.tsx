"use client";

import { DealerTable } from "@/components/dealers/dealer-table";
import { PageContainer } from "@/components/layout/page-container";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DealersPage() {
  const { t, isLoading } = useLanguage();

  if (isLoading) {
    return (
      <PageContainer
        title={t("dealers.title")}
        description={t("common.loading")}
      >
        <TableSkeleton rows={8} columns={7} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t("dealers.title")}
      description={t("dealers.subtitle")}
    >
      <DealerTable />
    </PageContainer>
  );
}
