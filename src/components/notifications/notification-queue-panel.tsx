"use client";

import { Activity, Pause, Play, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useState, useTransition } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  getNotificationMetricsAction,
  processNotificationQueue,
  retryFailedNotificationsAction,
  setNotificationQueuePaused,
} from "@/lib/actions/notifications";
import { hasPermission } from "@/lib/permissions";
import type { AuthUser } from "@/types/auth";
import type { NotificationMetricsDTO } from "@/lib/actions/notifications/get-notification-metrics";

interface NotificationQueuePanelProps {
  actor: AuthUser;
  initialMetrics: NotificationMetricsDTO;
}

function formatDurationMs(ms: number | null, t: (key: string) => string): string {
  if (ms === null || !Number.isFinite(ms)) {
    return t("notifications.queue.health.avgDeliveryUnknown");
  }
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)} s`;
  }
  return `${(ms / 60_000).toFixed(1)} min`;
}

function formatTimestamp(iso: string | null, t: (key: string) => string): string {
  if (!iso) {
    return t("notifications.queue.health.lastRunNever");
  }
  return new Date(iso).toLocaleString();
}

export function NotificationQueuePanel({
  actor,
  initialMetrics,
}: NotificationQueuePanelProps) {
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [messageKey, setMessageKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canManage = hasPermission(actor.role, "notifications:manage");

  const refreshMetrics = useCallback(() => {
    startTransition(async () => {
      const result = await getNotificationMetricsAction();
      if (result.success) {
        setMetrics(result.data);
      }
    });
  }, []);

  const handleProcessQueue = () => {
    startTransition(async () => {
      const result = await processNotificationQueue();
      if (!result.success) {
        setMessageKey(result.error.messageKey);
        return;
      }
      setMessageKey(
        result.data.paused
          ? "notifications.queue.message.paused"
          : "notifications.queue.message.processed",
      );
      refreshMetrics();
    });
  };

  const handleRetryFailed = () => {
    startTransition(async () => {
      const result = await retryFailedNotificationsAction();
      if (!result.success) {
        setMessageKey(result.error.messageKey);
        return;
      }
      setMessageKey("notifications.queue.message.retried");
      refreshMetrics();
    });
  };

  const handleTogglePause = () => {
    startTransition(async () => {
      const result = await setNotificationQueuePaused(!metrics.paused);
      if (!result.success) {
        setMessageKey(result.error.messageKey);
        return;
      }
      setMessageKey(
        result.data.paused
          ? "notifications.queue.message.pauseEnabled"
          : "notifications.queue.message.pauseDisabled",
      );
      refreshMetrics();
    });
  };

  const providerHealthy = metrics.provider.healthy;
  const providerLabel =
    metrics.provider.provider === "smtp"
      ? t("notifications.queue.health.providerSmtp")
      : t("notifications.queue.health.providerConsole");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="size-5 text-slate-500" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("notifications.queue.title")}
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ["pending", metrics.queue.pending],
            ["processing", metrics.queue.processing],
            ["sent", metrics.queue.sent],
            ["failed", metrics.queue.failed],
            ["retry", metrics.queue.retryScheduled],
          ] as const
        ).map(([key, value]) => (
          <div
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            key={key}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t(`notifications.queue.metrics.${key}`)}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("notifications.queue.health.title")}
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t("notifications.queue.health.provider")}</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{providerLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t("notifications.queue.health.status")}</dt>
              <dd>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    providerHealthy
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {providerHealthy
                    ? t("notifications.queue.health.statusHealthy")
                    : t("notifications.queue.health.statusDegraded")}
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t("notifications.queue.health.lastRun")}</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
                {formatTimestamp(metrics.lastProcessedAt, t)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t("notifications.queue.health.avgDelivery")}</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {formatDurationMs(metrics.averageDeliveryTimeMs, t)}
              </dd>
            </div>
            {metrics.provider.error ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {metrics.provider.error}
              </p>
            ) : null}
          </dl>
        </div>

        {canManage ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("notifications.queue.controls.title")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {t("notifications.queue.controls.subtitle")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                disabled={isPending || metrics.paused}
                onClick={handleProcessQueue}
                type="button"
              >
                <Play className="size-4" />
                {t("notifications.queue.controls.process")}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
                disabled={isPending}
                onClick={handleRetryFailed}
                type="button"
              >
                <RotateCcw className="size-4" />
                {t("notifications.queue.controls.retryFailed")}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
                disabled={isPending}
                onClick={handleTogglePause}
                type="button"
              >
                {metrics.paused ? (
                  <>
                    <Play className="size-4" />
                    {t("notifications.queue.controls.resume")}
                  </>
                ) : (
                  <>
                    <Pause className="size-4" />
                    {t("notifications.queue.controls.pause")}
                  </>
                )}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700"
                disabled={isPending}
                onClick={refreshMetrics}
                type="button"
              >
                <RefreshCw className="size-4" />
                {t("notifications.queue.controls.refresh")}
              </button>
            </div>
            {metrics.paused ? (
              <p className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-400">
                {t("notifications.queue.controls.pausedBanner")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {messageKey ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{t(messageKey)}</p>
      ) : null}
    </div>
  );
}
