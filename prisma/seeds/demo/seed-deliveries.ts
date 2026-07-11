import {
  DeliveryChallanStatus,
  DeliveryMode,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import { DEMO_COUNTS, DEMO_CHALLAN_PREFIX } from "./constants";
import { daysAgo, randomInt } from "./helpers";
import { filterOrdersEligibleForChallan } from "./seed-orders";
import type { DemoChallanRef, DemoOrderRef } from "./types";

export async function seedDemoDeliveries(
  prisma: PrismaClient,
  actorUserId: string,
  orders: DemoOrderRef[],
): Promise<DemoChallanRef[]> {
  const existing = await prisma.deliveryChallan.count({
    where: { challanNo: { startsWith: DEMO_CHALLAN_PREFIX } },
  });

  if (existing >= DEMO_COUNTS.challans) {
    const rows = await prisma.deliveryChallan.findMany({
      where: { challanNo: { startsWith: DEMO_CHALLAN_PREFIX } },
      orderBy: { challanNo: "asc" },
    });

    return rows.map((row) => ({
      id: row.id,
      challanNo: row.challanNo,
      orderId: row.orderId,
      dealerCode: row.dealerCode,
      status: row.status,
    }));
  }

  const eligibleOrders = filterOrdersEligibleForChallan(orders);
  const challans: DemoChallanRef[] = [];
  let sequence = existing;

  for (const order of eligibleOrders) {
    if (sequence >= DEMO_COUNTS.challans) {
      break;
    }

    const orderItems = await prisma.salesOrderItem.findMany({
      where: { orderId: order.id },
      select: { id: true, productId: true, quantity: true },
    });

    if (orderItems.length === 0) {
      continue;
    }

    const challanCount = sequence + 2 <= DEMO_COUNTS.challans && Math.random() > 0.7 ? 2 : 1;

    for (let part = 0; part < challanCount && sequence < DEMO_COUNTS.challans; part += 1) {
      sequence += 1;
      const dispatchedAt = daysAgo(randomInt(1, 90));
      const confirmed = sequence % 5 !== 0;

      const challan = await prisma.deliveryChallan.create({
        data: {
          challanNo: `${DEMO_CHALLAN_PREFIX}${String(sequence).padStart(5, "0")}`,
          orderId: order.id,
          dealerCode: order.dealerCode,
          status: confirmed
            ? DeliveryChallanStatus.Confirmed
            : DeliveryChallanStatus.Draft,
          deliveryMode: DeliveryMode.Truck,
          vehicleNo: `DHK-${String(randomInt(10, 99))}-${String(randomInt(1000, 9999))}`,
          driverName: `Driver ${String(sequence)}`,
          createdById: actorUserId,
          confirmedById: confirmed ? actorUserId : null,
          dispatchedAt: confirmed ? dispatchedAt : null,
          createdAt: dispatchedAt,
          items: {
            create: orderItems.map((item) => ({
              orderItemId: item.id,
              productId: item.productId,
              quantity:
                challanCount === 2 && part === 0
                  ? item.quantity
                      .div(2)
                      .toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN)
                  : item.quantity,
            })),
          },
        },
      });

      challans.push({
        id: challan.id,
        challanNo: challan.challanNo,
        orderId: challan.orderId,
        dealerCode: challan.dealerCode,
        status: challan.status,
      });
    }
  }

  const allChallans = await prisma.deliveryChallan.findMany({
    where: { challanNo: { startsWith: DEMO_CHALLAN_PREFIX } },
    orderBy: { challanNo: "asc" },
  });

  console.log(`  ✓ ${String(allChallans.length)} challans`);

  return allChallans.map((row) => ({
    id: row.id,
    challanNo: row.challanNo,
    orderId: row.orderId,
    dealerCode: row.dealerCode,
    status: row.status,
  }));
}

export function filterConfirmedChallans(challans: DemoChallanRef[]): DemoChallanRef[] {
  return challans.filter((row) => row.status === "Confirmed");
}
