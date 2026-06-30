import { enforcePermission } from "@/lib/rbac/guards";

import { NewCollectionPageClient } from "./page-client";

export default async function NewCollectionPage() {
  await enforcePermission("collections:create");
  return <NewCollectionPageClient />;
}
