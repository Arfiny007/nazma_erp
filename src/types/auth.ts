import type { UserRole } from "@prisma/client";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthSession {
  user: AuthUser;
  expires: string;
}

export type { UserRole };
