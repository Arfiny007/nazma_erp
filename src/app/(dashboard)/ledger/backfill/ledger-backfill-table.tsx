import type { LedgerBackfillDiscoveryResult } from "@/lib/ledger/backfill";

import { LedgerBackfillReplayControls } from "./ledger-backfill-replay-controls";

interface LedgerBackfillTableProps {
  data: LedgerBackfillDiscoveryResult;
}

function statusBadge(requiresBackfill: boolean, reason: string) {
  if (!requiresBackfill) {
    return (
      <span className="inline-block rounded px-2 py-0.5 text-xs bg-green-100 text-green-800">
        Reconciled
      </span>
    );
  }

  const colorMap: Record<string, string> = {
    NO_LEDGER: "bg-red-100 text-red-800",
    PARTIAL_LEDGER: "bg-amber-100 text-amber-800",
    CACHE_DRIFT: "bg-orange-100 text-orange-800",
  };

  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs ${colorMap[reason] ?? "bg-gray-100 text-gray-800"}`}
    >
      Needs Backfill
    </span>
  );
}

export function LedgerBackfillTable({ data }: LedgerBackfillTableProps) {
  const { candidates, summary } = data;

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Dealers: {summary.dealerCount} | Requires backfill:{" "}
        {summary.requiresBackfillCount} | Reconciled: {summary.reconciledCount}
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-2">Dealer</th>
              <th className="p-2">Current Balance</th>
              <th className="p-2">Invoice Count</th>
              <th className="p-2">Collection Count</th>
              <th className="p-2">Ledger Count</th>
              <th className="p-2">Reason</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-muted-foreground" colSpan={8}>
                  No dealers found.
                </td>
              </tr>
            ) : (
              candidates.map((candidate) => (
                <tr key={candidate.dealerCode} className="border-b">
                  <td className="p-2">
                    <div className="font-medium">{candidate.dealerCode}</div>
                    <div className="text-xs text-muted-foreground">
                      {candidate.dealerName}
                    </div>
                  </td>
                  <td className="p-2 tabular-nums">{candidate.currentBalance}</td>
                  <td className="p-2 tabular-nums">{candidate.invoiceCount}</td>
                  <td className="p-2 tabular-nums">{candidate.collectionCount}</td>
                  <td className="p-2 tabular-nums">{candidate.ledgerEntryCount}</td>
                  <td className="p-2 font-mono text-xs">{candidate.reason}</td>
                  <td className="p-2">
                    {statusBadge(candidate.requiresBackfill, candidate.reason)}
                  </td>
                  <td className="p-2">
                    <LedgerBackfillReplayControls candidate={candidate} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
