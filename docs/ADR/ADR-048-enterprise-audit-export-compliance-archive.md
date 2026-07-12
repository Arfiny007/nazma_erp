# ADR-048: Enterprise Audit Export & Compliance Archive

**Status:** Accepted  
**Date:** 2026-07-13  
**Phase:** PHASE_09E

## Context

PHASE_09D shipped the read-only Audit & Compliance Console. PHASE_09D.5 certified territory isolation, Accounts restrictions, and architectural boundaries. Operations and external auditors now require reproducible PDF, Excel, and ZIP compliance packages from the same scoped audit dataset.

## Decision

### Export module: `src/lib/audit/export/`

| File | Purpose |
|------|---------|
| `audit-export-service.ts` | Orchestration — `buildAuditExportPayload()`, PDF/Excel/ZIP generation |
| `audit-export-mappers.ts` | Metadata flattening, compliance summary, printable HTML |
| `audit-export-validation.ts` | Export filter normalization, 10,000 row cap |
| `audit-export-types.ts` | Export contracts |
| `audit-export-errors.ts` | `AuditExportSizeLimitError`, `AuditExportEmptyError` |

### Data path (mandatory)

```
AuditLog
    ↓
getAuditConsoleData()   ← sole read entry point
    ↓
AuditExportPayload
    ↓
PDF / Excel / ZIP
```

No second query layer. No direct `audit-query` imports from export code.

### Server actions

| Action | Permission | Output |
|--------|------------|--------|
| `exportAuditPdf(filters)` | `audit:view` | `application/pdf` |
| `exportAuditExcel(filters)` | `audit:view` | `.xlsx` workbook |
| `exportAuditArchive(filters)` | `audit:view` | `.zip` with PDF + XLSX + `compliance-summary.json` |

All actions preserve active filters and territory scope via `buildAuditContext()` + `getAuditConsoleData()`.

### Export limits

- Maximum batch: **10,000** rows (`MAX_AUDIT_EXPORT_BATCH`)
- Export uses `page=1`, `pageSize=10000` with `AuditQueryOptions.maxPageSize`
- Console UI pagination cap (`MAX_AUDIT_PAGE_SIZE=100`) unchanged

### Archive JSON contract

```ts
{
  generatedAt: string;
  generatedBy: string;
  filters: AuditFilters;
  recordCount: number;
  categoryCounts: Record<string, number>;
}
```

### UI

`src/components/audit/audit-export-menu.tsx` — Export PDF / Excel / Download Archive buttons wired to server actions; active console filters passed through.

## Non-goals

- New `AuditLog` writers
- Client-side record transformation
- Audit console query redesign
- Scheduled / emailed archives

## Compliance

| Engine | Modified? |
|--------|-----------|
| posting-service.ts | No |
| audit-query.ts | No (consumed via service only) |
| Territory RBAC | No (consumed only) |
| Financial engines | No |

## Consequences

- Compliance exports are reproducible from certified audit read path
- Territory isolation and Accounts category restrictions inherit from PHASE_09D
- Large exports bounded at 10,000 rows with explicit error surface
