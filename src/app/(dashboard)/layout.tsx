import type { UserRole } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth/helpers";
import { DashboardShell } from "@/components/layout/dashboard-shell";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const user = await getCurrentUser();

  // Middleware guarantees authentication, so user will always be present here.
  // Fallback to the most restrictive role as a defensive measure.
  const userRole = (user?.role ?? "SR") as UserRole;

  return <DashboardShell userRole={userRole}>{children}</DashboardShell>;
}
