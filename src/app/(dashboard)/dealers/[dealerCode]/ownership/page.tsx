import { enforcePermission } from "@/lib/rbac/guards";

import { DealerOwnershipPageClient } from "./page-client";

export default async function DealerOwnershipPage({
  params,
}: {
  params: Promise<{ dealerCode: string }>;
}) {
  await enforcePermission("dealers:view");
  const { dealerCode } = await params;
  return <DealerOwnershipPageClient dealerCode={dealerCode} />;
}
