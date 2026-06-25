"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ChallanForm } from "@/components/delivery-challans/challan-form";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";

export function NewChallanPageClient() {
  const { t } = useLanguage();

  return (
    <PageContainer
      title={t("challan.form.createTitle")}
      description={t("challan.form.createSubtitle")}
      actions={
        <Link
          href="/delivery-challans"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("challan.actions.backToList")}
        </Link>
      }
    >
      <ChallanForm mode="create" />
    </PageContainer>
  );
}
