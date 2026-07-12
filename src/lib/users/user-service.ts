import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/types/auth";
import type {
  CreateUserInput,
  ListUsersInput,
  SearchUsersInput,
  UpdateUserInput,
} from "@/lib/validators/user-management.schema";
import { buildTerritoryScope } from "@/lib/rbac/territory";
import type {
  CreateUserResultDTO,
  PaginatedResult,
  UserDetailDTO,
  UserSummaryDTO,
} from "@/types/user-management";

import { recordUserAudit } from "./user-audit";
import {
  assertAssignableRole,
  assertCanActivateUser,
  assertCanCreateUser,
  assertCanDisableUser,
  assertCanManageTargetUser,
  assertCanUpdateUser,
  assertCanViewUsers,
  assertSelfAccessOnly,
  assertTerritoryAssignmentScope,
  buildUserVisibilityWhere,
  canActorResetPassword,
} from "./user-validation";
import {
  UserEmailExistsError,
  UserLifecycleError,
  UserNotFoundError,
  UserScopeDeniedError,
} from "./user-errors";
import {
  assertLifecycleTransition,
  lifecycleToIsActive,
  resolveInitialLifecycleStatus,
} from "./user-lifecycle";
import {
  generateTemporaryPassword,
  hashPassword,
} from "./user-password";
import {
  toUserDetailDTO,
  toUserSummaryDTO,
  userDetailInclude,
  userSummarySelect,
} from "./user-mappers";

async function loadUserDetail(userId: string): Promise<UserDetailDTO> {
  const record = await prisma.user.findUnique({
    where: { id: userId },
    include: userDetailInclude,
  });

  if (!record) {
    throw new UserNotFoundError();
  }

  return toUserDetailDTO(record);
}

async function syncTerritoryAssignments(
  tx: Prisma.TransactionClient,
  userId: string,
  territoryIds: readonly string[],
  isPrimaryFirst: boolean,
): Promise<void> {
  const uniqueIds = [...new Set(territoryIds)];

  await tx.userTerritoryAssignment.updateMany({
    where: {
      userId,
      territoryId: { notIn: uniqueIds.length > 0 ? [...uniqueIds] : ["__none__"] },
      isActive: true,
    },
    data: {
      isActive: false,
      revokedAt: new Date(),
    },
  });

  for (let index = 0; index < uniqueIds.length; index += 1) {
    const territoryId = uniqueIds[index]!;
    const isPrimary = isPrimaryFirst && index === 0;

    await tx.userTerritoryAssignment.upsert({
      where: {
        userId_territoryId: { userId, territoryId },
      },
      update: {
        isActive: true,
        isPrimary,
        revokedAt: null,
        assignedAt: new Date(),
      },
      create: {
        userId,
        territoryId,
        isPrimary,
        isActive: true,
      },
    });
  }
}

export async function createUserRecord(
  actor: AuthUser,
  input: CreateUserInput,
): Promise<CreateUserResultDTO> {
  assertCanCreateUser(actor);
  assertAssignableRole(actor, input.role);

  const scope = await buildTerritoryScope(actor.id);
  const actorTerritoryIds =
    scope.mode === "TERRITORIES" ? [...scope.territoryIds] : [];

  assertTerritoryAssignmentScope(actor, input.territoryIds, actorTerritoryIds);

  if (input.role === "SR" && input.territoryIds.length === 0 && actor.role !== "Super_Admin") {
    throw new UserScopeDeniedError("SR users require at least one territory");
  }

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    throw new UserEmailExistsError();
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const lifecycleStatus = resolveInitialLifecycleStatus(input.draftOnly);
  const isActive = lifecycleToIsActive(lifecycleStatus);

  const userId = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: passwordHash,
        role: input.role,
        lifecycleStatus,
        isActive,
        mustChangePassword: true,
        managerId: input.managerId ?? null,
        provisionedById: actor.id,
        profile: {
          create: {
            phone: input.phone ?? null,
            employeeCode: input.employeeCode ?? null,
            notes: input.notes ?? null,
          },
        },
      },
      select: { id: true },
    });

    if (input.territoryIds.length > 0) {
      await syncTerritoryAssignments(tx, created.id, input.territoryIds, true);
    }

    await tx.userInvitation.create({
      data: {
        userId: created.id,
        invitedById: actor.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await recordUserAudit(tx, {
      actorId: actor.id,
      targetUserId: created.id,
      action: "USER_CREATED",
      newValue: {
        email: input.email,
        role: input.role,
        lifecycleStatus,
        territoryIds: input.territoryIds,
        draftOnly: input.draftOnly,
      },
    });

    return created.id;
  });

  const user = await loadUserDetail(userId);
  return { user, temporaryPassword };
}

