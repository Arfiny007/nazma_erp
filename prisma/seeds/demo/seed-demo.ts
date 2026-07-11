import type { PrismaClient } from "@prisma/client";

import { seedAdminUser } from "../admin-user";
import { seedBangladeshGeography } from "../bangladesh-geography";
import { seedProductCategories } from "../product-categories";
import { seedProducts } from "../products";
import { seedTerritories } from "../territories";

import { DEMO_PASSWORD, DEMO_USER_SPECS } from "./constants";
import { resolveActorUserId } from "./helpers";
import { seedDemoDealers } from "./seed-dealers";
import { seedDemoDeliveries } from "./seed-deliveries";
import { seedDemoInvoices } from "./seed-invoices";
import { seedDemoCollections } from "./seed-collections";
import { seedDemoOpeningBalances } from "./seed-opening-balances";
import { seedDemoOrders } from "./seed-orders";
import { seedDemoProducts } from "./seed-products";
import { seedDemoTerritories } from "./seed-territories";
import { seedDemoUsers } from "./seed-users";
import type { DemoSeedContext, DemoSeedSummary } from "./types";

async function ensureBaseSeed(prisma: PrismaClient): Promise<void> {
  const divisionCount = await prisma.division.count();
  if (divisionCount === 0) {
    console.log("\n[Base — Geography]");
    const districtIdByCode = await seedBangladeshGeography(prisma);
    console.log("\n[Base — Territories]");
    await seedTerritories(prisma, districtIdByCode);
  }

  const categoryCount = await prisma.category.count();
  if (categoryCount === 0) {
    console.log("\n[Base — Categories]");
    await seedProductCategories(prisma);
  }

  const productCount = await prisma.product.count();
  if (productCount === 0) {
    console.log("\n[Base — Products]");
    await seedProducts(prisma);
  }

  const adminCount = await prisma.user.count({
    where: { email: "admin@nazma.local" },
  });
  if (adminCount === 0) {
    console.log("\n[Base — Admin]");
    await seedAdminUser(prisma);
  }
}

export async function seedDemo(prisma: PrismaClient): Promise<DemoSeedSummary> {
  console.log("Seeding enterprise demo dataset…\n");

  await ensureBaseSeed(prisma);

  console.log("[Demo Users]");
  const users = await seedDemoUsers(prisma);
  const actorUserId = await resolveActorUserId(prisma);

  console.log("\n[Demo Territories]");
  const territories = await seedDemoTerritories(prisma, users);

  console.log("\n[Demo Dealers]");
  const dealers = await seedDemoDealers(prisma, actorUserId, users, territories);

  console.log("\n[Demo Products]");
  const products = await seedDemoProducts(prisma);

  console.log("\n[Demo Opening Balances]");
  const openingBalances = await seedDemoOpeningBalances(
    prisma,
    actorUserId,
    dealers,
  );

  console.log("\n[Demo Orders]");
  const orders = await seedDemoOrders(prisma, actorUserId, dealers, products);

  console.log("\n[Demo Deliveries]");
  const challans = await seedDemoDeliveries(prisma, actorUserId, orders);

  console.log("\n[Demo Invoices]");
  const invoices = await seedDemoInvoices(prisma, actorUserId, challans);

  console.log("\n[Demo Collections]");
  const collections = await seedDemoCollections(
    prisma,
    actorUserId,
    dealers,
    invoices,
  );

  const summary: DemoSeedSummary = {
    users: users.length,
    territories: territories.length,
    dealers: dealers.length,
    products: products.length,
    orders: orders.length,
    challans: challans.length,
    invoices: invoices.length,
    collections,
    openingBalances,
  };

  printSummary(summary);
  printCredentials();

  return summary;
}

function printSummary(summary: DemoSeedSummary): void {
  console.log("\n── Demo seed summary ──");
  console.log(`  Users:            ${String(summary.users)}`);
  console.log(`  Territories:      ${String(summary.territories)}`);
  console.log(`  Dealers:          ${String(summary.dealers)}`);
  console.log(`  Products:         ${String(summary.products)}`);
  console.log(`  Orders:           ${String(summary.orders)}`);
  console.log(`  Challans:         ${String(summary.challans)}`);
  console.log(`  Invoices:         ${String(summary.invoices)}`);
  console.log(`  Collections:      ${String(summary.collections)}`);
  console.log(`  Opening balances: ${String(summary.openingBalances)}`);
}

function printCredentials(): void {
  console.log("\n── Demo credentials (password for all) ──");
  console.log(`  Password: ${DEMO_PASSWORD}`);
  for (const spec of DEMO_USER_SPECS) {
    if (
      spec.email === "admin@nazma.test" ||
      spec.email === "manager1@nazma.test" ||
      spec.email === "sr1@nazma.test" ||
      spec.email === "accounts1@nazma.test"
    ) {
      console.log(`  ${spec.email}`);
    }
  }
}

export type { DemoSeedContext, DemoSeedSummary };
