export const BRANDING_CERTIFICATION_VERSION = "1.0.0";

export type BrandingCertificationStatus = "passed" | "failed" | "warning";

export interface BrandingCertificationCheckResult {
  id: string;
  name: string;
  passed: boolean;
  status: BrandingCertificationStatus;
  message: string;
}

export interface BrandingCertificationResult {
  certificationVersion: string;
  passed: boolean;
  checks: BrandingCertificationCheckResult[];
  findings: string[];
}
