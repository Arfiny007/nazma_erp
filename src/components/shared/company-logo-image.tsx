import { getCompanyBranding } from "@/lib/documents/company-branding";
import { cn } from "@/lib/utils";

interface CompanyLogoImageProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<CompanyLogoImageProps["size"]>, string> = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

export function CompanyLogoImage({
  size = "sm",
  className,
}: CompanyLogoImageProps) {
  const branding = getCompanyBranding();

  return (
    <img
      src={branding.logoSrc}
      alt={branding.companyName}
      width={size === "lg" ? 64 : size === "md" ? 48 : 36}
      height={size === "lg" ? 64 : size === "md" ? 48 : 36}
      className={cn("shrink-0 object-contain", SIZE_CLASSES[size], className)}
    />
  );
}
