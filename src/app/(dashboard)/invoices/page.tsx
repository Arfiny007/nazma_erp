"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { UserRole } from "@prisma/client";

import { InvoiceTable } from "@/components/invoices/invoice-table";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";
import { hasPermission } from "@/lib/permissions";

export default function InvoicesPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const canIssue = userRole ? hasPermission(userRole, "invoices:create") : false;

  return (
    <PageContainer
      title={t("invoice.title")}
      description={t("invoice.subtitle")}
      actions={
        canIssue ? (
          <Link
            href="/invoices/issue"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Plus aria-hidden="true" className="size-4" />
            {t("invoice.actions.issue")}
          </Link>
        ) : undefined
      }
    >
      <InvoiceTable />
    </PageContainer>
  );
}
