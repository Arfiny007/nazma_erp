import { getLedgerBackfillCandidates } from "@/lib/actions/ledger-backfill/get-ledger-backfill-candidates";
import { enforcePermission } from "@/lib/rbac/guards";

import { LedgerBackfillTable } from "./ledger-backfill-table";

/**
 * Dev verification page for PHASE_07E1 discovery.
 * Simple read-only table — not production styling.
 */
export default async function LedgerBackfillPage() {
  await enforcePermission("ledger:view");
  const result = await getLedgerBackfillCandidates();

  if (!result.success) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Ledger Backfill Discovery</h1>
        <p className="mt-2 text-sm text-red-600">{result.error.messageKey}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Ledger Backfill Discovery</h1>
        <p className="text-sm text-muted-foreground">
          Discovery scan + historical replay tooling (PHASE_07E2). Replay creates
          missing LedgerEntry rows only — never mutates dealer balance.
        </p>
      </div>
      <LedgerBackfillTable data={result.data} />
    </div>
  );
}
