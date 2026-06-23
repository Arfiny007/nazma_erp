"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { OrderForm } from "@/components/orders/order-form";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ProductDTO } from "@/types/product";

interface NewOrderPageClientProps {
  products: ProductDTO[];
}

export function NewOrderPageClient({ products }: NewOrderPageClientProps) {
  const { t } = useLanguage();

  return (
    <PageContainer
      title={t("order.form.createTitle")}
      description={t("order.form.createSubtitle")}
      actions={
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("order.actions.backToList")}
        </Link>
      }
    >
      <OrderForm mode="create" products={products} />
    </PageContainer>
  );
}
