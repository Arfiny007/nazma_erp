import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac/guards", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audit")>();
  return {
    ...actual,
    getAuditConsoleData: vi.fn(),
    buildAuditContext: vi.fn(),
  };
});

import { getAuditConsole } from "@/lib/actions/audit/get-audit-console";
import { buildAuditContext, getAuditConsoleData } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac/guards";

const payload = {
  records: [],
  summary: {
    totalEvents: 0,
    financialEvents: 0,
    securityEvents: 0,
    dealerEvents: 0,
    integrityEvents: 0,
  },
  timeline: [],
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
  generatedAt: "2026-07-13T00:00:00.000Z",
};

describe("getAuditConsole action", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockReset();
    vi.mocked(buildAuditContext).mockReset();
    vi.mocked(getAuditConsoleData).mockReset();
  });

  it("returns forbidden when audit permission is missing", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("forbidden"));

    const result = await getAuditConsole({ page: 1, pageSize: 25 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("returns audit payload for authorized Accounts users", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      id: "acc-1",
      role: "Accounts",
    } as never);
    vi.mocked(buildAuditContext).mockReturnValue({
      userId: "acc-1",
      role: "Accounts",
    });
    vi.mocked(getAuditConsoleData).mockResolvedValue(payload);

    const result = await getAuditConsole({ page: 1, pageSize: 25 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
    }
  });
});
