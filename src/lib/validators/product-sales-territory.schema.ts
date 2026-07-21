import { z } from "zod";

export const productSalesViewModeSchema = z.enum([
  "territory-product",
  "product-territory",
]);

export const productSalesSortSchema = z.enum([
  "quantity-desc",
  "quantity-asc",
  "product-asc",
  "territory-asc",
]);

export const productSalesPrintModeSchema = z.enum(["report"]);

export const getTerritoryProductSalesSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  territoryId: z.string().uuid().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  productSearch: z.string().max(200).optional(),
  view: productSalesViewModeSchema.optional(),
  sort: productSalesSortSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const getTopSellingProductsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  territoryId: z.string().uuid().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  productSearch: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const getTerritoryProductSalesPrintPayloadSchema =
  getTerritoryProductSalesSchema
    .omit({
      page: true,
      pageSize: true,
      limit: true,
    })
    .extend({
      mode: productSalesPrintModeSchema,
    });

export type GetTerritoryProductSalesInput = z.infer<
  typeof getTerritoryProductSalesSchema
>;
export type GetTopSellingProductsInput = z.infer<
  typeof getTopSellingProductsSchema
>;
export type GetTerritoryProductSalesPrintPayloadInput = z.infer<
  typeof getTerritoryProductSalesPrintPayloadSchema
>;
