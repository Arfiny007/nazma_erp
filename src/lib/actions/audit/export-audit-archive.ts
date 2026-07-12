"use server";

import {
  buildAuditContext,
  buildAuditExportPayload,
} from "@/lib/audit";
import { createAuditArchiveExport } from "@/lib/audit/export";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult, AuditExportFileDTO, AuditFilters } from "@/types/audit";

import { fail, fromAuditError, ok } from "./helpers";

/**
 * Server-generated compliance archive (PDF + Excel + JSON summary).
 */
export async function exportAuditArchive(
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
    const file = await createAuditArchiveExport(payload);
    return ok(file);
  } catch (error) {
    return fromAuditError(error);
  }
}
