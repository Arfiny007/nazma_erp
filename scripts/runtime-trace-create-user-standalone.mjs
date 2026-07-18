/**
 * Self-contained user creation investigation — runs inside Docker app container.
 * node scripts/runtime-trace-create-user-standalone.mjs [territoryCount]
 */
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

process.env.RUNTIME_TRACE = "1";

const prisma = new PrismaClient();
const territoryCount = Number(process.argv[2] ?? "3");

function trace(phase, detail) {
  console.log(`[TRACE] ${phase}`, detail ?? "");
}

function formatError(error) {
  if (!(error instanceof Error)) return { raw: String(error) };
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: "code" in error ? error.code : undefined,
    meta: "meta" in error ? error.meta : undefined,
    cause: error.cause,
  };
}

function generateSecureToken(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

function hashToken(plainToken) {
  return createHash("sha256").update(plainToken).digest("hex");
}

async function syncTerritoryAssignments(tx, userId, territoryIds) {
  const uniqueIds = [...new Set(territoryIds)];
  trace("syncTerritoryAssignments ENTER", { userId, uniqueIds });

  await tx.userTerritoryAssignment.updateMany({
    where: {
      userId,
      territoryId: { notIn: uniqueIds.length > 0 ? [...uniqueIds] : ["__none__"] },
      isActive: true,
    },
    data: { isActive: false, revokedAt: new Date() },
  });

  for (let index = 0; index < uniqueIds.length; index += 1) {
    const territoryId = uniqueIds[index];
    const isPrimary = index === 0;
    trace("syncTerritoryAssignments upsert", { index, territoryId, isPrimary });
    await tx.userTerritoryAssignment.upsert({
      where: { userId_territoryId: { userId, territoryId } },
      update: {
        isActive: true,
        isPrimary,
        revokedAt: null,
        assignedAt: new Date(),
      },
      create: { userId, territoryId, isPrimary, isActive: true },
    });
  }

  trace("syncTerritoryAssignments EXIT");
}

async function issueActivationToken(tx, userId) {
  const plainToken = generateSecureToken();
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await tx.userActivationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await tx.userActivationToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return plainToken;
}

async function recordUserAudit(tx, params) {
  await tx.auditLog.create({
    data: {
      userId: params.actorId,
      entityType: "User",
      entityId: params.targetUserId,
      action: params.action,
      newValue: params.newValue,
    },
  });
}

async function createUserTransaction(actorId, input) {
  const passwordHash = await bcrypt.hash("TempPass123!", 12);
  let activationToken = null;

  const userId = await prisma.$transaction(async (tx) => {
    trace("TX ENTER create user");
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: passwordHash,
        role: input.role,
        lifecycleStatus: "PENDING_ACTIVATION",
        isActive: false,
        mustChangePassword: true,
        provisionedById: actorId,
        profile: { create: { phone: null } },
      },
      select: { id: true },
    });
    trace("TX user created", { id: created.id });

    if (input.territoryIds.length > 0) {
      await syncTerritoryAssignments(tx, created.id, input.territoryIds);
    }

    await tx.userInvitation.create({
      data: {
        userId: created.id,
        invitedById: actorId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    trace("TX invitation created");

    await recordUserAudit(tx, {
      actorId,
      targetUserId: created.id,
      action: "USER_CREATED",
      newValue: {
        email: input.email,
        role: input.role,
        territoryIds: input.territoryIds,
      },
    });
    trace("TX audit USER_CREATED");

    activationToken = await issueActivationToken(tx, created.id);
    trace("TX activation token issued");

    return created.id;
  });

  trace("TX COMMITTED", { userId });
  return { userId, activationToken };
}

async function loadUserDetail(userId) {
  trace("loadUserDetail ENTER", { userId });
  const record = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      manager: { select: { id: true, name: true } },
      provisionedBy: { select: { id: true, name: true } },
      profile: true,
      territoryAssignments: {
        where: { isActive: true },
        include: {
          territory: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }],
      },
    },
  });
  trace("loadUserDetail EXIT", {
    found: Boolean(record),
    territoryCount: record?.territoryAssignments.length,
  });
  return record;
}

