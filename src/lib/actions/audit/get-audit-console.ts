"use server";

import { buildAuditContext, getAuditConsoleData } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac/guards";
import type { ActionResult, AuditConsoleDTO, AuditFilters } from "@/types/audit";

import { fail, fromAuditError, ok, toAuditConsoleDTO } from "./helpers";

/**
 * Role-aware audit console entry point — read-only.
 */
export async function getAuditConsole(
  filters: AuditFilters,
): Promise<ActionResult<AuditConsoleDTO>> {
  let user;
  try {
    user = await requirePermission("audit:view");
  } catch {
    return fail<AuditConsoleDTO>("FORBIDDEN", "rbac.noAccess");
  }

  try {
    const context = buildAuditContext(user.id, user.role);
    const payload = await getAuditConsoleData(context, filters);
    return ok(toAuditConsoleDTO(payload));
  } catch (error) {
    return fromAuditError(error);
  }
}
