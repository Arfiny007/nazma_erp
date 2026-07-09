import { prisma } from "@/lib/prisma";

import { gatherDealerBackfillMetrics, type BackfillReadClient } from "./ledger-backfill-query";
import type { LedgerBackfillDiscoveryResult } from "./ledger-backfill-types";
import {
  summarizeBackfillCandidates,
  toBackfillCandidate,
} from "./ledger-backfill-validation";

/**
 * Historical Ledger Discovery Engine — PHASE_07E1.
 *
 * Answers: "Which dealers require historical ledger reconstruction?"
 *
 * READ ONLY. Never creates `LedgerEntry`, never calls `posting-service.ts`,
 * never mutates `Dealer.currentBalance`, and never replays invoices or
 * collections.
 *
 * @see ADR-032
 */

/**
 * Scan every dealer and classify backfill requirements.
 *
 * @param client Defaults to the shared `prisma` client. Accepts a transaction
 *   client so future certification jobs can run discovery inside a read
 *   transaction without a second connection.
 */
export async function getLedgerBackfillCandidates(
  client: BackfillReadClient = prisma,
): Promise<LedgerBackfillDiscoveryResult> {
  const metrics = await gatherDealerBackfillMetrics(client);
  const candidates = metrics.map(toBackfillCandidate);

  return {
    candidates,
    summary: summarizeBackfillCandidates(candidates),
  };
}
