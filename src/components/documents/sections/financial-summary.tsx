import type { DocumentFinancialDTO, DocumentLabels } from "@/types/document";

import {
  DocumentFinancialSummary,
  type DocumentFinancialLine,
} from "@/components/documents/sections/document-financial-summary";

interface FinancialSummaryProps {
  financial: DocumentFinancialDTO;
  labels: Pick<
    DocumentLabels,
    | "subtotal"
    | "discount"
    | "vat"
    | "grandTotal"
    | "previousDue"
    | "currentDue"
    | "outstanding"
    | "status"
  >;
  statusLabel: string;
  formatMoney: (value: string) => string;
}

/** Invoice financial block — composes shared DocumentFinancialSummary. */
export function FinancialSummary({
  financial,
  labels,
  statusLabel,
  formatMoney,
}: FinancialSummaryProps) {
  const lines: DocumentFinancialLine[] = [
    { label: labels.subtotal, value: formatMoney(financial.subtotal) },
    { label: labels.discount, value: formatMoney(financial.discount) },
    { label: labels.vat, value: formatMoney(financial.vat) },
    {
      label: labels.grandTotal,
      value: formatMoney(financial.grandTotal),
      highlight: true,
    },
    { label: labels.previousDue, value: formatMoney(financial.previousDue) },
    {
      label: labels.currentDue,
      value: formatMoney(financial.currentDue),
      emphasis: true,
    },
    {
      label: labels.outstanding,
      value: formatMoney(financial.outstanding),
      emphasis: true,
    },
    { label: labels.status, value: statusLabel },
  ];

  return <DocumentFinancialSummary lines={lines} />;
}

export { DocumentFinancialSummary };
