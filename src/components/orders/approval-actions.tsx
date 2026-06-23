"use client";

import { AlertCircle, Ban, Check, CheckCircle2, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrderStatus, type UserRole } from "@prisma/client";

import { useLanguage } from "@/contexts/LanguageContext";
import { approveOrder } from "@/lib/actions/orders/approve-order";
import { cancelOrder } from "@/lib/actions/orders/cancel-order";
import { rejectOrder } from "@/lib/actions/orders/reject-order";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { OrderDetailDTO } from "@/types/order";

type ActionKind = "approve" | "reject" | "cancel";

interface ApprovalActionsProps {
  order: OrderDetailDTO;
  userRole: UserRole;
}

const CONFIG: Record<
  ActionKind,
  {
    titleKey: string;
    descriptionKey: string;
    confirmKey: string;
    successKey: string;
    withReason: boolean;
    tone: "emerald" | "rose" | "slate";
  }
> = {
  approve: {
    titleKey: "order.approval.approveConfirmTitle",
    descriptionKey: "order.approval.approveConfirmDescription",
    confirmKey: "order.approval.confirmApprove",
    successKey: "order.approval.approveSuccess",
    withReason: false,
    tone: "emerald",
  },
  reject: {
    titleKey: "order.approval.rejectConfirmTitle",
    descriptionKey: "order.approval.rejectConfirmDescription",
    confirmKey: "order.approval.confirmReject",
    successKey: "order.approval.rejectSuccess",
    withReason: true,
    tone: "rose",
  },
  cancel: {
    titleKey: "order.approval.cancelConfirmTitle",
    descriptionKey: "order.approval.cancelConfirmDescription",
    confirmKey: "order.approval.confirmCancel",
    successKey: "order.approval.cancelSuccess",
    withReason: true,
    tone: "slate",
  },
};

export function ApprovalActions({ order, userRole }: ApprovalActionsProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canApprovePerm = hasPermission(userRole, "orders:approve");
  const canModifyPerm = hasPermission(userRole, "orders:edit");

  const showApprove =
    canApprovePerm &&
    (order.status === OrderStatus.Draft ||
      order.status === OrderStatus.Pending_Approval ||
      order.status === OrderStatus.Rejected);
  const showReject =
    canApprovePerm &&
    (order.status === OrderStatus.Draft ||
      order.status === OrderStatus.Pending_Approval);
  const showCancel =
    canModifyPerm &&
    order.status !== OrderStatus.Cancelled &&
    order.status !== OrderStatus.Delivered &&
    order.invoiceCount === 0;

  if (!showApprove && !showReject && !showCancel) {
    return null;
  }

  const closeDialog = () => {
    if (processing) return;
    setActiveAction(null);
    setReason("");
    setError(null);
  };

  const runAction = async () => {
    if (!activeAction) return;
    setProcessing(true);
    setError(null);

    const payload =
      activeAction === "approve"
        ? { id: order.id }
        : { id: order.id, reason: reason.trim() || undefined };

    const result =
      activeAction === "approve"
        ? await approveOrder(payload)
        : activeAction === "reject"
          ? await rejectOrder(payload)
          : await cancelOrder(payload);

    if (result.success) {
      setSuccess(t(CONFIG[activeAction].successKey));
      setProcessing(false);
      setActiveAction(null);
      setReason("");
      router.refresh();
      return;
    }

    setError(t(result.error.messageKey));
    setProcessing(false);
  };

  const config = activeAction ? CONFIG[activeAction] : null;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("order.approval.title")}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {t("order.approval.description")}
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
          {showApprove && (
            <button
              type="button"
              onClick={() => {
                setActiveAction("approve");
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <Check aria-hidden="true" className="size-4" />
              {t("order.approval.approve")}
            </button>
          )}
          {showReject && (
            <button
              type="button"
              onClick={() => {
                setActiveAction("reject");
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-sm font-semibold text-rose-700 shadow-sm transition-colors hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
            >
              <X aria-hidden="true" className="size-4" />
              {t("order.approval.reject")}
            </button>
          )}
          {showCancel && (
            <button
              type="button"
              onClick={() => {
                setActiveAction("cancel");
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Ban aria-hidden="true" className="size-4" />
              {t("order.approval.cancel")}
            </button>
          )}
        </div>
      </div>

      {activeAction && config && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="approval-dialog-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeDialog();
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="px-5 py-4">
              <h3
                id="approval-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                {t(config.titleKey)}
              </h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                {t(config.descriptionKey)}
              </p>

              {config.withReason && (
                <div className="mt-4 flex flex-col gap-1.5">
                  <label
                    htmlFor="approval-reason"
                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t("order.approval.reasonLabel")}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      ({t("order.form.optional")})
                    </span>
                  </label>
                  <textarea
                    id="approval-reason"
                    rows={3}
                    disabled={processing}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={t("order.approval.reasonPlaceholder")}
                    className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              )}

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
                {t("order.approval.dismiss")}
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => void runAction()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                  config.tone === "emerald" && "bg-emerald-600 hover:bg-emerald-700",
                  config.tone === "rose" && "bg-rose-600 hover:bg-rose-700",
                  config.tone === "slate" && "bg-slate-900 hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200",
                )}
              >
                {processing && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                {processing ? t("order.approval.processing") : t(config.confirmKey)}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
