import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  isMustChangePasswordAllowedPath,
  isPublicAuthRoute,
  resolvePostLoginRedirect,
} from "@/lib/auth/auth-routing";
import {
  ActivationNotAllowedError,
  TokenExpiredError,
  TokenInvalidError,
  TokenReplayError,
} from "@/lib/users/auth-errors";
import {
  ACTIVATION_TOKEN_TTL_MS,
  PASSWORD_RESET_TOKEN_TTL_MS,
  buildActivationUrl,
  generateSecureToken,
  hashToken,
  isTokenExpired,
} from "@/lib/users/user-tokens";
import { hashPassword, verifyPassword } from "@/lib/users/user-password";
import type { AuthUser } from "@/types/auth";

const mockTransaction = vi.fn();
const mockFindFirst = vi.fn();
const mockUserUpdate = vi.fn();
const mockAuditCreate = vi.fn();
const mockInvitationUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (callback: (tx: unknown) => Promise<unknown>) =>
      mockTransaction(callback),
    userActivationToken: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    userPasswordResetToken: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    user: {
      findUnique: vi.fn(),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}));

import { validateActivationToken, completeAccountActivation } from "@/lib/users/user-activation-service";
import {
  validateResetToken,
  changeUserPassword,
} from "@/lib/users/user-password-reset-service";

const superAdmin: AuthUser = {
  id: "admin-1",
  name: "Admin",
  email: "admin@nazma.local",
  role: "Super_Admin",
  isActive: true,
  mustChangePassword: false,
};

const manager: AuthUser = {
  id: "mgr-1",
  name: "Manager",
  email: "manager1@nazma.test",
  role: "Manager",
  isActive: true,
  mustChangePassword: false,
};

const sr: AuthUser = {
  id: "sr-1",
  name: "SR",
  email: "sr1@nazma.test",
  role: "SR",
  isActive: true,
  mustChangePassword: true,
};

const accounts: AuthUser = {
  id: "acc-1",
  name: "Accounts",
  email: "accounts1@nazma.test",
  role: "Accounts",
  isActive: true,
  mustChangePassword: false,
};

describe("auth routing", () => {
  it("redirects mustChangePassword users to change-password page", () => {
    expect(resolvePostLoginRedirect(true)).toBe("/auth/change-password");
    expect(resolvePostLoginRedirect(false)).toBe("/");
  });

  it("allows only change-password and signout when password change required", () => {
    expect(isMustChangePasswordAllowedPath("/auth/change-password")).toBe(true);
    expect(isMustChangePasswordAllowedPath("/api/auth/signout")).toBe(true);
    expect(isMustChangePasswordAllowedPath("/dashboard")).toBe(false);
    expect(isMustChangePasswordAllowedPath("/settings")).toBe(false);
    expect(isMustChangePasswordAllowedPath("/reports")).toBe(false);
  });

  it("exposes public auth routes", () => {
    expect(isPublicAuthRoute("/login")).toBe(true);
    expect(isPublicAuthRoute("/auth/activate")).toBe(true);
    expect(isPublicAuthRoute("/auth/forgot-password")).toBe(true);
    expect(isPublicAuthRoute("/auth/reset-password")).toBe(true);
    expect(isPublicAuthRoute("/dashboard")).toBe(false);
  });
});

describe("token security", () => {
  it("hashes tokens with SHA-256 — never stores plaintext", () => {
    const plain = generateSecureToken();
    const hashed = hashToken(plain);
    expect(hashed).not.toBe(plain);
    expect(hashed).toHaveLength(64);
    expect(hashToken(plain)).toBe(hashed);
  });

  it("generates unique high-entropy tokens", () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it("detects expired tokens", () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 60_000);
    expect(isTokenExpired(past)).toBe(true);
    expect(isTokenExpired(future)).toBe(false);
  });

  it("builds activation URLs without exposing hash", () => {
    const plain = generateSecureToken();
    const url = buildActivationUrl(plain, "https://erp.nazma.local");
    expect(url).toContain(plain);
    expect(url).not.toContain(hashToken(plain));
  });

  it("uses bcrypt for password hashing", async () => {
    const hash = await hashPassword("Admin123!");
    expect(hash).not.toBe("Admin123!");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("Admin123!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("activation token validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid activation tokens", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    await expect(validateActivationToken("bad-token")).rejects.toThrow(TokenInvalidError);
  });

  it("rejects expired activation tokens", async () => {
    mockFindFirst.mockResolvedValueOnce({
      usedAt: null,
      expiresAt: new Date(Date.now() - ACTIVATION_TOKEN_TTL_MS),
      user: {
        id: "u1",
        email: "user@test.local",
        name: "User",
        lifecycleStatus: "PENDING_ACTIVATION",
      },
    });
    await expect(validateActivationToken("expired")).rejects.toThrow(TokenExpiredError);
  });

  it("rejects replayed activation tokens", async () => {
    mockFindFirst.mockResolvedValueOnce({
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
      user: {
        id: "u1",
        email: "user@test.local",
        name: "User",
        lifecycleStatus: "PENDING_ACTIVATION",
      },
    });
    await expect(validateActivationToken("used")).rejects.toThrow(TokenReplayError);
  });

  it("rejects activation for non-eligible lifecycle states", async () => {
    mockFindFirst.mockResolvedValueOnce({
      usedAt: null,
      expiresAt: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
      user: {
        id: "u1",
        email: "user@test.local",
        name: "User",
        lifecycleStatus: "ACTIVE",
      },
    });
    await expect(validateActivationToken("active-user")).rejects.toThrow(
      ActivationNotAllowedError,
    );
  });
});

