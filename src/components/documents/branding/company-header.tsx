import type { CompanyBranding } from "@/lib/documents/company-branding";

interface CompanyHeaderProps {
  branding: CompanyBranding;
}

export function CompanyHeader({ branding }: CompanyHeaderProps) {
  return (
    <header className="document-avoid-break mb-3 flex items-start justify-between gap-4">
      {/* Left — logo + brand identity */}
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={branding.logoSrc}
          alt={branding.companyName}
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 object-contain"
          loading="eager"
        />
        <div className="min-w-0">
          <p
            className="font-black leading-none tracking-tight doc-blue"
            style={{ fontSize: "32pt" }}
          >
            {branding.shortDisplayName}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="block shrink-0 bg-[var(--doc-enterprise-blue)]"
              style={{ height: "1px", width: "18px" }}
            />
            <p
              className="font-bold doc-blue"
              style={{
                fontSize: "9pt",
                letterSpacing: "0.16em",
              }}
            >
              {branding.tagline}
            </p>
            <span
              className="block shrink-0 bg-[var(--doc-enterprise-blue)]"
              style={{ height: "1px", width: "18px" }}
            />
          </div>
        </div>
      </div>

      {/* Vertical rule separator */}
      <div
        className="self-stretch shrink-0 bg-[var(--doc-border)]"
        style={{ width: "1px" }}
        aria-hidden="true"
      />

      {/* Right — contact details */}
      <address className="text-right not-italic" style={{ fontSize: "8pt", lineHeight: "1.55" }}>
        <p className="font-bold doc-blue" style={{ fontSize: "8.5pt" }}>
          {branding.companyName}
        </p>
        <p className="text-[var(--doc-muted)]">{branding.address}</p>
        <p className="text-[var(--doc-muted)]">
          <span className="font-semibold doc-blue">T</span> {branding.phone}
        </p>
        <p className="text-[var(--doc-muted)]">
          <span className="font-semibold doc-blue">E</span> {branding.email}
        </p>
        <p className="text-[var(--doc-muted)]">
          <span className="font-semibold doc-blue">W</span> {branding.website}
        </p>
      </address>
    </header>
  );
}