export async function updateUserRecord(
  actor: AuthUser,
  input: UpdateUserInput,
): Promise<UserDetailDTO> {
  assertCanUpdateUser(actor);

  const existing = await prisma.user.findUnique({
    where: { id: input.userId },
    include: userDetailInclude,
  });

  if (!existing) {
    throw new UserNotFoundError();
  }

  const scope = await buildTerritoryScope(actor.id);
  const actorTerritoryIds =
    scope.mode === "TERRITORIES" ? [...scope.territoryIds] : [];
  const targetTerritoryIds = existing.territoryAssignments.map((row) => row.territoryId);

  assertCanManageTargetUser(actor, existing.role, actorTerritoryIds, targetTerritoryIds);

  if (input.role && input.role !== existing.role) {
    assertAssignableRole(actor, input.role);
  }

  if (input.territoryIds) {
    assertTerritoryAssignmentScope(actor, input.territoryIds, actorTerritoryIds);
  }

  if (input.lifecycleStatus) {
    assertLifecycleTransition(existing.lifecycleStatus, input.lifecycleStatus);
  }

  const roleChanged = input.role !== undefined && input.role !== existing.role;

  await prisma.$transaction(async (tx) => {
    const nextStatus = input.lifecycleStatus ?? existing.lifecycleStatus;
    const nextRole = input.role ?? existing.role;

    await tx.user.update({
      where: { id: input.userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
        ...(input.lifecycleStatus !== undefined
          ? {
              lifecycleStatus: input.lifecycleStatus,
              isActive: lifecycleToIsActive(input.lifecycleStatus),
            }
          : {}),
        profile: {
          upsert: {
            create: {
              phone: input.phone ?? null,
              employeeCode: input.employeeCode ?? null,
              notes: input.notes ?? null,
            },
            update: {
              ...(input.phone !== undefined ? { phone: input.phone } : {}),
              ...(input.employeeCode !== undefined ? { employeeCode: input.employeeCode } : {}),
              ...(input.notes !== undefined ? { notes: input.notes } : {}),
            },
          },
        },
      },
    });

    if (input.territoryIds) {
      await syncTerritoryAssignments(tx, input.userId, input.territoryIds, true);
    }

    if (roleChanged) {
      await recordUserAudit(tx, {
        actorId: actor.id,
        targetUserId: input.userId,
        action: "USER_ROLE_CHANGED",
        oldValue: { role: existing.role },
        newValue: { role: nextRole },
      });
    } else if (
      input.name !== undefined ||
      input.managerId !== undefined ||
      input.territoryIds !== undefined ||
      input.phone !== undefined ||
      input.employeeCode !== undefined ||
      input.notes !== undefined
    ) {
      await recordUserAudit(tx, {
        actorId: actor.id,
        targetUserId: input.userId,
        action: "USER_UPDATED",
        oldValue: {
          name: existing.name,
          managerId: existing.managerId,
        },
        newValue: {
          name: input.name ?? existing.name,
          managerId: input.managerId ?? existing.managerId,
        },
      });
    }

    if (input.lifecycleStatus && input.lifecycleStatus !== existing.lifecycleStatus) {
      const action =
        input.lifecycleStatus === "ACTIVE" ? "USER_ACTIVATED" : "USER_DEACTIVATED";
      await recordUserAudit(tx, {
        actorId: actor.id,
        targetUserId: input.userId,
        action,
        oldValue: { lifecycleStatus: existing.lifecycleStatus },
        newValue: { lifecycleStatus: nextStatus },
      });
    }
  });

  return loadUserDetail(input.userId);
}

export async function activateUserRecord(
  actor: AuthUser,
  userId: string,
): Promise<UserDetailDTO> {
  assertCanActivateUser(actor);

  if (actor.id === userId) {
    throw new UserScopeDeniedError("Cannot activate own account");
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: userDetailInclude,
  });

  if (!existing) {
    throw new UserNotFoundError();
  }

  const scope = await buildTerritoryScope(actor.id);
  const actorTerritoryIds =
    scope.mode === "TERRITORIES" ? [...scope.territoryIds] : [];
  const targetTerritoryIds = existing.territoryAssignments.map((row) => row.territoryId);

  assertCanManageTargetUser(actor, existing.role, actorTerritoryIds, targetTerritoryIds);
  assertLifecycleTransition(existing.lifecycleStatus, "ACTIVE");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        lifecycleStatus: "ACTIVE",
        isActive: true,
      },
    });

    await recordUserAudit(tx, {
      actorId: actor.id,
      targetUserId: userId,
      action: "USER_ACTIVATED",
      oldValue: { lifecycleStatus: existing.lifecycleStatus },
      newValue: { lifecycleStatus: "ACTIVE" },
    });
  });

  return loadUserDetail(userId);
}

