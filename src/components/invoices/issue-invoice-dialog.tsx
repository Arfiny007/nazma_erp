"use client";

import { AlertCircle, CheckCircle2, Loader2, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { InvoiceFinancialSummary } from "@/components/invoices/invoice-financial-summary";
import { useLanguage } from "@/contexts/LanguageContext";
import { issueInvoice } from "@/lib/actions/invoices/issue-invoice";
import { previewInvoiceFromChallan } from "@/lib/actions/invoices/preview-invoice-from-challan";
import { useFormatMoney } from "@/lib/utils/use-format-money";
import type { InvoicePreviewDTO } from "@/types/invoice";

interface IssueInvoiceDialogProps {
  challanId: string;
  challanNo: string;
  open: boolean;
  onClose: () => void;
}

export function IssueInvoiceDialog({
  challanId,
  challanNo,
  open,
  onClose,
}: IssueInvoiceDialogProps) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const formatMoney = useFormatMoney(locale);

  const [preview, setPreview] = useState<InvoicePreviewDTO | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const closeDialog = () => {
    if (processing) return;
    setPreview(null);
    setError(null);
    setSuccess(false);
    onClose();
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        setPreviewLoading(true);
        setError(null);

        const response = await previewInvoiceFromChallan({ deliveryChallanId: challanId });
        if (cancelled) return;
        if (response.success) {
          setPreview(response.data);
        } else {
          setPreview(null);
          setError(t(response.error.messageKey));
        }
        setPreviewLoading(false);
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, challanId, t]);

  const handleIssue = async () => {
    setProcessing(true);
    setError(null);

    const result = await issueInvoice({ deliveryChallanId: challanId });

    if (result.success) {
      setSuccess(true);
      setProcessing(false);
      router.push(`/invoices/${result.data.id}`);
      return;
    }

    setError(t(result.error.messageKey));
    setProcessing(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("invoice.issue.dismiss")}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={closeDialog}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-invoice-dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") closeDialog();
        }}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
              <Receipt aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2
                id="issue-invoice-dialog-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                {t("invoice.issue.dialogTitle")}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("invoice.issue.dialogSubtitle").replace("{challanNo}", challanNo)}
              </p>
            </div>
          </div>
        </header>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {success ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2
                aria-hidden="true"
                className="mb-3 size-10 text-emerald-500 dark:text-emerald-400"
              />
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {t("invoice.issue.success")}
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200/80 bg-rose-50/50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400"
                >
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <InvoiceFinancialSummary
                preview={preview}
                loading={previewLoading}
                formatMoney={formatMoney}
              />
            </>
          )}
        </div>

        {!success && (
          <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
            <button
              type="button"
              disabled={processing}
              onClick={closeDialog}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t("invoice.issue.dismiss")}
            </button>
            <button
              type="button"
              disabled={processing || previewLoading || !preview}
              onClick={() => void handleIssue()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {processing && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
              {t("invoice.issue.confirm")}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
