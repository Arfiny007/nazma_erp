"use client";

import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ChallanForm } from "@/components/delivery-challans/challan-form";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  DeliveryChallanDetailDTO,
  OrderChallanContextDTO,
} from "@/types/delivery-challan";

interface EditChallanPageClientProps {
  challan: DeliveryChallanDetailDTO | null;
  context: OrderChallanContextDTO | null;
}

export function EditChallanPageClient({ challan, context }: EditChallanPageClientProps) {
  const { t } = useLanguage();

  if (!challan || !context) {
    return (
      <PageContainer title={t("challan.detail.loadError")}>
        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/50 px-6 py-16 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
          <AlertCircle aria-hidden="true" className="mb-4 size-10 text-rose-500" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("challan.detail.loadErrorDescription")}
          </p>
          <Link
            href="/delivery-challans"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("challan.actions.backToList")}
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t("challan.form.editTitle").replace("{challanNo}", challan.challanNo)}
      description={t("challan.form.editSubtitle")}
      actions={
        <Link
          href={`/delivery-challans/${challan.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("challan.actions.backToDetail")}
        </Link>
      }
    >
      <ChallanForm mode="edit" challan={challan} initialContext={context} />
    </PageContainer>
  );
}