describe("activation completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes activation and writes audit events", async () => {
    const plainToken = generateSecureToken();
    const tokenHash = hashToken(plainToken);

    mockTransaction.mockImplementation(async (callback) => {
      const tx = {
        userActivationToken: {
          findFirst: vi.fn().mockResolvedValue({
            id: "tok-1",
            usedAt: null,
            expiresAt: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
            user: { id: "u1", lifecycleStatus: "PENDING_ACTIVATION" },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        user: { update: mockUserUpdate },
        userInvitation: { updateMany: mockInvitationUpdateMany },
        auditLog: { create: mockAuditCreate },
      };
      return callback(tx);
    });

    const result = await completeAccountActivation(plainToken, "NewPass123!");
    expect(result.userId).toBe("u1");
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lifecycleStatus: "ACTIVE",
          mustChangePassword: false,
        }),
      }),
    );
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate.mock.calls[0]![0].data.action).toBe("USER_ACTIVATION_COMPLETED");
    expect(tokenHash).toHaveLength(64);
  });

  it("blocks replay on concurrent activation consumption", async () => {
    mockTransaction.mockImplementation(async (callback) => {
      const tx = {
        userActivationToken: {
          findFirst: vi.fn().mockResolvedValue({
            id: "tok-1",
            usedAt: null,
            expiresAt: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
            user: { id: "u1", lifecycleStatus: "PENDING_ACTIVATION" },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
        user: { update: mockUserUpdate },
        userInvitation: { updateMany: mockInvitationUpdateMany },
        auditLog: { create: mockAuditCreate },
      };
      return callback(tx);
    });

    await expect(completeAccountActivation("token", "NewPass123!")).rejects.toThrow(
      TokenReplayError,
    );
  });
});

describe("password reset foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects expired reset tokens", async () => {
    mockFindFirst.mockResolvedValueOnce({
      usedAt: null,
      expiresAt: new Date(Date.now() - PASSWORD_RESET_TOKEN_TTL_MS),
      user: { id: "u1", email: "user@test.local", isActive: true, lifecycleStatus: "ACTIVE" },
    });
    await expect(validateResetToken("expired")).rejects.toThrow(TokenExpiredError);
  });

  it("rejects replayed reset tokens", async () => {
    mockFindFirst.mockResolvedValueOnce({
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      user: { id: "u1", email: "user@test.local", isActive: true, lifecycleStatus: "ACTIVE" },
    });
    await expect(validateResetToken("used")).rejects.toThrow(TokenReplayError);
  });
});

describe("role login flow expectations", () => {
  it("Super Admin with mustChangePassword=false goes to dashboard", () => {
    expect(resolvePostLoginRedirect(superAdmin.mustChangePassword)).toBe("/");
    expect(isMustChangePasswordAllowedPath("/dashboard")).toBe(false);
  });

  it("Manager with mustChangePassword=false goes to dashboard", () => {
    expect(resolvePostLoginRedirect(manager.mustChangePassword)).toBe("/");
  });

  it("SR with mustChangePassword=true is forced to change-password", () => {
    expect(resolvePostLoginRedirect(sr.mustChangePassword)).toBe("/auth/change-password");
    expect(isMustChangePasswordAllowedPath("/auth/change-password")).toBe(true);
  });

  it("Accounts with mustChangePassword=false goes to dashboard", () => {
    expect(resolvePostLoginRedirect(accounts.mustChangePassword)).toBe("/");
  });
});

describe("changeUserPassword audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records USER_PASSWORD_CHANGED audit on success", async () => {
    const passwordHash = await hashPassword("OldPass123!");
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: superAdmin.id,
      password: passwordHash,
      mustChangePassword: true,
    } as never);

    mockTransaction.mockImplementation(async (callback) => {
      const tx = {
        user: { update: mockUserUpdate },
        auditLog: { create: mockAuditCreate },
      };
      return callback(tx);
    });

    await changeUserPassword(superAdmin, "OldPass123!", "NewPass456!");
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "USER_PASSWORD_CHANGED" }),
      }),
    );
  });
});
