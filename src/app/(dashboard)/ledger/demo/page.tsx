import { enforcePermission } from "@/lib/rbac/guards";

import { LedgerDemoPageClient } from "./page-client";

/**
 * Lightweight development page for verifying the PHASE_07D1 Dealer Statement
 * read engine. Not a production statement UI — no print layout or styling work.
 */
export default async function LedgerDemoPage() {
  await enforcePermission("ledger:view");
  return <LedgerDemoPageClient />;
}
