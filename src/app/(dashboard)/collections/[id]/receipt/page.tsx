import { enforcePermission } from "@/lib/rbac/guards";
import { loadMoneyReceiptDocument } from "@/lib/documents/load-money-receipt";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MoneyReceiptPrintPageClient } from "./page-client";

interface MoneyReceiptPrintPageProps {
  params: Promise<{ id: string }>;
}

export default async function MoneyReceiptPrintPage({
  params,
}: MoneyReceiptPrintPageProps) {
  await enforcePermission("collections:view");
  const { id } = await params;
  const document = await loadMoneyReceiptDocument(id);

  if (!document) {
    notFound();
  }

  return (
    <Suspense>
      <MoneyReceiptPrintPageClient document={document} collectionId={id} />
    </Suspense>
  );
}
