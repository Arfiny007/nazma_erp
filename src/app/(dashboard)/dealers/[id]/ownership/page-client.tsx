"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DealerOwnershipTimeline } from "@/components/dealers/dealer-ownership-timeline";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDealer } from "@/lib/actions/dealers/get-dealer";
import type { DealerDTO } from "@/types/dealer";

interface DealerOwnershipPageClientProps {
  dealerId: string;
}

export function DealerOwnershipPageClient({
  dealerId,
}: DealerOwnershipPageClientProps) {
  const { t } = useLanguage();
  const [dealer, setDealer] = useState<DealerDTO | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getDealer({ id: dealerId }).then((result) => {
      if (!cancelled && result.success) {
        setDealer(result.data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dealerId]);

  return (
    <PageContainer
      title={t("dealer.ownership.page.title")}
      description={
        dealer
          ? `${dealer.companyName} (${dealer.dealerCode})`
          : t("common.loading")
      }
      actions={
        <Link
          href="/dealers"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("dealers.form.backToList")}
        </Link>
      }
    >
      <DealerOwnershipTimeline dealerId={dealerId} />
    </PageContainer>
  );
}
