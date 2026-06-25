import { getChallanDetailLines } from "@/lib/actions/delivery-challans/get-challan-detail-lines";
import { getDeliveryChallan } from "@/lib/actions/delivery-challans/get-delivery-challan";
import { getOrder } from "@/lib/actions/orders/get-order";
import { enforcePermission } from "@/lib/rbac/guards";

import { ChallanDetailPageClient } from "./page-client";

interface ChallanDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChallanDetailPage({ params }: ChallanDetailPageProps) {
  await enforcePermission("orders:view");

  const { id } = await params;
  const challanResult = await getDeliveryChallan({ id });

  if (!challanResult.success) {
    return (
      <ChallanDetailPageClient
        challan={null}
        detailLines={[]}
        fulfillment={null}
        orderStatus={null}
      />
    );
  }

  const challan = challanResult.data;

  const [linesResult, orderResult] = await Promise.all([
    getChallanDetailLines({ challanId: id }),
    getOrder({ id: challan.orderId }),
  ]);

  return (
    <ChallanDetailPageClient
      challan={challan}
      detailLines={linesResult.success ? linesResult.data : []}
      fulfillment={orderResult.success ? orderResult.data.fulfillment ?? null : null}
      orderStatus={orderResult.success ? orderResult.data.status : null}
    />
  );
}
