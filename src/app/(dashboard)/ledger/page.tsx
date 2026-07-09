import { enforcePermission } from "@/lib/rbac/guards";

import { LedgerPageClient } from "./page-client";

/**
 * Production Dealer Statement route — PHASE_07D2.
 * Presentation only; consumes `getDealerStatement()` read engine.
 */
export default async function LedgerPage() {
  await enforcePermission("ledger:view");
  return <LedgerPageClient />;
}
