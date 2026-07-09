"use client";

import { useCallback, useEffect, useState } from "react";

import { useLanguage } from "@/contexts/LanguageContext";
import { listDealers } from "@/lib/actions/dealers/list-dealers";
import { getDealerStatement } from "@/lib/actions/ledger-statement/get-dealer-statement";
import type { DealerDTO } from "@/types/dealer";
import type { DealerStatementDTO } from "@/types/ledger-statement";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; statement: DealerStatementDTO }
  | { status: "error"; messageKey: string };

export function LedgerDemoPageClient() {
  const { t } = useLanguage();
  const [dealers, setDealers] = useState<DealerDTO[]>([]);
  const [dealerCode, setDealerCode] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    void (async () => {
      const result = await listDealers({ page: 1, pageSize: 200, isActive: true });
      if (result.success && result.data.items.length > 0) {
        setDealers(result.data.items);
        const firstCode = result.data.items[0]?.dealerCode ?? "";
        setDealerCode(firstCode);
        if (firstCode) {
          setLoadState({ status: "loading" });
          const statementResult = await getDealerStatement({
            dealerCode: firstCode,
            page: 1,
            pageSize: 25,
          });
          if (statementResult.success) {
            setLoadState({ status: "ready", statement: statementResult.data });
          } else {
            setLoadState({
              status: "error",
              messageKey: statementResult.error.messageKey,
            });
          }
        }
      }
    })();
  }, []);

  const loadStatement = useCallback(
    async (overrides?: { dealer?: string; from?: string; to?: string; nextPage?: number }) => {
      const targetDealer = overrides?.dealer ?? dealerCode;
      if (!targetDealer) {
        return;
      }

      const targetFrom = overrides?.from ?? fromDate;
      const targetTo = overrides?.to ?? toDate;
      const targetPage = overrides?.nextPage ?? page;

      setLoadState({ status: "loading" });

      const result = await getDealerStatement({
        dealerCode: targetDealer,
        fromDate: targetFrom || undefined,
        toDate: targetTo || undefined,
        page: targetPage,
        pageSize: 25,
      });

      if (!result.success) {
        setLoadState({
          status: "error",
          messageKey: result.error.messageKey,
        });
        return;
      }

      setLoadState({ status: "ready", statement: result.data });
    },
    [dealerCode, fromDate, page, toDate],
  );

  const statement =
    loadState.status === "ready" ? loadState.statement : null;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("ledgerStatement.demo.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("ledgerStatement.demo.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span>{t("ledgerStatement.demo.dealer")}</span>
          <select
            className="border-input bg-background w-full rounded-md border px-3 py-2"
            value={dealerCode}
            onChange={(event) => {
              const nextDealer = event.target.value;
              setPage(1);
              setDealerCode(nextDealer);
              void loadStatement({ dealer: nextDealer, nextPage: 1 });
            }}
          >
            {dealers.map((dealer) => (
              <option key={dealer.dealerCode} value={dealer.dealerCode}>
                {dealer.dealerCode} — {dealer.companyName}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span>{t("ledgerStatement.demo.fromDate")}</span>
          <input
            type="date"
            className="border-input bg-background w-full rounded-md border px-3 py-2"
            value={fromDate}
            onChange={(event) => {
              const nextFrom = event.target.value;
              setPage(1);
              setFromDate(nextFrom);
              void loadStatement({ from: nextFrom, nextPage: 1 });
            }}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>{t("ledgerStatement.demo.toDate")}</span>
          <input
            type="date"
            className="border-input bg-background w-full rounded-md border px-3 py-2"
            value={toDate}
            onChange={(event) => {
              const nextTo = event.target.value;
              setPage(1);
              setToDate(nextTo);
              void loadStatement({ to: nextTo, nextPage: 1 });
            }}
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
            onClick={() => void loadStatement()}
          >
            {t("ledgerStatement.demo.refresh")}
          </button>
        </div>
      </div>

      {loadState.status === "loading" && (
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      )}

      {loadState.status === "error" && (
        <p className="text-destructive text-sm" role="alert">
          {t(loadState.messageKey)}
        </p>
      )}

      {statement && (
        <div className="space-y-4">
          <div className="grid gap-2 text-sm md:grid-cols-4">
            <div>
              <span className="text-muted-foreground">
                {t("ledgerStatement.demo.currentBalance")}:{" "}
              </span>
              {statement.meta.currentBalance}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t("ledgerStatement.demo.openingForRange")}:{" "}
              </span>
              {statement.openingBalanceForRange}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t("ledgerStatement.demo.totalDebit")}:{" "}
              </span>
              {statement.totals.totalDebit}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t("ledgerStatement.demo.totalCredit")}:{" "}
              </span>
              {statement.totals.totalCredit}
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">{t("ledgerStatement.demo.colDate")}</th>
                  <th className="px-3 py-2 text-left">{t("ledgerStatement.demo.colType")}</th>
                  <th className="px-3 py-2 text-left">{t("ledgerStatement.demo.colReference")}</th>
                  <th className="px-3 py-2 text-left">{t("ledgerStatement.demo.colDescription")}</th>
                  <th className="px-3 py-2 text-right">{t("ledgerStatement.demo.colDebit")}</th>
                  <th className="px-3 py-2 text-right">{t("ledgerStatement.demo.colCredit")}</th>
                  <th className="px-3 py-2 text-right">{t("ledgerStatement.demo.colBalance")}</th>
                  <th className="px-3 py-2 text-left">{t("ledgerStatement.demo.colCreatedBy")}</th>
                </tr>
              </thead>
              <tbody>
                {statement.rows.length === 0 ? (
                  <tr>
                    <td className="text-muted-foreground px-3 py-4" colSpan={8}>
                      {t("ledgerStatement.demo.empty")}
                    </td>
                  </tr>
                ) : (
                  statement.rows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2">{row.transactionDate.slice(0, 10)}</td>
                      <td className="px-3 py-2">{row.postingType}</td>
                      <td className="px-3 py-2">{row.referenceNo}</td>
                      <td className="px-3 py-2">{row.description}</td>
                      <td className="px-3 py-2 text-right">{row.debit}</td>
                      <td className="px-3 py-2 text-right">{row.credit}</td>
                      <td className="px-3 py-2 text-right">{row.runningBalance}</td>
                      <td className="px-3 py-2">{row.createdByName ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              className="border-input rounded-md border px-3 py-1 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => {
                const nextPage = Math.max(1, page - 1);
                setPage(nextPage);
                void loadStatement({ nextPage });
              }}
            >
              {t("ledgerStatement.demo.previous")}
            </button>
            <span>
              {t("ledgerStatement.demo.page")} {statement.pagination.page} /{" "}
              {Math.max(statement.pagination.pageCount, 1)}
            </span>
            <button
              type="button"
              className="border-input rounded-md border px-3 py-1 disabled:opacity-50"
              disabled={page >= statement.pagination.pageCount}
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                void loadStatement({ nextPage });
              }}
            >
              {t("ledgerStatement.demo.next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
