"use client";

import type { UserLifecycleStatus, UserRole } from "@prisma/client";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { activateUser } from "@/lib/actions/users/activate-user";
import { getUser } from "@/lib/actions/users/get-user";
import { listUsers } from "@/lib/actions/users/list-users";
import { resendActivationEmail } from "@/lib/actions/users/resend-activation-notification";
import { resendPasswordResetEmail } from "@/lib/actions/users/resend-password-reset-notification";
import { hasPermission } from "@/lib/permissions";
import type { AuthUser } from "@/types/auth";
import type { PaginatedResult, UserDetailDTO, UserSummaryDTO } from "@/types/user-management";

import { CreateUserDialog } from "./create-user-dialog";
import { DisableUserDialog } from "./disable-user-dialog";
import { UserDetailsPanel } from "./user-details-panel";
import { UserRoleBadge } from "./user-role-badge";
import { UserStatusBadge } from "./user-status-badge";

const PAGE_SIZE = 20;

interface TerritoryOption {
  id: string;
  label: string;
}

interface UsersConsoleProps {
  actor: AuthUser;
  territoryOptions: TerritoryOption[];
}

const columnHelper = createColumnHelper<UserSummaryDTO>();

export function UsersConsole({ actor, territoryOptions }: UsersConsoleProps) {
  const { t } = useLanguage();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [statusFilter, setStatusFilter] = useState<UserLifecycleStatus | "">("");
  const [territoryFilter, setTerritoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResult<UserSummaryDTO> | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [tempPasswordNotice, setTempPasswordNotice] = useState<string | null>(null);

  const canCreate = hasPermission(actor.role, "users:create");
  const canActivate = hasPermission(actor.role, "users:activate");
  const canDisable = hasPermission(actor.role, "users:disable");
  const canResendNotifications = actor.role === "Super_Admin";

  const allowedRoles: UserRole[] = useMemo(() => {
    if (actor.role === "Super_Admin") {
      return ["Super_Admin", "Manager", "Accounts", "SR"];
    }
    if (actor.role === "Manager") {
      return ["SR"];
    }
    return [];
  }, [actor.role]);

  const refreshList = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const response = await listUsers({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        role: roleFilter || undefined,
        lifecycleStatus: statusFilter || undefined,
        territoryId: territoryFilter || undefined,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      if (cancelled) return;

      if (response.success) {
        setResult(response.data);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [page, search, roleFilter, statusFilter, territoryFilter, reloadToken]);

  const loadUserDetail = useCallback(async (userId: string) => {
    setDetailLoading(true);
    const response = await getUser({ userId });
    setDetailLoading(false);
    if (response.success) {
      setSelectedUser(response.data);
    }
  }, []);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: () => t("userManagement.table.name"),
        cell: (info) => (
          <button
            type="button"
            onClick={() => void loadUserDetail(info.row.original.id)}
            className="font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100"
          >
            {info.getValue()}
          </button>
        ),
      }),
      columnHelper.accessor("email", {
        header: () => t("userManagement.table.email"),
      }),
      columnHelper.accessor("role", {
        header: () => t("userManagement.table.role"),
        cell: (info) => <UserRoleBadge role={info.getValue()} />,
      }),
      columnHelper.accessor("lifecycleStatus", {
        header: () => t("userManagement.table.status"),
        cell: (info) => <UserStatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor("territoryCount", {
        header: () => t("userManagement.table.territories"),
      }),
      columnHelper.accessor("createdAt", {
        header: () => t("userManagement.table.created"),
        cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      }),
    ],
    [loadUserDetail, t],
  );

  const table = useReactTable({
    data: result?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function handleActivate() {
    if (!selectedUser) return;
    const response = await activateUser({ userId: selectedUser.id });
    if (response.success) {
      setSelectedUser(response.data);
      refreshList();
    }
  }

  async function handleResendActivation() {
    if (!selectedUser) return;
    setResendLoading(true);
    setResendNotice(null);
    const response = await resendActivationEmail(selectedUser.id);
    setResendLoading(false);
    if (response.success) {
      setResendNotice("userManagement.notice.activationResent");
    } else {
      setResendNotice(response.error.messageKey);
    }
  }

  async function handleResendPasswordReset() {
    if (!selectedUser) return;
    setResendLoading(true);
    setResendNotice(null);
    const response = await resendPasswordResetEmail(selectedUser.id);
    setResendLoading(false);
    if (response.success) {
      setResendNotice("userManagement.notice.passwordResetResent");
    } else {
      setResendNotice(response.error.messageKey);
    }
  }

  return (
    <div className="space-y-6">
      {resendNotice ? (
        <div
          role="status"
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200"
        >
          {t(resendNotice)}
        </div>
      ) : null}

      {tempPasswordNotice ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {t("userManagement.create.tempPasswordNotice")}:{" "}
          <code className="font-mono font-semibold">{tempPasswordNotice}</code>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("userManagement.filters.search")}
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as UserRole | "");
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t("userManagement.filters.allRoles")}</option>
            {(["Super_Admin", "Manager", "Accounts", "SR"] as const).map((role) => (
              <option key={role} value={role}>
                {t(`userManagement.role.${role}`)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as UserLifecycleStatus | "");
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t("userManagement.filters.allStatuses")}</option>
            {(
              ["INVITED", "PENDING_ACTIVATION", "ACTIVE", "DISABLED", "ARCHIVED"] as const
            ).map((status) => (
              <option key={status} value={status}>
                {t(`userManagement.status.${status}`)}
              </option>
            ))}
          </select>

          {territoryOptions.length > 0 ? (
            <select
              value={territoryFilter}
              onChange={(event) => {
                setTerritoryFilter(event.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t("userManagement.filters.allTerritories")}</option>
              {territoryOptions.map((territory) => (
                <option key={territory.id} value={territory.id}>
                  {territory.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="size-4" />
            {t("userManagement.actions.create")}
          </button>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {loading ? (
            <TableSkeleton rows={8} columns={6} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-950/50">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {table.getRowModel().rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-12 text-center text-sm text-slate-500"
                        >
                          {t("userManagement.table.empty")}
                        </td>
                      </tr>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          className={
                            selectedUser?.id === row.original.id
                              ? "bg-blue-50/50 dark:bg-blue-950/20"
                              : undefined
                          }
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {result && result.pageCount > 1 ? (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <p className="text-sm text-slate-500">
                    {t("userManagement.table.page")} {result.page} / {result.pageCount}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                      className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={page >= result.pageCount}
                      onClick={() => setPage((value) => value + 1)}
                      className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <UserDetailsPanel
          user={selectedUser}
          loading={detailLoading}
          canActivate={
            canActivate &&
            selectedUser !== null &&
            (selectedUser.lifecycleStatus === "INVITED" ||
              selectedUser.lifecycleStatus === "PENDING_ACTIVATION" ||
              selectedUser.lifecycleStatus === "DISABLED")
          }
          canDisable={
            canDisable &&
            selectedUser !== null &&
            selectedUser.lifecycleStatus === "ACTIVE"
          }
          canResendActivation={
            canResendNotifications &&
            selectedUser !== null &&
            (selectedUser.lifecycleStatus === "INVITED" ||
              selectedUser.lifecycleStatus === "PENDING_ACTIVATION")
          }
          canResendPasswordReset={
            canResendNotifications &&
            selectedUser !== null &&
            selectedUser.lifecycleStatus === "ACTIVE"
          }
          resendLoading={resendLoading}
          onActivate={() => void handleActivate()}
          onDisable={() => setDisableOpen(true)}
          onResendActivation={() => void handleResendActivation()}
          onResendPasswordReset={() => void handleResendPasswordReset()}
        />
      </div>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        allowedRoles={allowedRoles}
        territoryOptions={territoryOptions}
        defaultDraftOnly={actor.role === "Manager"}
        onSuccess={(password) => {
          setTempPasswordNotice(password);
          refreshList();
        }}
      />

      <DisableUserDialog
        open={disableOpen}
        userId={selectedUser?.id ?? null}
        userName={selectedUser?.name ?? null}
        onClose={() => setDisableOpen(false)}
        onSuccess={() => {
          if (selectedUser) {
            void loadUserDetail(selectedUser.id);
          }
          refreshList();
        }}
      />
    </div>
  );
}
