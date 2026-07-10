"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { DivisionSelect } from "@/components/geography/division-select";
import { DistrictSelect } from "@/components/geography/district-select";
import { TerritorySelect } from "@/components/geography/territory-select";
import { PageContainer } from "@/components/layout/page-container";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getCompanyDueSummary,
  getDueAgingReport,
  getDueReport,
  getSrDueReport,
  getTerritoryDueReport,
} from "@/lib/actions/due-reports";
import type {
  AgingBucket,
  CompanyDueSummaryDTO,
  DueAgingReportResultDTO,
  DueReportResultDTO,
  SrDueReportResultDTO,
  TerritoryDueReportResultDTO,
} from "@/types/due-report";
import type { AgingBucket } from "@/lib/reports/due";
import type { DistrictDTO, DivisionDTO, TerritoryDTO } from "@/types/geography";

const AGING_BUCKETS: { value: AgingBucket | ""; labelKey: string }[] = [
  { value: "", labelKey: "dueReport.filters.allAging" },
  { value: "current", labelKey: "dueReport.aging.current" },
  { value: "days30", labelKey: "dueReport.aging.days30" },
  { value: "days60", labelKey: "dueReport.aging.days60" },
  { value: "days90", labelKey: "dueReport.aging.days90" },
  { value: "days90Plus", labelKey: "dueReport.aging.days90Plus" },
];

const GROUP_BY_OPTIONS: { value: TerritoryGroupBy; labelKey: string }[] = [
  { value: "division", labelKey: "dueReport.groupBy.division" },
  { value: "district", labelKey: "dueReport.groupBy.district" },
  { value: "territory", labelKey: "dueReport.groupBy.territory" },
];

function formatMoney(value: string): string {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) {
    return value;
  }
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleDateString();
}

