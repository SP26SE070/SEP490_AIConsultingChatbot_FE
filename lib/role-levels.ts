/** Cấp bậc vai trò (1–5) — khớp API tenant roles `level`. */
export const DEFAULT_ROLE_LEVEL = 4;

export type RoleLevelLang = "vi" | "en";

export interface RoleLevelOption {
  value: number;
  /** Nhãn ngắn cho bảng / badge */
  shortLabel: Record<RoleLevelLang, string>;
  /** Nhãn đầy đủ cho dropdown */
  dropdownLabel: Record<RoleLevelLang, string>;
}

export const ROLE_LEVEL_OPTIONS: RoleLevelOption[] = [
  {
    value: 1,
    shortLabel: { vi: "Executive", en: "Executive" },
    dropdownLabel: {
      vi: "Level 1 — Executive (CEO, Giám đốc)",
      en: "Level 1 — Executive (CEO, Director)",
    },
  },
  {
    value: 2,
    shortLabel: { vi: "Management", en: "Management" },
    dropdownLabel: {
      vi: "Level 2 — Management (Manager, Trưởng phòng)",
      en: "Level 2 — Management (Manager, Department head)",
    },
  },
  {
    value: 3,
    shortLabel: { vi: "Senior", en: "Senior" },
    dropdownLabel: {
      vi: "Level 3 — Senior (Team Lead, Senior)",
      en: "Level 3 — Senior (Team Lead, Senior)",
    },
  },
  {
    value: 4,
    shortLabel: { vi: "Nhân viên", en: "Employee" },
    dropdownLabel: {
      vi: "Level 4 — Nhân viên",
      en: "Level 4 — Employee",
    },
  },
  {
    value: 5,
    shortLabel: { vi: "Intern", en: "Intern" },
    dropdownLabel: {
      vi: "Level 5 — Intern (Thực tập)",
      en: "Level 5 — Intern (Internship)",
    },
  },
];

const byValue = new Map(ROLE_LEVEL_OPTIONS.map((o) => [o.value, o]));

export function getRoleLevelOption(level: number | undefined | null): RoleLevelOption | undefined {
  if (level == null || !Number.isFinite(level)) return undefined;
  return byValue.get(level);
}

export function getRoleLevelDropdownLabel(
  level: number | undefined | null,
  lang: RoleLevelLang
): string {
  const opt = getRoleLevelOption(level);
  if (!opt) return "—";
  return opt.dropdownLabel[lang];
}

export function getRoleLevelDisplayLabel(
  level: number | undefined | null,
  lang: RoleLevelLang
): string {
  const opt = getRoleLevelOption(level);
  if (!opt) return "—";
  return `${level} · ${opt.shortLabel[lang]}`;
}

export function roleLevelFieldLabel(lang: RoleLevelLang): string {
  return lang === "en" ? "Role level" : "Cấp bậc";
}

export function minimumRoleLevelFieldLabel(lang: RoleLevelLang): string {
  return lang === "en" ? "Minimum role level" : "Mức vai trò tối thiểu";
}

/** Giải thích quyền xem tài liệu (1 = cao nhất, 5 = thấp nhất; BE: minimumRoleLevel >= userLevel). */
export function minimumRoleLevelTooltip(lang: RoleLevelLang): string {
  return lang === "en"
    ? "Only users with role level ≤ this value can view the document (e.g. set to 4 → levels 1–4 can view; level 5 cannot). Default 4 = all employees."
    : "Chỉ user có level ≤ mức này mới xem được (ví dụ chọn 4 → level 1–4 xem được; level 5 không). Mặc định 4 = tất cả nhân viên.";
}

/** Lấy mức lớn nhất (1–5) trong các role đã chọn; mặc định 4 nếu không có level. */
/** Gợi ý quyền xem sau khi upload (theo level người upload). */
export function documentUploadAccessHint(lang: RoleLevelLang): string {
  return lang === "en"
    ? "Access is set automatically: levels 1–2 see all departments; levels 3–5 only their department (level 3 also sees level 4–5 docs in the same dept)."
    : "Quyền xem tự động theo cấp bậc: level 1–2 xem mọi phòng ban; level 3–5 chỉ phòng ban của bạn (level 3 còn xem tài liệu level 4–5 cùng phòng ban).";
}

export function deriveMinimumRoleLevelFromSelectedRoles(
  selectedRoleIds: number[],
  allRoles: { id: number; level?: number | null }[]
): number {
  const levels = selectedRoleIds
    .map((id) => allRoles.find((r) => r.id === id)?.level)
    .filter((lv): lv is number => typeof lv === "number" && Number.isFinite(lv) && lv >= 1 && lv <= 5);
  if (levels.length === 0) return DEFAULT_ROLE_LEVEL;
  return Math.max(...levels);
}
