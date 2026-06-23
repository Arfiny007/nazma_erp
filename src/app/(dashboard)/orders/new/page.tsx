import { listProducts } from "@/lib/actions/products/list-products";
import { enforcePermission } from "@/lib/rbac/guards";

import { NewOrderPageClient } from "./page-client";

/**
 * New Order page — Server Component shell.
 *
 * Enforces `orders:create` before rendering. The active product catalog is
 * fetched server-side and passed to the client form so line items can be added
 * without an extra client round-trip.
 */
export default async function NewOrderPage() {
  await enforcePermission("orders:create");

  const productsResult = await listProducts({
    page: 1,
    pageSize: 100,
    isActive: true,
    sortBy: "name",
    sortOrder: "asc",
  });
  const products = productsResult.success ? productsResult.data.items : [];

  return <NewOrderPageClient products={products} />;
}
