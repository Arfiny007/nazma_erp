"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { runFinancialIntegrityScanAction } from "@/lib/actions/ledger-monitor/run-financial-integrity-scan";
import { cn } from "@/lib/utils";

type ScanFeedbackState = "idle" | "loading" | "success" | "failure";

export function IntegrityScanControls() {
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ScanFeedbackState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  function handleRunScan() {
    setFeedback("loading");
    setMessage(null);

    startTransition(async () => {
      const result = await runFinancialIntegrityScanAction();
      if (!result.success) {
        setFeedback("failure");
        setMessage(t("integrityConsole.scan.failure"));
        return;
      }

      setFeedback("success");
      setMessage(t("integrityConsole.scan.success"));
      window.location.reload();
    });
  }

  const loading = isPending || feedback === "loading";

  return (
    <section
      aria-label={t("integrityConsole.scan.sectionLabel")}
      className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t("integrityConsole.scan.title")}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("integrityConsole.scan.description")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
          )}
          disabled={loading}
          onClick={handleRunScan}
          type="button"
        >
          {loading ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {loading
            ? t("integrityConsole.scan.running")
            : t("integrityConsole.scan.run")}
        </button>

        {feedback === "success" && message ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
            {message}
          </p>
        ) : null}
        {feedback === "failure" && message ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
