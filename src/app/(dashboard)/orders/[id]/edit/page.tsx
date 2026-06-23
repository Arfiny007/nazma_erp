import { getOrder } from "@/lib/actions/orders/get-order";
import { getDealer } from "@/lib/actions/dealers/get-dealer";
import { listProducts } from "@/lib/actions/products/list-products";
import { enforcePermission } from "@/lib/rbac/guards";

import { EditOrderPageClient } from "./page-client";

interface EditOrderPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Edit Order page — Server Component shell.
 *
 * Enforces `orders:edit` (Manager / Super_Admin) before rendering. The order,
 * its dealer, and the active product catalog are fetched server-side and passed
 * to the client form. Approved orders remain editable; cancelled/delivered
 * orders are rejected by the workflow guards in the update action.
 */
export default async function EditOrderPage({ params }: EditOrderPageProps) {
  await enforcePermission("orders:edit");

  const { id } = await params;

  const [orderResult, productsResult] = await Promise.all([
    getOrder({ id }),
    listProducts({
      page: 1,
      pageSize: 100,
      isActive: true,
      sortBy: "name",
      sortOrder: "asc",
    }),
  ]);

  const order = orderResult.success ? orderResult.data : null;
  const products = productsResult.success ? productsResult.data.items : [];

  const dealerResult = order
    ? await getDealer({ dealerCode: order.dealerCode })
    : null;
  const dealer = dealerResult?.success ? dealerResult.data : null;

  return (
    <EditOrderPageClient order={order} products={products} initialDealer={dealer} />
  );
}
