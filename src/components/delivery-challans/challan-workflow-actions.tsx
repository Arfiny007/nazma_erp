"use client";

import { AlertCircle, Ban, Check, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { UserRole } from "@prisma/client";

import { useLanguage } from "@/contexts/LanguageContext";
import { cancelDeliveryChallan } from "@/lib/actions/delivery-challans/cancel-delivery-challan";
import { confirmDeliveryChallan } from "@/lib/actions/delivery-challans/confirm-delivery-challan";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { DeliveryChallanDetailDTO } from "@/types/delivery-challan";

interface ChallanWorkflowActionsProps {
  challan: DeliveryChallanDetailDTO;
  userRole: UserRole;
}

type ActionKind = "confirm" | "cancel";

const CONFIG: Record<
  ActionKind,
  {
    titleKey: string;
    descriptionKey: string;
    confirmKey: string;
    successKey: string;
    tone: "emerald" | "rose";
  }
> = {
  confirm: {
    titleKey: "challan.workflow.confirmTitle",
    descriptionKey: "challan.workflow.confirmDescription",
    confirmKey: "challan.workflow.confirmAction",
    successKey: "challan.workflow.confirmSuccess",
    tone: "emerald",
  },
  cancel: {
    titleKey: "challan.workflow.cancelTitle",
    descriptionKey: "challan.workflow.cancelDescription",
    confirmKey: "challan.workflow.cancelAction",
    successKey: "challan.workflow.cancelSuccess",
    tone: "rose",
  },
};

export function ChallanWorkflowActions({
  challan,
  userRole,
}: ChallanWorkflowActionsProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canModify = hasPermission(userRole, "orders:edit");
  const isDraft = challan.status === "Draft";
  const hasItems = challan.itemCount >= 1;

  const showConfirm = canModify && isDraft && hasItems;
  const showCancel = canModify && isDraft;

  if (!showConfirm && !showCancel) {
    return null;
  }

  const closeDialog = () => {
    if (processing) return;
    setActiveAction(null);
    setError(null);
  };

  const runAction = async () => {
    if (!activeAction) return;
    setProcessing(true);
    setError(null);

    const result =
      activeAction === "confirm"
        ? await confirmDeliveryChallan({ id: challan.id })
        : await cancelDeliveryChallan({ id: challan.id });

    if (result.success) {
      setSuccess(t(CONFIG[activeAction].successKey));
      setProcessing(false);
      setActiveAction(null);
      router.refresh();
      return;
    }

    setError(t(result.error.messageKey));
    setProcessing(false);
  };

  const config = activeAction ? CONFIG[activeAction] : null;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm print:hidden dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("challan.workflow.title")}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {t("challan.workflow.description")}
        </p>
      </header>

      <div className="space-y-3 p-5">
        {success && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {showConfirm && (
            <button
              type="button"
              onClick={() => {
                setActiveAction("confirm");
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <Check aria-hidden="true" className="size-4" />
              {t("challan.workflow.confirm")}
            </button>
          )}
          {showCancel && (
            <button
              type="button"
              onClick={() => {
                setActiveAction("cancel");
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-sm font-semibold text-rose-700 shadow-sm transition-colors hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <Ban aria-hidden="true" className="size-4" />
              {t("challan.workflow.cancel")}
            </button>
          )}
        </div>
      </div>

      {activeAction && config && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="challan-workflow-dialog-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeDialog();
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="px-5 py-4">
              <h3
                id="challan-workflow-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                {t(config.titleKey)}
              </h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                {t(config.descriptionKey)}
              </p>

              {error && (
                <p
                  role="alert"
                  className="mt-3 flex items-start gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400"
                >
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span>{error}</span>
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/30">
              <button
                type="button"
                disabled={processing}
                onClick={closeDialog}
                className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t("challan.workflow.dismiss")}
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => void runAction()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                  config.tone === "emerald" && "bg-emerald-600 hover:bg-emerald-700",
                  config.tone === "rose" && "bg-rose-600 hover:bg-rose-700",
                )}
              >
                {processing && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                {processing ? t("challan.workflow.processing") : t(config.confirmKey)}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
