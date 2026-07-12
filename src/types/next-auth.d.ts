import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      isActive: boolean;
      mustChangePassword: boolean;
    };
  }

  interface User {
    role: UserRole;
    isActive: boolean;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    isActive: boolean;
    mustChangePassword: boolean;
  }
}
