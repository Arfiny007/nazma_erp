import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAuditExportPayload,
  createAuditArchiveExport,
  createAuditExcelExport,
  createAuditPdfExport,
  flattenMetadataSummary,
  MAX_AUDIT_EXPORT_BATCH,
  normalizeExportFilters,
} from "@/lib/audit/export";
import {
  buildComplianceSummary,
  mapRecordsToExcelRows,
} from "@/lib/audit/export/audit-export-mappers";
import { assertExportWithinLimit } from "@/lib/audit/export/audit-export-validation";
import { AuditExportSizeLimitError } from "@/lib/audit/export/audit-export-errors";
import type { AuditRecord } from "@/lib/audit";

vi.mock("../audit-service", () => ({
  getAuditConsoleData: vi.fn(),
}));

import { getAuditConsoleData } from "../audit-service";

const sampleRecord: AuditRecord = {
  id: "log-1",
  action: "INVOICE_CREATED",
  entityType: "Invoice",
  entityId: "inv-1",
  userId: "user-1",
  userName: "Admin User",
  role: "Super_Admin",
  createdAt: "2026-07-13T10:00:00.000Z",
  metadata: {
    invoiceNo: "INV-0001",
    dealerCode: "DLR-001",
    territoryName: "Dhaka North",
  },
};

const consolePayload = {
  records: [sampleRecord],
  summary: {
    totalEvents: 1,
    financialEvents: 1,
    securityEvents: 0,
    dealerEvents: 0,
    integrityEvents: 0,
  },
  timeline: [
    {
      key: "today" as const,
      labelKey: "audit.timeline.today",
      records: [sampleRecord],
    },
  ],
  page: 1,
  pageSize: MAX_AUDIT_EXPORT_BATCH,
  total: 1,
  totalPages: 1,
  generatedAt: "2026-07-13T12:00:00.000Z",
};

describe("audit export validation", () => {
  it("normalizes export filters to page 1 with batch cap", () => {
    expect(
      normalizeExportFilters({
        page: 3,
        pageSize: 25,
        search: "  INV ",
        action: "INVOICE_CREATED",
      }),
    ).toEqual({
      page: 1,
      pageSize: MAX_AUDIT_EXPORT_BATCH,
      search: "INV",
      action: "INVOICE_CREATED",
    });
  });

  it("rejects exports above the batch limit", () => {
    expect(() => assertExportWithinLimit(MAX_AUDIT_EXPORT_BATCH + 1)).toThrow(
      AuditExportSizeLimitError,
    );
  });
});

describe("audit export mappers", () => {
  it("flattens metadata for Excel export", () => {
    expect(
      flattenMetadataSummary({
        invoiceNo: "INV-0001",
        dealerCode: "DLR-001",
      }),
    ).toBe("invoiceNo: INV-0001; dealerCode: DLR-001");
  });

  it("maps records to Excel rows preserving server sort order", () => {
    const rows = mapRecordsToExcelRows([sampleRecord]);
    expect(rows[0]).toMatchObject({
      action: "INVOICE_CREATED",
      category: "financial",
      territory: "Dhaka North",
      metadataSummary: "invoiceNo: INV-0001; dealerCode: DLR-001; territoryName: Dhaka North",
    });
  });

  it("builds compliance summary JSON contract", () => {
    const summary = buildComplianceSummary({
      console: consolePayload,
      filters: { page: 1, pageSize: MAX_AUDIT_EXPORT_BATCH },
      actor: {
        userId: "user-1",
        userName: "Admin User",
        role: "Super_Admin",
      },
      recordCount: 1,
    });

    expect(summary.generatedBy).toBe("Admin User");
    expect(summary.recordCount).toBe(1);
    expect(summary.categoryCounts.financial).toBe(1);
    expect(summary.filters.page).toBe(1);
  });
});

describe("audit export service", () => {
  beforeEach(() => {
    vi.mocked(getAuditConsoleData).mockReset();
  });

  it("builds export payload via getAuditConsoleData only", async () => {
    vi.mocked(getAuditConsoleData).mockResolvedValue(consolePayload);

    const payload = await buildAuditExportPayload(
      { userId: "user-1", role: "Super_Admin" },
      { userId: "user-1", userName: "Admin User", role: "Super_Admin" },
      { page: 2, pageSize: 25, search: "INV" },
    );

    expect(getAuditConsoleData).toHaveBeenCalledTimes(1);
    expect(getAuditConsoleData).toHaveBeenCalledWith(
      { userId: "user-1", role: "Super_Admin" },
      expect.objectContaining({ page: 1, pageSize: MAX_AUDIT_EXPORT_BATCH, search: "INV" }),
      undefined,
      { maxPageSize: MAX_AUDIT_EXPORT_BATCH },
    );
    expect(payload.recordCount).toBe(1);
  });

  it("generates PDF export bytes", async () => {
    vi.mocked(getAuditConsoleData).mockResolvedValue(consolePayload);
    const payload = await buildAuditExportPayload(
      { userId: "user-1", role: "Super_Admin" },
      { userId: "user-1", userName: "Admin User", role: "Super_Admin" },
      { page: 1, pageSize: 25 },
    );
    const file = await createAuditPdfExport(payload);
    const buffer = Buffer.from(file.data, "base64");
    expect(file.contentType).toBe("application/pdf");
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("generates Excel export workbook", async () => {
    vi.mocked(getAuditConsoleData).mockResolvedValue(consolePayload);
    const payload = await buildAuditExportPayload(
      { userId: "user-1", role: "Accounts" },
      { userId: "acc-1", userName: "Accounts User", role: "Accounts" },
      { page: 1, pageSize: 25 },
    );
    const file = await createAuditExcelExport(payload);
    const buffer = Buffer.from(file.data, "base64");
    expect(file.filename.endsWith(".xlsx")).toBe(true);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });

  it("generates ZIP compliance archive with required files", async () => {
    vi.mocked(getAuditConsoleData).mockResolvedValue(consolePayload);
    const payload = await buildAuditExportPayload(
      { userId: "user-1", role: "Manager" },
      { userId: "mgr-1", userName: "Manager User", role: "Manager" },
      { page: 1, pageSize: 25 },
    );
    const file = await createAuditArchiveExport(payload);
    expect(file.filename).toMatch(/^audit-archive-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(file.contentType).toBe("application/zip");
    const buffer = Buffer.from(file.data, "base64");
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });
});

describe("audit export architecture guards", () => {
  it("does not import posting-service or duplicate audit query layer", () => {
    const serviceSource = readFileSync(
      resolve(process.cwd(), "src/lib/audit/export/audit-export-service.ts"),
      "utf8",
    );
    expect(serviceSource).not.toContain("posting-service");
    expect(serviceSource).not.toContain("findAuditLogs");
    expect(serviceSource).toContain("getAuditConsoleData");
  });

  it("does not import forbidden financial engines from export actions", () => {
    const actionFiles = [
      "export-audit-pdf.ts",
      "export-audit-excel.ts",
      "export-audit-archive.ts",
    ];
    for (const fileName of actionFiles) {
      const source = readFileSync(
        resolve(process.cwd(), `src/lib/actions/audit/${fileName}`),
        "utf8",
      );
      expect(source).not.toContain("posting-service");
      expect(source).toContain("buildAuditExportPayload");
    }
  });
});
