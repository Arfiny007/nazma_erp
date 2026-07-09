"use client";

import { useRouter } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { UninitializedDealersTable } from "@/components/opening-balances/uninitialized-dealers-table";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UninitializedDealerDTO } from "@/types/opening-balance";

export function OpeningBalancesPageClient() {
  const { t } = useLanguage();
  const router = useRouter();

  const handleSelect = (dealer: UninitializedDealerDTO) => {
    router.push(`/opening-balances/new?dealerCode=${encodeURIComponent(dealer.dealerCode)}`);
  };

  return (
    <PageContainer
      title={t("openingBalance.title")}
      description={t("openingBalance.subtitle")}
    >
      <UninitializedDealersTable onSelect={handleSelect} />
    </PageContainer>
  );
}
