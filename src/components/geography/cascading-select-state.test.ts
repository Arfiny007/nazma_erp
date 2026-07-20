import { describe, expect, it } from "vitest";

import {
  resolveCascadingSelectViewState,
  shouldClearCascadingSelection,
} from "./cascading-select-state";

describe("cascading select derived view state", () => {
  const loaded = {
    items: [{ id: "d1" }, { id: "d2" }],
    loading: true,
    loadError: true,
  };

  it("shows empty non-loading view when parent id is null (initial / cleared)", () => {
    expect(resolveCascadingSelectViewState(null, loaded)).toEqual({
      items: [],
      loading: false,
      loadError: false,
    });
  });

  it("passes through loaded state when parent id is present", () => {
    expect(resolveCascadingSelectViewState("div-1", loaded)).toEqual(loaded);
  });

  it("clears selection only when parent is gone and a value remains", () => {
    expect(shouldClearCascadingSelection(null, "district-1")).toBe(true);
    expect(shouldClearCascadingSelection(null, null)).toBe(false);
    expect(shouldClearCascadingSelection("div-1", "district-1")).toBe(false);
    expect(shouldClearCascadingSelection("div-1", null)).toBe(false);
  });

  it("does not invent items while parent is absent even if cache is stale", () => {
    const stale = {
      items: [{ id: "stale" }],
      loading: false,
      loadError: false,
    };
    expect(resolveCascadingSelectViewState(null, stale).items).toEqual([]);
  });
});
