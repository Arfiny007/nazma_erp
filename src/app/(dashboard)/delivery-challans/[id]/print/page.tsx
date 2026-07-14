import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getChallanDetailLines } from "@/lib/actions/delivery-challans/get-challan-detail-lines";
import { getDeliveryChallan } from "@/lib/actions/delivery-challans/get-delivery-challan";
import { enforcePermission } from "@/lib/rbac/guards";

import { ChallanPrintPageClient } from "./page-client";

interface ChallanPrintPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChallanPrintPage({ params }: ChallanPrintPageProps) {
  await enforcePermission("orders:view");

  const { id } = await params;
  const challanResult = await getDeliveryChallan({ id });

  if (!challanResult.success) {
    notFound();
  }

  const linesResult = await getChallanDetailLines({ challanId: id });

  return (
    <Suspense>
      <ChallanPrintPageClient
        challan={challanResult.data}
        detailLines={linesResult.success ? linesResult.data : []}
      />
    </Suspense>
  );
}
