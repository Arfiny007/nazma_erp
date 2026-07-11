import {
  CollectionPaymentMethod,
  CollectionStatus,
  FinancialReferenceType,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import {
  executeAllocateCollectionTransaction,
  executeConfirmCollectionTransaction,
} from "@/lib/collections/allocation-engine";
import { CollectionWorkflowError } from "@/lib/collections/workflow";
import { generateNextCollectionNo } from "@/lib/utils/collection-number";

import { DEMO_COUNTS, DEMO_MOBILE_PREFIX } from "./constants";
import { daysAgo, pickOne, randomInt } from "./helpers";
import type { DemoDealerRef, DemoInvoiceRef } from "./types";

const PAYMENT_METHODS = [
  CollectionPaymentMethod.Cash,
  CollectionPaymentMethod.Bank,
  CollectionPaymentMethod.MobileBanking,
  CollectionPaymentMethod.Cheque,
] as const;

export async function seedDemoCollections(
  prisma: PrismaClient,
  actorUserId: string,
  dealers: DemoDealerRef[],
  invoices: DemoInvoiceRef[],
): Promise<number> {
  const existing = await prisma.collection.count({
    where: { dealer: { mobile: { startsWith: DEMO_MOBILE_PREFIX } } },
  });

  if (existing >= DEMO_COUNTS.collections) {
    return existing;
  }

  const invoicesByDealer = groupInvoicesByDealer(invoices);
  let created = existing;

  while (created < DEMO_COUNTS.collections) {
    const dealer = pickOne(dealers);
    const dealerInvoices = invoicesByDealer.get(dealer.dealerCode) ?? [];

    const mode = created % 7;
    const collectionDate = daysAgo(randomInt(1, 60));
    const paymentMethod = pickOne(PAYMENT_METHODS);

    let receivedAmount: Prisma.Decimal;
    let allocations: Array<{
      referenceType: FinancialReferenceType;
      referenceId: string;
      allocatedAmount: Prisma.Decimal;
      allocationOrder: number;
    }> = [];

    if (mode === 0 || dealerInvoices.length === 0) {
      receivedAmount = new Prisma.Decimal(randomInt(5_000, 25_000));
    } else if (mode === 1 || mode === 2) {
      const invoice = pickOne(dealerInvoices);
      const live = await prisma.invoice.findUnique({
        where: { id: invoice.id },
        select: { currentDue: true, status: true },
      });

      if (!live || live.currentDue.lessThanOrEqualTo(0)) {
        receivedAmount = new Prisma.Decimal(randomInt(5_000, 20_000));
      } else if (mode === 1) {
        receivedAmount = live.currentDue;
        allocations = [
          {
            referenceType: FinancialReferenceType.Invoice,
            referenceId: invoice.id,
            allocatedAmount: live.currentDue,
            allocationOrder: 1,
          },
        ];
      } else {
        const partial = live.currentDue
          .mul(0.45)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        receivedAmount = partial.greaterThan(0) ? partial : live.currentDue;
        allocations = [
          {
            referenceType: FinancialReferenceType.Invoice,
            referenceId: invoice.id,
            allocatedAmount: receivedAmount,
            allocationOrder: 1,
          },
        ];
      }
    } else {
      const invoice = pickOne(dealerInvoices);
      const live = await prisma.invoice.findUnique({
        where: { id: invoice.id },
        select: { currentDue: true },
      });
      const outstanding = live?.currentDue ?? new Prisma.Decimal(0);
      const advance = new Prisma.Decimal(randomInt(3_000, 12_000));
      receivedAmount = outstanding.greaterThan(0)
        ? outstanding.plus(advance)
        : advance;

      if (outstanding.greaterThan(0)) {
        allocations = [
          {
            referenceType: FinancialReferenceType.Invoice,
            referenceId: invoice.id,
            allocatedAmount: outstanding,
            allocationOrder: 1,
          },
        ];
      }
    }

    try {
      const collectionId = await prisma.$transaction(async (tx) => {
        const collectionNo = await generateNextCollectionNo(tx);

        const collection = await tx.collection.create({
          data: {
            collectionNo,
            dealerCode: dealer.dealerCode,
            collectionDate,
            paymentMethod,
            referenceNumber:
              paymentMethod === CollectionPaymentMethod.Cheque
                ? `CHQ-${String(created + 1).padStart(5, "0")}`
                : null,
            receivedAmount,
            allocatedAmount: new Prisma.Decimal(0),
            unallocatedAmount: receivedAmount,
            status: CollectionStatus.Draft,
            isAdvancePayment: allocations.length === 0,
            createdById: actorUserId,
          },
          select: { id: true },
        });

        await executeConfirmCollectionTransaction(tx, {
          collectionId: collection.id,
          userId: actorUserId,
        });

        if (allocations.length > 0) {
          const allocation = allocations[0]!;
          const invoice = await tx.invoice.findUnique({
            where: { id: allocation.referenceId },
            select: { currentDue: true },
          });
          const outstanding = invoice?.currentDue ?? new Prisma.Decimal(0);

          if (outstanding.greaterThan(0)) {
            const applicable = Prisma.Decimal.min(
              allocation.allocatedAmount,
              outstanding,
              receivedAmount,
            );

            if (applicable.greaterThan(0)) {
              await executeAllocateCollectionTransaction(tx, {
                collectionId: collection.id,
                userId: actorUserId,
                allocations: [
                  {
                    ...allocation,
                    allocatedAmount: applicable,
                  },
                ],
              });
            }
          }
        }

        return collection.id;
      });

      if (!collectionId) {
        break;
      }

      created += 1;
    } catch (error) {
      if (error instanceof CollectionWorkflowError) {
        continue;
      }
      throw error;
    }
  }

  console.log(`  ✓ ${String(created)} collections`);
  return created;
}

function groupInvoicesByDealer(
  invoices: DemoInvoiceRef[],
): Map<string, DemoInvoiceRef[]> {
  const map = new Map<string, DemoInvoiceRef[]>();

  for (const invoice of invoices) {
    const bucket = map.get(invoice.dealerCode) ?? [];
    bucket.push(invoice);
    map.set(invoice.dealerCode, bucket);
  }

  return map;
}
