import { getOrder } from "@/lib/actions/orders/get-order";
import { enforcePermission } from "@/lib/rbac/guards";

import { OrderDetailPageClient } from "./page-client";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Order Detail page — Server Component shell.
 *
 * Enforces `orders:view` before rendering and fetches the full order detail
 * (items + audit-derived approval history) server-side.
 */
export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  await enforcePermission("orders:view");

  const { id } = await params;
  const result = await getOrder({ id });
  const order = result.success ? result.data : null;

  return <OrderDetailPageClient order={order} />;
}
