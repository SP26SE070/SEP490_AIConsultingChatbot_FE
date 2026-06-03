/** Màu nhấn theo portal: Staff/Super Admin = xanh dương, Tenant/Employee = emerald. */

export type PortalAccent = "blue" | "emerald";

const STAFF_SUPER_ROLES = ["ROLE_STAFF", "ROLE_SUPER_ADMIN"];

export function getPortalAccent(roles: string[] | undefined): PortalAccent {
  if (!roles?.length) return "emerald";
  const isBlue = roles.some((r) =>
    STAFF_SUPER_ROLES.some((key) => r.includes(key))
  );
  return isBlue ? "blue" : "emerald";
}

export const portalAccentStyles = {
  blue: {
    spinner: "border-blue-500",
    tabActive: "bg-blue-500",
    tabHover: "hover:bg-blue-50 dark:hover:bg-blue-950/30",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    avatarGradient: "bg-linear-to-br from-blue-500 to-blue-600",
    icon: "text-blue-500 dark:text-blue-400",
    iconBg: "bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400",
    inputFocus:
      "focus:border-blue-400 focus:ring-blue-400/30 dark:focus:border-blue-400 dark:focus:ring-blue-400/30",
    inputFocusWithin:
      "focus-within:border-blue-400 focus-within:ring-blue-400/30 dark:focus-within:border-blue-400 dark:focus-within:ring-blue-400/30",
    btnPrimary: "bg-blue-600 hover:bg-blue-700",
    formCard: "border-blue-200/80 bg-blue-50/30 dark:border-blue-800/80 dark:bg-blue-950/20",
    formIconBg: "bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400",
    navActive: "bg-blue-500 text-white",
    navInactive:
      "border-blue-500/60 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40",
    headerUserBorder:
      "border-blue-500/35 dark:border-blue-500/35 hover:border-blue-400 dark:hover:border-blue-400",
    headerUserBg: "hover:bg-blue-50 dark:hover:bg-zinc-900",
    headerAvatar: "bg-blue-500",
    menuHeader: "from-blue-50 dark:from-blue-950/20",
    menuHeaderFull:
      "border-zinc-200 bg-linear-to-br from-blue-50 to-white dark:border-zinc-800 dark:from-blue-950/20 dark:to-zinc-900",
    onboardingBtn:
      "group hidden items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-blue-600 hover:bg-blue-600 hover:text-white sm:inline-flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-blue-500 dark:hover:bg-blue-600",
    settingsToggle: "bg-blue-500",
    settingsIcon: "text-blue-500",
    settingsLangBtn: "bg-blue-500 hover:bg-blue-600",
    settingsDoneBtn: "bg-blue-500 shadow-blue-500/30 hover:bg-blue-600",
    bubbleBorder: "border-blue-400/25 dark:border-blue-500/20",
    bubbleBg: "bg-blue-400/[0.06] dark:bg-blue-500/[0.05]",
    glowA: "bg-blue-400/20 dark:bg-blue-600/15",
    glowB: "bg-blue-300/18 dark:bg-blue-500/12",
    radialLight:
      "bg-[radial-gradient(ellipse_at_20%_10%,rgba(59,130,246,0.12),transparent_55%),radial-gradient(ellipse_at_80%_85%,rgba(37,99,235,0.1),transparent_50%)]",
    radialDark:
      "dark:bg-[radial-gradient(ellipse_at_20%_10%,rgba(37,99,235,0.1),transparent_55%),radial-gradient(ellipse_at_80%_85%,rgba(59,130,246,0.08),transparent_50%)]",
    successMsg:
      "bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
    emailFormCard:
      "border-blue-200/80 bg-blue-50/25 dark:border-blue-800/80 dark:bg-blue-950/20",
    btnGradient:
      "bg-linear-to-r from-blue-500 to-blue-600 shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700",
    emailBtnGradient:
      "bg-linear-to-r from-blue-500 to-sky-500 shadow-cyan-500/30 hover:from-blue-600 hover:to-sky-600",
    otpFocus:
      "focus:border-blue-400 focus:ring-blue-400/30 dark:focus:border-blue-400",
  },
  emerald: {
    spinner: "border-emerald-500",
    tabActive: "bg-emerald-500",
    tabHover: "hover:bg-zinc-100 dark:hover:bg-zinc-700",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    avatarGradient: "bg-linear-to-br from-emerald-500 to-teal-500",
    icon: "text-emerald-500 dark:text-emerald-400",
    iconBg: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-400",
    inputFocus:
      "focus:border-emerald-400 focus:ring-emerald-400/30 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30",
    inputFocusWithin:
      "focus-within:border-emerald-400 focus-within:ring-emerald-400/30 dark:focus-within:border-emerald-400 dark:focus-within:ring-emerald-400/30",
    btnPrimary: "bg-emerald-600 hover:bg-emerald-700",
    formCard: "border-violet-200 bg-violet-50/30 dark:border-violet-800 dark:bg-violet-950/20",
    formIconBg: "bg-violet-500/15 text-violet-600 dark:bg-violet-400/20 dark:text-violet-400",
    navActive: "bg-green-500 text-white",
    navInactive:
      "border-emerald-500/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40",
    headerUserBorder:
      "border-emerald-500/35 dark:border-emerald-500/35 hover:border-emerald-400 dark:hover:border-emerald-400",
    headerUserBg: "hover:bg-emerald-50 dark:hover:bg-zinc-900",
    headerAvatar: "bg-emerald-500",
    menuHeader: "from-emerald-50 dark:from-emerald-950/20",
    menuHeaderFull:
      "border-zinc-200 bg-linear-to-br from-emerald-50 to-white dark:border-zinc-800 dark:from-emerald-950/20 dark:to-zinc-900",
    onboardingBtn:
      "group hidden items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-emerald-600 hover:bg-emerald-600 hover:text-white sm:inline-flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-emerald-500 dark:hover:bg-emerald-600",
    settingsToggle: "bg-emerald-500",
    settingsIcon: "text-emerald-500",
    settingsLangBtn: "bg-emerald-500 hover:bg-emerald-600",
    settingsDoneBtn: "bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-600",
    bubbleBorder: "border-emerald-400/25 dark:border-emerald-500/20",
    bubbleBg: "bg-emerald-400/[0.06] dark:bg-emerald-500/[0.05]",
    glowA: "bg-emerald-400/20 dark:bg-emerald-600/15",
    glowB: "bg-emerald-300/18 dark:bg-emerald-500/12",
    radialLight:
      "bg-[radial-gradient(ellipse_at_20%_10%,rgba(52,211,153,0.12),transparent_55%),radial-gradient(ellipse_at_80%_85%,rgba(16,185,129,0.1),transparent_50%)]",
    radialDark:
      "dark:bg-[radial-gradient(ellipse_at_20%_10%,rgba(16,185,129,0.1),transparent_55%),radial-gradient(ellipse_at_80%_85%,rgba(52,211,153,0.08),transparent_50%)]",
    successMsg:
      "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    emailFormCard:
      "border-cyan-200 bg-cyan-50/30 dark:border-cyan-800 dark:bg-cyan-950/20",
    btnGradient:
      "bg-linear-to-r from-violet-500 to-purple-500 shadow-violet-500/30 hover:from-violet-600 hover:to-purple-600",
    emailBtnGradient:
      "bg-linear-to-r from-cyan-500 to-sky-500 shadow-cyan-500/30 hover:from-cyan-600 hover:to-sky-600",
    otpFocus:
      "focus:border-cyan-400 focus:ring-cyan-400/30 dark:focus:border-cyan-400",
  },
} as const;
