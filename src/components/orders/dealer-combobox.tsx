"use client";

import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { listDealers } from "@/lib/actions/dealers/list-dealers";
import { cn } from "@/lib/utils";
import type { DealerDTO, DealerError } from "@/types/dealer";

/**
 * Why a dealer load failed. We deliberately separate these so the UI can show a
 * meaningful, actionable message instead of masking everything as "empty".
 *
 * - `ACTION_FAILURE`  — the action ran and returned a typed `{ success: false }`
 *   envelope (validation / internal error).
 * - `NETWORK`         — the POST never reached the server (offline, DNS, CORS,
 *   aborted) — a thrown `TypeError: Failed to fetch`.
 * - `PERMISSION`      — middleware/guard rejected the request (redirect to
 *   `/access-denied`).
 * - `SESSION`         — the session expired and the request was redirected to
 *   sign-in.
 * - `STALE_ACTION`    — the client bundle referenced a Server Action id that no
 *   longer exists on the server (typical after a redeploy / Docker rebuild /
 *   HMR). Next throws "Failed to find Server Action … from an older or newer
 *   deployment".
 */
type DealerLoadErrorKind =
  | "ACTION_FAILURE"
  | "NETWORK"
  | "PERMISSION"
  | "SESSION"
  | "STALE_ACTION";

type DealerLoadState =
  | { status: "loading" }
  | { status: "ready"; items: DealerDTO[] }
  | { status: "error"; kind: DealerLoadErrorKind; messageKey: string };

const DEALER_LOAD_ERROR_MESSAGE_KEY: Record<DealerLoadErrorKind, string> = {
  ACTION_FAILURE: "order.form.dealer.error.failed",
  NETWORK: "order.form.dealer.error.network",
  PERMISSION: "order.form.dealer.error.permission",
  SESSION: "order.form.dealer.error.session",
  STALE_ACTION: "order.form.dealer.error.stale",
};

/** Dev-only diagnostics. Produces no output in production builds. */
function logDealerDiagnostic(
  event: string,
  detail: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.warn(`[DealerCombobox] ${event}`, detail);
}

/** Maps a typed action-failure envelope to a load-error classification. */
function classifyActionError(error: DealerError): DealerLoadErrorKind {
  // `listDealers` only emits VALIDATION_ERROR / INTERNAL_ERROR today, but we
  // keep the switch exhaustive-friendly so future codes are handled explicitly.
  switch (error.code) {
    case "VALIDATION_ERROR":
    case "INTERNAL_ERROR":
    default:
      return "ACTION_FAILURE";
  }
}

/**
 * Classifies an error thrown out of the Server Action call. These are transport
 * / framework failures (never the typed `{ success: false }` envelope), so the
 * only signal we have is the message / digest string.
 */
function classifyThrownError(error: unknown): DealerLoadErrorKind {
  const message = error instanceof Error ? error.message : String(error);
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest?: unknown }).digest ?? "")
      : "";
  const combined = `${message} ${digest}`;

  if (/Failed to find Server Action|older or newer deployment/i.test(combined)) {
    return "STALE_ACTION";
  }
  if (/NEXT_REDIRECT/i.test(combined)) {
    if (/access-denied|forbidden|unauthorized/i.test(combined)) {
      return "PERMISSION";
    }
    return "SESSION";
  }
  if (
    error instanceof TypeError ||
    /failed to fetch|networkerror|load failed|fetch/i.test(combined)
  ) {
    return "NETWORK";
  }
  return "ACTION_FAILURE";
}

interface DealerComboboxProps {
  value: DealerDTO | null;
  onChange: (dealer: DealerDTO | null) => void;
  disabled?: boolean;
  hasError?: boolean;
  /** When true an explicit "clear" affordance is offered (e.g. list filter). */
  allowClear?: boolean;
  /** Only return active dealers (orders may only be placed for active dealers). */
  activeOnly?: boolean;
  id?: string;
}

/**
 * Accessible, searchable dealer selector backed by the `listDealers` action.
 * Keyboard friendly: the trigger toggles the popover, Escape closes it, and the
 * search input is auto-focused on open.
 */
