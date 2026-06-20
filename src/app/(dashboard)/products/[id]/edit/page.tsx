import { listActiveCategories } from "@/lib/actions/products/list-categories";
import { getProduct } from "@/lib/actions/products/get-product";
import { enforcePermission } from "@/lib/rbac/guards";

import { EditProductPageClient } from "./page-client";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Edit Product page — Server Component shell.
 *
 * Enforces `products:edit` permission before rendering. Fetches the product
 * and categories server-side and passes them to the client component.
 * If the product is not found, the client component renders an error state.
 */
export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  await enforcePermission("products:edit");

  const { id } = await params;

  const [productResult, categoriesResult] = await Promise.all([
    getProduct({ id }),
    listActiveCategories(),
  ]);

  const product = productResult.success ? productResult.data : null;
  const categories = categoriesResult.success ? categoriesResult.data : [];

  return (
    <EditProductPageClient
      product={product}
      categories={categories}
    />
  );
}
