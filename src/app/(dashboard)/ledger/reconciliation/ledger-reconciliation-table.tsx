import type { ReconciliationReport } from "@/lib/ledger/reconciliation";

interface LedgerReconciliationTableProps {
  data: ReconciliationReport;
}

function statusBadge(status: string) {
  const colorMap: Record<string, string> = {
    CONSISTENT: "bg-green-100 text-green-800",
    DRIFT: "bg-orange-100 text-orange-800",
    MISSING_LEDGER: "bg-red-100 text-red-800",
    CORRUPTED_CHAIN: "bg-purple-100 text-purple-800",
  };

  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs ${colorMap[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}

export function LedgerReconciliationTable({
  data,
}: LedgerReconciliationTableProps) {
  const { dealers, summary } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded border p-3 text-sm">
          <div className="text-muted-foreground">Consistent</div>
          <div className="text-lg font-semibold tabular-nums">
            {summary.consistentDealers}
          </div>
        </div>
        <div className="rounded border p-3 text-sm">
          <div className="text-muted-foreground">Drifted</div>
          <div className="text-lg font-semibold tabular-nums">
            {summary.driftedDealers}
          </div>
        </div>
        <div className="rounded border p-3 text-sm">
          <div className="text-muted-foreground">Missing Ledger</div>
          <div className="text-lg font-semibold tabular-nums">
            {summary.missingLedgerDealers}
          </div>
        </div>
        <div className="rounded border p-3 text-sm">
          <div className="text-muted-foreground">Corrupted</div>
          <div className="text-lg font-semibold tabular-nums">
            {summary.corruptedDealers}
          </div>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Total dealers: {summary.totalDealers}
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="p-2">Dealer</th>
              <th className="p-2">Ledger Balance</th>
              <th className="p-2">Dealer Balance</th>
              <th className="p-2">Summed Balance</th>
              <th className="p-2">Drift</th>
              <th className="p-2">Entries</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {dealers.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-muted-foreground" colSpan={7}>
                  No dealers found.
                </td>
              </tr>
            ) : (
              dealers.map((dealer) => (
                <tr key={dealer.dealerCode} className="border-b">
                  <td className="p-2">
                    <div className="font-medium">{dealer.dealerCode}</div>
                    <div className="text-xs text-muted-foreground">
                      {dealer.dealerName}
                    </div>
                  </td>
                  <td className="p-2 tabular-nums">
                    {dealer.latestLedgerBalance}
                  </td>
                  <td className="p-2 tabular-nums">{dealer.dealerBalance}</td>
                  <td className="p-2 tabular-nums">
                    {dealer.summedLedgerBalance}
                  </td>
                  <td className="p-2 tabular-nums">{dealer.drift}</td>
                  <td className="p-2 tabular-nums">
                    {dealer.ledgerEntryCount}
                  </td>
                  <td className="p-2">{statusBadge(dealer.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
