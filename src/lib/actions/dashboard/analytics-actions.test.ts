import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDashboardAnalytics } from "@/lib/actions/dashboard/get-dashboard-analytics";
import { getSrAnalyticsAction } from "@/lib/actions/dashboard/get-sr-analytics";

vi.mock("@/lib/rbac/guards", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/dashboard/analytics", () => ({
  resolveAnalyticsForRole: vi.fn(),
  getSrAnalytics: vi.fn(),
}));

import { requirePermission } from "@/lib/rbac/guards";
import {
  getSrAnalytics,
  resolveAnalyticsForRole,
} from "@/lib/dashboard/analytics";

const sampleAnalytics = {
  role: "SR" as const,
  charts: [
    {
      id: "monthlySales",
      titleKey: "dashboard.analytics.charts.monthlySales",
      type: "line" as const,
      data: [{ label: "Jan", value: 100 }],
    },
  ],
  generatedAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    id: "user-1",
    name: "SR User",
    email: "sr@nazma.local",
    role: "SR",
    isActive: true,
    mustChangePassword: false,
  });
  vi.mocked(resolveAnalyticsForRole).mockResolvedValue(sampleAnalytics);
  vi.mocked(getSrAnalytics).mockResolvedValue(sampleAnalytics);
});

describe("analytics server actions", () => {
  it("getDashboardAnalytics returns role-aware analytics", async () => {
    const result = await getDashboardAnalytics();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("SR");
      expect(result.data.charts).toHaveLength(1);
    }
  });

  it("getSrAnalytics rejects non-SR roles", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      id: "user-2",
      name: "Manager",
      email: "mgr@nazma.local",
      role: "Manager",
      isActive: true,
      mustChangePassword: false,
    });
    const result = await getSrAnalyticsAction();
    expect(result.success).toBe(false);
  });
});
