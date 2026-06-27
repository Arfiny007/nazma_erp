/**
 * Central company branding configuration for all printable documents.
 *
 * Future company settings UI will override these defaults. Document components
 * must never hardcode company contact details.
 */

export interface CompanyBranding {
  /** Display name — primary heading */
  companyName: string;
  /** Short brand word shown beside the logo */
  shortDisplayName: string;
  /** Secondary tagline shown under the logo block */
  tagline: string;
  /** Full postal address (single line or multiline) */
  address: string;
  phone: string;
  email: string;
  website: string;
  /** Public path to the company logo asset */
  logoSrc: string;
  /** Optional regulatory identifiers — reserved for future settings */
  bin?: string;
  tradeLicense?: string;
  vatRegistration?: string;
}

/** Default Nazma Water Taps branding — replace via settings in a future phase. */
export const DEFAULT_COMPANY_BRANDING: CompanyBranding = {
  companyName: "Nazma Water Taps",
  shortDisplayName: "Nazma",
  tagline: "WATER TAPS",
  address: "Jatrabari, Dhaka-1204, Bangladesh",
  phone: "+880 1712-345678",
  email: "nazmawatertaps@gmail.com",
  website: "nazmawatertaps.com",
  logoSrc: "/branding/nazma-logo.png",
};

export function getCompanyBranding(): CompanyBranding {
  return DEFAULT_COMPANY_BRANDING;
}
