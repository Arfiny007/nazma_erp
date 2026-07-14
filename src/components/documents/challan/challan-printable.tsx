"use client";

import { useMemo } from "react";

import { CompanyFooter } from "@/components/documents/branding/company-footer";
import { CompanyHeader } from "@/components/documents/branding/company-header";
import { DocumentLayout } from "@/components/documents/layout/document-layout";
import { DocumentMetadata } from "@/components/documents/sections/document-metadata";
import { DocumentNotes } from "@/components/documents/sections/document-notes";
import { DocumentParties } from "@/components/documents/sections/document-parties";
import { DocumentSignature } from "@/components/documents/sections/document-signature";
import { DocumentTable } from "@/components/documents/sections/document-table";
import { DocumentTitle } from "@/components/documents/sections/document-title";
import "@/components/documents/styles/document-print.css";
import { getCompanyBranding } from "@/lib/documents/company-branding";
import { createDocumentDateFormatter } from "@/lib/utils/format-money";
import type { ChallanDetailLineDTO, DeliveryChallanDetailDTO } from "@/types/delivery-challan";

export interface ChallanDocumentLabels {
  title: string;
  dealer: string;
  orderNo: string;
  status: string;
  deliveryMode: string;
  vehicleNo: string;
  driverName: string;
  dispatchedAt: string;
  createdAt: string;
  columnSl: string;
  columnProduct: string;
  columnSku: string;
  columnUnit: string;
  columnQuantity: string;
  remarks: string;
  authorizedBy: string;
  footerNote: string;
  notSet: string;
  notDispatched: string;
}

interface ChallanPrintableProps {
  challan: DeliveryChallanDetailDTO;
  detailLines: ChallanDetailLineDTO[];
  labels: ChallanDocumentLabels;
  statusLabel: string;
  deliveryModeLabel: string;
  locale: "en" | "bn";
}

export function ChallanPrintable({
  challan,
  detailLines,
  labels,
  statusLabel,
  deliveryModeLabel,
  locale,
}: ChallanPrintableProps) {
  const branding = getCompanyBranding();

  const dateFormatter = useMemo(() => createDocumentDateFormatter(locale), [locale]);
  const quantityFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
        maximumFractionDigits: 2,
      }),
    [locale],
  );

  const formatDate = (iso: string) => dateFormatter.format(new Date(iso));
  const formatQuantity = (value: string, unit?: string) => {
    const formatted = quantityFormatter.format(Number(value));
    return unit ? `${formatted} ${unit}` : formatted;
  };

  const lineRows = detailLines.filter(
    (line) => Number.parseFloat(line.currentDelivery) > 0,
  );

  return (
    <DocumentLayout>
      <CompanyHeader branding={branding} />
      <DocumentTitle title={labels.title} />
      <DocumentMetadata
        primaryReference={challan.challanNo}
        parties={
          <DocumentParties
            parties={[
              {
                label: labels.dealer,
                party: {
                  name: `${challan.dealerCode} · ${challan.dealerName}`,
                  address: challan.orderNo,
                  phone: "",
                },
              },
            ]}
          />
        }
        fields={[
          { label: labels.orderNo, value: challan.orderNo },
          { label: labels.status, value: statusLabel },
          { label: labels.deliveryMode, value: deliveryModeLabel },
          {
            label: labels.vehicleNo,
            value: challan.vehicleNo ?? labels.notSet,
          },
          {
            label: labels.driverName,
            value: challan.driverName ?? labels.notSet,
          },
          {
            label: labels.dispatchedAt,
            value: challan.dispatchedAt
              ? formatDate(challan.dispatchedAt)
              : labels.notDispatched,
          },
          { label: labels.createdAt, value: formatDate(challan.createdAt) },
        ]}
      />
      <DocumentTable
        caption={labels.columnProduct}
        variant="standard"
        rows={lineRows}
        rowKey={(row) => row.orderItemId}
        columns={[
          {
            key: "sl",
            header: labels.columnSl,
            align: "center",
            className: "col-ref-type",
            render: (_row, index) => index + 1,
          },
          {
            key: "product",
            header: labels.columnProduct,
            render: (row) => row.productName,
          },
          {
            key: "sku",
            header: labels.columnSku,
            className: "col-ref-no",
            render: (row) => row.productSku,
          },
          {
            key: "unit",
            header: labels.columnUnit,
            align: "center",
            render: (row) => row.unit,
          },
          {
            key: "quantity",
            header: labels.columnQuantity,
            align: "right",
            className: "col-ref-amount",
            render: (row) => formatQuantity(row.currentDelivery, row.unit),
          },
        ]}
      />
      <div className="document-avoid-break flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {challan.remarks ? (
            <DocumentNotes title={labels.remarks} text={challan.remarks} />
          ) : (
            <DocumentNotes title={labels.remarks} text={labels.footerNote} />
          )}
        </div>
        <DocumentSignature lines={[labels.authorizedBy]} />
      </div>
      <CompanyFooter message={branding.tagline} />
    </DocumentLayout>
  );
}

export function buildChallanDocumentLabels(
  t: (key: string) => string,
): ChallanDocumentLabels {
  return {
    title: t("document.challan.title"),
    dealer: t("challan.detail.dealer"),
    orderNo: t("challan.detail.order"),
    status: t("challan.detail.status"),
    deliveryMode: t("challan.detail.deliveryMode"),
    vehicleNo: t("challan.detail.vehicleNo"),
    driverName: t("challan.detail.driverName"),
    dispatchedAt: t("challan.detail.dispatchedAt"),
    createdAt: t("challan.detail.createdAt"),
    columnSl: t("document.challan.columnSl"),
    columnProduct: t("challan.detail.column.product"),
    columnSku: t("document.challan.columnSku"),
    columnUnit: t("document.challan.columnUnit"),
    columnQuantity: t("challan.detail.column.currentDelivery"),
    remarks: t("challan.detail.remarks"),
    authorizedBy: t("document.challan.authorizedBy"),
    footerNote: t("document.challan.footerNote"),
    notSet: t("challan.notSet"),
    notDispatched: t("challan.notDispatched"),
  };
}

export function challanStatusLabel(
  status: DeliveryChallanDetailDTO["status"],
  t: (key: string) => string,
): string {
  return t(`challan.status.${status}`);
}
