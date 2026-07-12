"use client";

import { useState } from "react";
import type { UserRole } from "@prisma/client";

import { useLanguage } from "@/contexts/LanguageContext";
import { createUser } from "@/lib/actions/users/create-user";

interface TerritoryOption {
  id: string;
  label: string;
}

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (temporaryPassword: string) => void;
  allowedRoles: UserRole[];
  territoryOptions: TerritoryOption[];
  defaultDraftOnly?: boolean;
}

export function CreateUserDialog({
  open,
  onClose,
  onSuccess,
  allowedRoles,
  territoryOptions,
  defaultDraftOnly = false,
}: CreateUserDialogProps) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(allowedRoles[0] ?? "SR");
  const [selectedTerritories, setSelectedTerritories] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  function resetForm() {
    setName("");
    setEmail("");
    setRole(allowedRoles[0] ?? "SR");
    setSelectedTerritories([]);
    setPhone("");
    setError(null);
  }

  function toggleTerritory(territoryId: string) {
    setSelectedTerritories((current) =>
      current.includes(territoryId)
        ? current.filter((id) => id !== territoryId)
        : [...current, territoryId],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createUser({
      name,
      email,
      role,
      territoryIds: selectedTerritories,
      phone: phone || null,
      draftOnly: defaultDraftOnly,
    });

    setSubmitting(false);

    if (result.success) {
      onSuccess(result.data.temporaryPassword);
      resetForm();
      onClose();
      return;
    }

    setError(t(result.error.messageKey));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 id="create-user-title" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {t("userManagement.create.title")}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t("userManagement.create.subtitle")}
        </p>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-4">
          <div>
            <label htmlFor="user-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("userManagement.create.name")}
            </label>
            <input
              id="user-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label htmlFor="user-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("userManagement.create.email")}
            </label>
            <input
              id="user-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div>
            <label htmlFor="user-role" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("userManagement.create.role")}
            </label>
            <select
              id="user-role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {allowedRoles.map((allowedRole) => (
                <option key={allowedRole} value={allowedRole}>
                  {t(`userManagement.role.${allowedRole}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="user-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("userManagement.create.phone")}
            </label>
            <input
              id="user-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          {territoryOptions.length > 0 ? (
            <fieldset>
              <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("userManagement.create.territories")}
              </legend>
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                {territoryOptions.map((territory) => (
                  <label key={territory.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedTerritories.includes(territory.id)}
                      onChange={() => toggleTerritory(territory.id)}
                    />
                    <span>{territory.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium"
            >
              {t("common.close")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? t("common.loading") : t("userManagement.create.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
