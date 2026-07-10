"use client";

import { useSession } from "next-auth/react";

import {
  DistrictSelect,
  DivisionSelect,
  TerritorySelect,
} from "@/components/geography";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

interface DealerGeographyFieldsProps {
  divisionId: string | null;
  districtId: string | null;
  territoryId: string | null;
  onDivisionChange: (id: string | null) => void;
  onDistrictChange: (id: string | null) => void;
  onTerritoryChange: (id: string | null) => void;
  disabled?: boolean;
  errors?: {
    divisionId?: string;
    districtId?: string;
    territoryId?: string;
  };
}

export function DealerGeographyFields({
  divisionId,
  districtId,
  territoryId,
  onDivisionChange,
  onDistrictChange,
  onTerritoryChange,
  disabled,
  errors,
}: DealerGeographyFieldsProps) {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;

  const canEditTerritory =
    role === "Super_Admin" ||
    role === "Manager" ||
    role === "SR" ||
    (role ? hasPermission(role, "dealers:edit") && role !== "Accounts" : false);

  const isReadOnly = disabled || role === "Accounts" || !canEditTerritory;

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("dealers.form.field.division")}
          <span className="ml-0.5 text-rose-500">*</span>
        </label>
        <DivisionSelect
          value={divisionId}
          disabled={isReadOnly}
          hasError={Boolean(errors?.divisionId)}
          onChange={(next) => {
            onDivisionChange(next?.id ?? null);
            onDistrictChange(null);
            onTerritoryChange(null);
          }}
        />
        {errors?.divisionId && (
          <p className="text-xs text-rose-600">{errors.divisionId}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("dealers.form.field.districtGeo")}
          <span className="ml-0.5 text-rose-500">*</span>
        </label>
        <DistrictSelect
          divisionId={divisionId}
          value={districtId}
          disabled={isReadOnly}
          hasError={Boolean(errors?.districtId)}
          onChange={(next) => {
            onDistrictChange(next?.id ?? null);
            onTerritoryChange(null);
          }}
        />
        {errors?.districtId && (
          <p className="text-xs text-rose-600">{errors.districtId}</p>
        )}
      </div>

      <div className={cn("space-y-1.5 sm:col-span-2")}>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("dealers.form.field.territoryGeo")}
          <span className="ml-0.5 text-rose-500">*</span>
        </label>
        <TerritorySelect
          districtId={districtId}
          value={territoryId}
          disabled={isReadOnly}
          hasError={Boolean(errors?.territoryId)}
          onChange={(next) => {
            onTerritoryChange(next?.id ?? null);
          }}
        />
        {errors?.territoryId && (
          <p className="text-xs text-rose-600">{errors.territoryId}</p>
        )}
        {isReadOnly && role === "Accounts" && (
          <p className="text-xs text-slate-500">{t("dealers.form.territoryReadOnly")}</p>
        )}
      </div>
    </div>
  );
}
