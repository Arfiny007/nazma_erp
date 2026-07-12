import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDashboard } from "@/lib/actions/dashboard/get-dashboard";
import { getSrDashboardAction } from "@/lib/actions/dashboard/get-sr-dashboard";
import { getManagerDashboardAction } from "@/lib/actions/dashboard/get-manager-dashboard";
import { getAccountsDashboardAction } from "@/lib/actions/dashboard/get-accounts-dashboard";
import { getAdminDashboardAction } from "@/lib/actions/dashboard/get-admin-dashboard";

vi.mock("@/lib/rbac/guards", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/dashboard", () => ({
  resolveDashboardForRole: vi.fn(),
  getSrDashboard: vi.fn(),
  getManagerDashboard: vi.fn(),
  getAccountsDashboard: vi.fn(),
  getAdminDashboard: vi.fn(),
}));

import { requirePermission } from "@/lib/rbac/guards";
import {
  resolveDashboardForRole,
  getSrDashboard as getSrDashboardService,
  getManagerDashboard as getManagerDashboardService,
  getAccountsDashboard as getAccountsDashboardService,
  getAdminDashboard as getAdminDashboardService,
} from "@/lib/dashboard";

const samplePayload = {
  summary: {
    role: "SR" as const,
    scopeKey: "dashboard.scope.ownTerritories",
    titleKey: "dashboard.titles.sr",
    kpis: [],
  },
  widgets: { myDealers: { id: "myDealers", titleKey: "", columns: [], rows: [], emptyKey: "" }, recentActivity: [] },
  generatedAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    id: "user-1",
    name: "Test User",
    email: "test@nazma.local",
    role: "SR",
    isActive: true,
    mustChangePassword: false,
  });
  vi.mocked(resolveDashboardForRole).mockResolvedValue(samplePayload);
  vi.mocked(getSrDashboardService).mockResolvedValue(samplePayload);
  vi.mocked(getManagerDashboardService).mockResolvedValue({
    ...samplePayload,
    summary: { ...samplePayload.summary, role: "Manager" },
  });
  vi.mocked(getAccountsDashboardService).mockResolvedValue({
    ...samplePayload,
    summary: { ...samplePayload.summary, role: "Accounts" },
  });
  vi.mocked(getAdminDashboardService).mockResolvedValue({
    ...samplePayload,
    summary: { ...samplePayload.summary, role: "Super_Admin" },
  });
});

describe("dashboard server actions", () => {
  it("getDashboard returns role-aware payload", async () => {
    const result = await getDashboard();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summary.role).toBe("SR");
    }
  });

  it("getSrDashboard rejects non-SR roles", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      id: "user-1",
      name: "Manager",
      email: "mgr@nazma.local",
      role: "Manager",
      isActive: true,
      mustChangePassword: false,
    });
    const result = await getSrDashboardAction();
    expect(result.success).toBe(false);
  });

  it("getManagerDashboard accepts Manager role", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      id: "user-2",
      name: "Manager",
      email: "mgr@nazma.local",
      role: "Manager",
      isActive: true,
      mustChangePassword: false,
    });
    const result = await getManagerDashboardAction();
    expect(result.success).toBe(true);
  });

  it("getAccountsDashboard accepts Accounts role", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      id: "user-3",
      name: "Accounts",
      email: "acc@nazma.local",
      role: "Accounts",
      isActive: true,
      mustChangePassword: false,
    });
    const result = await getAccountsDashboardAction();
    expect(result.success).toBe(true);
  });

  it("getAdminDashboard accepts Super_Admin role", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      id: "user-4",
      name: "Admin",
      email: "admin@nazma.local",
      role: "Super_Admin",
      isActive: true,
      mustChangePassword: false,
    });
    const result = await getAdminDashboardAction();
    expect(result.success).toBe(true);
  });

  it("returns forbidden when permission check fails", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("forbidden"));
    const result = await getDashboard();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });
});
