import { getCurrentUser } from "@/lib/auth/helpers";
import { enforcePermission } from "@/lib/rbac/guards";

import { SettingsPageClient } from "./page-client";

export default async function SettingsPage() {
  await enforcePermission("settings:view");
  const actor = await getCurrentUser();
  if (!actor) {
    return null;
  }
  return <SettingsPageClient role={actor.role} />;
}
