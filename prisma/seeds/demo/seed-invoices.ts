import { DeliveryChallanStatus, InvoiceStatus, type PrismaClient } from "@prisma/client";

import { InvoiceActionError } from "@/lib/actions/invoices/helpers";
import { executeIssueInvoiceTransaction } from "@/lib/invoices/issue-invoice-transaction";

import { DEMO_COUNTS } from "./constants";
import { daysAgo, randomInt } from "./helpers";
import { filterConfirmedChallans } from "./seed-deliveries";
import type { DemoChallanRef, DemoInvoiceRef } from "./types";

export async function seedDemoInvoices(
  prisma: PrismaClient,
  actorUserId: string,
  challans: DemoChallanRef[],
): Promise<DemoInvoiceRef[]> {
  const existing = await prisma.invoice.count({
    where: {
      deliveryChallan: { challanNo: { startsWith: "DEMO-CHL-" } },
    },
  });

  if (existing < DEMO_COUNTS.invoices) {
    const confirmed = filterConfirmedChallans(challans);
    let issued = existing;

    for (const challan of confirmed) {
      if (issued >= DEMO_COUNTS.invoices) {
        break;
      }

      const hasInvoice = await prisma.invoice.findUnique({
        where: { deliveryChallanId: challan.id },
        select: { id: true },
      });

      if (hasInvoice) {
        continue;
      }

      const live = await prisma.deliveryChallan.findUnique({
        where: { id: challan.id },
        select: { status: true },
      });

      if (live?.status !== DeliveryChallanStatus.Confirmed) {
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          await executeIssueInvoiceTransaction(tx, {
            deliveryChallanId: challan.id,
            userId: actorUserId,
          });
        });
        issued += 1;
      } catch (error) {
        if (
          error instanceof InvoiceActionError &&
          error.code === "CREDIT_LIMIT_EXCEEDED"
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  const invoices = await loadDemoInvoices(prisma);

  const overdueTargets = invoices.filter((_, index) => index % 4 === 0);
  for (const invoice of overdueTargets) {
    const issueDate = daysAgo(randomInt(45, 120));
    const dueDate = daysAgo(randomInt(10, 40));
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        issueDate,
        dueDate,
        status: InvoiceStatus.Overdue,
      },
    });
  }

  console.log(`  ✓ ${String(invoices.length)} invoices`);

  return loadDemoInvoices(prisma);
}

async function loadDemoInvoices(prisma: PrismaClient): Promise<DemoInvoiceRef[]> {
  const rows = await prisma.invoice.findMany({
    where: {
      deliveryChallan: { challanNo: { startsWith: "DEMO-CHL-" } },
    },
    select: {
      id: true,
      invoiceNo: true,
      dealerCode: true,
      grandTotal: true,
      currentDue: true,
    },
    orderBy: { invoiceNo: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    invoiceNo: row.invoiceNo,
    dealerCode: row.dealerCode,
    grandTotal: row.grandTotal,
    outstanding: row.currentDue,
  }));
}