async function dispatchActivationNotification(actorId, user, activationUrl) {
  trace("dispatchActivationNotification ENTER");
  const template = await prisma.notificationTemplate.findFirst({
    where: { key: "USER_ACTIVATION_EMAIL", locale: "en", channel: "EMAIL", isActive: true },
  });
  if (!template) {
    throw new Error("NotificationTemplate USER_ACTIVATION_EMAIL not found");
  }

  const notificationId = await prisma.$transaction(async (tx) => {
    const created = await tx.notification.create({
      data: {
        type: "USER_ACTIVATION",
        channel: "EMAIL",
        status: "PENDING",
        recipient: user.email,
        subject: template.subject,
        payload: {
          body: template.body,
          userId: user.id,
          activationLink: activationUrl,
        },
        maxRetries: 3,
      },
    });

    await recordUserAudit(tx, {
      actorId,
      targetUserId: user.id,
      action: "USER_ACTIVATION_STARTED",
      newValue: { notificationId: created.id, recipient: user.email },
    });

    return created.id;
  });

  await prisma.notification.update({
    where: { id: notificationId },
    data: { queuedAt: new Date(), status: "PENDING" },
  });

  trace("dispatchActivationNotification EXIT", { notificationId });
}

async function main() {
  const email = `standalone-trace-${Date.now()}@nazma.test`;
  const admin = await prisma.user.findFirst({
    where: { role: "Super_Admin", isActive: true },
    select: { id: true },
  });
  if (!admin) throw new Error("No admin");

  const territories = await prisma.territory.findMany({
    where: { isActive: true },
    select: { id: true },
    take: territoryCount,
  });
  const territoryIds = territories.map((t) => t.id);
  trace("SETUP", { email, territoryCount, territoryIds });

  let userId;
  let activationToken;
  try {
    ({ userId, activationToken } = await createUserTransaction(admin.id, {
      name: `Standalone Trace ${Date.now()}`,
      email,
      role: "SR",
      territoryIds,
    }));
  } catch (error) {
    console.error("[TRACE] FAIL transaction", JSON.stringify(formatError(error), null, 2));
    process.exit(1);
  }

  let detail;
  try {
    detail = await loadUserDetail(userId);
  } catch (error) {
    console.error("[TRACE] FAIL loadUserDetail", JSON.stringify(formatError(error), null, 2));
    process.exit(2);
  }

  const dto = {
    user: {
      id: detail.id,
      name: detail.name,
      email: detail.email,
      territories: detail.territoryAssignments.map((row) => ({
        territoryId: row.territoryId,
        territoryCode: row.territory.code,
        territoryName: row.territory.name,
        isPrimary: row.isPrimary,
      })),
      createdAt: detail.createdAt.toISOString(),
      updatedAt: detail.updatedAt.toISOString(),
    },
    temporaryPassword: "hidden",
    activationToken,
    activationUrl: activationToken
      ? `http://localhost:3000/auth/activate?token=${encodeURIComponent(activationToken)}`
      : null,
  };

  try {
    JSON.stringify(dto);
    trace("serialization OK");
  } catch (error) {
    console.error("[TRACE] FAIL serialization", JSON.stringify(formatError(error), null, 2));
    process.exit(3);
  }

  try {
    await dispatchActivationNotification(admin.id, detail, dto.activationUrl);
  } catch (error) {
    console.error("[TRACE] FAIL notification", JSON.stringify(formatError(error), null, 2));
    process.exit(4);
  }

  await prisma.user.delete({ where: { id: userId } });
  trace("SUCCESS", { territoryCount });
}

main()
  .catch((error) => {
    console.error("[TRACE] UNHANDLED", JSON.stringify(formatError(error), null, 2));
    process.exit(99);
  })
  .finally(() => prisma.$disconnect());
