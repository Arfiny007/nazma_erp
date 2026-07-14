import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/types/auth";

import {
  PasswordMismatchError,
  TokenExpiredError,
  TokenInvalidError,
  TokenReplayError,
} from "./auth-errors";
import { recordUserAudit } from "./user-audit";
import { hashPassword, verifyPassword } from "./user-password";
import {
  generateSecureToken,
  hashToken,
  isTokenExpired,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "./user-tokens";

export interface PasswordResetTokenValidation {
  userId: string;
  email: string;
}

export async function changeUserPassword(
  actor: AuthUser,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { id: true, password: true, mustChangePassword: true },
  });

  if (!user) {
    throw new TokenInvalidError();
  }

  const currentValid = await verifyPassword(currentPassword, user.password);
  if (!currentValid) {
    throw new PasswordMismatchError();
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: actor.id },
      data: {
        password: passwordHash,
        mustChangePassword: false,
      },
    });

    await recordUserAudit(tx, {
      actorId: actor.id,
      targetUserId: actor.id,
      action: "USER_PASSWORD_CHANGED",
      oldValue: { mustChangePassword: user.mustChangePassword },
      newValue: { mustChangePassword: false },
    });
  });
}

export async function requestPasswordReset(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isActive: true, lifecycleStatus: true },
  });

  if (!user || !user.isActive || user.lifecycleStatus !== "ACTIVE") {
    return null;
  }

  const plainToken = generateSecureToken();
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.userPasswordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await tx.userPasswordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    await recordUserAudit(tx, {
      actorId: user.id,
      targetUserId: user.id,
      action: "USER_PASSWORD_RESET_REQUESTED",
      newValue: { email },
    });
  });

  return plainToken;
}

async function findResetTokenRecord(token: string) {
  const tokenHash = hashToken(token);
  return prisma.userPasswordResetToken.findFirst({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
          lifecycleStatus: true,
        },
      },
    },
  });
}

export async function validateResetToken(
  token: string,
): Promise<PasswordResetTokenValidation> {
  const record = await findResetTokenRecord(token);

  if (!record) {
    throw new TokenInvalidError();
  }

  if (record.usedAt) {
    throw new TokenReplayError();
  }

  if (isTokenExpired(record.expiresAt)) {
    throw new TokenExpiredError();
  }

  if (!record.user.isActive || record.user.lifecycleStatus !== "ACTIVE") {
    throw new TokenInvalidError();
  }

  return {
    userId: record.user.id,
    email: record.user.email,
  };
}

export async function completePasswordReset(
  token: string,
  newPassword: string,
): Promise<{ userId: string }> {
  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(newPassword);

  return prisma.$transaction(async (tx) => {
    const record = await tx.userPasswordResetToken.findFirst({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            isActive: true,
            lifecycleStatus: true,
          },
        },
      },
    });

    if (!record) {
      throw new TokenInvalidError();
    }

    if (record.usedAt) {
      throw new TokenReplayError();
    }

    if (isTokenExpired(record.expiresAt)) {
      throw new TokenExpiredError();
    }

    if (!record.user.isActive || record.user.lifecycleStatus !== "ACTIVE") {
      throw new TokenInvalidError();
    }

    const consumed = await tx.userPasswordResetToken.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (consumed.count === 0) {
      throw new TokenReplayError();
    }

    await tx.user.update({
      where: { id: record.user.id },
      data: {
        password: passwordHash,
        mustChangePassword: false,
      },
    });

    await recordUserAudit(tx, {
      actorId: record.user.id,
      targetUserId: record.user.id,
      action: "USER_PASSWORD_RESET_COMPLETED",
      newValue: { mustChangePassword: false },
    });

    return { userId: record.user.id };
  });
}
