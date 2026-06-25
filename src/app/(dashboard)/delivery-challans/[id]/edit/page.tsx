import { getDeliveryChallan } from "@/lib/actions/delivery-challans/get-delivery-challan";
import { getOrderChallanContext } from "@/lib/actions/delivery-challans/get-order-challan-context";
import { enforcePermission } from "@/lib/rbac/guards";
import { redirect } from "next/navigation";

import { EditChallanPageClient } from "./page-client";

interface EditChallanPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditChallanPage({ params }: EditChallanPageProps) {
  await enforcePermission("orders:edit");

  const { id } = await params;
  const challanResult = await getDeliveryChallan({ id });

  if (!challanResult.success) {
    return <EditChallanPageClient challan={null} context={null} />;
  }

  const challan = challanResult.data;

  if (challan.status !== "Draft") {
    redirect(`/delivery-challans/${id}`);
  }

  const contextResult = await getOrderChallanContext({
    orderId: challan.orderId,
    excludeChallanId: challan.id,
  });

  return (
    <EditChallanPageClient
      challan={challan}
      context={contextResult.success ? contextResult.data : null}
    />
  );
}
