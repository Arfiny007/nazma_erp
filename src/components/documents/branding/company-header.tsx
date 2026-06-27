
import type { CompanyBranding } from "@/lib/documents/company-branding";

interface CompanyHeaderProps {
  branding: CompanyBranding;
}

export function CompanyHeader({ branding }: CompanyHeaderProps) {
  return (
    <header className="document-avoid-break mb-2 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
      <img
        src={branding.logoSrc}
        alt={branding.companyName}
        width={56}
        height={56}
        className="h-14 w-14 shrink-0 object-contain"
        loading="eager"
        />
        <div className="min-w-0">
          <p className="text-[17pt] font-bold leading-tight doc-blue">
            {branding.shortDisplayName}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="block h-px w-3 bg-[var(--doc-enterprise-blue)]" />
            <p className="text-[8pt] font-semibold tracking-[0.12em] doc-blue">
              {branding.tagline}
            </p>
            <span className="block h-px w-3 bg-[var(--doc-enterprise-blue)]" />
          </div>
        </div>
      </div>

      <address className="max-w-[48%] text-right text-[8pt] not-italic leading-snug doc-blue">
        <p className="font-bold">{branding.companyName}</p>
        <p>{branding.address}</p>
        <p>
          <span aria-hidden="true">☎ </span>
          {branding.phone}
        </p>
        <p>
          <span aria-hidden="true">✉ </span>
          {branding.email}
        </p>
        <p>
          <span aria-hidden="true">🌐 </span>
          {branding.website}
        </p>
      </address>
    </header>
  );
}
