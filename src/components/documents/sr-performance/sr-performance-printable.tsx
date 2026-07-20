"use client";

import { useMemo } from "react";

import { CompanyFooter } from "@/components/documents/branding/company-footer";
import { CompanyHeader } from "@/components/documents/branding/company-header";
import { DocumentLayout } from "@/components/documents/layout/document-layout";
import { DocumentMetadata } from "@/components/documents/sections/document-metadata";
import { DocumentNotes } from "@/components/documents/sections/document-notes";
import { DocumentTitle } from "@/components/documents/sections/document-title";
import "@/components/documents/styles/document-print.css";
import { getCompanyBranding } from "@/lib/documents/company-branding";
import {
  createDocumentDateFormatter,
  createMoneyFormatter,
  formatMoney,
} from "@/lib/utils/format-money";
import type { SrPerformancePrintPayloadDTO } from "@/types/sr-performance";

import { SrPerformanceDealerTable } from "./sr-performance-dealer-table";
import { mapSrPerformanceToDocument } from "./sr-performance-document-mapper";
import type { SrPerformanceDocumentLabels } from "./sr-performance-document-types";
import { SrPerformanceOverviewTable } from "./sr-performance-overview-table";

interface SrPerformancePrintableProps {
  payload: SrPerformancePrintPayloadDTO;
  labels: SrPerformanceDocumentLabels;
  locale: "en" | "bn";
}

/**
 * Single source of truth for SR Performance preview / print / PDF.
 * Formats labels only — no financial arithmetic on DTO money strings.
 * Renders exactly one report mode (individual | overview).
 */
export function SrPerformancePrintable({
  payload,
  labels,
  locale,
}: SrPerformancePrintableProps) {
  const branding = getCompanyBranding();
  const moneyFormatter = useMemo(() => createMoneyFormatter(locale), [locale]);
  const dateFormatter = useMemo(
    () => createDocumentDateFormatter(locale),
    [locale],
  );

  const documentData = useMemo(() => {
    return mapSrPerformanceToDocument(payload, labels, {
      formatMoney: (value) => formatMoney(value, moneyFormatter),
      formatDate: (isoDate) => dateFormatter.format(new Date(isoDate)),
      formatDateTime: (iso) =>
        new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(iso)),
    });
  }, [payload, labels, moneyFormatter, dateFormatter, locale]);

  const metadataFields =
    payload.mode === "individual"
      ? [
          { label: labels.dateRange, value: documentData.dateRangeLabel },
          { label: labels.territory, value: documentData.territoryLabel },
          { label: labels.selectedSr, value: documentData.selectedSrLabel },
          ...(documentData.partySearchLabel
            ? [{ label: labels.partySearch, value: documentData.partySearchLabel }]
            : []),
          { label: labels.generatedAt, value: documentData.generatedAtLabel },
        ]
      : [
          { label: labels.dateRange, value: documentData.dateRangeLabel },
          { label: labels.territory, value: documentData.territoryLabel },
          ...(documentData.srSearchLabel
            ? [{ label: labels.srSearch, value: documentData.srSearchLabel }]
            : []),
          { label: labels.generatedAt, value: documentData.generatedAtLabel },
        ];

  return (
    <DocumentLayout className="doc-sr-performance-layout">
      <CompanyHeader branding={branding} />
      <DocumentTitle title={documentData.title} />
      <DocumentMetadata
        primaryReference={documentData.readOnlyLabel}
        fields={metadataFields}
      />
      {payload.mode === "individual" ? (
        <SrPerformanceDealerTable
          rows={documentData.individualRows}
          totals={documentData.individualTotals}
          labels={labels}
        />
      ) : (
        <SrPerformanceOverviewTable
          rows={documentData.overviewRows}
          totals={documentData.overviewTotals}
          labels={labels}
        />
      )}
      <DocumentNotes
        title={labels.notesTitle}
        text={documentData.notes.join(" · ")}
      />
      <CompanyFooter message={branding.tagline} />
    </DocumentLayout>
  );
}
