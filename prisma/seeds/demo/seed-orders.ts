import { OrderStatus, Prisma, type PrismaClient } from "@prisma/client";

import { DEMO_COUNTS, DEMO_ORDER_PREFIX } from "./constants";
import { daysAgo, pickMany, pickOne, randomInt } from "./helpers";
import type { DemoDealerRef, DemoOrderRef, DemoProductRef } from "./types";

const STATUS_WEIGHTS: Array<{ status: OrderStatus; weight: number }> = [
  { status: OrderStatus.Draft, weight: 25 },
  { status: OrderStatus.Pending_Approval, weight: 15 },
  { status: OrderStatus.Approved, weight: 35 },
  { status: OrderStatus.Partially_Delivered, weight: 10 },
  { status: OrderStatus.Delivered, weight: 10 },
  { status: OrderStatus.Rejected, weight: 3 },
  { status: OrderStatus.Cancelled, weight: 2 },
];

function pickOrderStatus(): OrderStatus {
  const total = STATUS_WEIGHTS.reduce((sum, row) => sum + row.weight, 0);
  let roll = Math.random() * total;
  for (const entry of STATUS_WEIGHTS) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.status;
    }
  }
  return OrderStatus.Approved;
}

export async function seedDemoOrders(
  prisma: PrismaClient,
  actorUserId: string,
  dealers: DemoDealerRef[],
  products: DemoProductRef[],
): Promise<DemoOrderRef[]> {
  const existing = await prisma.salesOrder.count({
    where: { orderNo: { startsWith: DEMO_ORDER_PREFIX } },
  });

  if (existing >= DEMO_COUNTS.orders) {
    const rows = await prisma.salesOrder.findMany({
      where: { orderNo: { startsWith: DEMO_ORDER_PREFIX } },
      include: { items: { select: { id: true } } },
      orderBy: { orderNo: "asc" },
    });

    return rows.map((row) => ({
      id: row.id,
      orderNo: row.orderNo,
      dealerCode: row.dealerCode,
      status: row.status,
      grandTotal: row.grandTotal,
      itemIds: row.items.map((item) => item.id),
    }));
  }

  const orders: DemoOrderRef[] = [];
  const toCreate = DEMO_COUNTS.orders - existing;

  for (let index = 0; index < toCreate; index += 1) {
    const sequence = existing + index + 1;
    const dealer = pickOne(dealers);
    const lineProducts = pickMany(products, randomInt(1, 3));
    const status = pickOrderStatus();
    const createdAt = daysAgo(randomInt(1, 120));

    let subtotal = new Prisma.Decimal(0);
    const itemCreates: Array<{
      productId: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      discount: Prisma.Decimal;
      total: Prisma.Decimal;
    }> = [];

    for (const product of lineProducts) {
      const quantity = new Prisma.Decimal(randomInt(5, 40));
      const unitPrice = product.currentPrice;
      const discount = new Prisma.Decimal(0);
      const total = unitPrice.mul(quantity);
      subtotal = subtotal.plus(total);
      itemCreates.push({
        productId: product.id,
        quantity,
        unitPrice,
        discount,
        total,
      });
    }

    const discount = new Prisma.Decimal(0);
    const vat = new Prisma.Decimal(0);
    const grandTotal = subtotal;

    const approved =
      status === OrderStatus.Approved ||
      status === OrderStatus.Partially_Delivered ||
      status === OrderStatus.Delivered;

    const order = await prisma.salesOrder.create({
      data: {
        orderNo: `${DEMO_ORDER_PREFIX}${String(sequence).padStart(5, "0")}`,
        dealerCode: dealer.dealerCode,
        status,
        subtotal,
        discount,
        vat,
        grandTotal,
        createdById: actorUserId,
        approvedById: approved ? actorUserId : null,
        approvedAt: approved ? createdAt : null,
        createdAt,
        items: { create: itemCreates },
      },
      include: { items: { select: { id: true } } },
    });

    orders.push({
      id: order.id,
      orderNo: order.orderNo,
      dealerCode: order.dealerCode,
      status: order.status,
      grandTotal: order.grandTotal,
      itemIds: order.items.map((item) => item.id),
    });
  }

  const allOrders = await prisma.salesOrder.findMany({
    where: { orderNo: { startsWith: DEMO_ORDER_PREFIX } },
    include: { items: { select: { id: true } } },
    orderBy: { orderNo: "asc" },
  });

  console.log(`  ✓ ${String(allOrders.length)} orders`);

  return allOrders.map((row) => ({
    id: row.id,
    orderNo: row.orderNo,
    dealerCode: row.dealerCode,
    status: row.status,
    grandTotal: row.grandTotal,
    itemIds: row.items.map((item) => item.id),
  }));
}

export function filterOrdersEligibleForChallan(orders: DemoOrderRef[]): DemoOrderRef[] {
  return orders.filter(
    (order) =>
      order.status === OrderStatus.Approved ||
      order.status === OrderStatus.Partially_Delivered ||
      order.status === OrderStatus.Delivered,
  );
}
