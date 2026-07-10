import { getReconciliationSummaryAction } from "@/lib/actions/ledger-reconciliation/get-reconciliation-summary";
import { getLatestIntegrityScanAction } from "@/lib/actions/ledger-monitor/get-latest-integrity-scan";
import { listIntegrityScansAction } from "@/lib/actions/ledger-monitor/list-integrity-scans";
import { IntegrityConsoleView } from "@/components/ledger/integrity";
import { INTEGRITY_SCAN_HISTORY_LIMIT } from "@/components/ledger/integrity/integrity-console-utils";
import { enforcePermission } from "@/lib/rbac/guards";

/**
 * Production Financial Integrity Console — PHASE_07E5.
 * Presentation only; consumes persisted scans and read-only reconciliation.
 */
export default async function LedgerIntegrityPage() {
  await enforcePermission("invoices:create");

  const [latestResult, historyResult, reconciliationResult] = await Promise.all([
    getLatestIntegrityScanAction(),
    listIntegrityScansAction(INTEGRITY_SCAN_HISTORY_LIMIT),
    getReconciliationSummaryAction(),
  ]);

  if (!latestResult.success) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm text-red-600">{latestResult.error.messageKey}</p>
      </div>
    );
  }

  if (!historyResult.success) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm text-red-600">{historyResult.error.messageKey}</p>
      </div>
    );
  }

  if (!reconciliationResult.success) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm text-red-600">{reconciliationResult.error.messageKey}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <IntegrityConsoleView
        latestScan={latestResult.data}
        reconciliationReport={reconciliationResult.data}
        scanHistory={historyResult.data}
      />
    </div>
  );
}
