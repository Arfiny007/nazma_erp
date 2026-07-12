import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTerritoryMap } from "@/lib/actions/dashboard/get-territory-map";
import { getManagerTerritoryMapAction } from "@/lib/actions/dashboard/get-manager-territory-map";
import { getAccountsTerritoryMapAction } from "@/lib/actions/dashboard/get-accounts-territory-map";
import { getAdminTerritoryMapAction } from "@/lib/actions/dashboard/get-admin-territory-map";

vi.mock("@/lib/rbac/guards", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/lib/dashboard/maps", () => ({
  resolveTerritoryMapForRole: vi.fn(),
  getManagerTerritoryMap: vi.fn(),
  getAccountsTerritoryMap: vi.fn(),
  getAdminTerritoryMap: vi.fn(),
}));

import { requirePermission } from "@/lib/rbac/guards";
import {
  resolveTerritoryMapForRole,
  getManagerTerritoryMap,
  getAccountsTerritoryMap,
  getAdminTerritoryMap,
} from "@/lib/dashboard/maps";

const samplePayload = {
  role: "Super_Admin" as const,
  nodes: [],
  divisions: [],
  districts: [],
  filters: { metric: "sales" as const, period: "month" as const },
  generatedAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    id: "user-1",
    name: "Admin",
    email: "admin@nazma.local",
    role: "Super_Admin",
    isActive: true,
  });
  vi.mocked(resolveTerritoryMapForRole).mockResolvedValue(samplePayload);
  vi.mocked(getManagerTerritoryMap).mockResolvedValue({
    ...samplePayload,
    role: "Manager",
  });
  vi.mocked(getAccountsTerritoryMap).mockResolvedValue({
    ...samplePayload,
    role: "Accounts",
  });
  vi.mocked(getAdminTerritoryMap).mockResolvedValue(samplePayload);
});

describe("territory map server actions", () => {
  it("getTerritoryMap returns role-aware payload", async () => {
    const result = await getTerritoryMap();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("Super_Admin");
    }
  });

  it("getManagerTerritoryMap rejects non-Manager roles", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      id: "user-1",
      name: "Admin",
      email: "admin@nazma.local",
      role: "Super_Admin",
      isActive: true,
    });
    const result = await getManagerTerritoryMapAction();
    expect(result.success).toBe(false);
  });

  it("getAccountsTerritoryMap rejects non-Accounts roles", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      id: "user-1",
      name: "SR",
      email: "sr@nazma.local",
      role: "SR",
      isActive: true,
    });
    const result = await getAccountsTerritoryMapAction();
    expect(result.success).toBe(false);
  });

  it("getAdminTerritoryMap rejects non-Super_Admin roles", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      id: "user-1",
      name: "Manager",
      email: "mgr@nazma.local",
      role: "Manager",
      isActive: true,
    });
    const result = await getAdminTerritoryMapAction();
    expect(result.success).toBe(false);
  });

  it("getTerritoryMap returns FORBIDDEN without permission", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("denied"));
    const result = await getTerritoryMap();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });
});
