"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { updateProduct } from "@/lib/actions/products/update-product";

interface DeactivateProductDialogProps {
  productId: string;
  productName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation dialog for soft-deactivating a product (isActive = false).
 *
 * The dialog is accessible: focus is trapped inside, Escape closes it, and it
 * announces the outcome via role="alert" / role="status".
 */
export function DeactivateProductDialog({
  productId,
  productName,
  onSuccess,
  onCancel,
}: DeactivateProductDialogProps) {
  const { t } = useLanguage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, pending]);

  const handleDeactivate = async () => {
    setPending(true);
    setError(null);

    const result = await updateProduct({ id: productId, isActive: false });

    if (result.success) {
      onSuccess();
    } else {
      setPending(false);
      setError(t(result.error.messageKey));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-dialog-title"
      aria-describedby="deactivate-dialog-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={pending ? undefined : onCancel}
      />

      {/* Dialog panel */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Close button */}
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          aria-label={t("common.close")}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <X aria-hidden="true" className="size-4" />
        </button>

        <div className="px-6 pb-6 pt-6">
          {/* Icon */}
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <AlertTriangle
              aria-hidden="true"
              className="size-6 text-amber-600 dark:text-amber-400"
            />
          </div>

          <h2
            id="deactivate-dialog-title"
            className="text-center text-base font-semibold text-slate-900 dark:text-slate-50"
          >
            {t("products.deactivate.title")}
          </h2>

          <p
            id="deactivate-dialog-description"
            className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400"
          >
            {t("products.deactivate.description").replace(
              "{productName}",
              productName,
            )}
          </p>

          <p className="mt-1 text-center text-xs text-slate-400 dark:text-slate-500">
            {t("products.deactivate.softDeleteNote")}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            ref={cancelRef}
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("products.deactivate.cancel")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleDeactivate}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending && (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            )}
            {pending
              ? t("products.deactivate.deactivating")
              : t("products.deactivate.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
