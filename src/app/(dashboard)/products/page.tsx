"use client";

import { PageContainer } from "@/components/layout/page-container";
import { ProductTable } from "@/components/products/product-table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ProductsPage() {
  const { t, isLoading } = useLanguage();

  if (isLoading) {
    return (
      <PageContainer
        title={t("products.title")}
        description={t("common.loading")}
      >
        <TableSkeleton rows={8} columns={6} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t("products.title")}
      description={t("products.subtitle")}
    >
      <ProductTable />
    </PageContainer>
  );
}
