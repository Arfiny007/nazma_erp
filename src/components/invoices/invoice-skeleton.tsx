"use client";

import { TableSkeleton } from "@/components/shared/loading-skeleton";

export function InvoiceSkeleton() {
  return <TableSkeleton rows={8} columns={10} />;
}
