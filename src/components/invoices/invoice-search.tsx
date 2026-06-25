"use client";

import { ProductSearch } from "@/components/products/product-search";

interface InvoiceSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function InvoiceSearch({ value, onChange }: InvoiceSearchProps) {
  return <ProductSearch value={value} onChange={onChange} />;
}
