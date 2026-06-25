import { getInvoice } from "@/lib/actions/invoices/get-invoice";
import { enforcePermission } from "@/lib/rbac/guards";

import { InvoiceDetailPageClient } from "./page-client";

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  await enforcePermission("invoices:view");

  const { id } = await params;
  const result = await getInvoice({ id });
  const invoice = result.success ? result.data : null;

  return <InvoiceDetailPageClient invoice={invoice} />;
}
