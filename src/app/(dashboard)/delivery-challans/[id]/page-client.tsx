"use client";

import { AlertCircle, ArrowLeft, Eye, Pencil, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { OrderStatus, UserRole } from "@prisma/client";

import { ChallanDocumentPreview } from "@/components/documents/challan/challan-document-preview";
import { ChallanDetailView } from "@/components/delivery-challans/challan-detail-view";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";
import { hasPermission } from "@/lib/permissions";
import type {
  ChallanDetailLineDTO,
  DeliveryChallanDetailDTO,
  OrderFulfillmentProgressDTO,
} from "@/types/delivery-challan";

interface ChallanDetailPageClientProps {
  challan: DeliveryChallanDetailDTO | null;
  detailLines: ChallanDetailLineDTO[];
  fulfillment: OrderFulfillmentProgressDTO | null;
  orderStatus: OrderStatus | null;
  userRole: UserRole;
}

export function ChallanDetailPageClient({
  challan,
  detailLines,
  fulfillment,
  orderStatus,
  userRole,
}: ChallanDetailPageClientProps) {
  const { t } = useLanguage();
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!challan) {
    return (
      <PageContainer title={t("challan.detail.loadError")}>
        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/50 px-6 py-16 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/60">
            <AlertCircle aria-hidden="true" className="size-5 text-rose-500 dark:text-rose-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t("challan.detail.loadError")}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {t("challan.detail.loadErrorDescription")}
          </p>
          <Link
            href="/delivery-challans"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("challan.actions.backToList")}
          </Link>
        </div>
      </PageContainer>
    );
  }

  const canEdit =
    hasPermission(userRole, "orders:edit") && challan.status === "Draft";

  return (
    <PageContainer
      title={t("challan.detail.title").replace("{challanNo}", challan.challanNo)}
      description={t("challan.detail.subtitle")}
      actions={
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Link
            href="/delivery-challans"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("challan.actions.backToList")}
          </Link>
          {canEdit && (
            <Link
              href={`/delivery-challans/${challan.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Pencil aria-hidden="true" className="size-4" />
              {t("challan.actions.edit")}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Eye aria-hidden="true" className="size-4" />
            {t("document.actions.previewChallan")}
          </button>
          <Link
            href={`/delivery-challans/${challan.id}/print`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Printer aria-hidden="true" className="size-4" />
            {t("challan.actions.print")}
          </Link>
        </div>
      }
    >
      <ChallanDetailView
        challan={challan}
        detailLines={detailLines}
        fulfillment={fulfillment}
        orderStatus={orderStatus}
        userRole={userRole}
      />
      <ChallanDocumentPreview
        challan={challan}
        detailLines={detailLines}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </PageContainer>
  );
}
