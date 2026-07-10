import { enforcePermission } from "@/lib/rbac/guards";

import { SettingsPageClient } from "./page-client";

export default async function SettingsPage() {
  await enforcePermission("settings:view");
  return <SettingsPageClient />;
}
