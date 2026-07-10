import { enforcePermission } from "@/lib/rbac/guards";

import { TerritoriesPageClient } from "./page-client";

export default async function TerritoriesSettingsPage() {
  await enforcePermission("settings:view");
  return <TerritoriesPageClient />;
}
