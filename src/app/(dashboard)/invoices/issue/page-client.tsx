"use client";

import { AlertCircle, ArrowLeft, Loader2, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { EligibleChallanCombobox } from "@/components/invoices/eligible-challan-combobox";
import { InvoiceFinancialSummary } from "@/components/invoices/invoice-financial-summary";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";
import { issueInvoice } from "@/lib/actions/invoices/issue-invoice";
import { listInvoiceEligibleChallans } from "@/lib/actions/invoices/list-invoice-eligible-challans";
import { previewInvoiceFromChallan } from "@/lib/actions/invoices/preview-invoice-from-challan";
import { useFormatMoney } from "@/lib/utils/use-format-money";
import type { InvoiceEligibleChallanDTO, InvoicePreviewDTO } from "@/types/invoice";

export function IssueInvoicePageClient() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formatMoney = useFormatMoney(locale);

  const [selectedChallan, setSelectedChallan] = useState<InvoiceEligibleChallanDTO | null>(
    null,
  );
  const [preview, setPreview] = useState<InvoicePreviewDTO | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const challanId = searchParams.get("challanId");
    if (!challanId) return;

    let cancelled = false;
    void (async () => {
      const response = await listInvoiceEligibleChallans({ limit: 50 });
      if (cancelled || !response.success) return;
      const match = response.data.find((challan) => challan.id === challanId);
      if (match) {
        setSelectedChallan(match);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!selectedChallan) return;

    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        setPreviewLoading(true);
        setError(null);

        const response = await previewInvoiceFromChallan({
          deliveryChallanId: selectedChallan.id,
        });
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
  }, [selectedChallan, t]);

  const handleChallanChange = (challan: InvoiceEligibleChallanDTO | null) => {
    setSelectedChallan(challan);
    if (!challan) {
      setPreview(null);
      setError(null);
    }
  };

  const handleIssue = async () => {
    if (!selectedChallan) return;
    setProcessing(true);
    setError(null);

    const result = await issueInvoice({ deliveryChallanId: selectedChallan.id });

    if (result.success) {
      router.push(`/invoices/${result.data.id}`);
      return;
    }

    setError(t(result.error.messageKey));
    setProcessing(false);
  };

  return (
    <PageContainer
      title={t("invoice.issue.title")}
      description={t("invoice.issue.subtitle")}
      actions={
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("invoice.actions.backToList")}
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <section className="overflow-visible rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("invoice.issue.selectChallanTitle")}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("invoice.issue.selectChallanDescription")}
              </p>
            </header>
            <div className="p-5">
              <EligibleChallanCombobox
                value={selectedChallan}
                onChange={handleChallanChange}
                disabled={processing}
              />
            </div>
          </section>

          {preview && preview.lines.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t("invoice.issue.linePreview")}
                </h2>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
                      <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("invoice.detail.column.product")}
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("invoice.detail.column.quantity")}
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("invoice.detail.column.lineTotal")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {preview.lines.map((line) => (
                      <tr key={`${line.productCode}-${line.quantity}`}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {line.productName}
                          </p>
                          <p className="text-xs text-slate-500">{line.productCode}</p>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {line.quantity} {line.unit}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-medium">
                          {formatMoney(line.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200/80 bg-rose-50/50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <InvoiceFinancialSummary
            preview={preview}
            loading={previewLoading}
            formatMoney={formatMoney}
          />
          <button
            type="button"
            disabled={processing || previewLoading || !preview}
            onClick={() => void handleIssue()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {processing ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Receipt aria-hidden="true" className="size-4" />
            )}
            {t("invoice.issue.confirm")}
          </button>
        </div>
      </div>
    </PageContainer>
  );
}
