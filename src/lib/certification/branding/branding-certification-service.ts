import {
  BRANDING_CERTIFICATION_VERSION,
  type BrandingCertificationResult,
} from "./branding-certification-types";
import { buildBrandingCertificationResult } from "./branding-certification-validation";

export function runBrandingCertification(): BrandingCertificationResult {
  const { checks, findings, passed } = buildBrandingCertificationResult();

  return {
    certificationVersion: BRANDING_CERTIFICATION_VERSION,
    passed,
    checks,
    findings,
  };
}
