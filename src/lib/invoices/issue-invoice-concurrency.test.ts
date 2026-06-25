import {
  DeliveryChallanStatus,
  DeliveryMode,
  OrderStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { executeIssueInvoiceTransaction } from "@/lib/invoices/issue-invoice-transaction";

/**
 * Resolves a test database URL. Use INTEGRATION_DATABASE_URL when the app
 * DATABASE_URL targets the Docker service hostname (`postgres`) from the host.
 */
function resolveIntegrationDatabaseUrl(): string | undefined {
  const explicit = process.env.INTEGRATION_DATABASE_URL;
  if (explicit) {
    return explicit;
  }

  const base = process.env.DATABASE_URL;
  if (!base) {
    return undefined;
  }

  if (base.includes("@postgres:")) {
    return base.replace("@postgres:", "@127.0.0.1:");
  }

  return base;
}

const integrationDatabaseUrl = resolveIntegrationDatabaseUrl();

interface ConcurrencyFixture {
  dealerCode: string;
  challanIds: string[];
  userId: string;
  startingBalance: Prisma.Decimal;
  creditLimit: Prisma.Decimal;
  invoiceAmount: Prisma.Decimal;
}

const testDealerCodes: string[] = [];

async function createConcurrencyFixture(
  prisma: PrismaClient,
  options: {
    suffix: string;
    challanCount: number;
    currentBalance: string;
    creditLimit: string;
    unitPrice: string;
    challanQuantity: string;
  },
): Promise<ConcurrencyFixture> {
  const admin = await prisma.user.findUnique({
    where: { email: "admin@nazma.local" },
    select: { id: true },
  });
  if (!admin) {
    throw new Error("Super Admin seed required — run npm run seed");
  }

  const dealerCode = `CC-${options.suffix}`;
  testDealerCodes.push(dealerCode);

  const category = await prisma.category.create({
    data: {
      name: `Concurrency Cat ${options.suffix}`,
      slug: `concurrency-cat-${options.suffix}`,
      isActive: true,
    },
  });

  const product = await prisma.product.create({
    data: {
      sku: `CC-SKU-${options.suffix}`,
      modelNumber: `CC-MODEL-${options.suffix}`,
      name: `Concurrency Product ${options.suffix}`,
      categoryId: category.id,
      unit: "PCS",
      currentPrice: new Prisma.Decimal(options.unitPrice),
      isActive: true,
    },
  });

  await prisma.dealer.create({
    data: {
      dealerCode,
      companyName: `Concurrency Dealer ${options.suffix}`,
      mobile: "01700000000",
      address: "Test Address",
      district: "Dhaka",
      territory: "Test",
      creditLimit: new Prisma.Decimal(options.creditLimit),
      currentBalance: new Prisma.Decimal(options.currentBalance),
      isActive: true,
    },
  });

  const order = await prisma.salesOrder.create({
    data: {
      orderNo: `CC-ORD-${options.suffix}`,
      dealerCode,
      status: OrderStatus.Approved,
      subtotal: new Prisma.Decimal(options.unitPrice),
      discount: new Prisma.Decimal(0),
      vat: new Prisma.Decimal(0),
      grandTotal: new Prisma.Decimal(options.unitPrice),
      createdById: admin.id,
      items: {
        create: {
          productId: product.id,
          quantity: new Prisma.Decimal("100.00"),
          unitPrice: new Prisma.Decimal(options.unitPrice),
          discount: new Prisma.Decimal(0),
          total: new Prisma.Decimal(options.unitPrice),
        },
      },
    },
    include: { items: true },
  });

  const orderItem = order.items[0];
  const challanIds: string[] = [];

  for (let index = 0; index < options.challanCount; index += 1) {
    const challan = await prisma.deliveryChallan.create({
      data: {
        challanNo: `CC-CHL-${options.suffix}-${index + 1}`,
        orderId: order.id,
        dealerCode,
        status: DeliveryChallanStatus.Confirmed,
        deliveryMode: DeliveryMode.Truck,
        createdById: admin.id,
        confirmedById: admin.id,
        dispatchedAt: new Date(),
        items: {
          create: {
            orderItemId: orderItem.id,
            productId: product.id,
            quantity: new Prisma.Decimal(options.challanQuantity),
          },
        },
      },
    });
    challanIds.push(challan.id);
  }

  const invoiceAmount = new Prisma.Decimal(options.unitPrice).times(
    new Prisma.Decimal(options.challanQuantity),
  );

  return {
    dealerCode,
    challanIds,
    userId: admin.id,
    startingBalance: new Prisma.Decimal(options.currentBalance),
    creditLimit: new Prisma.Decimal(options.creditLimit),
    invoiceAmount,
  };
}

async function cleanupTestDealers(prisma: PrismaClient): Promise<void> {
  if (testDealerCodes.length === 0) {
    return;
  }

  await prisma.invoice.deleteMany({
    where: { dealerCode: { in: testDealerCodes } },
  });
  await prisma.deliveryChallan.deleteMany({
    where: { dealerCode: { in: testDealerCodes } },
  });
  await prisma.salesOrder.deleteMany({
    where: { dealerCode: { in: testDealerCodes } },
  });
  await prisma.dealer.deleteMany({
    where: { dealerCode: { in: testDealerCodes } },
  });
  await prisma.product.deleteMany({
    where: { sku: { startsWith: "CC-SKU-" } },
  });
  await prisma.category.deleteMany({
    where: { slug: { startsWith: "concurrency-cat-" } },
  });

  testDealerCodes.length = 0;
}

describe("issue invoice concurrency", () => {
  let prisma: PrismaClient;
  let integrationReady = false;

  beforeAll(async () => {
    if (!integrationDatabaseUrl) {
      return;
    }

    prisma = new PrismaClient({
      datasources: { db: { url: integrationDatabaseUrl } },
    });

    try {
      await prisma.$queryRaw`SELECT 1`;
      integrationReady = true;
    } catch {
      integrationReady = false;
      await prisma.$disconnect();
    }
  });

  afterEach(async () => {
    if (integrationReady) {
      await cleanupTestDealers(prisma);
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it.skipIf(!integrationReady)(
    "serializes same-dealer concurrent issues with correct previousDue chain and balance",
    async () => {
    const fixture = await createConcurrencyFixture(prisma, {
      suffix: `${Date.now()}-parallel`,
      challanCount: 2,
      currentBalance: "1000.00",
      creditLimit: "50000.00",
      unitPrice: "100.00",
      challanQuantity: "10.00",
    });

    const [firstId, secondId] = await Promise.all([
      prisma.$transaction((tx) =>
        executeIssueInvoiceTransaction(tx, {
          deliveryChallanId: fixture.challanIds[0],
          userId: fixture.userId,
        }),
      ),
      prisma.$transaction((tx) =>
        executeIssueInvoiceTransaction(tx, {
          deliveryChallanId: fixture.challanIds[1],
          userId: fixture.userId,
        }),
      ),
    ]);

    expect(firstId).not.toBe(secondId);

    const invoices = await prisma.invoice.findMany({
      where: { id: { in: [firstId, secondId] } },
      orderBy: { createdAt: "asc" },
    });

    expect(invoices).toHaveLength(2);

    const [first, second] = invoices;
    const expectedFirstPrevious = fixture.startingBalance;
    const expectedFirstCurrent = expectedFirstPrevious.plus(fixture.invoiceAmount);
    const expectedSecondPrevious = expectedFirstCurrent;
    const expectedSecondCurrent = expectedSecondPrevious.plus(fixture.invoiceAmount);
    const expectedFinalBalance = fixture.startingBalance.plus(
      fixture.invoiceAmount.times(2),
    );

    expect(first.previousDue.toFixed(2)).toBe(expectedFirstPrevious.toFixed(2));
    expect(first.currentDue.toFixed(2)).toBe(expectedFirstCurrent.toFixed(2));
    expect(second.previousDue.toFixed(2)).toBe(expectedSecondPrevious.toFixed(2));
    expect(second.currentDue.toFixed(2)).toBe(expectedSecondCurrent.toFixed(2));

    const dealer = await prisma.dealer.findUnique({
      where: { dealerCode: fixture.dealerCode },
      select: { currentBalance: true },
    });
    expect(dealer?.currentBalance.toFixed(2)).toBe(expectedFinalBalance.toFixed(2));
    },
  );

  it.skipIf(!integrationReady)(
    "enforces credit limit after dealer lock when concurrent issues would exceed exposure",
    async () => {
    const fixture = await createConcurrencyFixture(prisma, {
      suffix: `${Date.now()}-credit`,
      challanCount: 2,
      currentBalance: "9000.00",
      creditLimit: "10000.00",
      unitPrice: "100.00",
      challanQuantity: "10.00",
    });

    const results = await Promise.allSettled([
      prisma.$transaction((tx) =>
        executeIssueInvoiceTransaction(tx, {
          deliveryChallanId: fixture.challanIds[0],
          userId: fixture.userId,
        }),
      ),
      prisma.$transaction((tx) =>
        executeIssueInvoiceTransaction(tx, {
          deliveryChallanId: fixture.challanIds[1],
          userId: fixture.userId,
        }),
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejection = rejected[0];
    expect(rejection.status).toBe("rejected");
    if (rejection.status === "rejected") {
      expect(rejection.reason).toMatchObject({ code: "CREDIT_LIMIT_EXCEEDED" });
    }

    const invoiceCount = await prisma.invoice.count({
      where: { dealerCode: fixture.dealerCode },
    });
    expect(invoiceCount).toBe(1);

    const dealer = await prisma.dealer.findUnique({
      where: { dealerCode: fixture.dealerCode },
      select: { currentBalance: true },
    });
    const expectedBalance = fixture.startingBalance.plus(fixture.invoiceAmount);
    expect(dealer?.currentBalance.toFixed(2)).toBe(expectedBalance.toFixed(2));
    },
  );

  it.skipIf(!integrationReady)(
    "returns one invoice per challan on concurrent duplicate submission",
    async () => {
    const fixture = await createConcurrencyFixture(prisma, {
      suffix: `${Date.now()}-dup`,
      challanCount: 1,
      currentBalance: "0.00",
      creditLimit: "50000.00",
      unitPrice: "50.00",
      challanQuantity: "5.00",
    });

    const challanId = fixture.challanIds[0];

    const [firstId, secondId] = await Promise.all([
      prisma.$transaction((tx) =>
        executeIssueInvoiceTransaction(tx, {
          deliveryChallanId: challanId,
          userId: fixture.userId,
        }),
      ),
      prisma.$transaction((tx) =>
        executeIssueInvoiceTransaction(tx, {
          deliveryChallanId: challanId,
          userId: fixture.userId,
        }),
      ),
    ]);

    expect(firstId).toBe(secondId);

    const invoiceCount = await prisma.invoice.count({
      where: { deliveryChallanId: challanId },
    });
    expect(invoiceCount).toBe(1);
    },
  );

  it.skipIf(!integrationReady)(
    "is idempotent on sequential retry for the same challan",
    async () => {
    const fixture = await createConcurrencyFixture(prisma, {
      suffix: `${Date.now()}-retry`,
      challanCount: 1,
      currentBalance: "500.00",
      creditLimit: "50000.00",
      unitPrice: "25.00",
      challanQuantity: "4.00",
    });

    const challanId = fixture.challanIds[0];

    const firstId = await prisma.$transaction((tx) =>
      executeIssueInvoiceTransaction(tx, {
        deliveryChallanId: challanId,
        userId: fixture.userId,
      }),
    );

    const secondId = await prisma.$transaction((tx) =>
      executeIssueInvoiceTransaction(tx, {
        deliveryChallanId: challanId,
        userId: fixture.userId,
      }),
    );

    expect(secondId).toBe(firstId);

    const invoiceCount = await prisma.invoice.count({
      where: { deliveryChallanId: challanId },
    });
    expect(invoiceCount).toBe(1);

    const dealer = await prisma.dealer.findUnique({
      where: { dealerCode: fixture.dealerCode },
      select: { currentBalance: true },
    });
    const expectedBalance = fixture.startingBalance.plus(fixture.invoiceAmount);
    expect(dealer?.currentBalance.toFixed(2)).toBe(expectedBalance.toFixed(2));
    },
  );
});
