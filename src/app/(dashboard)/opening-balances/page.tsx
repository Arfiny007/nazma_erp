import { enforcePermission } from "@/lib/rbac/guards";

import { OpeningBalancesPageClient } from "./page-client";

export default async function OpeningBalancesPage() {
  await enforcePermission("invoices:create");
  return <OpeningBalancesPageClient />;
}
