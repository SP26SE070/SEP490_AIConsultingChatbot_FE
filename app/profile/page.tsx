"use client";

import { useEffect, useState, useRef, useMemo, FormEvent } from "react";
import {
  UserCircle,
  Pencil,
  Key,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Eye,
  EyeOff,
  ShieldCheck,
  Image,
  Building,
  Clock,
  User,
} from "lucide-react";
import { ProfilePageShell } from "@/components/layout/ProfilePageShell";
import { AppLogo } from "@/components/brand/AppLogo";
import { getPortalAccent, portalAccentStyles } from "@/lib/portal-accent";
import { dashboardPanelClass } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils/cn";
import { getStoredUser } from "@/lib/auth-store";
import { roleToPath } from "@/lib/auth-routes";
import { useRouter } from "next/navigation";
import {
  getProfile,
  updateProfile,
  changePassword,
  requestUpdateContactEmail,
  verifyAndUpdateContactEmail,
} from "@/lib/api/profile";
import {
  getTenantInfo,
  updateTenantProfile,
  uploadTenantLogo,
  type TenantInfoResponse,
} from "@/lib/api/tenant-admin";
import type {
  UserProfileResponse,
  UpdateProfileRequest,
  ChangePasswordRequest,
} from "@/types/profile";
import {
  formatDobDigitsInput,
  formatDobDisplay,
  isoDateToDdMmYyyy,
  isAtLeastYearsOld,
  parseDdMmYyyy,
  validateDobForSubmit,
  type DobValidationMessages,
} from "@/lib/date-of-birth";
import { useLanguageStore } from "@/lib/language-store";
import { translations } from "@/lib/translations";
import { toast } from "@/components/ui/AlertProvider";

function formatDateTime(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(locale);
  } catch {
    return iso;
  }
}

function onlyDigits(input: string): string {
  return input.replace(/\D/g, "");
}

function toLocalPhoneDigits(raw: string | null | undefined): string {
  const digits = onlyDigits(raw ?? "");
  if (!digits) return "";
  if (digits.startsWith("84")) {
    return digits.slice(2).slice(0, 10);
  }
  return digits.slice(0, 10);
}

