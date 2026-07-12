import type { UserLifecycleStatus } from "@prisma/client";

import { UserLifecycleError } from "./user-errors";

/** Allowed lifecycle transitions by actor capability. */
const SUPER_ADMIN_TRANSITIONS: Readonly<
  Record<UserLifecycleStatus, readonly UserLifecycleStatus[]>
> = {
  INVITED: ["PENDING_ACTIVATION", "ACTIVE", "DISABLED", "ARCHIVED"],
  PENDING_ACTIVATION: ["ACTIVE", "DISABLED", "ARCHIVED"],
  ACTIVE: ["DISABLED", "ARCHIVED"],
  DISABLED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export function isLifecycleActive(status: UserLifecycleStatus): boolean {
  return status === "ACTIVE";
}

export function lifecycleToIsActive(status: UserLifecycleStatus): boolean {
  return isLifecycleActive(status);
}

export function assertLifecycleTransition(
  from: UserLifecycleStatus,
  to: UserLifecycleStatus,
): void {
  if (from === to) {
    return;
  }

  const allowed = SUPER_ADMIN_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new UserLifecycleError(from, to);
  }
}

export function resolveInitialLifecycleStatus(draftOnly: boolean): UserLifecycleStatus {
  return draftOnly ? "INVITED" : "PENDING_ACTIVATION";
}

export function canLoginWithLifecycle(status: UserLifecycleStatus): boolean {
  return status === "ACTIVE";
}
