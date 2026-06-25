import { enforcePermission } from "@/lib/rbac/guards";

import { NewChallanPageClient } from "./page-client";

export default async function NewChallanPage() {
  await enforcePermission("orders:create");
  return <NewChallanPageClient />;
}
