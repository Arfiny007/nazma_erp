import type { PrismaClient } from "@prisma/client";

import { DEMO_EMAIL_DOMAIN, DEMO_MOBILE_PREFIX } from "./constants";

/**
 * Removes all demo-tagged transactional data in FK-safe order.
 * Does not touch base seed (admin@nazma.local, core products, geography).
 */
export async function resetDemoData(prisma: PrismaClient): Promise<void> {
  const demoDealers = await prisma.dealer.findMany({
    where: { mobile: { startsWith: DEMO_MOBILE_PREFIX } },
    select: { id: true, dealerCode: true },
  });
  const dealerCodes = demoDealers.map((row) => row.dealerCode);
  const dealerIds = demoDealers.map((row) => row.id);

  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_DOMAIN } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((row) => row.id);

  if (dealerCodes.length === 0 && demoUserIds.length === 0) {
    await prisma.product.deleteMany({ where: { sku: { startsWith: "DEMO-" } } });
    console.log("  No demo data found — skipped reset");
    return;
  }

  if (dealerCodes.length > 0) {
    const collections = await prisma.collection.findMany({
      where: { dealerCode: { in: dealerCodes } },
      select: { id: true },
    });
    const collectionIds = collections.map((row) => row.id);

    if (collectionIds.length > 0) {
      await prisma.collectionAllocation.deleteMany({
        where: { collectionId: { in: collectionIds } },
      });
      await prisma.auditLog.deleteMany({
        where: {
          entityType: "Collection",
          entityId: { in: collectionIds },
        },
      });
      await prisma.collection.deleteMany({ where: { id: { in: collectionIds } } });
    }

    const invoices = await prisma.invoice.findMany({
      where: { dealerCode: { in: dealerCodes } },
      select: { id: true },
    });
    const invoiceIds = invoices.map((row) => row.id);

    if (invoiceIds.length > 0) {
      await prisma.invoiceItem.deleteMany({
        where: { invoiceId: { in: invoiceIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { entityType: "Invoice", entityId: { in: invoiceIds } },
      });
      await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    }

    const challans = await prisma.deliveryChallan.findMany({
      where: { dealerCode: { in: dealerCodes } },
      select: { id: true },
    });
    const challanIds = challans.map((row) => row.id);

    if (challanIds.length > 0) {
      await prisma.deliveryChallanItem.deleteMany({
        where: { challanId: { in: challanIds } },
      });
      await prisma.deliveryChallan.deleteMany({ where: { id: { in: challanIds } } });
    }

    const orders = await prisma.salesOrder.findMany({
      where: { dealerCode: { in: dealerCodes } },
      select: { id: true },
    });
    const orderIds = orders.map((row) => row.id);

    if (orderIds.length > 0) {
      await prisma.salesOrderItem.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      await prisma.salesOrder.deleteMany({ where: { id: { in: orderIds } } });
    }

    await prisma.openingBalance.deleteMany({
      where: { dealerCode: { in: dealerCodes } },
    });

    await prisma.ledgerEntry.updateMany({
      where: {
        dealerCode: { in: dealerCodes },
        reversesEntryId: { not: null },
      },
      data: { reversesEntryId: null },
    });
    await prisma.ledgerEntry.deleteMany({
      where: { dealerCode: { in: dealerCodes } },
    });

    if (dealerIds.length > 0) {
      await prisma.dealerOwnershipHistory.deleteMany({
        where: { dealerId: { in: dealerIds } },
      });
      await prisma.dealer.deleteMany({ where: { id: { in: dealerIds } } });
    }
  }

  if (demoUserIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { userId: { in: demoUserIds } },
    });
    await prisma.userTerritoryAssignment.deleteMany({
      where: { userId: { in: demoUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: demoUserIds } } });
  }

  await prisma.product.deleteMany({ where: { sku: { startsWith: "DEMO-" } } });

  console.log("  Demo data cleared");
}
