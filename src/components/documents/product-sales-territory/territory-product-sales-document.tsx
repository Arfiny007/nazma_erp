"use client";

import { useMemo } from "react";

import { CompanyFooter } from "@/components/documents/branding/company-footer";
import { CompanyHeader } from "@/components/documents/branding/company-header";
import { DocumentLayout } from "@/components/documents/layout/document-layout";
import { DocumentMetadata } from "@/components/documents/sections/document-metadata";
import { DocumentTitle } from "@/components/documents/sections/document-title";
import "@/components/documents/styles/document-print.css";
import { getCompanyBranding } from "@/lib/documents/company-branding";
import { createDocumentDateFormatter } from "@/lib/utils/format-money";
import type { TerritoryProductSalesPrintPayloadDTO } from "@/types/product-sales-territory";

import { mapTerritoryProductSalesToDocument } from "./product-sales-document-mapper";
import type { TerritoryProductSalesDocumentLabels } from "./product-sales-document-types";
import { TerritoryProductSalesDiagnostics } from "./territory-product-sales-diagnostics";
import { TerritoryProductSalesHeader } from "./territory-product-sales-header";
import { TerritoryProductSalesSummary } from "./territory-product-sales-summary";
import { TerritoryProductSalesTable } from "./territory-product-sales-table";

interface TerritoryProductSalesDocumentProps {
  payload: TerritoryProductSalesPrintPayloadDTO;
  labels: TerritoryProductSalesDocumentLabels;
  locale: "en" | "bn";
}

function formatQuantityDisplay(value: string, locale: "en" | "bn"): string {
  const [whole, fraction = "00"] = value.split(".");
  const digits = whole.replace(/\D/g, "") || "0";
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (locale !== "bn") {
    return `${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
  }
  const bnDigits = "০১২৩৪৫৬৭৮৯";
  const toBn = (s: string) =>
    s.replace(/\d/g, (d) => bnDigits[Number(d)] ?? d);
  return `${toBn(grouped)}.${toBn(fraction.padEnd(2, "0").slice(0, 2))}`;
}

function formatIntegerDisplay(value: number, locale: "en" | "bn"): string {
  const raw = String(Math.trunc(value));
  const grouped = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (locale !== "bn") {
    return grouped;
  }
  return grouped.replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)] ?? d);
}

/**
 * Single source of truth for Territory Product Sales preview / print / PDF.
 * Formats labels only — no quantity arithmetic on DTO strings.
 */
export function TerritoryProductSalesDocument({
  payload,
  labels,
  locale,
}: TerritoryProductSalesDocumentProps) {
  const branding = getCompanyBranding();
  const dateFormatter = useMemo(
    () => createDocumentDateFormatter(locale),
    [locale],
  );

  const documentData = useMemo(() => {
    return mapTerritoryProductSalesToDocument(payload, labels, {
      formatQuantity: (value) => formatQuantityDisplay(value, locale),
      formatInteger: (value) => formatIntegerDisplay(value, locale),
      formatDate: (isoDate) => {
        const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(isoDate);
        if (dateOnly) {
          const [y, m, d] = isoDate.split("-").map(Number);
          return dateFormatter.format(new Date(y!, m! - 1, d!));
        }
        return dateFormatter.format(new Date(isoDate));
      },
      formatDateTime: (iso) =>
        new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(iso)),
    });
  }, [payload, labels, dateFormatter, locale]);

  return (
    <DocumentLayout className="doc-product-sales-layout">
      <CompanyHeader branding={branding} />
      <DocumentTitle title={documentData.title} />
      <DocumentMetadata
        primaryReference={documentData.readOnlyLabel}
        fields={[
          { label: labels.from, value: documentData.fromLabel },
          { label: labels.to, value: documentData.toLabel },
          {
            label: labels.territoryScope,
            value: documentData.territoryScopeLabel,
          },
          { label: labels.generatedAt, value: documentData.generatedAtLabel },
          { label: labels.preparedFor, value: documentData.preparedForLabel },
        ]}
      />
      <TerritoryProductSalesHeader
        labels={labels}
        fromLabel={documentData.fromLabel}
        toLabel={documentData.toLabel}
        territoryScopeLabel={documentData.territoryScopeLabel}
        generatedAtLabel={documentData.generatedAtLabel}
        preparedForLabel={documentData.preparedForLabel}
      />
      <TerritoryProductSalesSummary
        labels={labels}
        summary={documentData.summary}
      />
      <TerritoryProductSalesTable
        rows={documentData.rows}
        labels={labels}
        emptyLabel={labels.empty}
      />
      <TerritoryProductSalesDiagnostics
        labels={labels}
        diagnostics={documentData.diagnostics}
      />
      <CompanyFooter message={branding.tagline} />
    </DocumentLayout>
  );
}
