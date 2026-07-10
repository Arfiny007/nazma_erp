import { prisma } from "@/lib/prisma";
import { reconcileAllDealers } from "@/lib/ledger/reconciliation";
import type { ReconciliationReadClient } from "@/lib/ledger/reconciliation";

import { IntegrityScanPersistenceError } from "./ledger-monitor-errors";
import {
  createFailedIntegrityScanRecord,
  createIntegrityScanRecord,
  findLatestIntegrityScan,
  listIntegrityScansFromParams,
  type IntegrityScanReadClient,
  type IntegrityScanWriteClient,
} from "./ledger-monitor-query";
import type {
  FinancialIntegrityScanRecord,
  FinancialIntegrityScanResult,
  ListIntegrityScansParams,
} from "./ledger-monitor-types";
import {
  deriveScanStatus,
  toFinancialIntegrityScanResult,
} from "./ledger-monitor-validation";

/**
 * Scheduled Financial Integrity Monitor — PHASE_07E4.
 *
 * Orchestrates the existing reconciliation engine and persists scan summaries.
 * Never mutates `LedgerEntry` or `Dealer.currentBalance`.
 *
 * @see ADR-035
 */

export type IntegrityMonitorClient = ReconciliationReadClient &
  IntegrityScanReadClient &
  IntegrityScanWriteClient;

/**
 * Run a repository-wide integrity scan and persist the summary.
 */
export async function runFinancialIntegrityScan(
  client: IntegrityMonitorClient = prisma,
): Promise<FinancialIntegrityScanResult> {
  const startedAt = new Date();

  try {
    const summary = await reconcileAllDealers(client);
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    const row = await createIntegrityScanRecord(client, {
      startedAt,
      completedAt,
      durationMs,
      totalDealers: summary.totalDealers,
      consistentDealers: summary.consistentDealers,
      driftedDealers: summary.driftedDealers,
      missingLedgerDealers: summary.missingLedgerDealers,
      corruptedDealers: summary.corruptedDealers,
      status: deriveScanStatus(summary),
    });

    return toFinancialIntegrityScanResult(row);
  } catch (error) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    try {
      await createFailedIntegrityScanRecord(client, {
        startedAt,
        completedAt,
        durationMs,
      });
    } catch {
      throw new IntegrityScanPersistenceError(
        "Integrity scan failed and the failure record could not be persisted.",
      );
    }

    throw error;
  }
}

/** Return the most recent persisted scan, if any. */
export async function getLatestIntegrityScan(
  client: IntegrityScanReadClient = prisma,
): Promise<FinancialIntegrityScanRecord | null> {
  return findLatestIntegrityScan(client);
}

/** List historical scan summaries (newest first). */
export async function listIntegrityScans(
  params: ListIntegrityScansParams = {},
  client: IntegrityScanReadClient = prisma,
): Promise<FinancialIntegrityScanRecord[]> {
  return listIntegrityScansFromParams(client, params);
}
