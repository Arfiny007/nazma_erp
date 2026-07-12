import { Prisma } from "@prisma/client";

import { COLLECTION_ENTITY_TYPE } from "@/lib/actions/collections/helpers";
import { CHALLAN_ENTITY_TYPE } from "@/lib/actions/delivery-challans/helpers";
import { INVOICE_ENTITY_TYPE } from "@/lib/actions/invoices/helpers";
import { ORDER_ENTITY_TYPE } from "@/lib/actions/orders/helpers";
import { buildTerritoryScope, mergeDealerTerritoryScope } from "@/lib/rbac/territory";
import type { TerritoryScope } from "@/lib/rbac/territory";

import {
  FINANCIAL_AUDIT_ACTIONS,
  INTEGRITY_AUDIT_ACTIONS,
  OPERATIONAL_AUDIT_ACTIONS,
  SECURITY_AUDIT_ACTIONS,
  categoryMatchesRole,
  parseAuditDate,
  resolveAllowedCategories,
} from "./audit-validation";
import type { AuditContext, AuditFilters, AuditRole } from "./audit-types";

const DEALER_ENTITY_TYPE = "Dealer";

export type AuditReadClient = Pick<
  Prisma.TransactionClient,
  | "auditLog"
  | "dealer"
  | "invoice"
  | "collection"
  | "salesOrder"
  | "deliveryChallan"
  | "dealerOwnershipHistory"
  | "user"
  | "territory"
>;

export type AuditLogRow = Prisma.AuditLogGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        role: true;
      };
    };
  };
}>;

const auditInclude = {
  user: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
} as const;

interface ScopedEntityIds {
  dealerCodes: string[];
  invoiceIds: string[];
  collectionIds: string[];
  orderIds: string[];
  challanIds: string[];
}

async function resolveScopedEntityIds(
  context: AuditContext,
  scope: TerritoryScope,
  client: AuditReadClient,
): Promise<ScopedEntityIds | null> {
  if (scope.mode === "ALL") {
    return null;
  }
  if (scope.mode === "NONE") {
    return {
      dealerCodes: [],
      invoiceIds: [],
      collectionIds: [],
      orderIds: [],
      challanIds: [],
    };
  }

  const dealerWhere = mergeDealerTerritoryScope({ isActive: true }, scope);
  let dealers = await client.dealer.findMany({
    where: dealerWhere,
    select: { id: true, dealerCode: true },
  });

  if (context.role === "SR") {
    const assigned = await client.dealerOwnershipHistory.findMany({
      where: {
        isActive: true,
        assignedSrId: context.userId,
        dealerId: { in: dealers.map((row) => row.id) },
      },
      select: { dealerId: true },
    });
    const assignedIds = new Set(assigned.map((row) => row.dealerId));
    dealers = dealers.filter((row) => assignedIds.has(row.id));
  }

  const dealerCodes = dealers.map((row) => row.dealerCode);
  if (dealerCodes.length === 0) {
    return {
      dealerCodes: [],
      invoiceIds: [],
      collectionIds: [],
      orderIds: [],
      challanIds: [],
    };
  }

  const [invoices, collections, orders, challans] = await Promise.all([
    client.invoice.findMany({
      where: { dealerCode: { in: dealerCodes } },
      select: { id: true },
    }),
    client.collection.findMany({
      where: { dealerCode: { in: dealerCodes } },
      select: { id: true },
    }),
    client.salesOrder.findMany({
      where: { dealerCode: { in: dealerCodes } },
      select: { id: true },
    }),
    client.deliveryChallan.findMany({
      where: { dealerCode: { in: dealerCodes } },
      select: { id: true },
    }),
  ]);

  return {
    dealerCodes,
    invoiceIds: invoices.map((row) => row.id),
    collectionIds: collections.map((row) => row.id),
    orderIds: orders.map((row) => row.id),
    challanIds: challans.map((row) => row.id),
  };
}

function buildScopedEntityWhere(ids: ScopedEntityIds): Prisma.AuditLogWhereInput {
  const or: Prisma.AuditLogWhereInput[] = [];

  if (ids.dealerCodes.length > 0) {
    or.push({ entityType: DEALER_ENTITY_TYPE, entityId: { in: ids.dealerCodes } });
  }
  if (ids.invoiceIds.length > 0) {
    or.push({ entityType: INVOICE_ENTITY_TYPE, entityId: { in: ids.invoiceIds } });
  }
  if (ids.collectionIds.length > 0) {
    or.push({
      entityType: COLLECTION_ENTITY_TYPE,
      entityId: { in: ids.collectionIds },
    });
  }
  if (ids.orderIds.length > 0) {
    or.push({ entityType: ORDER_ENTITY_TYPE, entityId: { in: ids.orderIds } });
  }
  if (ids.challanIds.length > 0) {
    or.push({
      entityType: CHALLAN_ENTITY_TYPE,
      entityId: { in: ids.challanIds },
    });
  }

  if (or.length === 0) {
    return { id: { in: [] } };
  }

  return { OR: or };
}

