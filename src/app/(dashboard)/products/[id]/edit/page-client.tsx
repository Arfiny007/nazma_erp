"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { DeactivateProductDialog } from "@/components/products/deactivate-product-dialog";
import { ProductForm } from "@/components/products/product-form";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CategoryDTO, ProductDTO } from "@/types/product";

interface EditProductPageClientProps {
  product: ProductDTO | null;
  categories: CategoryDTO[];
}

export function EditProductPageClient({
  product,
  categories,
}: EditProductPageClientProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [deactivateSuccess, setDeactivateSuccess] = useState(false);

  const handleDeactivateSuccess = () => {
    setShowDeactivateDialog(false);
    setDeactivateSuccess(true);
    window.setTimeout(() => {
      router.push("/products");
      router.refresh();
    }, 900);
  };

  if (!product) {
    return (
      <PageContainer
        title={t("products.form.editTitle")}
        description={t("products.form.editSubtitle")}
        actions={
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("products.form.backToList")}
          </Link>
        }
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center rounded-xl border border-rose-200/80 bg-rose-50/50 px-6 py-16 text-center dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/60">
            <AlertTriangle
              aria-hidden="true"
              className="size-5 text-rose-500 dark:text-rose-400"
            />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {t("products.form.loadError")}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {t("products.form.loadErrorDescription")}
          </p>
          <Link
            href="/products"
            className="mt-6 inline-flex items-center rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {t("products.form.backToList")}
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <>
      {showDeactivateDialog && (
        <DeactivateProductDialog
          productId={product.id}
          productName={product.name}
          onSuccess={handleDeactivateSuccess}
          onCancel={() => setShowDeactivateDialog(false)}
        />
      )}

      <PageContainer
        title={t("products.form.editTitle")}
        description={t("products.form.editSubtitle")}
        actions={
          <div className="flex items-center gap-2">
            {product.isActive && (
              <button
                type="button"
                onClick={() => setShowDeactivateDialog(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 shadow-sm transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60"
              >
                {t("products.deactivate.button")}
              </button>
            )}
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t("products.form.backToList")}
            </Link>
          </div>
        }
      >
        {deactivateSuccess && (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{t("products.deactivate.success")}</span>
          </div>
        )}

        <div className="mx-auto w-full max-w-3xl">
          <ProductForm mode="edit" product={product} categories={categories} />
        </div>
      </PageContainer>
    </>
  );
}
