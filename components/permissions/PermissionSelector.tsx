"use client";

import { useLanguageStore } from "@/lib/language-store";
import {
  getPermissionCategoryLabel,
  getPermissionLabel,
} from "@/lib/permission-labels";
import type { PermissionCategoryDto, PermissionOption } from "@/lib/permissions";
import { flattenPermissionCategories } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

type PermissionSelectorProps = {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  options?: PermissionOption[];
  categories?: PermissionCategoryDto[];
  /** Gọn hơn — pill nhỏ */
  compact?: boolean;
  /** flat = một dải pill; grid = lưới thẻ (modal onboarding) */
  layout?: "grouped" | "flat" | "grid";
  maxHeightClass?: string;
};

export function PermissionSelector({
  selected,
  onChange,
  disabled,
  options,
  categories,
  compact = false,
  layout = "grouped",
  maxHeightClass = "max-h-56",
}: PermissionSelectorProps) {
  const { language } = useLanguageStore();
  const lang = language === "en" ? "en" : "vi";
  const isFlat = layout === "flat";
  const isGrid = layout === "grid";

  const toggle = (code: string) => {
    if (disabled) return;
    onChange(
      selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code]
    );
  };

  const pillClass = (active: boolean) =>
    cn(
      "rounded-full font-medium transition",
      isFlat ? "px-2 py-0.5 text-[10px] leading-tight" : compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-xs",
      active
        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 ring-1 ring-emerald-300/50 dark:ring-emerald-400/40"
        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700",
      disabled && "cursor-not-allowed opacity-50"
    );

  const renderPill = (permission: PermissionOption) => {
    const active = selected.includes(permission.code);
    const label = getPermissionLabel(permission.code, permission, lang);
    return (
      <button
        key={permission.code}
        type="button"
        disabled={disabled}
        onClick={() => toggle(permission.code)}
        title={permission.code}
        className={pillClass(active)}
      >
        {label}
      </button>
    );
  };

  const flatList =
    options ?? (categories ? flattenPermissionCategories(categories) : []);

  if (isGrid) {
    if (flatList.length === 0) {
      return (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {lang === "en"
            ? "No permissions available."
            : "Không có quyền để chọn."}
        </p>
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {flatList.map((permission) => {
          const active = selected.includes(permission.code);
          const label = getPermissionLabel(permission.code, permission, lang);
          return (
            <button
              key={permission.code}
              type="button"
              disabled={disabled}
              onClick={() => toggle(permission.code)}
              title={permission.code}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium leading-tight transition",
                active
                  ? "border-blue-500/80 bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20 dark:text-blue-300 dark:ring-blue-500/30"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:border-zinc-600",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  if (isFlat) {
    if (flatList.length === 0) {
      return (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {lang === "en"
            ? "No permissions available."
            : "Không có quyền để chọn."}
        </p>
      );
    }
    return (
      <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-1.5 dark:border-zinc-700/80 dark:bg-zinc-900/30">
        {flatList.map((permission) => renderPill(permission))}
      </div>
    );
  }

  const containerClass = cn(
    "rounded-xl border border-zinc-200 dark:border-zinc-700",
    compact ? "p-2" : "p-3",
    maxHeightClass && "overflow-auto",
    maxHeightClass
  );

  const groupedHasPermissions =
    categories?.some((category) => (category.permissions?.length ?? 0) > 0) ?? false;

  if (categories && categories.length > 0 && groupedHasPermissions) {
    return (
      <div className={containerClass}>
        <div className={cn(compact ? "space-y-2" : "space-y-3")}>
          {categories.map((category) => {
            const categoryKey = category.category ?? "Other";
            const permissions = category.permissions ?? [];
            if (permissions.length === 0) return null;
            return (
              <div key={categoryKey}>
                <p
                  className={cn(
                    "mb-1.5 font-medium text-zinc-500 dark:text-zinc-400",
                    compact ? "text-[11px]" : "text-xs"
                  )}
                >
                  {getPermissionCategoryLabel(categoryKey, lang)}
                </p>
                <div className={cn("flex flex-wrap", compact ? "gap-1.5" : "gap-2")}>
                  {permissions.map((permission) =>
                    renderPill({
                      code: permission.code,
                      nameEn: permission.name,
                      nameVi: permission.description,
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (flatList.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 px-3 py-3 text-sm text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
        {lang === "en"
          ? "No permissions available. Restart the backend or try again later."
          : "Không có quyền để chọn. Hãy khởi động lại backend hoặc thử lại sau."}
      </p>
    );
  }

  return (
    <div className={containerClass}>
      <div className={cn("flex flex-wrap", compact ? "gap-1" : "gap-2")}>
        {flatList.map((permission) => renderPill(permission))}
      </div>
    </div>
  );
}
