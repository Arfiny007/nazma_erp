import { getAuditConsole } from "@/lib/actions/audit";
import { enforcePermission } from "@/lib/rbac/guards";

import { AuditPageClient } from "./page-client";

export default async function AuditPage() {
  await enforcePermission("audit:view");

  const result = await getAuditConsole({ page: 1, pageSize: 25 });

  if (!result.success) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm text-red-600">{result.error.messageKey}</p>
      </div>
    );
  }

  return <AuditPageClient initialData={result.data} />;
}
