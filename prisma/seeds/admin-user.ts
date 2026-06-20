import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

const SUPER_ADMIN = {
  name: "Super Admin",
  email: "admin@nazma.local",
  password: "Admin123!",
  role: "Super_Admin" as const,
  isActive: true,
} as const;

export async function seedAdminUser(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { email: SUPER_ADMIN.email },
    select: { id: true },
  });

  if (existing) {
    console.log(
      `  ✓ Super Admin already exists (${SUPER_ADMIN.email}) — skipping`,
    );
    return;
  }

  const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, SALT_ROUNDS);

  await prisma.user.create({
    data: {
      name: SUPER_ADMIN.name,
      email: SUPER_ADMIN.email,
      password: hashedPassword,
      role: SUPER_ADMIN.role,
      isActive: SUPER_ADMIN.isActive,
    },
  });

  console.log(`  ✓ Super Admin created (${SUPER_ADMIN.email})`);
}
