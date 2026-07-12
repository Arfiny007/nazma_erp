import type { Prisma } from "@prisma/client";

import type {
  AuditRecord,
  AuditSummary,
  AuditTimelineGroup,
  AuditTimelineGroupKey,
} from "./audit-types";
import { classifyAuditAction } from "./audit-validation";
import type { AuditLogRow } from "./audit-query";

const METADATA_KEYS = [
  "dealerCode",
  "referenceNo",
  "collectionNo",
  "invoiceNo",
  "amount",
  "previousBalance",
  "newBalance",
  "referenceType",
  "referenceId",
  "ledgerEntryId",
  "ledgerPostingKey",
  "ledgerPostingType",
  "status",
  "remarks",
  "reason",
  "territoryName",
] as const;

function readJsonRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function extractAuditMetadata(
  oldValue: Prisma.JsonValue | null,
  newValue: Prisma.JsonValue | null,
): Record<string, unknown> {
  const merged = {
    ...readJsonRecord(oldValue),
    ...readJsonRecord(newValue),
  };

  const metadata: Record<string, unknown> = {};
  for (const key of METADATA_KEYS) {
    const value = merged[key];
    if (value !== undefined && value !== null) {
      metadata[key] = value;
    }
  }

  return metadata;
}

export function mapAuditLogRow(row: AuditLogRow): AuditRecord {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    userId: row.userId,
    userName: row.user.name,
    role: row.user.role,
    createdAt: row.createdAt.toISOString(),
    metadata: extractAuditMetadata(row.oldValue, row.newValue),
  };
}

export function buildAuditSummary(
  rows: Array<{ action: string; entityType: string }>,
): AuditSummary {
  let financialEvents = 0;
  let securityEvents = 0;
  let dealerEvents = 0;
  let integrityEvents = 0;

  for (const row of rows) {
    const category = classifyAuditAction(row.action, row.entityType);
    switch (category) {
      case "financial":
        financialEvents += 1;
        break;
      case "security":
        securityEvents += 1;
        break;
      case "dealer":
        dealerEvents += 1;
        break;
      case "integrity":
        integrityEvents += 1;
        break;
      default:
        break;
    }
  }

  return {
    totalEvents: rows.length,
    financialEvents,
    securityEvents,
    dealerEvents,
    integrityEvents,
  };
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function resolveTimelineGroupKey(createdAt: string, now = new Date()): AuditTimelineGroupKey {
  const eventDate = new Date(createdAt);
  const today = startOfDay(now);
  const eventDay = startOfDay(eventDate);
  const diffMs = today.getTime() - eventDay.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return "today";
  }
  if (diffDays === 1) {
    return "yesterday";
  }
  if (diffDays < 7) {
    return "thisWeek";
  }
  return "older";
}

const TIMELINE_GROUP_ORDER: AuditTimelineGroupKey[] = [
  "today",
  "yesterday",
  "thisWeek",
  "older",
];

const TIMELINE_GROUP_LABELS: Record<AuditTimelineGroupKey, string> = {
  today: "audit.timeline.today",
  yesterday: "audit.timeline.yesterday",
  thisWeek: "audit.timeline.thisWeek",
  older: "audit.timeline.older",
};

export function groupAuditTimeline(records: AuditRecord[]): AuditTimelineGroup[] {
  const buckets = new Map<AuditTimelineGroupKey, AuditRecord[]>();
  for (const key of TIMELINE_GROUP_ORDER) {
    buckets.set(key, []);
  }

  for (const record of records) {
    const key = resolveTimelineGroupKey(record.createdAt);
    buckets.get(key)?.push(record);
  }

  return TIMELINE_GROUP_ORDER.map((key) => ({
    key,
    labelKey: TIMELINE_GROUP_LABELS[key],
    records: buckets.get(key) ?? [],
  })).filter((group) => group.records.length > 0);
}

export function buildEmptyAuditSummary(): AuditSummary {
  return {
    totalEvents: 0,
    financialEvents: 0,
    securityEvents: 0,
    dealerEvents: 0,
    integrityEvents: 0,
  };
}
