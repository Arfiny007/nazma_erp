import { listActiveCategories } from "@/lib/actions/products/list-categories";
import { enforcePermission } from "@/lib/rbac/guards";

import { NewProductPageClient } from "./page-client";

/**
 * New Product page — Server Component shell.
 *
 * Enforces `products:create` permission before rendering. Users without the
 * permission are redirected to /access-denied. Categories are fetched
 * server-side and passed to the client component.
 */
export default async function NewProductPage() {
  await enforcePermission("products:create");

  const categoriesResult = await listActiveCategories();
  const categories = categoriesResult.success ? categoriesResult.data : [];

  return <NewProductPageClient categories={categories} />;
}
