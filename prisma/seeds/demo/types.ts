import type { Prisma, UserRole } from "@prisma/client";

export interface DemoTerritoryRef {
  id: string;
  code: string;
  name: string;
  districtCode: string;
  divisionId: string;
  districtId: string;
}

export interface DemoUserRef {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface DemoDealerRef {
  id: string;
  dealerCode: string;
  territoryId: string;
  assignedSrId: string | null;
}

export interface DemoProductRef {
  id: string;
  sku: string;
  currentPrice: Prisma.Decimal;
  unit: string;
}

export interface DemoOrderRef {
  id: string;
  orderNo: string;
  dealerCode: string;
  status: string;
  grandTotal: Prisma.Decimal;
  itemIds: string[];
}

export interface DemoChallanRef {
  id: string;
  challanNo: string;
  orderId: string;
  dealerCode: string;
  status: string;
}

export interface DemoInvoiceRef {
  id: string;
  invoiceNo: string;
  dealerCode: string;
  grandTotal: Prisma.Decimal;
  outstanding: Prisma.Decimal;
}

export interface DemoSeedContext {
  actorUserId: string;
  users: DemoUserRef[];
  territories: DemoTerritoryRef[];
  dealers: DemoDealerRef[];
  products: DemoProductRef[];
  orders: DemoOrderRef[];
  challans: DemoChallanRef[];
  invoices: DemoInvoiceRef[];
}

export interface DemoSeedSummary {
  users: number;
  territories: number;
  dealers: number;
  products: number;
  orders: number;
  challans: number;
  invoices: number;
  collections: number;
  openingBalances: number;
}
