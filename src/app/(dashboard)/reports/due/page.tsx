import { enforcePermission } from "@/lib/rbac/guards";

import { DueReportPageClient } from "./page-client";

export default async function DueReportPage() {
  await enforcePermission("reports:view");

  return <DueReportPageClient />;
}
