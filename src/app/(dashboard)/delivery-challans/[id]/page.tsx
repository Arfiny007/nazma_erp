import { getChallanDetailLines } from "@/lib/actions/delivery-challans/get-challan-detail-lines";
import { getDeliveryChallan } from "@/lib/actions/delivery-challans/get-delivery-challan";
import { getOrder } from "@/lib/actions/orders/get-order";
import { getCurrentUser } from "@/lib/auth/helpers";
import { enforcePermission } from "@/lib/rbac/guards";
import type { UserRole } from "@prisma/client";

import { ChallanDetailPageClient } from "./page-client";

interface ChallanDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChallanDetailPage({ params }: ChallanDetailPageProps) {
  await enforcePermission("orders:view");

  const { id } = await params;
  const user = await getCurrentUser();
  const userRole = (user?.role ?? "SR") as UserRole;
  const challanResult = await getDeliveryChallan({ id });

  if (!challanResult.success) {
    return (
      <ChallanDetailPageClient
        challan={null}
        detailLines={[]}
        fulfillment={null}
        orderStatus={null}
        userRole={userRole}
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
      userRole={userRole}
    />
  );
}
