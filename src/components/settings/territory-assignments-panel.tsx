"use client";

import { useCallback, useEffect, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  assignTerritory,
  listUserTerritories,
  revokeTerritoryAssignment,
  searchAssignableTerritories,
  searchAssignableUsers,
} from "@/lib/actions/territory-assignments";
import type {
  AssignableTerritoryDTO,
  AssignableUserDTO,
  TerritoryAssignmentRecord,
} from "@/lib/rbac/territory";

type LoadStatus = "loading" | "ready" | "error";

export function TerritoryAssignmentsPanel() {
  const { t, locale } = useLanguage();

  const [users, setUsers] = useState<AssignableUserDTO[]>([]);
  const [territories, setTerritories] = useState<AssignableTerritoryDTO[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTerritoryId, setSelectedTerritoryId] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [assignments, setAssignments] = useState<TerritoryAssignmentRecord[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const displayTerritoryName = useCallback(
    (name: string, nameBn: string | null) =>
      locale === "bn" && nameBn ? nameBn : name,
    [locale],
  );

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setStatus("loading");

      const [userResult, territoryResult] = await Promise.all([
        searchAssignableUsers({ page: 1, pageSize: 50 }),
        searchAssignableTerritories({ page: 1, pageSize: 100 }),
      ]);

      if (cancelled) {
        return;
      }

      if (!userResult.success || !territoryResult.success) {
        setStatus("error");
        return;
      }

      setUsers(userResult.data.items);
      setTerritories(territoryResult.data.items);
      if (userResult.data.items.length > 0) {
        setSelectedUserId((current) => current || userResult.data.items[0].id);
      }
      setStatus("ready");
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    if (!selectedUserId) {
      setAssignments([]);
      return;
    }

    let cancelled = false;

    async function loadAssignments(): Promise<void> {
      const result = await listUserTerritories({ userId: selectedUserId });
      if (!cancelled && result.success) {
        setAssignments(result.data);
      }
    }

    void loadAssignments();

    return () => {
      cancelled = true;
    };
  }, [selectedUserId, reloadToken]);

  const handleAssign = async (): Promise<void> => {
    setActionError(null);
    if (!selectedUserId || !selectedTerritoryId) {
      return;
    }

    const result = await assignTerritory({
      userId: selectedUserId,
      territoryId: selectedTerritoryId,
      isPrimary,
    });

    if (!result.success) {
      setActionError(t(result.error.messageKey));
      return;
    }

    setReloadToken((token) => token + 1);
    setIsPrimary(false);
  };

  const handleRevoke = async (assignmentId: string): Promise<void> => {
    setActionError(null);
    const result = await revokeTerritoryAssignment({ assignmentId });
    if (!result.success) {
      setActionError(t(result.error.messageKey));
      return;
    }
    setReloadToken((token) => token + 1);
  };

  if (status === "loading") {
    return (
      <p className="text-sm text-slate-500">{t("common.loading")}</p>
    );
  }

  if (status === "error") {
    return (
      <p className="text-sm text-red-600">{t("territoryAssignment.page.loadError")}</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-50">
          {t("territoryAssignment.form.title")}
        </h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-300">
              {t("territoryAssignment.form.user")}
            </span>
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-300">
              {t("territoryAssignment.form.territory")}
            </span>
            <select
              value={selectedTerritoryId}
              onChange={(event) => setSelectedTerritoryId(event.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">{t("territoryAssignment.form.selectTerritory")}</option>
              {territories.map((territory) => (
                <option key={territory.id} value={territory.id}>
                  {displayTerritoryName(territory.name, territory.nameBn)} —{" "}
                  {territory.districtName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-end gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(event) => setIsPrimary(event.target.checked)}
              className="size-4 rounded border-slate-300"
            />
            <span>{t("territoryAssignment.form.primary")}</span>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void handleAssign()}
              disabled={!selectedUserId || !selectedTerritoryId}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"
            >
              {t("territoryAssignment.form.assign")}
            </button>
          </div>
        </div>

        {actionError && (
          <p className="mt-3 text-sm text-red-600">{actionError}</p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                {t("territoryAssignment.column.territory")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                {t("territoryAssignment.column.location")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                {t("territoryAssignment.column.status")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                {t("territoryAssignment.column.primary")}
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                {t("territoryAssignment.column.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  {t("territoryAssignment.table.empty")}
                </td>
              </tr>
            ) : (
              assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-50">
                    {displayTerritoryName(
                      assignment.territoryName,
                      assignment.territoryNameBn,
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {assignment.districtName}, {assignment.divisionName}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {assignment.isActive
                      ? t("territoryAssignment.status.active")
                      : t("territoryAssignment.status.revoked")}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {assignment.isPrimary
                      ? t("territoryAssignment.status.yes")
                      : t("territoryAssignment.status.no")}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {assignment.isActive && (
                      <button
                        type="button"
                        onClick={() => void handleRevoke(assignment.id)}
                        className="font-medium text-red-600 hover:underline"
                      >
                        {t("territoryAssignment.actions.revoke")}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
