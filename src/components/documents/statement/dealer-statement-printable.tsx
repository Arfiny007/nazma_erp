"use client";

import { useMemo } from "react";

import { CompanyFooter } from "@/components/documents/branding/company-footer";
import { CompanyHeader } from "@/components/documents/branding/company-header";
import { DocumentLayout } from "@/components/documents/layout/document-layout";
import { DocumentMetadata } from "@/components/documents/sections/document-metadata";
import { DocumentSignature } from "@/components/documents/sections/document-signature";
import { DocumentTitle } from "@/components/documents/sections/document-title";
import { StatementNotes } from "@/components/documents/statement/statement-notes";
import { StatementSummary } from "@/components/documents/statement/statement-summary";
import { StatementTable } from "@/components/documents/statement/statement-table";
import { mapDealerStatementToDocument } from "@/components/documents/statement/statement-mapper";
import type { StatementDocumentLabels } from "@/components/documents/statement/statement-types";
import "@/components/documents/styles/document-print.css";
import { getCompanyBranding } from "@/lib/documents/company-branding";
import {
  createDocumentDateFormatter,
  createMoneyFormatter,
  formatMoney,
} from "@/lib/utils/format-money";
import type { DealerStatementDTO } from "@/types/ledger-statement";

interface DealerStatementPrintableProps {
  statement: DealerStatementDTO;
  labels: StatementDocumentLabels;
  locale: "en" | "bn";
  postingTypeLabel: (postingType: string) => string;
  integrityLabel: (consistent: boolean) => string;
}

/**
 * Single source of truth for Dealer Statement preview, browser print, and PDF.
 * Composes the shared document platform only — no duplicated layout or CSS.
 */
export function DealerStatementPrintable({
  statement,
  labels,
  locale,
  postingTypeLabel,
  integrityLabel,
}: DealerStatementPrintableProps) {
  const branding = getCompanyBranding();

  const moneyFormatter = useMemo(() => createMoneyFormatter(locale), [locale]);
  const dateFormatter = useMemo(() => createDocumentDateFormatter(locale), [locale]);

  const documentData = useMemo(() => {
    const formatMoneyValue = (value: string) => formatMoney(value, moneyFormatter);
    const formatDate = (iso: string) => dateFormatter.format(new Date(iso));
    const formatPeriodDate = (value: string | null) =>
      value ? formatDate(value) : labels.openEnded;

    return mapDealerStatementToDocument(
      statement,
      {
        formatMoney: formatMoneyValue,
        formatDate,
        formatPeriodDate,
        postingTypeLabel: (postingType) => postingTypeLabel(postingType),
        integrityLabel,
      },
      labels.statementPeriod,
    );
  }, [
    statement,
    moneyFormatter,
    dateFormatter,
    postingTypeLabel,
    integrityLabel,
    labels.openEnded,
    labels.statementPeriod,
  ]);

  const metadataFields = [
    { label: labels.dealerCode, value: documentData.dealerCode },
    { label: labels.statementPeriod, value: documentData.statementPeriod },
    { label: labels.printDate, value: documentData.printDate },
    { label: labels.currentBalance, value: documentData.currentBalance },
    { label: labels.ledgerIntegrity, value: documentData.ledgerIntegrityLabel },
  ];

  return (
    <DocumentLayout className="doc-statement-layout">
      <CompanyHeader branding={branding} />
      <DocumentTitle title={labels.title} />

      <DocumentMetadata
        primaryReference={documentData.dealerName}
        fields={metadataFields}
      />

      <StatementTable rows={documentData.rows} labels={labels} />

      <div className="document-avoid-break flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <StatementNotes document={documentData} labels={labels} />
        </div>
        <div>
          <StatementSummary document={documentData} labels={labels} />
          <DocumentSignature lines={[labels.authorizedBy]} />
        </div>
      </div>

      <CompanyFooter message={labels.footerThanks} />
    </DocumentLayout>
  );
}

export function buildStatementDocumentLabels(
  t: (key: string) => string,
): StatementDocumentLabels {
  return {
    title: t("document.statement.title"),
    dealerName: t("document.statement.dealerName"),
    dealerCode: t("document.statement.dealerCode"),
    statementPeriod: t("document.statement.allTime"),
    openEnded: t("ledgerStatement.header.openEnded"),
    printDate: t("document.statement.printDate"),
    currentBalance: t("document.statement.currentBalance"),
    ledgerIntegrity: t("document.statement.ledgerIntegrity"),
    columnDate: t("ledgerStatement.table.colDate"),
    columnPostingType: t("ledgerStatement.table.colPostingType"),
    columnReferenceNo: t("ledgerStatement.table.colReferenceNo"),
    columnDescription: t("ledgerStatement.table.colDescription"),
    columnDebit: t("ledgerStatement.table.colDebit"),
    columnCredit: t("ledgerStatement.table.colCredit"),
    columnRunningBalance: t("ledgerStatement.table.colRunningBalance"),
    openingBalance: t("ledgerStatement.cards.openingBalance"),
    totalDebit: t("ledgerStatement.cards.totalDebit"),
    totalCredit: t("ledgerStatement.cards.totalCredit"),
    closingBalance: t("ledgerStatement.cards.closingBalance"),
    transactionCount: t("ledgerStatement.cards.transactionCount"),
    tableCaption: t("document.statement.tableCaption"),
    integrityConsistentNote: t("document.statement.integrityConsistentNote"),
    integrityWarningNote: t("document.statement.integrityWarningNote"),
    authorizedBy: t("document.invoice.authorizedBy"),
    footerThanks: t("document.statement.footerThanks"),
    previewTitle: t("document.statement.previewTitle"),
    printStatement: t("document.statement.printStatement"),
    emptyStatementNote: t("document.statement.emptyStatementNote"),
  };
}
