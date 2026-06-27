import { enforcePermission } from "@/lib/rbac/guards";
import { loadInvoiceDetailDTO } from "@/lib/actions/invoices/helpers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { InvoicePrintPageClient } from "./page-client";

interface InvoicePrintPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoicePrintPage({ params }: InvoicePrintPageProps) {
  await enforcePermission("invoices:view");
  const { id } = await params;
  const invoice = await loadInvoiceDetailDTO(id);

  if (!invoice) {
    notFound();
  }

  return (
    <Suspense>
      <InvoicePrintPageClient invoice={invoice} />
    </Suspense>
  );
}
