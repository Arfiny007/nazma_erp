"use client";

import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { OrderForm } from "@/components/orders/order-form";
import { useLanguage } from "@/contexts/LanguageContext";
import type { OrderDetailDTO } from "@/types/order";
import type { DealerDTO } from "@/types/dealer";
import type { ProductDTO } from "@/types/product";

interface EditOrderPageClientProps {
  order: OrderDetailDTO | null;
  products: ProductDTO[];
  initialDealer: DealerDTO | null;
}

export function EditOrderPageClient({
  order,
  products,
  initialDealer,
}: EditOrderPageClientProps) {
  const { t } = useLanguage();

  if (!order) {
    return (
      <PageContainer title={t("order.detail.loadError")}>
        <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/50 px-6 py-16 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/60">
            <AlertCircle aria-hidden="true" className="size-5 text-rose-500 dark:text-rose-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t("order.detail.loadError")}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {t("order.detail.loadErrorDescription")}
          </p>
          <Link
            href="/orders"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("order.actions.backToList")}
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t("order.form.editTitle")}
      description={t("order.form.editSubtitle")}
      actions={
        <Link
          href={`/orders/${order.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("order.actions.backToOrder")}
        </Link>
      }
    >
      <OrderForm
        mode="edit"
        products={products}
        order={order}
        initialDealer={initialDealer}
      />
    </PageContainer>
  );
}
