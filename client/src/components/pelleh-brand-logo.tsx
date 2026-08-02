import { getInitialTenantMeta } from "@/lib/bootstrap";

type PellehBrandLogoProps = {
  className?: string;
  imageClassName?: string;
  href?: string;
};

export function PellehBrandLogo({
  className = "inline-flex items-center",
  imageClassName = "h-10 w-auto max-w-[180px] object-contain",
  href = "/",
}: PellehBrandLogoProps) {
  const settings = (getInitialTenantMeta()?.landingSiteSettings ?? {}) as Record<string, unknown>;
  const logoUrl = typeof settings.logoUrl === "string" && settings.logoUrl.trim() ? settings.logoUrl : "/step-logo-transparent.png";
  const siteTitle = typeof settings.siteTitle === "string" && settings.siteTitle.trim() ? settings.siteTitle : "استپ";

  return (
    <a href={href} className={className} aria-label={siteTitle}>
      <img src={logoUrl} alt={siteTitle} className={imageClassName} />
    </a>
  );
}
