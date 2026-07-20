import { afterEach, describe, expect, it, vi } from "vitest";

import { LOCALE_STORAGE_KEY } from "@/lib/i18n/locale-cookie";
import {
  LOCALE_CHANGE_EVENT,
  readStoredLocale,
  resolveClientLocale,
  syncLocaleExternalStore,
  writeLocalePreference,
} from "@/lib/i18n/locale-store";

describe("locale store (LanguageProvider external sync)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubWindow(storage: Record<string, string>): {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    dispatchEvent: ReturnType<typeof vi.fn>;
  } {
    const getItem = vi.fn((key: string) => storage[key] ?? null);
    const setItem = vi.fn((key: string, value: string) => {
      storage[key] = value;
    });
    const dispatchEvent = vi.fn();

    vi.stubGlobal("window", {
      localStorage: { getItem, setItem },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent,
    });
    vi.stubGlobal("document", {
      cookie: "",
    });

    return { getItem, setItem, dispatchEvent };
  }

  it("resolves initial locale when storage is empty", () => {
    stubWindow({});
    expect(resolveClientLocale("en")).toBe("en");
    expect(readStoredLocale()).toBeNull();
  });

  it("prefers stored locale over cookie-derived initial", () => {
    stubWindow({ [LOCALE_STORAGE_KEY]: "bn" });
    expect(resolveClientLocale("en")).toBe("bn");
  });

  it("ignores invalid stored values", () => {
    stubWindow({ [LOCALE_STORAGE_KEY]: "fr" });
    expect(resolveClientLocale("en")).toBe("en");
    expect(readStoredLocale()).toBeNull();
  });

  it("writeLocalePreference updates storage and notifies subscribers", () => {
    const { setItem, dispatchEvent } = stubWindow({});
    writeLocalePreference("bn");
    expect(setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, "bn");
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: LOCALE_CHANGE_EVENT }),
    );
  });

  it("syncLocaleExternalStore seeds empty storage without inventing React state", () => {
    const { setItem } = stubWindow({});
    syncLocaleExternalStore("bn");
    expect(setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, "bn");
  });

  it("syncLocaleExternalStore does not overwrite a valid stored locale", () => {
    const { setItem } = stubWindow({ [LOCALE_STORAGE_KEY]: "en" });
    syncLocaleExternalStore("bn");
    expect(setItem).not.toHaveBeenCalled();
  });
});
