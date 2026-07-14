"use client";

import { Search } from "lucide-react";
import { useCallback, useState, useTransition } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  cancelNotification,
  retryNotification,
  searchNotificationTemplates,
  searchNotifications,
} from "@/lib/actions/notifications";
import { hasPermission } from "@/lib/permissions";
import type { AuthUser } from "@/types/auth";
import type {
  NotificationListDTO,
  NotificationTemplateListDTO,
} from "@/types/notification";

import { NotificationTemplatesTable } from "./notification-templates-table";
import { NotificationsTable } from "./notifications-table";

type TabId = "notifications" | "templates";

interface NotificationsConsoleProps {
  actor: AuthUser;
  initialNotifications: NotificationListDTO;
  initialTemplates: NotificationTemplateListDTO;
}

export function NotificationsConsole({
  actor,
  initialNotifications,
  initialTemplates,
}: NotificationsConsoleProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>("notifications");
  const [notifications, setNotifications] = useState(initialNotifications);
  const [templates, setTemplates] = useState(initialTemplates);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canRetry = hasPermission(actor.role, "notifications:retry");
  const canCancel = hasPermission(actor.role, "notifications:create");

  const loadNotifications = useCallback(
    (page = notifications.page) => {
      startTransition(async () => {
        const result = await searchNotifications({
          page,
          pageSize: notifications.pageSize,
          search: search || undefined,
          status: statusFilter
            ? (statusFilter as NotificationListDTO["records"][number]["status"])
            : undefined,
        });
        if (!result.success) {
          setErrorKey(result.error.messageKey);
          return;
        }
        setErrorKey(null);
        setNotifications(result.data);
      });
    },
    [notifications.pageSize, search, statusFilter],
  );

  const loadTemplates = useCallback(
    (page = templates.page) => {
      startTransition(async () => {
        const result = await searchNotificationTemplates({
          page,
          pageSize: templates.pageSize,
          search: search || undefined,
        });
        if (!result.success) {
          setErrorKey(result.error.messageKey);
          return;
        }
        setErrorKey(null);
        setTemplates(result.data);
      });
    },
    [search, templates.pageSize],
  );

  const handleSearch = () => {
    if (activeTab === "notifications") {
      loadNotifications(1);
    } else {
      loadTemplates(1);
    }
  };

  const handleRetry = (id: string) => {
    startTransition(async () => {
      const result = await retryNotification(id);
      if (!result.success) {
        setErrorKey(result.error.messageKey);
        return;
      }
      loadNotifications();
    });
  };

  const handleCancel = (id: string) => {
    startTransition(async () => {
      const result = await cancelNotification(id);
      if (!result.success) {
        setErrorKey(result.error.messageKey);
        return;
      }
      loadNotifications();
    });
  };

  const activeData = activeTab === "notifications" ? notifications : templates;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {t("notifications.page.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("notifications.page.subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            activeTab === "notifications"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
          }`}
          onClick={() => setActiveTab("notifications")}
          type="button"
        >
          {t("notifications.tabs.notifications")}
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            activeTab === "templates"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
          }`}
          onClick={() => setActiveTab("templates")}
          type="button"
        >
          {t("notifications.tabs.templates")}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {t("notifications.filters.search")}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("notifications.filters.searchPlaceholder")}
              type="search"
              value={search}
            />
          </div>
        </div>

        {activeTab === "notifications" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t("notifications.filters.status")}
            </label>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="">{t("notifications.filters.allStatuses")}</option>
              <option value="PENDING">{t("notifications.status.PENDING")}</option>
              <option value="PROCESSING">{t("notifications.status.PROCESSING")}</option>
              <option value="SENT">{t("notifications.status.SENT")}</option>
              <option value="FAILED">{t("notifications.status.FAILED")}</option>
              <option value="CANCELLED">{t("notifications.status.CANCELLED")}</option>
            </select>
          </div>
        ) : null}

        <button
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          disabled={isPending}
          onClick={handleSearch}
          type="button"
        >
          {t("notifications.filters.apply")}
        </button>
      </div>

      {errorKey ? (
        <p className="text-sm text-red-600 dark:text-red-400">{t(errorKey)}</p>
      ) : null}

      {activeTab === "notifications" ? (
        notifications.records.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
            {t("notifications.empty.notifications")}
          </p>
        ) : (
          <NotificationsTable
            canCancel={canCancel}
            canRetry={canRetry}
            isLoading={isPending}
            onCancel={handleCancel}
            onRetry={handleRetry}
            records={notifications.records}
          />
        )
      ) : templates.records.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          {t("notifications.empty.templates")}
        </p>
      ) : (
        <NotificationTemplatesTable records={templates.records} />
      )}

      {activeData.totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-600 dark:text-slate-300">
            {t("notifications.pagination.page")} {activeData.page}{" "}
            {t("notifications.pagination.of")} {activeData.totalPages} ·{" "}
            {activeData.total} {t("notifications.pagination.records")}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50 dark:border-slate-700"
              disabled={isPending || activeData.page <= 1}
              onClick={() =>
                activeTab === "notifications"
                  ? loadNotifications(activeData.page - 1)
                  : loadTemplates(activeData.page - 1)
              }
              type="button"
            >
              {t("notifications.pagination.previous")}
            </button>
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-50 dark:border-slate-700"
              disabled={isPending || activeData.page >= activeData.totalPages}
              onClick={() =>
                activeTab === "notifications"
                  ? loadNotifications(activeData.page + 1)
                  : loadTemplates(activeData.page + 1)
              }
              type="button"
            >
              {t("notifications.pagination.next")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
