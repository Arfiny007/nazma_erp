import type { Prisma } from "@prisma/client";

/**
 * Invoice number generation utilities.
 *
 * Invoice numbers follow `INV-000001`, `INV-000002`, … with a fixed-width,
 * zero-padded sequence. Generated inside the issuing transaction.
 */

export const INVOICE_NO_PREFIX = "INV";
export const INVOICE_NO_SEPARATOR = "-";
export const INVOICE_NO_PAD_LENGTH = 6;

const INVOICE_NO_PATTERN = /^INV-(\d+)$/;

type InvoiceReadClient = Pick<Prisma.TransactionClient, "invoice">;

export function formatInvoiceNo(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(
      `Invoice number sequence must be a positive integer, received: ${sequence}`,
    );
  }

  const padded = String(sequence).padStart(INVOICE_NO_PAD_LENGTH, "0");
  return `${INVOICE_NO_PREFIX}${INVOICE_NO_SEPARATOR}${padded}`;
}

export function parseInvoiceNoSequence(invoiceNo: string): number | null {
  const match = INVOICE_NO_PATTERN.exec(invoiceNo.trim());
  if (!match) {
    return null;
  }

  const sequence = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(sequence) ? sequence : null;
}

export function isValidInvoiceNo(invoiceNo: string): boolean {
  return parseInvoiceNoSequence(invoiceNo) !== null;
}

export async function generateNextInvoiceNo(
  client: InvoiceReadClient,
): Promise<string> {
  const latest = await client.invoice.findFirst({
    orderBy: { createdAt: "desc" },
    select: { invoiceNo: true },
  });

  const lastSequence = latest
    ? (parseInvoiceNoSequence(latest.invoiceNo) ?? 0)
    : 0;

  return formatInvoiceNo(lastSequence + 1);
}
