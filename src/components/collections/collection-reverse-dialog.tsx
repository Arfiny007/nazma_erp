"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import type { UserRole } from "@prisma/client";
import { CollectionStatus } from "@prisma/client";

import { useLanguage } from "@/contexts/LanguageContext";
import { reverseCollection } from "@/lib/actions/collections/reverse-collection";
import { hasPermission } from "@/lib/permissions";

interface CollectionReverseDialogProps {
  collectionId: string;
  collectionNo: string;
  userRole: UserRole;
  open: boolean;
  onClose: () => void;
  onReversed: () => void;
}

export function CollectionReverseDialog({
  collectionId,
  collectionNo,
  userRole,
  open,
  onClose,
  onReversed,
}: CollectionReverseDialogProps) {
  const { t } = useLanguage();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReverse = hasPermission(userRole, "collections:edit");

  if (!open || !canReverse) {
    return null;
  }

  const handleSubmit = async () => {
    if (reason.trim().length === 0) {
      setError(t("collection.reverse.reasonRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await reverseCollection({
      id: collectionId,
      reversalReason: reason.trim(),
    });

    setSubmitting(false);

    if (result.success) {
      setReason("");
      onReversed();
      onClose();
      return;
    }

    setError(t(result.error.messageKey));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reverse-collection-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2
            id="reverse-collection-title"
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            {t("collection.reverse.title")}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t("collection.reverse.subtitle").replace("{collectionNo}", collectionNo)}
          </p>
        </header>

        <div className="space-y-4 p-5">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>{t("collection.reverse.warning")}</p>
          </div>

          <div>
            <label
              htmlFor="reversal-reason"
              className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              {t("collection.reverse.reasonLabel")}
            </label>
            <textarea
              id="reversal-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {t("collection.actions.cancel")}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
          >
            {submitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            {t("collection.actions.reverse")}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function canReverseCollection(status: CollectionStatus): boolean {
  return (
    status === CollectionStatus.Confirmed ||
    status === CollectionStatus.PartiallyAllocated ||
    status === CollectionStatus.Allocated
  );
}

export function canAllocateCollection(
  status: CollectionStatus,
  unallocatedAmount: string,
): boolean {
  if (status === CollectionStatus.Reversed || status === CollectionStatus.Draft) {
    return false;
  }
  return Number.parseFloat(unallocatedAmount) > 0;
}
