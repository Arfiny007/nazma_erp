import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  ActivationNotAllowedError,
  TokenExpiredError,
  TokenInvalidError,
  TokenReplayError,
} from "./auth-errors";
import { assertLifecycleTransition } from "./user-lifecycle";
import { recordUserAudit } from "./user-audit";
import { hashPassword } from "./user-password";
import {
  ACTIVATION_TOKEN_TTL_MS,
  generateSecureToken,
  hashToken,
  isTokenExpired,
} from "./user-tokens";

type TxClient = Pick<
  Prisma.TransactionClient,
  "userActivationToken" | "user" | "userInvitation" | "auditLog"
>;

const ACTIVATABLE_STATUSES = new Set(["INVITED", "PENDING_ACTIVATION"]);

export interface ActivationTokenValidation {
  userId: string;
  email: string;
  name: string;
  lifecycleStatus: string;
}

export async function issueActivationToken(
  tx: TxClient,
  userId: string,
): Promise<string> {
  const plainToken = generateSecureToken();
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);

  await tx.userActivationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await tx.userActivationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return plainToken;
}

async function findActivationTokenRecord(token: string) {
  const tokenHash = hashToken(token);
  return prisma.userActivationToken.findFirst({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          lifecycleStatus: true,
        },
      },
    },
  });
}

export async function validateActivationToken(
  token: string,
): Promise<ActivationTokenValidation> {
  const record = await findActivationTokenRecord(token);

  if (!record) {
    throw new TokenInvalidError();
  }

  if (record.usedAt) {
    throw new TokenReplayError();
  }

  if (isTokenExpired(record.expiresAt)) {
    throw new TokenExpiredError();
  }

  if (!ACTIVATABLE_STATUSES.has(record.user.lifecycleStatus)) {
    throw new ActivationNotAllowedError();
  }

  return {
    userId: record.user.id,
    email: record.user.email,
    name: record.user.name,
    lifecycleStatus: record.user.lifecycleStatus,
  };
}

export async function completeAccountActivation(
  token: string,
  newPassword: string,
): Promise<{ userId: string }> {
  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(newPassword);

  return prisma.$transaction(async (tx) => {
    const record = await tx.userActivationToken.findFirst({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
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

    if (!ACTIVATABLE_STATUSES.has(record.user.lifecycleStatus)) {
      throw new ActivationNotAllowedError();
    }

    const consumed = await tx.userActivationToken.updateMany({
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

    assertLifecycleTransition(record.user.lifecycleStatus, "ACTIVE");

    await tx.user.update({
      where: { id: record.user.id },
      data: {
        password: passwordHash,
        lifecycleStatus: "ACTIVE",
        isActive: true,
        mustChangePassword: false,
      },
    });

    await tx.userInvitation.updateMany({
      where: {
        userId: record.user.id,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { acceptedAt: new Date() },
    });

    await recordUserAudit(tx, {
      actorId: record.user.id,
      targetUserId: record.user.id,
      action: "USER_ACTIVATION_STARTED",
      newValue: { lifecycleStatus: record.user.lifecycleStatus },
    });

    await recordUserAudit(tx, {
      actorId: record.user.id,
      targetUserId: record.user.id,
      action: "USER_ACTIVATION_COMPLETED",
      oldValue: { lifecycleStatus: record.user.lifecycleStatus },
      newValue: { lifecycleStatus: "ACTIVE", mustChangePassword: false },
    });

    return { userId: record.user.id };
  });
}
