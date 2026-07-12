"use server";

import {
  buildAuditContext,
  buildAuditExportPayload,
} from "@/lib/audit";
import { createAuditExcelExport } from "@/lib/audit/export";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult, AuditExportFileDTO, AuditFilters } from "@/types/audit";

import { fail, fromAuditError, ok } from "./helpers";

/**
 * Server-generated audit Excel export — preserves active filters and territory scope.
 */
export async function exportAuditExcel(
  filters: AuditFilters,
): Promise<ActionResult<AuditExportFileDTO>> {
  let user;
  try {
    user = await requirePermission("audit:view");
  } catch {
    return fail<AuditExportFileDTO>("FORBIDDEN", "rbac.noAccess");
  }

  try {
    const context = buildAuditContext(user.id, user.role);
    const payload = await buildAuditExportPayload(context, {
      userId: user.id,
      userName: user.name,
      role: user.role,
    }, filters);
    const file = await createAuditExcelExport(payload);
    return ok(file);
  } catch (error) {
    return fromAuditError(error);
  }
}
