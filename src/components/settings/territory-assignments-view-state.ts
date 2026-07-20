/**
 * When no user is selected, assignment rows are an empty derived view —
 * do not mirror that into React state via an effect.
 */
export function resolveAssignmentsForSelectedUser<T>(
  selectedUserId: string,
  assignments: T[],
): T[] {
  if (!selectedUserId) {
    return [];
  }

  return assignments;
}