function buildRoleCategoryWhere(role: AuditRole): Prisma.AuditLogWhereInput | null {
  const allowed = resolveAllowedCategories(role);
  if (allowed === "ALL") {
    return null;
  }

  return {
    action: {
      in: [...FINANCIAL_AUDIT_ACTIONS, ...INTEGRITY_AUDIT_ACTIONS],
    },
  };
}

function buildFilterWhere(filters: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.userId) {
    where.userId = filters.userId;
  }
  if (filters.action) {
    where.action = filters.action;
  }
  if (filters.entityType) {
    where.entityType = filters.entityType;
  }
  if (filters.role) {
    where.user = { role: filters.role as Prisma.EnumUserRoleFilter["equals"] };
  }

  const fromDate = parseAuditDate(filters.fromDate);
  const toDate = parseAuditDate(filters.toDate);
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) {
      where.createdAt.gte = fromDate;
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (filters.search) {
    const term = filters.search;
    where.OR = [
      { action: { contains: term, mode: "insensitive" } },
      { entityType: { contains: term, mode: "insensitive" } },
      { entityId: { contains: term, mode: "insensitive" } },
      { user: { name: { contains: term, mode: "insensitive" } } },
      {
        newValue: {
          path: ["dealerCode"],
          string_contains: term,
        },
      },
      {
        newValue: {
          path: ["referenceNo"],
          string_contains: term,
        },
      },
      {
        newValue: {
          path: ["collectionNo"],
          string_contains: term,
        },
      },
      {
        newValue: {
          path: ["invoiceNo"],
          string_contains: term,
        },
      },
    ];
  }

  return where;
}

function mergeWhere(
  ...parts: Array<Prisma.AuditLogWhereInput | null | undefined>
): Prisma.AuditLogWhereInput {
  const and = parts.filter(
    (part): part is Prisma.AuditLogWhereInput =>
      Boolean(part) && Object.keys(part as object).length > 0,
  );
  if (and.length === 0) {
    return {};
  }
  if (and.length === 1) {
    return and[0];
  }
  return { AND: and };
}

export async function buildAuditWhereClause(
  context: AuditContext,
  filters: AuditFilters,
  client: AuditReadClient,
): Promise<Prisma.AuditLogWhereInput> {
  const scope = await buildTerritoryScope(context.userId);
  const scopedIds = await resolveScopedEntityIds(context, scope, client);
  const scopedWhere =
    scopedIds === null ? null : buildScopedEntityWhere(scopedIds);
  const roleCategoryWhere = buildRoleCategoryWhere(context.role);
  const filterWhere = buildFilterWhere(filters);

  return mergeWhere(scopedWhere, roleCategoryWhere, filterWhere);
}

export async function countAuditLogs(
  where: Prisma.AuditLogWhereInput,
  client: AuditReadClient,
): Promise<number> {
  return client.auditLog.count({ where });
}

export async function findAuditLogs(
  where: Prisma.AuditLogWhereInput,
  page: number,
  pageSize: number,
  client: AuditReadClient,
): Promise<AuditLogRow[]> {
  return client.auditLog.findMany({
    where,
    include: auditInclude,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

export async function findAuditLogsForSummary(
  where: Prisma.AuditLogWhereInput,
  client: AuditReadClient,
  limit = 5000,
): Promise<Array<{ action: string; entityType: string }>> {
  return client.auditLog.findMany({
    where,
    select: { action: true, entityType: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function filterRowsForRole<T extends { action: string; entityType: string }>(
  role: AuditRole,
  rows: T[],
): T[] {
  return rows.filter((row) =>
    categoryMatchesRole(role, row.action, row.entityType),
  );
}

export const CATEGORY_ACTION_GROUPS = {
  financial: FINANCIAL_AUDIT_ACTIONS,
  integrity: INTEGRITY_AUDIT_ACTIONS,
  security: SECURITY_AUDIT_ACTIONS,
  operational: OPERATIONAL_AUDIT_ACTIONS,
} as const;
