"use client";

import { twMerge } from "tailwind-merge";

const DEFAULT_LOGO_URL = "/logo-transparent.png";

interface AppLogoProps {
  size?: number;
  className?: string;
  imageClassName?: string;
  alt?: string;
  tenantLogoUrl?: string | null;
  tenantName?: string | null;
}

export function AppLogo({
  size = 36,
  className = "",
  imageClassName = "",
  alt,
  tenantLogoUrl = null,
  tenantName = null,
}: AppLogoProps) {
  const normalizedTenantLogoUrl = tenantLogoUrl?.trim();
  const resolvedLogoUrl = normalizedTenantLogoUrl ? normalizedTenantLogoUrl : DEFAULT_LOGO_URL;
  const resolvedAlt = alt ?? (tenantName?.trim() ? `${tenantName} logo` : "Internal Consultant AI logo");

  return (
    <span
      className={twMerge(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <img
        src={resolvedLogoUrl}
        alt={resolvedAlt}
        className={twMerge(
          "block h-full w-full rounded-lg object-contain",
          imageClassName
        )}
        loading="lazy"
      />
    </span>
  );
}

