"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { UserRole } from "@prisma/client";

import { ChallanTable } from "@/components/delivery-challans/challan-table";
import { PageContainer } from "@/components/layout/page-container";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { hasPermission } from "@/lib/permissions";

export default function DeliveryChallansPage() {
  const { t, isLoading } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const canCreate = userRole ? hasPermission(userRole, "orders:create") : false;

  if (isLoading) {
    return (
      <PageContainer title={t("challan.title")} description={t("common.loading")}>
        <TableSkeleton rows={8} columns={9} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t("challan.title")}
      description={t("challan.subtitle")}
      actions={
        canCreate ? (
          <Link
            href="/delivery-challans/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Plus aria-hidden="true" className="size-4" />
            {t("challan.actions.newChallan")}
          </Link>
        ) : undefined
      }
    >
      <ChallanTable />
    </PageContainer>
  );
}
