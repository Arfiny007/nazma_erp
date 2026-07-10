import { enforcePermission } from "@/lib/rbac/guards";

import { GeographyPageClient } from "./page-client";

export default async function GeographySettingsPage() {
  await enforcePermission("settings:view");
  return <GeographyPageClient />;
}
