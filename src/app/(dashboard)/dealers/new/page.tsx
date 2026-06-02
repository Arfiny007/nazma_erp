"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { DealerForm } from "@/components/dealers/dealer-form";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";

export default function NewDealerPage() {
  const { t } = useLanguage();

  return (
    <PageContainer
      title={t("dealers.form.createTitle")}
      description={t("dealers.form.createSubtitle")}
      actions={
        <Link
          href="/dealers"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("dealers.form.backToList")}
        </Link>
      }
    >
      <div className="mx-auto w-full max-w-3xl">
        <DealerForm mode="create" />
      </div>
    </PageContainer>
  );
}
