"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { UserDetailDTO } from "@/types/user-management";

import { UserRoleBadge } from "./user-role-badge";
import { UserStatusBadge } from "./user-status-badge";

interface UserDetailsPanelProps {
  user: UserDetailDTO | null;
  loading?: boolean;
  onActivate?: () => void;
  onDisable?: () => void;
  canActivate?: boolean;
  canDisable?: boolean;
}

export function UserDetailsPanel({
  user,
  loading = false,
  onActivate,
  onDisable,
  canActivate = false,
  canDisable = false,
}: UserDetailsPanelProps) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-500">{t("common.loading")}…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t("userManagement.details.emptyTitle")}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("userManagement.details.emptyDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {user.name}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <UserRoleBadge role={user.role} />
            <UserStatusBadge status={user.lifecycleStatus} />
          </div>
        </div>
      </div>

      <dl className="grid gap-4 px-5 py-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">
            {t("userManagement.details.manager")}
          </dt>
          <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
            {user.managerName ?? t("userManagement.details.none")}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">
            {t("userManagement.details.phone")}
          </dt>
          <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
            {user.phone ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">
            {t("userManagement.details.employeeCode")}
          </dt>
          <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
            {user.employeeCode ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">
            {t("userManagement.details.provisionedBy")}
          </dt>
          <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
            {user.provisionedByName ?? "—"}
          </dd>
        </div>
      </dl>

      {user.territories.length > 0 ? (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("userManagement.details.territories")}
          </h3>
          <ul className="mt-2 space-y-1.5">
            {user.territories.map((territory) => (
              <li
                key={territory.territoryId}
                className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300"
              >
                <span>
                  {territory.territoryName}{" "}
                  <span className="text-slate-400">({territory.territoryCode})</span>
                </span>
                {territory.isPrimary ? (
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {t("userManagement.details.primary")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {user.notes ? (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("userManagement.details.notes")}
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{user.notes}</p>
        </div>
      ) : null}

      {(canActivate || canDisable) && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          {canActivate ? (
            <button
              type="button"
              onClick={onActivate}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              {t("userManagement.actions.activate")}
            </button>
          ) : null}
          {canDisable ? (
            <button
              type="button"
              onClick={onDisable}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              {t("userManagement.actions.disable")}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
