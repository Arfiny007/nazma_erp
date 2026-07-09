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
    | "grandTotal"
    | "previousDue"
    | "currentDue"
    | "outstanding"
  >;
  formatMoney: (value: string) => string;
}

/**
 * Invoice financial block — groups lines visually into Invoice Amount and
 * Due Summary sections. Composes shared DocumentFinancialSummary.
 * No financial logic — all values are server-sourced strings.
 */
export function FinancialSummary({
  financial,
  labels,
  formatMoney,
}: FinancialSummaryProps) {
  const lines: DocumentFinancialLine[] = [
    { label: labels.subtotal, value: formatMoney(financial.subtotal) },
    {
      label: labels.grandTotal,
      value: formatMoney(financial.grandTotal),
      highlight: true,
    },
    {
      label: labels.previousDue,
      value: formatMoney(financial.previousDue),
      divider: true,
    },
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
  ];

  return <DocumentFinancialSummary lines={lines} />;
}

export { DocumentFinancialSummary };
