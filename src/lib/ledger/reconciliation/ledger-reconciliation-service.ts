import { prisma } from "@/lib/prisma";

import { DealerReconciliationNotFoundError } from "./ledger-reconciliation-errors";
import {
  findAllDealersForReconciliation,
  gatherDealerReconciliationMetrics,
  type ReconciliationReadClient,
} from "./ledger-reconciliation-query";
import { buildReconciliationReport } from "./ledger-reconciliation-report";
import type {
  DealerReconciliationResult,
  ReconciliationReport,
  ReconciliationSummary,
} from "./ledger-reconciliation-types";
import {
  summarizeReconciliationResults,
  toDealerReconciliationResult,
} from "./ledger-reconciliation-validation";

/**
 * Enterprise Reconciliation Engine — PHASE_07E3.
 *
 * Read-only integrity verification for every dealer subledger.
 * Detects drift, missing ledger history, and corrupted chains.
 * Never mutates financial data.
 *
 * @see ADR-034
 */

/**
 * Reconcile a single dealer's ledger integrity.
 */
export async function reconcileDealer(
  dealerCode: string,
  client: ReconciliationReadClient = prisma,
): Promise<DealerReconciliationResult> {
  const dealer = await client.dealer.findUnique({
    where: { dealerCode },
    select: {
      dealerCode: true,
      companyName: true,
      currentBalance: true,
    },
  });

  if (!dealer) {
    throw new DealerReconciliationNotFoundError(dealerCode);
  }

  const metrics = await gatherDealerReconciliationMetrics(
    client,
    dealer.dealerCode,
    dealer.companyName,
    dealer.currentBalance,
  );

  return toDealerReconciliationResult(metrics);
}

/**
 * Reconcile every dealer and return a repository-wide summary.
 */
export async function reconcileAllDealers(
  client: ReconciliationReadClient = prisma,
): Promise<ReconciliationSummary> {
  const report = await runFullReconciliation(client);
  return report.summary;
}

/**
 * Full reconciliation report — all dealers with per-row results.
 */
export async function getReconciliationSummary(
  client: ReconciliationReadClient = prisma,
): Promise<ReconciliationReport> {
  return runFullReconciliation(client);
}

async function runFullReconciliation(
  client: ReconciliationReadClient,
): Promise<ReconciliationReport> {
  const dealers = await findAllDealersForReconciliation(client);
  const results: DealerReconciliationResult[] = [];

  for (const dealer of dealers) {
    const metrics = await gatherDealerReconciliationMetrics(
      client,
      dealer.dealerCode,
      dealer.dealerName,
      dealer.currentBalance,
    );
    results.push(toDealerReconciliationResult(metrics));
  }

  const summary = summarizeReconciliationResults(results);
  return buildReconciliationReport(results, summary);
}
