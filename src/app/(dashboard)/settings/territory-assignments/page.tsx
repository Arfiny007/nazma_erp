import { enforcePermission } from "@/lib/rbac/guards";

import { TerritoryAssignmentsPageClient } from "./page-client";

export default async function TerritoryAssignmentsPage() {
  await enforcePermission("settings:view");
  return <TerritoryAssignmentsPageClient />;
}
