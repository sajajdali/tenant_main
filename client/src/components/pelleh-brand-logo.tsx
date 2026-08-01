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
  const logoUrl = typeof settings.logoUrl === "string" && settings.logoUrl.trim() ? settings.logoUrl : "";
  const siteTitle = typeof settings.siteTitle === "string" && settings.siteTitle.trim() ? settings.siteTitle : "استپ";

  return (
    <a href={href} className={className} aria-label={siteTitle}>
      {logoUrl ? (
        <img src={logoUrl} alt={siteTitle} className={imageClassName} />
      ) : (
        <span className="text-2xl font-black leading-none text-white sm:text-[28px]">استپ</span>
      )}
    </a>
  );
}
