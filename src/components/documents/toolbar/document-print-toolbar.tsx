"use client";

import { Download, Printer, X } from "lucide-react";
import type { ReactNode } from "react";

interface DocumentPrintToolbarProps {
  title: string;
  backLink?: ReactNode;
  onPrint: () => void;
  onDownloadPdf: () => void;
  onClose?: () => void;
  printLabel: string;
  downloadLabel: string;
  closeLabel?: string;
}

/** Shared preview / print route toolbar — not included in print output. */
export function DocumentPrintToolbar({
  title,
  backLink,
  onPrint,
  onDownloadPdf,
  onClose,
  printLabel,
  downloadLabel,
  closeLabel,
}: DocumentPrintToolbarProps) {
  return (
    <div className="no-print flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 items-center gap-3">
        {backLink}
        <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <Printer className="size-4" aria-hidden="true" />
          {printLabel}
        </button>
        <button
          type="button"
          onClick={onDownloadPdf}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
        >
          <Download className="size-4" aria-hidden="true" />
          {downloadLabel}
        </button>
        {onClose && closeLabel ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={closeLabel}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
