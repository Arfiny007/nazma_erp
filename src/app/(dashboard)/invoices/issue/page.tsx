import { Suspense } from "react";

import { enforcePermission } from "@/lib/rbac/guards";
import { InvoiceSkeleton } from "@/components/invoices/invoice-skeleton";

import { IssueInvoicePageClient } from "./page-client";

export default async function IssueInvoicePage() {
  await enforcePermission("invoices:create");

  return (
    <Suspense fallback={<InvoiceSkeleton />}>
      <IssueInvoicePageClient />
    </Suspense>
  );
}
