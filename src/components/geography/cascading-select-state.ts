/**
 * Derived view-state for parent-dependent geography selects.
 * When the parent id is cleared, options/loading/error must not be
 * synchronized through a mount effect — derive the empty view instead.
 */
export interface CascadingSelectLoadedState<T> {
  items: T[];
  loading: boolean;
  loadError: boolean;
}

export function resolveCascadingSelectViewState<T>(
  parentId: string | null,
  loaded: CascadingSelectLoadedState<T>,
): CascadingSelectLoadedState<T> {
  if (!parentId) {
    return { items: [], loading: false, loadError: false };
  }

  return {
    items: loaded.items,
    loading: loaded.loading,
    loadError: loaded.loadError,
  };
}

/** Parent identity change should clear the controlled child selection. */
export function shouldClearCascadingSelection(
  parentId: string | null,
  selectedValue: string | null,
): boolean {
  return !parentId && selectedValue !== null;
}
