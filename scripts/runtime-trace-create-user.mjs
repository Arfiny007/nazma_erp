/**
 * PHASE_11E.2E — User creation root cause investigation script.
 * Run: node scripts/runtime-trace-create-user.mjs
 */
import { PrismaClient } from "@prisma/client";

process.env.RUNTIME_TRACE = "1";

const prisma = new PrismaClient();

function trace(phase, detail) {
  console.log(`[TRACE] ${phase}`, detail ?? "");
}

function formatError(error) {
  if (!(error instanceof Error)) {
    return { raw: String(error) };
  }
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause instanceof Error ? {
      name: error.cause.name,
      message: error.cause.message,
      stack: error.cause.stack,
    } : error.cause,
    code: "code" in error ? error.code : undefined,
    meta: "meta" in error ? error.meta : undefined,
  };
}

async function main() {
  const territoryCount = Number(process.argv[2] ?? "3");
  const email = `trace-user-${Date.now()}@nazma.test`;

  trace("SETUP", { territoryCount, email });

  const admin = await prisma.user.findFirst({
    where: { role: "Super_Admin", isActive: true },
    select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true },
  });

  if (!admin) {
    throw new Error("No Super_Admin user found");
  }

  const territories = await prisma.territory.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    take: territoryCount,
  });

  if (territories.length < territoryCount) {
    throw new Error(`Need ${territoryCount} territories, found ${territories.length}`);
  }

  const territoryIds = territories.map((t) => t.id);
  trace("TERRITORIES", territoryIds);

  const actor = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    isActive: admin.isActive,
    mustChangePassword: admin.mustChangePassword,
  };

  const { createUserRecord } = await import("../src/lib/users/user-service.ts");
  const { dispatchActivationNotification } = await import("../src/lib/notifications/auth-notifications.ts");
  const { ACTIVATION_TOKEN_TTL_MS } = await import("../src/lib/users/user-tokens.ts");

  let createResult;
  try {
    trace("ENTER createUserRecord");
    createResult = await createUserRecord(actor, {
      name: `Trace User ${Date.now()}`,
      email,
      role: "SR",
      territoryIds,
      phone: null,
      employeeCode: null,
      notes: null,
      draftOnly: false,
    });
    trace("EXIT createUserRecord", {
      userId: createResult.user.id,
      territoryCount: createResult.user.territories.length,
      hasActivationToken: Boolean(createResult.activationToken),
    });
  } catch (error) {
    console.error("[TRACE] FAIL createUserRecord", JSON.stringify(formatError(error), null, 2));
    process.exit(1);
  }

  if (createResult.activationToken && createResult.activationUrl) {
    try {
      trace("ENTER dispatchActivationNotification");
      const notification = await dispatchActivationNotification({
        actorId: actor.id,
        userId: createResult.user.id,
        name: createResult.user.name,
        email: createResult.user.email,
        activationLink: createResult.activationUrl,
        expirationAt: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
      });
      trace("EXIT dispatchActivationNotification", { notificationId: notification.id, status: notification.status });
    } catch (error) {
      console.error("[TRACE] FAIL dispatchActivationNotification", JSON.stringify(formatError(error), null, 2));
      process.exit(2);
    }
  }

  // Verify serialization (server action boundary)
  try {
    trace("ENTER JSON.stringify (serialization probe)");
    const serialized = JSON.stringify(createResult);
    trace("EXIT JSON.stringify", { bytes: serialized.length });
  } catch (error) {
    console.error("[TRACE] FAIL serialization", JSON.stringify(formatError(error), null, 2));
    process.exit(3);
  }

  // Cleanup
  await prisma.user.delete({ where: { id: createResult.user.id } });
  trace("CLEANUP", { deletedUserId: createResult.user.id });
  trace("SUCCESS");
}

main()
  .catch((error) => {
    console.error("[TRACE] UNHANDLED", JSON.stringify(formatError(error), null, 2));
    process.exit(99);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
