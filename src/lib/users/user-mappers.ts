import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type {
  UserDetailDTO,
  UserSummaryDTO,
  UserTerritorySummary,
} from "@/types/user-management";

export const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  lifecycleStatus: true,
  isActive: true,
  mustChangePassword: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  manager: { select: { id: true, name: true } },
  _count: {
    select: {
      territoryAssignments: {
        where: { isActive: true },
      },
    },
  },
} satisfies Prisma.UserSelect;

export const userDetailInclude = {
  manager: { select: { id: true, name: true } },
  provisionedBy: { select: { id: true, name: true } },
  profile: true,
  territoryAssignments: {
    where: { isActive: true },
    include: {
      territory: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }],
  },
} satisfies Prisma.UserInclude;

export type UserSummaryRecord = Prisma.UserGetPayload<{
  select: typeof userSummarySelect;
}>;

export type UserDetailRecord = Prisma.UserGetPayload<{
  include: typeof userDetailInclude;
}>;

function mapTerritories(
  assignments: UserDetailRecord["territoryAssignments"],
): UserTerritorySummary[] {
  return assignments.map((row) => ({
    territoryId: row.territoryId,
    territoryCode: row.territory.code,
    territoryName: row.territory.name,
    isPrimary: row.isPrimary,
  }));
}

export function toUserSummaryDTO(record: UserSummaryRecord): UserSummaryDTO {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    lifecycleStatus: record.lifecycleStatus,
    isActive: record.isActive,
    mustChangePassword: record.mustChangePassword,
    managerId: record.managerId,
    managerName: record.manager?.name ?? null,
    territoryCount: record._count.territoryAssignments,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toUserDetailDTO(record: UserDetailRecord): UserDetailDTO {
  return {
    ...toUserSummaryDTO({
      ...record,
      _count: { territoryAssignments: record.territoryAssignments.length },
    }),
    phone: record.profile?.phone ?? null,
    employeeCode: record.profile?.employeeCode ?? null,
    notes: record.profile?.notes ?? null,
    provisionedById: record.provisionedById,
    provisionedByName: record.provisionedBy?.name ?? null,
    territories: mapTerritories(record.territoryAssignments),
  };
}

export async function fetchActiveTerritoryIdsForUsers(
  prisma: Pick<PrismaClient, "userTerritoryAssignment">,
  userId: string,
): Promise<string[]> {
  const rows = await prisma.userTerritoryAssignment.findMany({
    where: { userId, isActive: true },
    select: { territoryId: true },
  });
  return rows.map((row) => row.territoryId);
}
