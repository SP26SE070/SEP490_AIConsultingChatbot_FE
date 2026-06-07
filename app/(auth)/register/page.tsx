"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { AuthHeroPanel } from "@/components/auth/AuthHeroPanel";
import { ErrorNotice } from "@/components/ui";
import { AUTH_BASE } from "@/lib/api/config";
import { toUiErrorMessage } from "@/lib/api/parseApiError";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [representativePosition, setRepresentativePosition] = useState("");
  const [representativePhone, setRepresentativePhone] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const getFieldClassName = (field: string) =>
    `block w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:ring-2 dark:bg-zinc-900 dark:text-zinc-50 ${
      fieldErrors[field]
        ? "border-red-500 focus:border-red-500 focus:ring-red-500/25 dark:border-red-500"
        : "border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20 dark:border-zinc-700"
    }`;

  const validateForm = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!companyName.trim()) next.companyName = "Vui lòng nhập tên công ty.";
    if (!contactEmail.trim()) next.contactEmail = "Vui lòng nhập email liên hệ.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      next.contactEmail = "Email không đúng định dạng.";
    } else {
      const domain = contactEmail.trim().split("@")[1]!;
      const labels = domain.split(".");
      if (labels.length >= 2 && labels[labels.length - 1] === labels[labels.length - 2]) {
        next.contactEmail = "Email không hợp lệ. Vui lòng kiểm tra lại tên miền email.";
      }
    }
    if (representativePhone.trim() && !/^(0\d{9}|(\+84)\d{9})$/.test(representativePhone.trim().replace(/\s+/g, ""))) {
      next.representativePhone = "Số điện thoại không hợp lệ (0xxxxxxxxx hoặc +84xxxxxxxxx).";
    }
    if (website.trim()) {
      try {
        const u = new URL(website.trim());
        if (!["http:", "https:"].includes(u.protocol)) next.website = "Website phải bắt đầu bằng http:// hoặc https://";
      } catch {
        next.website = "Website không đúng định dạng URL.";
      }
    }
    return next;
  };

  const extractBackendFieldErrors = (data: unknown): Record<string, string> => {
    if (!data || typeof data !== "object") return {};
    const o = data as Record<string, unknown>;
    const details = o.details;
    if (!details || typeof details !== "object") return {};
    const d = details as Record<string, unknown>;
    const mapped: Record<string, string> = {};
    for (const [k, v] of Object.entries(d)) {
      if (typeof v === "string" && v.trim()) mapped[k] = v.trim();
    }
    return mapped;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const localErrors = validateForm();
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setError("Vui lòng kiểm tra lại thông tin đã nhập.");
      return;
    }
    setLoading(true);

    try {
      const response = await fetch(`${AUTH_BASE}/register-tenant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName,
          address,
          website,
          companySize,
          contactEmail,
          representativeName,
          representativePosition,
          representativePhone,
          requestMessage,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const backendFields = extractBackendFieldErrors(data);
        if (Object.keys(backendFields).length > 0) {
          setFieldErrors(backendFields);
        }
        throw new Error(toUiErrorMessage(data, "Registration failed"));
      }

      setSuccess(true);
    } catch (err) {
      setError(toUiErrorMessage(err, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-dvh">
        {/* Left: Success message */}
        <div className="flex w-full flex-col justify-center border-zinc-200 bg-white px-6 py-8 dark:border-zinc-800 dark:bg-zinc-900 sm:px-8 lg:w-1/2 lg:border-r lg:px-12 lg:py-10">
          <div className="mx-auto w-full max-w-md space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Registration Submitted!
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Your tenant registration request has been submitted successfully. Our team will review your application and contact you soon.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-700"
              >
                Back to Home
              </Link>
              <Link
                href="/login"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </div>

        <AuthHeroPanel>
          <blockquote className="mx-auto max-w-md">
            <p className="text-2xl font-medium leading-relaxed text-white/95 md:text-2xl">
              You&apos;re on your way. We&apos;ll review your request and get back to you soon.
            </p>
            <footer className="mt-6 text-lg font-semibold uppercase tracking-wider text-emerald-400/90">
              Internal Consultant Platform
            </footer>
          </blockquote>
        </AuthHeroPanel>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      {/* Left: Register form */}
      <div className="flex w-full flex-col border-zinc-200 bg-white px-6 py-10 dark:border-zinc-800 dark:bg-zinc-900 sm:px-8 lg:w-1/2 lg:border-r lg:px-12 lg:py-14">
        <div className="mx-auto flex w-full max-w-md flex-col">
          <div className="mb-8 space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Apply Now
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Register your organization to get started with our AI-powered internal consultant.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <ErrorNotice message={error} />
            )}

            <div className="space-y-1.5">
              <label htmlFor="companyName" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Company Name *
              </label>
              <input
                id="companyName"
                type="text"
                required
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  if (fieldErrors.companyName) setFieldErrors((prev) => ({ ...prev, companyName: "" }));
                }}
                aria-invalid={fieldErrors.companyName ? "true" : "false"}
                className={getFieldClassName("companyName")}
                placeholder="Acme Corporation"
              />
              {fieldErrors.companyName ? <p className="text-xs text-red-500">{fieldErrors.companyName}</p> : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="contactEmail" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Contact Email *
              </label>
              <input
                id="contactEmail"
                type="email"
                required
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  if (fieldErrors.contactEmail) setFieldErrors((prev) => ({ ...prev, contactEmail: "" }));
                }}
                aria-invalid={fieldErrors.contactEmail ? "true" : "false"}
                className={getFieldClassName("contactEmail")}
                placeholder="contact@company.com"
              />
              {fieldErrors.contactEmail ? <p className="text-xs text-red-500">{fieldErrors.contactEmail}</p> : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="representativeName" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Representative Name
                </label>
                <input
                  id="representativeName"
                  type="text"
                  value={representativeName}
                  onChange={(e) => setRepresentativeName(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  placeholder="John Doe"
                />
              </div>

              <div className="min-w-0 space-y-1.5">
                <label htmlFor="representativePosition" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Position
                </label>
                <input
                  id="representativePosition"
                  type="text"
                  value={representativePosition}
                  onChange={(e) => setRepresentativePosition(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  placeholder="CEO"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="representativePhone" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Phone Number
              </label>
              <input
                id="representativePhone"
                type="tel"
                value={representativePhone}
                  onChange={(e) => {
                    setRepresentativePhone(e.target.value);
                    if (fieldErrors.representativePhone) {
                      setFieldErrors((prev) => ({ ...prev, representativePhone: "" }));
                    }
                  }}
                  aria-invalid={fieldErrors.representativePhone ? "true" : "false"}
                  className={getFieldClassName("representativePhone")}
                placeholder="+84 123 456 789"
              />
                {fieldErrors.representativePhone ? (
                  <p className="text-xs text-red-500">{fieldErrors.representativePhone}</p>
                ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="address" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Address
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                placeholder="123 Main St, City"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="website" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Website
                </label>
                <input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => {
                    setWebsite(e.target.value);
                    if (fieldErrors.website) setFieldErrors((prev) => ({ ...prev, website: "" }));
                  }}
                  aria-invalid={fieldErrors.website ? "true" : "false"}
                  className={getFieldClassName("website")}
                  placeholder="https://company.com"
                />
                {fieldErrors.website ? <p className="text-xs text-red-500">{fieldErrors.website}</p> : null}
              </div>

              <div className="min-w-0 space-y-1.5">
                <label htmlFor="companySize" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  Company Size
                </label>
                <select
                  id="companySize"
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  <option value="">Select size</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-500">201-500</option>
                  <option value="500+">500+</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="requestMessage" className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Message (Optional)
              </label>
              <textarea
                id="requestMessage"
                rows={3}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                placeholder="Tell us about your needs..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Submit Registration"}
            </button>

            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>

      <AuthHeroPanel>
        <blockquote className="mx-auto max-w-md">
          <p className="text-2xl font-medium leading-relaxed text-white/95 md:text-2xl">
            Join companies using AI to make internal knowledge accessible to everyone.
          </p>
          <footer className="mt-6 text-lg font-semibold uppercase tracking-wider text-emerald-400/90">
            Internal Consultant Platform
          </footer>
        </blockquote>
      </AuthHeroPanel>
    </div>
  );
}

