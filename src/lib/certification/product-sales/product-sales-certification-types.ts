/**
 * Territory Product Sales certification types — PHASE_12B / ADR-061.
 */

export const PRODUCT_SALES_CERTIFICATION_VERSION = "12B.1.1";

export type ProductSalesCheckStatus = "passed" | "failed" | "warning";

export interface ProductSalesCertificationCheckResult {
  id: string;
  name: string;
  passed: boolean;
  status: ProductSalesCheckStatus;
  message: string;
}

export interface ProductSalesCertificationScores {
  security: number;
  dataAccuracy: number;
  performance: number;
  architecture: number;
  dashboardReadiness: number;
}

export interface ProductSalesCertificationResult {
  phase: "PHASE_12B";
  version: string;
  generatedAt: string;
  checks: ProductSalesCertificationCheckResult[];
  scores: ProductSalesCertificationScores;
  warnings: string[];
  manualChecks: string[];
  phase12bApproved: boolean;
  approved: boolean;
  productionReady: boolean;
}