export function DealerCombobox({
  value,
  onChange,
  disabled,
  hasError,
  allowClear,
  activeOnly,
  id,
}: DealerComboboxProps) {
  const { t } = useLanguage();
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<DealerLoadState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;

    const handle = window.setTimeout(() => {
      void (async () => {
        setState({ status: "loading" });
        try {
          const response = await listDealers({
            page: 1,
            pageSize: 20,
            search: search.length > 0 ? search : undefined,
            ...(activeOnly ? { isActive: true } : {}),
            sortBy: "companyName",
            sortOrder: "asc",
          });
          if (cancelled) {
            return;
          }

          if (response.success) {
            setState({ status: "ready", items: response.data.items });
            return;
          }

          // Action ran but returned a typed failure — never swallow it as [].
          const kind = classifyActionError(response.error);
          logDealerDiagnostic("listDealers returned a failure envelope", {
            kind,
            code: response.error.code,
            messageKey: response.error.messageKey,
            activeOnly: Boolean(activeOnly),
            search,
          });
          setState({
            status: "error",
            kind,
            messageKey: DEALER_LOAD_ERROR_MESSAGE_KEY[kind],
          });
        } catch (error) {
          if (cancelled) {
            return;
          }

          // Transport / framework failure (network, redirect, stale action).
          const kind = classifyThrownError(error);
          logDealerDiagnostic("listDealers threw before returning", {
            kind,
            error,
            activeOnly: Boolean(activeOnly),
            search,
          });
          setState({
            status: "error",
            kind,
            messageKey: DEALER_LOAD_ERROR_MESSAGE_KEY[kind],
          });
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, search, activeOnly, reloadToken]);

  const handleSelect = (dealer: DealerDTO) => {
    onChange(dealer);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-950",
          hasError
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-600"
            : "border-slate-300 focus:border-slate-400 focus:ring-slate-900/10 dark:border-slate-700 dark:focus:border-slate-600 dark:focus:ring-white/10",
        )}
      >
        {value ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
              {value.dealerCode}
            </span>
            <span className="truncate text-slate-900 dark:text-slate-100">
              {value.companyName}
            </span>
          </span>
        ) : (
          <span className="truncate text-slate-400 dark:text-slate-500">
            {t("order.form.dealer.placeholder")}
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {allowClear && value && (
            <span
              role="button"
              tabIndex={0}
              aria-label={t("order.search.clear")}
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(null);
                }
              }}
              className="rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X aria-hidden="true" className="size-3.5" />
            </span>
          )}
          <ChevronsUpDown
            aria-hidden="true"
            className="size-4 text-slate-400 dark:text-slate-500"
          />
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="relative border-b border-slate-100 p-2 dark:border-slate-800">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("order.form.dealer.search")}
              className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <ul id={listboxId} role="listbox" className="max-h-64 overflow-auto py-1">
            {state.status === "loading" ? (
              <li className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                {t("order.form.dealer.loading")}
              </li>
            ) : state.status === "error" ? (
              <li className="px-3 py-6">
                <div
                  role="alert"
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <AlertTriangle
                    aria-hidden="true"
                    className="size-5 text-rose-500 dark:text-rose-400"
                  />
                  <span className="text-sm font-medium text-rose-600 dark:text-rose-400">
                    {t(state.messageKey)}
                  </span>
                  {state.kind === "STALE_ACTION" ? (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <RefreshCw aria-hidden="true" className="size-3.5" />
                      {t("order.form.dealer.error.refresh")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={retry}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <RefreshCw aria-hidden="true" className="size-3.5" />
                      {t("order.form.dealer.error.retry")}
                    </button>
                  )}
                </div>
              </li>
            ) : state.items.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {t("order.form.dealer.empty")}
              </li>
            ) : (
              state.items.map((dealer) => {
                const selected = dealer.dealerCode === value?.dealerCode;
                return (
                  <li key={dealer.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => handleSelect(dealer)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60",
                        selected && "bg-slate-50 dark:bg-slate-800/60",
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {dealer.companyName}
                        </span>
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          {dealer.dealerCode}
                        </span>
                      </span>
                      {selected && (
                        <Check
                          aria-hidden="true"
                          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
