import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { getCompanyBranding } from "@/lib/documents/company-branding";

import type { BrandingCertificationCheckResult } from "./branding-certification-types";

const PROJECT_ROOT = path.resolve(process.cwd());

function readSource(relativePath: string): string {
  return readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

function fileExists(relativePath: string): boolean {
  return existsSync(path.join(PROJECT_ROOT, relativePath));
}

function check(
  id: string,
  name: string,
  passed: boolean,
  message: string,
): BrandingCertificationCheckResult {
  return {
    id,
    name,
    passed,
    status: passed ? "passed" : "failed",
    message,
  };
}

/**
 * Branding Certification — PHASE_11E.1 hotfix.
 *
 * Verifies unified company logo consumption across shell and document surfaces.
 *
 * @see ADR-058
 */
export function runBrandingCertificationChecks(): BrandingCertificationCheckResult[] {
  const branding = getCompanyBranding();
  const logoRelativePath = branding.logoSrc.replace(/^\//, "");

  const companyLogoImage = readSource("src/components/shared/company-logo-image.tsx");
  const appLogo = readSource("src/components/shared/app-logo.tsx");
  const authPageShell = readSource("src/components/auth/auth-page-shell.tsx");
  const loginPage = readSource("src/app/(auth)/login/page.tsx");
  const middleware = readSource("middleware.ts");
  const invoicePrintable = readSource(
    "src/components/documents/invoice/invoice-printable.tsx",
  );
  const challanPrintable = readSource(
    "src/components/documents/challan/challan-printable.tsx",
  );
  const companyHeader = readSource(
    "src/components/documents/branding/company-header.tsx",
  );

  return [
    check(
      "RULE_BRANDING_01_UNIFIED_SOURCE",
      "Company logo image reads getCompanyBranding().logoSrc",
      companyLogoImage.includes("getCompanyBranding()") &&
        companyLogoImage.includes("branding.logoSrc"),
      "CompanyLogoImage must resolve logo via getCompanyBranding().logoSrc",
    ),
    check(
      "RULE_BRANDING_02_LOGIN_PAGE",
      "Login page renders CompanyLogoImage",
      loginPage.includes("CompanyLogoImage"),
      "Login page must render CompanyLogoImage",
    ),
    check(
      "RULE_BRANDING_03_DASHBOARD_SHELL",
      "Sidebar AppLogo renders CompanyLogoImage",
      appLogo.includes("CompanyLogoImage"),
      "AppLogo must render CompanyLogoImage",
    ),
    check(
      "RULE_BRANDING_04_AUTH_SHELL",
      "Auth pages render CompanyLogoImage",
      authPageShell.includes("CompanyLogoImage"),
      "AuthPageShell must render CompanyLogoImage",
    ),
    check(
      "RULE_BRANDING_05_INVOICE_DOCUMENT",
      "Invoice printable uses CompanyHeader branding",
      invoicePrintable.includes("CompanyHeader") &&
        invoicePrintable.includes("getCompanyBranding"),
      "Invoice printable must use CompanyHeader + getCompanyBranding()",
    ),
    check(
      "RULE_BRANDING_06_CHALLAN_DOCUMENT",
      "Challan printable uses CompanyHeader branding",
      challanPrintable.includes("CompanyHeader") &&
        challanPrintable.includes("getCompanyBranding"),
      "Challan printable must use CompanyHeader + getCompanyBranding()",
    ),
    check(
      "RULE_BRANDING_07_DOCUMENT_HEADER",
      "Document header uses branding.logoSrc",
      companyHeader.includes("branding.logoSrc"),
      "CompanyHeader must render branding.logoSrc",
    ),
    check(
      "RULE_BRANDING_08_ASSET_EXISTS",
      "Branding logo asset exists on disk",
      fileExists(path.join("public", logoRelativePath)),
      `Expected logo asset at public/${logoRelativePath}`,
    ),
    check(
      "RULE_BRANDING_09_MIDDLEWARE_PUBLIC_ASSETS",
      "Middleware allows unauthenticated branding asset requests",
      middleware.includes("branding") && middleware.includes("locales"),
      "Middleware matcher must exclude branding/ and locales/ public assets",
    ),
    check(
      "RULE_BRANDING_10_NO_DUPLICATE_SHELL_LOGO",
      "Shell components do not hardcode alternate logo paths",
      !appLogo.includes('d="M12 3L4 9v12') &&
        !loginPage.includes('d="M12 3L4 9v12') &&
        !authPageShell.includes('d="M12 3L4 9v12'),
      "Shell/auth components must not use legacy inline SVG house logo",
    ),
  ];
}

export function buildBrandingCertificationResult() {
  const checks = runBrandingCertificationChecks();
  const findings = checks
    .filter((item) => !item.passed)
    .map((item) => `${item.id}: ${item.message}`);

  return {
    checks,
    findings,
    passed: findings.length === 0,
  };
}
