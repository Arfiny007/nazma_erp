import { Suspense } from "react";

import { enforcePermission } from "@/lib/rbac/guards";

import { NewOpeningBalancePageClient } from "./page-client";

export default async function NewOpeningBalancePage() {
  await enforcePermission("invoices:create");
  return (
    <Suspense>
      <NewOpeningBalancePageClient />
    </Suspense>
  );
}
