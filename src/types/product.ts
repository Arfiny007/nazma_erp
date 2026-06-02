import type { Category, Product } from "@prisma/client";

/**
 * Domain types for the Product catalog module.
 *
 * Nazma Metal products are organized by Category and identified primarily by
 * their Model Number (e.g. "FV-222", "FV-223-C", "OVP6-507"). Prisma's
 * `Decimal` type is not serializable across the Server/Client boundary, so the
 * monetary `currentPrice` that leaves the data layer is exposed as a
 * fixed-precision decimal string (e.g. "1250.00"). UI code is responsible for
 * locale-aware formatting of these strings.
 */

/** The raw persistence records as returned by Prisma. */
export type ProductRecord = Product;
export type CategoryRecord = Category;

/** A product record with its related category eagerly loaded. */
export type ProductWithCategory = Product & { category: Category | null };

/* -------------------------------------------------------------------------- */
/*                          Data transfer / view models                      */
/* -------------------------------------------------------------------------- */

/** Serializable category projection safe to return from server actions. */
export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Serializable product projection safe to return from server actions. */
export interface ProductDTO {
  id: string;
  sku: string;
  modelNumber: string;
  name: string;
  nameBn: string | null;
  categoryId: string;
  unit: string;
  description: string | null;
  /** Current selling price as a fixed-precision decimal string. */
  currentPrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** The owning category, when eagerly loaded; otherwise `null`. */
  category: CategoryDTO | null;
}

/* -------------------------------------------------------------------------- */
/*                              Listing & paging                              */
/* -------------------------------------------------------------------------- */

export const PRODUCT_SORT_FIELDS = [
  "sku",
  "modelNumber",
  "name",
  "currentPrice",
  "createdAt",
] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export type SortOrder = "asc" | "desc";

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/* -------------------------------------------------------------------------- */
/*                            Typed error responses                           */
/* -------------------------------------------------------------------------- */

export type ProductErrorCode =
  | "VALIDATION_ERROR"
  | "PRODUCT_NOT_FOUND"
  | "CATEGORY_NOT_FOUND"
  | "DUPLICATE_SKU"
  | "DUPLICATE_MODEL_NUMBER"
  | "PRODUCT_HAS_DEPENDENCIES"
  | "INTERNAL_ERROR";

/** A single field-level validation failure carrying a localization key. */
export interface FieldError {
  field: string;
  messageKey: string;
}

/**
 * Typed, serializable error envelope. `messageKey` is always a localization
 * key (never a hard-coded human string) so the UI layer can translate it.
 */
export interface ProductError {
  code: ProductErrorCode;
  messageKey: string;
  fieldErrors?: FieldError[];
}

/** Discriminated union returned by every product server action. */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: ProductError };
