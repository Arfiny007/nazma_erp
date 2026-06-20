"use server";

import { prisma } from "@/lib/prisma";
import type { ActionResult, CategoryDTO } from "@/types/product";

import { fromPrismaError, ok, toCategoryDTO } from "./helpers";

/**
 * Returns all active categories ordered alphabetically by name.
 * Used to populate the category selector in the product form.
 */
export async function listActiveCategories(): Promise<
  ActionResult<CategoryDTO[]>
> {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return ok(categories.map(toCategoryDTO));
  } catch (error) {
    return fromPrismaError(error);
  }
}
