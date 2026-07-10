import type { Prisma } from "@prisma/client";

import type { FinancialIntegrityScanStatus } from "./ledger-monitor-types";
import {
  normalizeListIntegrityScansParams,
  toFinancialIntegrityScanRecord,
} from "./ledger-monitor-validation";

/**
 * Persistence queries for PHASE_07E4 integrity scan history.
 *
 * @see ADR-035
 */

export type IntegrityScanWriteClient = Pick<
  Prisma.TransactionClient,
  "financialIntegrityScan"
>;

export type IntegrityScanReadClient = Pick<
  Prisma.TransactionClient,
  "financialIntegrityScan"
>;

export interface CreateIntegrityScanInput {
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  totalDealers: number;
  consistentDealers: number;
  driftedDealers: number;
  missingLedgerDealers: number;
  corruptedDealers: number;
  status: FinancialIntegrityScanStatus;
}

export async function createIntegrityScanRecord(
  client: IntegrityScanWriteClient,
  input: CreateIntegrityScanInput,
) {
  return client.financialIntegrityScan.create({
    data: {
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      durationMs: input.durationMs,
      totalDealers: input.totalDealers,
      consistentDealers: input.consistentDealers,
      driftedDealers: input.driftedDealers,
      missingLedgerDealers: input.missingLedgerDealers,
      corruptedDealers: input.corruptedDealers,
      status: input.status,
    },
  });
}

export async function createFailedIntegrityScanRecord(
  client: IntegrityScanWriteClient,
  input: {
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
  },
) {
  return client.financialIntegrityScan.create({
    data: {
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      durationMs: input.durationMs,
      totalDealers: 0,
      consistentDealers: 0,
      driftedDealers: 0,
      missingLedgerDealers: 0,
      corruptedDealers: 0,
      status: "Failed",
    },
  });
}

export async function findLatestIntegrityScan(client: IntegrityScanReadClient) {
  const row = await client.financialIntegrityScan.findFirst({
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
  });
  return row ? toFinancialIntegrityScanRecord(row) : null;
}

export async function findIntegrityScans(
  client: IntegrityScanReadClient,
  params: { limit: number },
) {
  const rows = await client.financialIntegrityScan.findMany({
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    take: params.limit,
  });
  return rows.map(toFinancialIntegrityScanRecord);
}

export async function listIntegrityScansFromParams(
  client: IntegrityScanReadClient,
  params?: { limit?: number },
) {
  const normalized = normalizeListIntegrityScansParams(params);
  return findIntegrityScans(client, normalized);
}
