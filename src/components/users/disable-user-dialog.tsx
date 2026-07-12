"use client";

import { useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { disableUser } from "@/lib/actions/users/disable-user";

interface DisableUserDialogProps {
  userId: string | null;
  userName: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DisableUserDialog({
  userId,
  userName,
  open,
  onClose,
  onSuccess,
}: DisableUserDialogProps) {
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !userId) {
    return null;
  }

  async function handleConfirm() {
    if (!userId) return;
    setSubmitting(true);
    setError(null);

    const result = await disableUser({ userId });
    setSubmitting(false);

    if (result.success) {
      onSuccess();
      onClose();
      return;
    }

    setError(t(result.error.messageKey));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="disable-user-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 id="disable-user-title" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {t("userManagement.disable.title")}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {userName
            ? `${t("userManagement.disable.description")} ${userName}`
            : t("userManagement.disable.description")}
        </p>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          >
            {t("common.close")}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {submitting ? t("common.loading") : t("userManagement.disable.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