function normalizeVietnamPhoneFromInput(localDigits: string): string | null {
  const digits = onlyDigits(localDigits);
  if (!digits) return null;
  if (digits.startsWith("0")) {
    if (digits.length !== 10) return null;
    return `+84${digits.slice(1)}`;
  }
  if (digits.length !== 9 && digits.length !== 10) return null;
  return `+84${digits}`;
}

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { language } = useLanguageStore();
  const t = translations[language];
  const dateLocale = language === "vi" ? "vi-VN" : "en-US";
  const currentUser = getStoredUser();
  const accent = getPortalAccent(currentUser?.roles);
  const ac = portalAccentStyles[accent];

  const dobMessages: DobValidationMessages = useMemo(
    () => ({
      formatInvalid: t.profileDobFormatInvalid,
      dateInvalid: t.profileDobDateInvalid,
      under18: t.profileDobUnder18,
    }),
    [t.profileDobFormatInvalid, t.profileDobDateInvalid, t.profileDobUnder18]
  );

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Update form state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [dateOfBirthDisplay, setDateOfBirthDisplay] = useState("");
  const [dobUnder18Notice, setDobUnder18Notice] = useState<string | null>(null);
  const dobEditedRef = useRef(false);
  const under18NoticeShownRef = useRef(false);
  const dobPickerRef = useRef<HTMLInputElement>(null);
  const dobPickerIsoValue = useMemo(() => {
    const r = parseDdMmYyyy(dateOfBirthDisplay, dobMessages);
    if (r.ok && r.iso) return r.iso;
    return "";
  }, [dateOfBirthDisplay, dobMessages]);
  const [address, setAddress] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Change password state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showFirstPasswordDonePrompt, setShowFirstPasswordDonePrompt] = useState(false);
  const mustChangePassword = currentUser?.mustChangePassword ?? false;
  const isTenantAdmin = (currentUser?.roles ?? []).some((role) => role.includes("TENANT_ADMIN"));
  const isEmployee = (currentUser?.roles ?? []).some((role) => role.includes("EMPLOYEE"));

  // Contact email update (OTP) state
  const [newContactEmail, setNewContactEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  // Tenant branding (logo) state
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState<string | null>(null);

  // Tenant info state (tenant admin only)
  const [tenantInfo, setTenantInfo] = useState<TenantInfoResponse | null>(null);
  const [tenantInfoLoading, setTenantInfoLoading] = useState(false);
  const [tenantInfoSaving, setTenantInfoSaving] = useState(false);
  const [tenantInfoError, setTenantInfoError] = useState<string | null>(null);
  const [tenantInfoSuccess, setTenantInfoSuccess] = useState<string | null>(null);
  const [tenantAddress, setTenantAddress] = useState("");
  const [tenantWebsite, setTenantWebsite] = useState("");
  const [tenantCompanySize, setTenantCompanySize] = useState("");

  // Active tab
  const [activeTab, setActiveTab] = useState<"info" | "password" | "branding">("info");

  const prettifyContactEmailError = (message: string) => {
    const m = message || "";
    if (/PKIX path building failed/i.test(m) || /SSLHandshakeException/i.test(m) || /unable to find valid certification path/i.test(m)) {
      return `${t.profileContactEmailErrorTls} ${t.profileContactEmailHelp}`;
    }
    if (/Mail server connection failed/i.test(m) || /MessagingException/i.test(m)) {
      return `${t.profileContactEmailErrorMailServer} ${t.profileContactEmailHelp}`;
    }
    return message;
  };

  useEffect(() => {
    getProfile()
      .then((data) => {
        setProfile(data);
        setPhoneNumber(toLocalPhoneDigits(data.phoneNumber));
        setDateOfBirthDisplay(isoDateToDdMmYyyy(data.dateOfBirth));
        setAddress(data.address ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : t.profilePageError))
      .finally(() => setLoading(false));
  }, [t.profilePageError]);

  useEffect(() => {
    if (!isTenantAdmin) return;
    setTenantInfoLoading(true);
    setTenantInfoError(null);
    getTenantInfo()
      .then((data) => {
        setTenantInfo(data);
        setTenantAddress(data.address ?? "");
        setTenantWebsite(data.website ?? "");
        setTenantCompanySize(data.companySize ?? "");
      })
      .catch((err) =>
        setTenantInfoError(
          err instanceof Error ? err.message : t.profileTenantInfoLoadFailed
        )
      )
      .finally(() => setTenantInfoLoading(false));
  }, [isTenantAdmin, t.profileTenantInfoLoadFailed]);

  useEffect(() => {
    if (!dobEditedRef.current) return;
    const r = parseDdMmYyyy(dateOfBirthDisplay, dobMessages);
    if (!r.ok || r.iso === null) {
      setDobUnder18Notice(null);
      under18NoticeShownRef.current = false;
      return;
    }
    const [y, mo, d] = r.iso.split("-").map(Number);
    const birth = new Date(y, mo - 1, d);
    if (isAtLeastYearsOld(birth, 18)) {
      setDobUnder18Notice(null);
      under18NoticeShownRef.current = false;
      return;
    }
    if (!under18NoticeShownRef.current) {
      setDobUnder18Notice(t.profileDobUnder18);
      under18NoticeShownRef.current = true;
    }
  }, [dateOfBirthDisplay, dobMessages, t.profileDobUnder18]);

  useEffect(() => {
    setDobUnder18Notice((prev) => (prev !== null ? t.profileDobUnder18 : null));
  }, [language, t.profileDobUnder18]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const preview = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(preview);
    return () => { URL.revokeObjectURL(preview); };
  }, [logoFile]);

  const openDobPicker = () => {
    dobEditedRef.current = true;
    const el = dobPickerRef.current;
    if (!el) return;
    const picker = (el as HTMLInputElement & { showPicker?: () => void }).showPicker;
    if (typeof picker === "function") {
      try { picker.call(el); } catch { el.click(); }
    } else {
      el.click();
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setUpdateError(null);
    setUpdateSuccess(false);
    setUpdateLoading(true);
    try {
      const dobCheck = validateDobForSubmit(dateOfBirthDisplay, dobMessages);
      if (!dobCheck.ok) {
        const alreadyShownUnder18 = dobCheck.message === t.profileDobUnder18 && dobUnder18Notice !== null;
        if (!alreadyShownUnder18) {
          setUpdateError(dobCheck.message);
        }
        setUpdateLoading(false);
        return;
      }
      const normalizedPhone = normalizeVietnamPhoneFromInput(phoneNumber);
      if (phoneNumber.trim() && !normalizedPhone) {
        toast.warning(
          language === "en"
            ? "Phone number is invalid. Suggested format: +84 0123456789 or +84 123456789."
            : "Số điện thoại không hợp lệ. Gợi ý định dạng: +84 0123456789 hoặc +84 123456789."
        );
        setUpdateLoading(false);
        return;
      }
      const body: UpdateProfileRequest = {
        phoneNumber: normalizedPhone,
        dateOfBirth: dobCheck.iso,
        address: address.trim() || null,
      };
      const updated = await updateProfile(body);
      setProfile(updated);
      setUpdateSuccess(true);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : t.profileUpdateFailed);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]{8,}$/;
    if (newPassword !== confirmNew) {
      setPasswordError(t.profilePasswordMismatch);
      return;
    }
    if (!passwordPattern.test(newPassword)) {
      setPasswordError(t.profilePasswordPolicy);
      return;
    }
    setPasswordError(null);
    setPasswordSuccess(false);
    setPasswordLoading(true);
    try {
      const body: ChangePasswordRequest = {
        oldPassword: mustChangePassword ? undefined : (oldPassword || undefined),
        newPassword,
      };
      await changePassword(body);
      setPasswordSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmNew("");
      if (mustChangePassword) {
        setShowFirstPasswordDonePrompt(true);
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t.profileChangePasswordFailed);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setContactError(null);
    setContactSuccess(null);
    setContactLoading(true);
    try {
      await requestUpdateContactEmail({ newContactEmail: newContactEmail.trim() });
      setOtpSent(true);
      setContactSuccess(t.profileOtpSentSuccess);
    } catch (err) {
      const raw = err instanceof Error ? err.message : t.profileRequestOtpFailed;
      setContactError(prettifyContactEmailError(raw));
    } finally {
      setContactLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setContactError(null);
    setContactSuccess(null);
    setContactLoading(true);
    try {
      await verifyAndUpdateContactEmail({
        newContactEmail: newContactEmail.trim(),
        otp: otp.trim(),
      });
      setContactSuccess(t.profileContactEmailUpdatedSuccess);
      setOtp("");
      setOtpSent(false);
      const refreshed = await getProfile();
      setProfile(refreshed);
    } catch (err) {
      const raw = err instanceof Error ? err.message : t.profileVerifyOtpFailed;
      setContactError(prettifyContactEmailError(raw));
    } finally {
      setContactLoading(false);
    }
  };

  const handleTenantInfoUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setTenantInfoError(null);
    setTenantInfoSuccess(null);

    const nextAddress = tenantAddress.trim();
    const nextWebsite = tenantWebsite.trim();
    const nextCompanySize = tenantCompanySize.trim();

    if (nextAddress.length > 500) {
      setTenantInfoError(t.profileTenantInfoAddressTooLong);
      return;
    }
    if (nextWebsite.length > 255) {
      setTenantInfoError(t.profileTenantInfoWebsiteTooLong);
      return;
    }
    if (nextCompanySize.length > 50) {
      setTenantInfoError(t.profileTenantInfoCompanySizeTooLong);
      return;
    }

    setTenantInfoSaving(true);
    try {
      const updated = await updateTenantProfile({
        address: nextAddress || null,
        website: nextWebsite || null,
        companySize: nextCompanySize || null,
      });
      const merged = { ...(tenantInfo ?? {}), ...updated };
      setTenantInfo(merged);
      setTenantAddress(merged.address ?? "");
      setTenantWebsite(merged.website ?? "");
      setTenantCompanySize(merged.companySize ?? "");
      setTenantInfoSuccess(t.profileTenantInfoUpdatedSuccess);
    } catch (err) {
      setTenantInfoError(
        err instanceof Error ? err.message : t.profileTenantInfoUpdateFailed
      );
    } finally {
      setTenantInfoSaving(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    setLogoError(null);
    setLogoSuccess(null);
  };

  const handleLogoUpload = async () => {
    setLogoError(null);
    setLogoSuccess(null);
    if (!logoFile) {
      setLogoError(t.profileTenantLogoErrorEmpty);
      return;
    }
    if (logoFile.size > MAX_LOGO_SIZE_BYTES) {
      setLogoError(t.profileTenantLogoErrorSize);
      return;
    }
    if (!ALLOWED_LOGO_TYPES.has(logoFile.type)) {
      setLogoError(t.profileTenantLogoErrorType);
      return;
    }
    setLogoUploading(true);
    try {
      const result = await uploadTenantLogo(logoFile);
      setProfile((prev) => prev ? { ...prev, tenantLogoUrl: result.logoUrl ?? prev.tenantLogoUrl } : prev);
      setTenantInfo((prev) => prev ? { ...prev, logoUrl: result.logoUrl ?? prev.logoUrl } : prev);
      setLogoSuccess(t.profileTenantLogoSuccess);
      setLogoFile(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : t.profileUpdateFailed);
    } finally {
      setLogoUploading(false);
    }
  };

  const inputClass = cn(
    "block w-full rounded-xl border border-zinc-200 bg-white/80 px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100",
    ac.inputFocus
  );
  const dobCompositeClass = cn(
    "flex w-full min-w-0 items-stretch rounded-xl border border-zinc-200 bg-white/80 text-sm text-zinc-900 shadow-sm outline-none transition focus-within:ring-2 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100",
    ac.inputFocusWithin
  );
  const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";
  const logoDisplayUrl = logoPreviewUrl ?? tenantInfo?.logoUrl ?? profile?.tenantLogoUrl ?? null;
  const tenantNameDisplay = tenantInfo?.name ?? profile?.tenantName ?? "";

  const tabs = [
    { id: "info" as const, label: t.profilePersonalInformation, icon: User },
    { id: "password" as const, label: t.profileChangePasswordTitle, icon: Key },
    ...(isTenantAdmin ? [{ id: "branding" as const, label: t.profileTenantBrandingTitle, icon: Building }] : []),
  ];

  if (loading) {
    return (
      <ProfilePageShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className={cn("h-10 w-10 animate-spin rounded-full border-2 border-t-transparent", ac.spinner)} />
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t.profilePageLoading}</p>
          </div>
        </div>
      </ProfilePageShell>
    );
  }

  if (error || !profile) {
    return (
      <ProfilePageShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-6 py-4 text-rose-800 shadow-lg dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
            {error ?? t.profilePageNotFound}
          </div>
        </div>
      </ProfilePageShell>
    );
  }

  return (
    <ProfilePageShell>
      <>
          {/* Compact Profile Header */}
          <div className={cn("mb-6 flex items-center gap-4 p-4 sm:p-5", dashboardPanelClass)}>
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-md", ac.avatarGradient)}>
              <UserCircle className="h-7 w-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {profile.fullName || t.profile}
              </h1>
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {profile.email}
              </p>
            </div>
            {profile.roleName && (
              <span className={cn("hidden shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium sm:flex", ac.badge)}>
                <ShieldCheck className="h-3 w-3" />
                {profile.roleName}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="mb-6 overflow-x-auto">
            <div className={cn("flex gap-1 rounded-xl border border-zinc-200/80 bg-white/75 p-1 shadow-sm backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/75")}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap",
                    activeTab === tab.id
                      ? cn(ac.tabActive, "text-white shadow-sm")
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden xs:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className={cn("rounded-2xl p-6 sm:p-8", dashboardPanelClass)}>
            <div key={activeTab} className="animate-tab-enter">
            {/* Info Tab */}
            {activeTab === "info" && (
              <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
                {/* Personal Info Card */}
                <section className="h-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-700 dark:bg-zinc-800/50 flex flex-col">
                  <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", ac.iconBg)}>
                      <User className="h-4 w-4" />
                    </span>
                    {t.profilePersonalInformation}
                  </h2>
                  <div className="flex-1 flex items-center">
                    <dl className="w-full space-y-3 text-sm">
                      {[
                        { icon: Mail, label: t.email, value: profile.email },
                        { icon: Mail, label: t.contactEmail, value: profile.contactEmail ?? "—" },
                        { icon: User, label: t.fullName, value: profile.fullName },
                        { icon: Phone, label: t.phone, value: profile.phoneNumber ?? "—" },
                        { icon: Calendar, label: t.profileDateOfBirth, value: formatDobDisplay(profile.dateOfBirth) },
                        { icon: MapPin, label: t.address, value: profile.address ?? "—" },
                        { icon: ShieldCheck, label: t.role, value: profile.roleName ?? "—" },
                        { icon: Building, label: t.department, value: profile.departmentName ?? "—" },
                        { icon: Building, label: t.tenant, value: profile.tenantName ?? "—" },
                        { icon: Clock, label: t.profileLastLogin, value: formatDateTime(profile.lastLoginAt, dateLocale) },
                      ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex gap-3">
                          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ac.icon)} />
                          <div>
                            <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
                            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
                          </div>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>

                <div className="flex h-full flex-col gap-6">
                  {/* Update Form Card */}
                  <section className={cn("flex-1 rounded-xl border p-5", ac.formCard)}>
                    <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", ac.formIconBg)}>
                        <Pencil className="h-4 w-4" />
                      </span>
                      {t.profileUpdateProfile}
                    </h2>
                    <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">{t.profileUpdateProfileHint}</p>

                    <form onSubmit={handleUpdate} className="space-y-4">
                      {updateError && (
                        <p className="rounded-xl bg-rose-50 p-2.5 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">{updateError}</p>
                      )}
                      {updateSuccess && (
                        <p className={cn("rounded-xl p-2.5 text-sm", ac.successMsg)}>{t.profileUpdatedSuccessfully}</p>
                      )}

                      <div>
                        <label htmlFor="phone" className={labelClass}>{t.phone}</label>
                        <div className="flex overflow-hidden rounded-xl border border-zinc-200 bg-white/80 shadow-sm dark:border-zinc-600 dark:bg-zinc-800/80">
                          <span className="inline-flex items-center border-r border-zinc-200 bg-zinc-100 px-3 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">+84</span>
                          <input
                            id="phone"
                            type="text"
                            inputMode="numeric"
                            maxLength={10}
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(onlyDigits(e.target.value).slice(0, 10))}
                            placeholder="0123456789"
                            className="block w-full border-0 bg-transparent px-3 py-2.5 text-sm text-zinc-900 outline-none dark:bg-zinc-800/80 dark:text-zinc-100"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="dob" className={labelClass}>{t.profileDateOfBirth}</label>
                        <div className={dobCompositeClass}>
                          <input
                            id="dob"
                            type="text"
                            inputMode="numeric"
                            autoComplete="bday"
                            placeholder={t.profileDobPlaceholder}
                            maxLength={10}
                            value={dateOfBirthDisplay}
                            onChange={(e) => {
                              dobEditedRef.current = true;
                              setDateOfBirthDisplay(formatDobDigitsInput(e.target.value));
                            }}
                            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 outline-none focus:ring-0 dark:bg-transparent dark:text-zinc-100"
                          />
                          <input
                            ref={dobPickerRef}
                            type="date"
                            className="sr-only"
                            tabIndex={-1}
                            aria-hidden
                            value={dobPickerIsoValue}
                            onChange={(e) => {
                              const v = e.target.value;
                              dobEditedRef.current = true;
                              if (v) setDateOfBirthDisplay(isoDateToDdMmYyyy(v));
                            }}
                          />
                          <button
                            type="button"
                            onClick={openDobPicker}
                            className={cn("flex shrink-0 items-center justify-center rounded-r-xl px-2.5 py-2.5 transition hover:opacity-80", ac.icon)}
                            title={t.profileDobPickFromCalendar}
                            aria-label={t.profileDobOpenCalendar}
                          >
                            <Calendar className="h-5 w-5" aria-hidden />
                          </button>
                        </div>
                        {dobUnder18Notice && (
                          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="alert">
                            {dobUnder18Notice}
                          </div>
                        )}
                      </div>

                      <div>
                        <label htmlFor="address" className={labelClass}>{t.address}</label>
                        <textarea id="address" rows={3} maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
                      </div>

                      <button
                        type="submit"
                        disabled={updateLoading}
                        className={cn("w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg transition disabled:opacity-60", ac.btnGradient)}
                      >
                        {updateLoading ? t.profileSaving : t.profileSaveChanges}
                      </button>
                    </form>
                  </section>

                  {/* Contact Email Card */}
                  <section className={cn("flex-1 rounded-xl border p-5", ac.emailFormCard)}>
                    <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", ac.formIconBg)}>
                        <Mail className="h-4 w-4" />
                      </span>
                      {t.profileUpdateContactEmail}
                    </h2>
                    <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">{t.profileUpdateContactEmailHint}</p>

                    <form onSubmit={otpSent ? handleVerifyOtp : handleRequestOtp} className="space-y-4">
                      {contactError && (
                        <p className="rounded-xl bg-rose-50 p-2.5 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">{contactError}</p>
                      )}
                      {contactSuccess && (
                        <p className={cn("rounded-xl p-2.5 text-sm", ac.successMsg)}>{contactSuccess}</p>
                      )}

                      <div>
                        <label htmlFor="newContactEmail" className={labelClass}>{t.profileNewContactEmailLabel}</label>
                        <input
                          id="newContactEmail"
                          type="email"
                          value={newContactEmail}
                          onChange={(e) => setNewContactEmail(e.target.value)}
                          className={inputClass}
                          placeholder="email@example.com"
                          required
                        />
                      </div>

                      {otpSent && (
                        <div>
                          <label htmlFor="otp" className={labelClass}>{t.profileOtpSixDigits}</label>
                          <input
                            id="otp"
                            type="text"
                            inputMode="numeric"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className={cn("w-full rounded-xl border border-zinc-200 bg-white/80 px-4 py-3 text-center text-lg tracking-widest text-zinc-900 shadow-sm outline-none transition focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100", ac.otpFocus)}
                            placeholder="123456"
                            maxLength={6}
                            required
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={contactLoading}
                        className={cn("w-full rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg transition disabled:opacity-60", ac.emailBtnGradient)}
                      >
                        {contactLoading ? t.profileProcessing : otpSent ? t.profileVerifyOtpUpdate : t.profileSendOtp}
                      </button>

                      {otpSent && (
                        <button
                          type="button"
                          onClick={() => { setOtpSent(false); setOtp(""); setContactSuccess(null); setContactError(null); }}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          {t.profileResendOrChangeEmail}
                        </button>
                      )}
                    </form>
                  </section>
                </div>
              </div>
            )}

            {/* Password Tab */}
            {activeTab === "password" && (
              <div className="mx-auto max-w-lg">
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                    <Key className="h-7 w-7" />
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.profileChangePasswordTitle}</h2>
                  {mustChangePassword && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{t.profileFirstLoginPasswordHint}</p>
                  )}
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  {passwordError && (
                    <p className="rounded-xl bg-rose-50 p-2.5 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">{passwordError}</p>
                  )}
                  {passwordSuccess && (
                    <p className={cn("rounded-xl p-2.5 text-sm", ac.successMsg)}>{t.profilePasswordUpdatedSuccess}</p>
                  )}

                  {!mustChangePassword && (
                    <div>
                      <label htmlFor="oldPassword" className={labelClass}>{t.profileCurrentPasswordLabel}</label>
                      <div className="relative">
                        <input
                          id="oldPassword"
                          type={showOldPassword ? "text" : "password"}
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          className="w-full rounded-xl border border-zinc-200 bg-white/80 px-4 py-2.5 pr-10 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                          {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="newPassword" className={labelClass}>{t.profileNewPasswordLabel}</label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-white/80 px-4 py-2.5 pr-10 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmNew" className={labelClass}>{t.profileConfirmPasswordLabel}</label>
                    <div className="relative">
                      <input
                        id="confirmNew"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmNew}
                        onChange={(e) => setConfirmNew(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-white/80 px-4 py-2.5 pr-10 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="w-full rounded-xl bg-linear-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-amber-500/30 transition hover:from-amber-600 hover:to-orange-600 disabled:opacity-60"
                  >
                    {passwordLoading ? t.profileUpdatingPassword : t.profileChangePasswordButton}
                  </button>
                </form>
              </div>
            )}

            {/* Branding Tab */}
            {activeTab === "branding" && isTenantAdmin && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                    <Building className="h-7 w-7" />
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.profileTenantBrandingTitle}</h2>
                  <p className="mt-1 text-xs text-zinc-500">{t.profileTenantBrandingHint}</p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 dark:border-indigo-800 dark:bg-indigo-950/20">
                    <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-400">
                        <Building className="h-4 w-4" />
                      </span>
                      {t.profileTenantInfoTitle}
                    </h3>
                    <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">{t.profileTenantInfoHint}</p>

                    {tenantInfoError && (
                      <p className="mb-3 rounded-xl bg-rose-50 p-2.5 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">{tenantInfoError}</p>
                    )}
                    {tenantInfoSuccess && (
                      <p className={cn("mb-3 rounded-xl p-2.5 text-sm", ac.successMsg)}>{tenantInfoSuccess}</p>
                    )}

                    <form onSubmit={handleTenantInfoUpdate} className="space-y-4">
                      <div>
                        <label htmlFor="tenantName" className={labelClass}>{t.profileTenantNameLabel}</label>
                        <input
                          id="tenantName"
                          value={tenantNameDisplay}
                          readOnly
                          className={`${inputClass} cursor-not-allowed bg-zinc-100/70 text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300`}
                        />
                      </div>

                      <div>
                        <label htmlFor="tenantWebsite" className={labelClass}>{t.profileTenantWebsiteLabel}</label>
                        <input
                          id="tenantWebsite"
                          type="text"
                          maxLength={255}
                          value={tenantWebsite}
                          onChange={(e) => setTenantWebsite(e.target.value)}
                          className={inputClass}
                          placeholder="https://example.com"
                          disabled={tenantInfoLoading}
                        />
                      </div>

                      <div>
                        <label htmlFor="tenantCompanySize" className={labelClass}>{t.profileTenantCompanySizeLabel}</label>
                        <select
                          id="tenantCompanySize"
                          value={tenantCompanySize}
                          onChange={(e) => setTenantCompanySize(e.target.value)}
                          className={inputClass}
                          disabled={tenantInfoLoading}
                        >
                          <option value="">{t.profileTenantCompanySizeSelect}</option>
                          <option value="1-10">1-10</option>
                          <option value="11-50">11-50</option>
                          <option value="51-200">51-200</option>
                          <option value="201-500">201-500</option>
                          <option value="500+">500+</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="tenantAddress" className={labelClass}>{t.profileTenantAddressLabel}</label>
                        <textarea
                          id="tenantAddress"
                          rows={3}
                          maxLength={500}
                          value={tenantAddress}
                          onChange={(e) => setTenantAddress(e.target.value)}
                          className={inputClass}
                          disabled={tenantInfoLoading}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={tenantInfoSaving || tenantInfoLoading}
                        className="w-full rounded-xl bg-linear-to-r from-indigo-500 to-slate-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-600 hover:to-slate-600 disabled:opacity-60"
                      >
                        {tenantInfoSaving ? t.profileTenantInfoSaving : t.profileTenantInfoSave}
                      </button>
                    </form>
                  </section>

                  <section className="rounded-xl border border-zinc-200 bg-white/70 p-5 dark:border-zinc-700 dark:bg-zinc-800/60">
                    <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-400">
                        <Image className="h-4 w-4" />
                      </span>
                      {t.profileTenantLogoLabel}
                    </h3>
                    <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">{t.profileTenantLogoNote}</p>

                    {logoError && (
                      <p className="mb-3 rounded-xl bg-rose-50 p-2.5 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">{logoError}</p>
                    )}
                    {logoSuccess && (
                      <p className={cn("mb-3 rounded-xl p-2.5 text-sm", ac.successMsg)}>{logoSuccess}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-zinc-200 bg-white/80 p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/70">
                        <AppLogo size={48} tenantLogoUrl={logoDisplayUrl} tenantName={tenantNameDisplay} />
                      </div>
                      <div className="min-w-56 flex-1">
                        <label htmlFor="tenantLogo" className={labelClass}>{t.profileTenantLogoLabel}</label>
                        <input
                          id="tenantLogo"
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleLogoFileChange}
                          className={inputClass}
                        />
                        {logoFile && (
                          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t.profileTenantLogoSelected}: {logoFile.name} - {formatBytes(logoFile.size)}</p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLogoUpload}
                      disabled={logoUploading || !logoFile}
                      className="mt-4 w-full rounded-xl bg-linear-to-r from-indigo-500 to-slate-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-600 hover:to-slate-600 disabled:opacity-60"
                    >
                      {logoUploading ? t.profileTenantLogoUploading : t.profileTenantLogoUpload}
                    </button>
                  </section>
                </div>
              </div>
            )}
            </div>
          </div>

      {/* First Password Done Prompt Modal */}
      {showFirstPasswordDonePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {language === "en" ? "Password updated successfully" : "Đổi mật khẩu thành công"}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {isTenantAdmin
                ? language === "en"
                  ? "You can now go to Tenant Admin dashboard to continue management."
                  : "Bạn có thể quay về trang chủ Tenant Admin để tiếp tục quản trị."
                : isEmployee
                  ? language === "en"
                    ? "You can now continue to the chatbot workspace."
                    : "Bạn có thể tiếp tục sử dụng chatbot ngay bây giờ."
                  : language === "en"
                    ? "Choose where you want to continue."
                    : "Chọn nơi bạn muốn tiếp tục."}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFirstPasswordDonePrompt(false)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {language === "en" ? "Stay here" : "Ở lại trang này"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFirstPasswordDonePrompt(false);
                  const destination = isTenantAdmin ? "/tenant-admin" : isEmployee ? "/chatbot-new" : roleToPath(currentUser?.roles ?? []);
                  router.push(destination);
                  router.refresh();
                }}
                className={cn("rounded-lg px-3 py-2 text-sm font-medium text-white", ac.btnPrimary)}
              >
                {isTenantAdmin
                  ? language === "en"
                    ? "Go to Tenant dashboard"
                    : "Về trang chủ Tenant Admin"
                  : isEmployee
                    ? language === "en"
                      ? "Go to Chatbot"
                      : "Đi tới Chatbot"
                    : language === "en"
                      ? "Continue"
                      : "Tiếp tục"}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    </ProfilePageShell>
  );
}
