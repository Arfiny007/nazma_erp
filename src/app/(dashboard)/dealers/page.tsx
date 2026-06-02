"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { DealerTable } from "@/components/dealers/dealer-table";
import { PageContainer } from "@/components/layout/page-container";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DealersPage() {
  const { t, isLoading } = useLanguage();

  const newDealerAction = (
    <Link
      href="/dealers/new"
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
    >
      <Plus aria-hidden="true" className="size-4" />
      {t("dealers.actions.newDealer")}
    </Link>
  );

  if (isLoading) {
    return (
      <PageContainer
        title={t("dealers.title")}
        description={t("common.loading")}
        actions={newDealerAction}
      >
        <TableSkeleton rows={8} columns={7} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t("dealers.title")}
      description={t("dealers.subtitle")}
      actions={newDealerAction}
    >
      <DealerTable />
    </PageContainer>
  );
}
