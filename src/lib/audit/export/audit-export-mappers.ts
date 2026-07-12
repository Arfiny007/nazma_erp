import { classifyAuditAction } from "../audit-validation";
import { DOC_COLORS } from "@/lib/documents/design-tokens";
import { getCompanyBranding } from "@/lib/documents/company-branding";

import type {
  AuditComplianceSummary,
  AuditExcelRow,
  AuditExportPayload,
  AuditRecord,
} from "./audit-export-types";

export function flattenMetadataSummary(
  metadata: Record<string, unknown>,
): string {
  const entries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) {
    return "";
  }
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join("; ");
}

export function resolveTerritoryLabel(metadata: Record<string, unknown>): string {
  const territory = metadata.territoryName;
  if (typeof territory === "string" && territory.length > 0) {
    return territory;
  }
  const dealerCode = metadata.dealerCode;
  if (typeof dealerCode === "string" && dealerCode.length > 0) {
    return dealerCode;
  }
  return "";
}

export function buildCategoryCounts(records: AuditRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const category = classifyAuditAction(record.action, record.entityType);
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
}

export function buildComplianceSummary(
  payload: AuditExportPayload,
): AuditComplianceSummary {
  return {
    generatedAt: payload.console.generatedAt,
    generatedBy: payload.actor.userName,
    filters: payload.filters,
    recordCount: payload.recordCount,
    categoryCounts: buildCategoryCounts(payload.console.records),
  };
}

export function mapRecordsToExcelRows(records: AuditRecord[]): AuditExcelRow[] {
  return records.map((record) => ({
    date: record.createdAt,
    action: record.action,
    category: classifyAuditAction(record.action, record.entityType),
    entityType: record.entityType,
    entityId: record.entityId,
    user: record.userName ?? "",
    role: record.role ?? "",
    territory: resolveTerritoryLabel(record.metadata),
    metadataSummary: flattenMetadataSummary(record.metadata),
  }));
}

function formatFilterValue(value: string | undefined): string {
  return value && value.length > 0 ? value : "—";
}

export function describeAppliedFilters(
  filters: AuditExportPayload["filters"],
): Array<{ label: string; value: string }> {
  return [
    { label: "Search", value: formatFilterValue(filters.search) },
    { label: "Action", value: formatFilterValue(filters.action) },
    { label: "Entity Type", value: formatFilterValue(filters.entityType) },
    { label: "User Role", value: formatFilterValue(filters.role) },
    { label: "From Date", value: formatFilterValue(filters.fromDate) },
    { label: "To Date", value: formatFilterValue(filters.toDate) },
  ];
}

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Server-side printable HTML aligned with the Document Platform visual language.
 * Browser print / Save-as-PDF compatible (landscape A4).
 */
export function buildAuditReportHtml(payload: AuditExportPayload): string {
  const branding = getCompanyBranding();
  const filters = describeAppliedFilters(payload.filters);
  const { summary, timeline, records, generatedAt } = payload.console;
  const enterpriseBlue = DOC_COLORS.enterpriseBlue;

  const filterRows = filters
    .map(
      (row) =>
        `<tr><td class="label">${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`,
    )
    .join("");

  const summaryCards = [
    ["Total Events", summary.totalEvents],
    ["Financial", summary.financialEvents],
    ["Security", summary.securityEvents],
    ["Dealer", summary.dealerEvents],
    ["Integrity", summary.integrityEvents],
  ]
    .map(
      ([label, value]) =>
        `<div class="card"><div class="card-label">${label}</div><div class="card-value">${value}</div></div>`,
    )
    .join("");

  const timelineSections = timeline
    .map((group) => {
      const rows = group.records
        .map(
          (record) => `<tr>
            <td>${escapeHtml(formatDisplayDate(record.createdAt))}</td>
            <td>${escapeHtml(record.action)}</td>
            <td>${escapeHtml(record.entityType)}</td>
            <td>${escapeHtml(record.entityId)}</td>
            <td>${escapeHtml(record.userName ?? "—")}</td>
          </tr>`,
        )
        .join("");
      return `<h3>${escapeHtml(group.key)}</h3><table><thead><tr><th>When</th><th>Action</th><th>Entity</th><th>ID</th><th>User</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join("");

  const recordRows = records
    .map(
      (record) => `<tr>
        <td>${escapeHtml(formatDisplayDate(record.createdAt))}</td>
        <td>${escapeHtml(record.action)}</td>
        <td>${escapeHtml(record.entityType)}</td>
        <td>${escapeHtml(record.entityId)}</td>
        <td>${escapeHtml(record.userName ?? "—")}</td>
        <td>${escapeHtml(record.role ?? "—")}</td>
        <td>${escapeHtml(flattenMetadataSummary(record.metadata))}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Audit Report</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 11px; }
    h1 { font-size: 22px; margin: 0 0 4px; color: ${enterpriseBlue}; letter-spacing: 0.04em; }
    h2 { font-size: 14px; margin: 24px 0 8px; color: ${enterpriseBlue}; border-bottom: 2px solid ${enterpriseBlue}; padding-bottom: 4px; }
    h3 { font-size: 12px; margin: 16px 0 6px; color: #334155; }
    .subtitle { color: #64748b; margin-bottom: 20px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; }
    .label { width: 140px; color: #475569; font-weight: 600; }
    .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 16px; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #fff; }
    .card-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
    .card-value { font-size: 18px; font-weight: 700; margin-top: 4px; color: ${enterpriseBlue}; }
    .footer { margin-top: 24px; padding-top: 8px; border-top: 2px solid ${enterpriseBlue}; color: #64748b; font-size: 10px; display: flex; justify-content: space-between; }
    @media print { body { padding: 0; } tr { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>Audit Report</h1>
  <p class="subtitle">${escapeHtml(branding.companyName)} — Compliance Export</p>

  <div class="meta-grid">
    <table>
      <tbody>
        <tr><td class="label">Generated At</td><td>${escapeHtml(formatDisplayDate(generatedAt))}</td></tr>
        <tr><td class="label">Generated By</td><td>${escapeHtml(payload.actor.userName)}</td></tr>
        <tr><td class="label">Role</td><td>${escapeHtml(payload.actor.role)}</td></tr>
        <tr><td class="label">Record Count</td><td>${payload.recordCount}</td></tr>
      </tbody>
    </table>
    <table>
      <thead><tr><th colspan="2">Applied Filters</th></tr></thead>
      <tbody>${filterRows}</tbody>
    </table>
  </div>

  <h2>Summary</h2>
  <div class="cards">${summaryCards}</div>

  <h2>Timeline</h2>
  ${timelineSections || "<p>No timeline groups in this export batch.</p>"}

  <h2>Records</h2>
  <table>
    <thead>
      <tr>
        <th>When</th><th>Action</th><th>Entity Type</th><th>Entity ID</th>
        <th>User</th><th>Role</th><th>Metadata Summary</th>
      </tr>
    </thead>
    <tbody>${recordRows}</tbody>
  </table>

  <div class="footer">
    <span>Confidential — For authorized compliance review only</span>
    <span>${escapeHtml(branding.companyName)}</span>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
