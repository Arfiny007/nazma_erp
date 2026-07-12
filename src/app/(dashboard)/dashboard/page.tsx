import { DashboardPageClient } from "./page-client";
import { enforcePermission } from "@/lib/rbac/guards";

/**
 * Role-aware enterprise dashboard — PHASE_09A.
 * Server resolves auth; client loads role-specific payload via `getDashboard()`.
 */
export default async function DashboardPage() {
  await enforcePermission("dashboard:view");
  return <DashboardPageClient />;
}
