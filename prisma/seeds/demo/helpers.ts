import type { PrismaClient } from "@prisma/client";

import { DEMO_EMAIL_DOMAIN } from "./constants";

export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(12, 0, 0, 0);
  return date;
}

export function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function pickMany<T>(items: readonly T[], count: number): T[] {
  const copy = [...items];
  const result: T[] = [];
  for (let i = 0; i < count && copy.length > 0; i += 1) {
    const index = Math.floor(Math.random() * copy.length);
    result.push(copy[index]!);
    copy.splice(index, 1);
  }
  return result;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function padIndex(index: number, width = 4): string {
  return String(index).padStart(width, "0");
}

export async function resolveActorUserId(
  prisma: PrismaClient,
): Promise<string> {
  const preferred = await prisma.user.findFirst({
    where: {
      OR: [
        { email: "admin@nazma.local" },
        { email: { endsWith: DEMO_EMAIL_DOMAIN }, role: "Super_Admin" },
      ],
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!preferred) {
    throw new Error(
      "No admin user found — run `npm run seed` before `npm run seed:demo`",
    );
  }

  return preferred.id;
}
