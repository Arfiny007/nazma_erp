"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { PageContainer } from "@/components/layout/page-container";
import { OrderTable } from "@/components/orders/order-table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

export default function OrdersPage() {
  const { t, isLoading } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const canCreate = userRole ? hasPermission(userRole, "orders:create") : false;

  if (isLoading) {
    return (
      <PageContainer title={t("order.title")} description={t("common.loading")}>
        <TableSkeleton rows={8} columns={10} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t("order.title")}
      description={t("order.subtitle")}
      actions={
        canCreate ? (
          <Link
            href="/orders/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Plus aria-hidden="true" className="size-4" />
            {t("order.actions.newOrder")}
          </Link>
        ) : undefined
      }
    >
      <OrderTable />
    </PageContainer>
  );
}
