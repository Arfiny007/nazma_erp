/**
 * Enterprise Document Platform — design tokens.
 *
 * Single source of truth for all printable document visual constants.
 * Every document (Invoice, Money Receipt, Delivery Challan, Ledger Statement,
 * Dealer Statement, Credit Note, etc.) references these tokens instead of
 * hardcoding values.
 *
 * PHASE_06D.2 — Production Design Freeze
 * ADR-017 — Enterprise Document Engine
 */

/** Core color palette for all printable documents. */
export const DOC_COLORS = {
  enterpriseBlue: "#1a5dad",
  enterpriseBlueDark: "#164a8f",
  border: "#d1d5db",
  text: "#111827",
  muted: "#4b5563",
  surface: "#ffffff",
  sectionDivider: "#e5e7eb",
} as const;

/** Typography scale for all document components. */
export const DOC_TYPOGRAPHY = {
  companyNamePt: "32pt",
  taglinePt: "9pt",
  taglineTracking: "0.16em",

  titlePt: "17pt",
  titleTracking: "0.12em",
  titleWeight: "900",

  sectionHeaderPt: "8.5pt",
  bodyPt: "9pt",

  tableBodyPt: "7.5pt",
  tableHeaderPt: "8pt",

  summaryPt: "8pt",
  summaryGroupHeaderPt: "6.5pt",

  metaPt: "8pt",
  primaryRefPt: "14pt",

  footerPt: "9pt",
} as const;

/** Spacing and sizing constants. */
export const DOC_SPACING = {
  pagePaddingMm: "8mm",
  summaryWidthMm: "72mm",
  signatureWidthMm: "72mm",
  signatureTopMarginPx: "28px",
} as const;

/**
 * Product table column widths — 7 columns (no Discount column).
 * All values sum to 100%.
 */
export const DOC_PRODUCT_TABLE_COLS = {
  sl: "4%",
  code: "9%",
  name: "42%",
  unit: "8%",
  qty: "8%",
  price: "14%",
  amount: "15%",
} as const;

/** Data table column widths (Money Receipt allocation table). */
export const DOC_DATA_TABLE_COLS = {
  refType: "28%",
  refNo: "44%",
  refAmount: "28%",
} as const;

/** Statement table column widths — 7 columns. Sum = 100%. */
export const DOC_STATEMENT_TABLE_COLS = {
  date: "11%",
  postingType: "13%",
  referenceNo: "14%",
  description: "28%",
  debit: "11%",
  credit: "11%",
  runningBalance: "12%",
} as const;
