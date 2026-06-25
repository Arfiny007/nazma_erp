"use client";

import { CheckCircle2, FileText, Receipt, Truck } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface InvoiceTimelineProps {
  orderNo: string;
  challanNo: string | null;
  invoiceNo: string;
}

const STEPS = [
  { key: "order", icon: FileText },
  { key: "challan", icon: Truck },
  { key: "invoice", icon: Receipt },
  { key: "pdf", icon: FileText },
] as const;

export function InvoiceTimeline({ orderNo, challanNo, invoiceNo }: InvoiceTimelineProps) {
  const { t } = useLanguage();

  const labels: Record<(typeof STEPS)[number]["key"], string> = {
    order: orderNo,
    challan: challanNo ?? "—",
    invoice: invoiceNo,
    pdf: t("invoice.timeline.pdfFuture"),
  };

  return (
    <ol className="flex flex-col gap-0 sm:flex-row sm:items-stretch">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = step.key === "invoice";
        const isFuture = step.key === "pdf";
        const isLast = index === STEPS.length - 1;

        return (
          <li
            key={step.key}
            className={cn(
              "relative flex flex-1 flex-col items-center px-2 py-3 text-center",
              !isLast && "sm:after:absolute sm:after:right-0 sm:after:top-1/2 sm:after:h-px sm:after:w-1/2 sm:after:-translate-y-1/2 sm:after:bg-slate-200 sm:after:content-[''] dark:sm:after:bg-slate-700",
            )}
          >
            <span
              className={cn(
                "mb-2 flex size-9 items-center justify-center rounded-full",
                isActive
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
                  : isFuture
                    ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
              )}
            >
              {isActive ? (
                <CheckCircle2 aria-hidden="true" className="size-4" />
              ) : (
                <Icon aria-hidden="true" className="size-4" />
              )}
            </span>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t(`invoice.timeline.${step.key}`)}
            </p>
            <p
              className={cn(
                "mt-0.5 font-mono text-xs",
                isFuture
                  ? "italic text-slate-400 dark:text-slate-500"
                  : "text-slate-900 dark:text-slate-100",
              )}
            >
              {labels[step.key]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
