import { enforcePermission } from "@/lib/rbac/guards";

import { DealerOwnershipPageClient } from "./page-client";

export default async function DealerOwnershipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await enforcePermission("dealers:view");
  const { id } = await params;
  return <DealerOwnershipPageClient dealerId={id} />;
}
