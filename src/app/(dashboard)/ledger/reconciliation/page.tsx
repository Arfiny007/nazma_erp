import { getReconciliationSummaryAction } from "@/lib/actions/ledger-reconciliation/get-reconciliation-summary";
import { enforcePermission } from "@/lib/rbac/guards";

import { LedgerReconciliationTable } from "./ledger-reconciliation-table";

/**
 * Dev verification page for PHASE_07E3 reconciliation engine.
 * Read-only integrity scan — no mutations.
 */
export default async function LedgerReconciliationPage() {
  await enforcePermission("ledger:view");
  const result = await getReconciliationSummaryAction();

  if (!result.success) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Ledger Reconciliation</h1>
        <p className="mt-2 text-sm text-red-600">{result.error.messageKey}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Ledger Reconciliation</h1>
        <p className="text-sm text-muted-foreground">
          Read-only integrity scan — verifies ledger sum, latest balance, and
          chain integrity against dealer cache. Never mutates financial data.
        </p>
      </div>
      <LedgerReconciliationTable data={result.data} />
    </div>
  );
}
