import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  DEMO_EMAIL_DOMAIN,
  DEMO_PASSWORD,
  DEMO_USER_SPECS,
  SALT_ROUNDS,
} from "./constants";
import type { DemoUserRef } from "./types";

export async function seedDemoUsers(
  prisma: PrismaClient,
): Promise<DemoUserRef[]> {
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
  const users: DemoUserRef[] = [];

  for (const spec of DEMO_USER_SPECS) {
    const row = await prisma.user.upsert({
      where: { email: spec.email },
      update: {
        name: spec.name,
        role: spec.role,
        isActive: true,
        password: hashedPassword,
      },
      create: {
        name: spec.name,
        email: spec.email,
        password: hashedPassword,
        role: spec.role,
        isActive: true,
      },
      select: { id: true, email: true, role: true, name: true },
    });

    users.push(row);
    console.log(`  ✓ ${spec.email}`);
  }

  const srCount = users.filter((user) => user.role === "SR").length;
  console.log(`  ${String(users.length)} demo users (${String(srCount)} SRs)`);

  return users;
}

export function listDemoSrUsers(users: DemoUserRef[]): DemoUserRef[] {
  return users.filter((user) => user.role === "SR");
}

export function isDemoEmail(email: string): boolean {
  return email.endsWith(DEMO_EMAIL_DOMAIN);
}