export async function disableUserRecord(
  actor: AuthUser,
  userId: string,
): Promise<UserDetailDTO> {
  assertCanDisableUser(actor);

  if (actor.id === userId) {
    throw new UserScopeDeniedError("Cannot disable own account");
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: userDetailInclude,
  });

  if (!existing) {
    throw new UserNotFoundError();
  }

  const scope = await buildTerritoryScope(actor.id);
  const actorTerritoryIds =
    scope.mode === "TERRITORIES" ? [...scope.territoryIds] : [];
  const targetTerritoryIds = existing.territoryAssignments.map((row) => row.territoryId);

  assertCanManageTargetUser(actor, existing.role, actorTerritoryIds, targetTerritoryIds);
  assertLifecycleTransition(existing.lifecycleStatus, "DISABLED");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        lifecycleStatus: "DISABLED",
        isActive: false,
      },
    });

    await recordUserAudit(tx, {
      actorId: actor.id,
      targetUserId: userId,
      action: "USER_DEACTIVATED",
      oldValue: { lifecycleStatus: existing.lifecycleStatus },
      newValue: { lifecycleStatus: "DISABLED" },
    });
  });

  return loadUserDetail(userId);
}

export async function resetUserTemporaryPassword(
  actor: AuthUser,
  userId: string,
): Promise<{ user: UserDetailDTO; temporaryPassword: string }> {
  if (!canActorResetPassword(actor)) {
    throw new UserScopeDeniedError("Password reset not permitted");
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!existing) {
    throw new UserNotFoundError();
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        mustChangePassword: true,
      },
    });

    await recordUserAudit(tx, {
      actorId: actor.id,
      targetUserId: userId,
      action: "USER_UPDATED",
      newValue: { temporaryPasswordReset: true },
    });
  });

  const user = await loadUserDetail(userId);
  return { user, temporaryPassword };
}

export async function listUsersRecord(
  actor: AuthUser,
  input: ListUsersInput,
): Promise<PaginatedResult<UserSummaryDTO>> {
  assertCanViewUsers(actor);

  const scope = await buildTerritoryScope(actor.id);
  const visibilityWhere = buildUserVisibilityWhere(actor, scope);

  const where: Prisma.UserWhereInput = {
    AND: [visibilityWhere],
  };

  if (input.role) {
    where.role = input.role;
  }

  if (input.lifecycleStatus) {
    where.lifecycleStatus = input.lifecycleStatus;
  }

  if (input.search) {
    where.OR = [
      { name: { contains: input.search, mode: "insensitive" } },
      { email: { contains: input.search, mode: "insensitive" } },
    ];
  }

  if (input.territoryId) {
    where.territoryAssignments = {
      some: {
        territoryId: input.territoryId,
        isActive: true,
      },
    };
  }

  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userSummarySelect,
      orderBy: { [input.sortBy]: input.sortOrder },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
  ]);

  return {
    items: rows.map(toUserSummaryDTO),
    total,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: total === 0 ? 0 : Math.ceil(total / input.pageSize),
  };
}

export async function getUserRecord(
  actor: AuthUser,
  userId: string,
): Promise<UserDetailDTO> {
  if (actor.role === "SR") {
    assertSelfAccessOnly(actor, userId);
  } else {
    assertCanViewUsers(actor);
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: userDetailInclude,
  });

  if (!existing) {
    throw new UserNotFoundError();
  }

  if (actor.role === "Manager") {
    const scope = await buildTerritoryScope(actor.id);
    const actorTerritoryIds =
      scope.mode === "TERRITORIES" ? [...scope.territoryIds] : [];
    const targetTerritoryIds = existing.territoryAssignments.map((row) => row.territoryId);

    if (existing.role !== "SR") {
      throw new UserScopeDeniedError("Manager may only view SR users");
    }

    try {
      assertCanManageTargetUser(actor, existing.role, actorTerritoryIds, targetTerritoryIds);
    } catch {
      throw new UserScopeDeniedError("User outside manager territory scope");
    }
  }

  return toUserDetailDTO(existing);
}

export async function searchUsersRecord(
  actor: AuthUser,
  input: SearchUsersInput,
): Promise<UserSummaryDTO[]> {
  assertCanViewUsers(actor);

  const scope = await buildTerritoryScope(actor.id);
  const visibilityWhere = buildUserVisibilityWhere(actor, scope);

  const where: Prisma.UserWhereInput = {
    AND: [
      visibilityWhere,
      {
        OR: [
          { name: { contains: input.query, mode: "insensitive" } },
          { email: { contains: input.query, mode: "insensitive" } },
        ],
      },
    ],
  };

  if (input.role) {
    where.role = input.role;
  }

  const rows = await prisma.user.findMany({
    where,
    select: userSummarySelect,
    orderBy: { name: "asc" },
    take: input.limit,
  });

  return rows.map(toUserSummaryDTO);
}

export {
  UserLifecycleError,
  UserNotFoundError,
  UserScopeDeniedError,
  UserEmailExistsError,
};
