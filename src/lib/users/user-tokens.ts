import { createHash, randomBytes } from "node:crypto";

/** Default activation token lifetime — 7 days. */
export const ACTIVATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Default password reset token lifetime — 1 hour. */
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashToken(plainToken: string): string {
  return createHash("sha256").update(plainToken).digest("hex");
}

export function isTokenExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function buildActivationUrl(plainToken: string, baseUrl?: string): string {
  const origin = baseUrl ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${origin.replace(/\/$/, "")}/auth/activate?token=${encodeURIComponent(plainToken)}`;
}

export function buildPasswordResetUrl(plainToken: string, baseUrl?: string): string {
  const origin = baseUrl ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${origin.replace(/\/$/, "")}/auth/reset-password?token=${encodeURIComponent(plainToken)}`;
}
