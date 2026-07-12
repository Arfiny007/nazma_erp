"use client";

import { AuditConsole } from "@/components/audit";
import type { AuditConsoleDTO } from "@/types/audit";

interface AuditPageClientProps {
  initialData: AuditConsoleDTO;
}

export function AuditPageClient({ initialData }: AuditPageClientProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <AuditConsole initialData={initialData} />
    </div>
  );
}