export function DueReportPageClient() {
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();

  const [division, setDivision] = useState<DivisionDTO | null>(null);
  const [district, setDistrict] = useState<DistrictDTO | null>(null);
  const [territory, setTerritory] = useState<TerritoryDTO | null>(null);
  const [agingBucket, setAgingBucket] = useState<AgingBucket | "">("");
  const [groupBy, setGroupBy] = useState<TerritoryGroupBy>("territory");
  const [dealerCode, setDealerCode] = useState("");
  const [balanceMin, setBalanceMin] = useState("");
  const [balanceMax, setBalanceMax] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [summary, setSummary] = useState<CompanyDueSummaryDTO | null>(null);
  const [dueReport, setDueReport] = useState<DueReportResultDTO | null>(null);
  const [territoryReport, setTerritoryReport] =
    useState<TerritoryDueReportResultDTO | null>(null);
  const [srReport, setSrReport] = useState<SrDueReportResultDTO | null>(null);
  const [agingReport, setAgingReport] = useState<DueAgingReportResultDTO | null>(
    null,
  );
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const buildFilters = useCallback(
    () => ({
      divisionId: division?.id,
      districtId: district?.id,
      territoryId: territory?.id,
      dealerCode: dealerCode.trim() || undefined,
      agingBucket: agingBucket || undefined,
      balanceMin: balanceMin.trim() || undefined,
      balanceMax: balanceMax.trim() || undefined,
      fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
      toDate: toDate ? new Date(toDate).toISOString() : undefined,
      includeZeroBalance: false,
      includeAdvance: true,
      page: 1,
      pageSize: 100,
    }),
    [
      division,
      district,
      territory,
      dealerCode,
      agingBucket,
      balanceMin,
      balanceMax,
      fromDate,
      toDate,
    ],
  );

  const loadReports = useCallback(() => {
    startTransition(async () => {
      setErrorKey(null);
      const filters = buildFilters();

      const [summaryResult, dueResult, territoryResult, srResult, agingResult] =
        await Promise.all([
          getCompanyDueSummary(filters),
          getDueReport(filters),
          getTerritoryDueReport({ ...filters, groupBy }),
          getSrDueReport(filters),
          getDueAgingReport(filters),
        ]);

      if (!summaryResult.success) {
        setErrorKey(summaryResult.error.messageKey);
        return;
      }
      if (!dueResult.success) {
        setErrorKey(dueResult.error.messageKey);
        return;
      }
      if (!territoryResult.success) {
        setErrorKey(territoryResult.error.messageKey);
        return;
      }
      if (!srResult.success) {
        setErrorKey(srResult.error.messageKey);
        return;
      }
      if (!agingResult.success) {
        setErrorKey(agingResult.error.messageKey);
        return;
      }

      setSummary(summaryResult.data);
      setDueReport(dueResult.data);
      setTerritoryReport(territoryResult.data);
      setSrReport(srResult.data);
      setAgingReport(agingResult.data);
    });
  }, [buildFilters, groupBy]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return (
    <PageContainer
      title={t("dueReport.title")}
      description={t("dueReport.subtitle")}
    >
      <div className="space-y-6">
        {errorKey ? (
          <p className="text-sm text-red-600">{t(errorKey)}</p>
        ) : null}

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">{t("dueReport.filters.title")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("dueReport.filters.division")}
              </label>
              <DivisionSelect
                value={division?.id ?? null}
                onChange={(value) => {
                  setDivision(value);
                  setDistrict(null);
                  setTerritory(null);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("dueReport.filters.district")}
              </label>
              <DistrictSelect
                divisionId={division?.id ?? null}
                value={district?.id ?? null}
                onChange={(value) => {
                  setDistrict(value);
                  setTerritory(null);
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("dueReport.filters.territory")}
              </label>
              <TerritorySelect
                districtId={district?.id ?? null}
                value={territory?.id ?? null}
                onChange={setTerritory}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("dueReport.filters.aging")}
              </label>
              <select
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={agingBucket}
                onChange={(event) =>
                  setAgingBucket(event.target.value as AgingBucket | "")
                }
              >
                {AGING_BUCKETS.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("dueReport.filters.dealer")}
              </label>
              <input
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={dealerCode}
                onChange={(event) => setDealerCode(event.target.value)}
                placeholder={t("dueReport.filters.dealerPlaceholder")}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("dueReport.filters.balanceMin")}
              </label>
              <input
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm tabular-nums"
                value={balanceMin}
                onChange={(event) => setBalanceMin(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("dueReport.filters.balanceMax")}
              </label>
              <input
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm tabular-nums"
                value={balanceMax}
                onChange={(event) => setBalanceMax(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("dueReport.filters.fromDate")}
              </label>
              <input
                type="date"
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("dueReport.filters.toDate")}
              </label>
              <input
                type="date"
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                {t("dueReport.filters.groupBy")}
              </label>
              <select
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={groupBy}
                onChange={(event) =>
                  setGroupBy(event.target.value as TerritoryGroupBy)
                }
              >
                {GROUP_BY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              onClick={loadReports}
              disabled={isPending}
            >
              {isPending ? t("common.loading") : t("dueReport.filters.apply")}
            </button>
          </div>
        </section>

        {summary ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label={t("dueReport.summary.totalDue")}
              value={formatMoney(summary.totalDue)}
            />
            <SummaryCard
              label={t("dueReport.summary.dealersWithDue")}
              value={String(summary.dealersWithDue)}
            />
            <SummaryCard
              label={t("dueReport.summary.netReceivable")}
              value={formatMoney(summary.netReceivable)}
            />
            <SummaryCard
              label={t("dueReport.summary.integrityIssues")}
              value={String(summary.integrityIssues)}
            />
          </section>
        ) : null}

        {agingReport ? (
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("dueReport.aging.title")}</h2>
            <div className="grid gap-3 sm:grid-cols-5">
              <SummaryCard
                label={t("dueReport.aging.current")}
                value={formatMoney(agingReport.aging.current)}
              />
              <SummaryCard
                label={t("dueReport.aging.days30")}
                value={formatMoney(agingReport.aging.days30)}
              />
              <SummaryCard
                label={t("dueReport.aging.days60")}
                value={formatMoney(agingReport.aging.days60)}
              />
              <SummaryCard
                label={t("dueReport.aging.days90")}
                value={formatMoney(agingReport.aging.days90)}
              />
              <SummaryCard
                label={t("dueReport.aging.days90Plus")}
                value={formatMoney(agingReport.aging.days90Plus)}
              />
            </div>
          </section>
        ) : null}

        {territoryReport ? (
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-semibold">
              {t("dueReport.territory.title")}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-2">{t("dueReport.territory.group")}</th>
                    <th className="p-2">{t("dueReport.territory.dealers")}</th>
                    <th className="p-2">{t("dueReport.territory.totalDue")}</th>
                    <th className="p-2">{t("dueReport.territory.netBalance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {territoryReport.groups.length === 0 ? (
                    <tr>
                      <td className="p-4 text-center text-muted-foreground" colSpan={4}>
                        {t("dueReport.empty")}
                      </td>
                    </tr>
                  ) : (
                    territoryReport.groups.map((group) => (
                      <tr key={group.groupId} className="border-b">
                        <td className="p-2">{group.groupName}</td>
                        <td className="p-2 tabular-nums">{group.dealerCount}</td>
                        <td className="p-2 tabular-nums">
                          {formatMoney(group.totalDue)}
                        </td>
                        <td className="p-2 tabular-nums">
                          {formatMoney(group.netBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {srReport ? (
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("dueReport.sr.title")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-2">{t("dueReport.sr.name")}</th>
                    <th className="p-2">{t("dueReport.sr.dealers")}</th>
                    <th className="p-2">{t("dueReport.sr.totalDue")}</th>
                    <th className="p-2">{t("dueReport.sr.netBalance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {srReport.groups.length === 0 ? (
                    <tr>
                      <td className="p-4 text-center text-muted-foreground" colSpan={4}>
                        {t("dueReport.empty")}
                      </td>
                    </tr>
                  ) : (
                    srReport.groups.map((group) => (
                      <tr key={group.srId ?? "unassigned"} className="border-b">
                        <td className="p-2">
                          {group.srName ?? t("dueReport.sr.unassigned")}
                        </td>
                        <td className="p-2 tabular-nums">{group.dealerCount}</td>
                        <td className="p-2 tabular-nums">
                          {formatMoney(group.totalDue)}
                        </td>
                        <td className="p-2 tabular-nums">
                          {formatMoney(group.netBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {dueReport ? (
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("dueReport.dealers.title")}</h2>
            <div className="mb-2 text-sm text-muted-foreground">
              {t("dueReport.dealers.count")}: {dueReport.total}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-2">{t("dueReport.dealers.code")}</th>
                    <th className="p-2">{t("dueReport.dealers.name")}</th>
                    <th className="p-2">{t("dueReport.dealers.territory")}</th>
                    <th className="p-2">{t("dueReport.dealers.sr")}</th>
                    <th className="p-2">{t("dueReport.dealers.balance")}</th>
                    <th className="p-2">{t("dueReport.dealers.lastInvoice")}</th>
                    <th className="p-2">{t("dueReport.dealers.lastCollection")}</th>
                    <th className="p-2">{t("dueReport.dealers.integrity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dueReport.rows.length === 0 ? (
                    <tr>
                      <td className="p-4 text-center text-muted-foreground" colSpan={8}>
                        {t("dueReport.empty")}
                      </td>
                    </tr>
                  ) : (
                    dueReport.rows.map((row) => (
                      <tr key={row.dealerCode} className="border-b">
                        <td className="p-2 font-medium">{row.dealerCode}</td>
                        <td className="p-2">{row.dealerName}</td>
                        <td className="p-2">{row.territoryName ?? "—"}</td>
                        <td className="p-2">{row.assignedSrName ?? "—"}</td>
                        <td className="p-2 tabular-nums">
                          {formatMoney(row.currentBalance)}
                        </td>
                        <td className="p-2">{formatDate(row.lastInvoiceDate)}</td>
                        <td className="p-2">{formatDate(row.lastCollectionDate)}</td>
                        <td className="p-2">
                          <span
                            className={
                              row.ledgerIntegrity
                                ? "text-green-700"
                                : "text-orange-700"
                            }
                          >
                            {row.ledgerIntegrity
                              ? t("dueReport.integrity.ok")
                              : t("dueReport.integrity.issue")}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </PageContainer>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
