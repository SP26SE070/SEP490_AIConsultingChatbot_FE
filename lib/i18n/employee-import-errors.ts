export type ImportErrorLang = "vi" | "en";

type MsgFn = (params: string[]) => string;

const ROW_ERRORS: Record<string, { vi: string | MsgFn; en: string | MsgFn }> = {
  FULL_NAME_REQUIRED: {
    vi: "Họ tên không được để trống",
    en: "Full name is required",
  },
  CONTACT_EMAIL_REQUIRED: {
    vi: "Email liên hệ không được để trống",
    en: "Contact email is required",
  },
  CONTACT_EMAIL_INVALID: {
    vi: "Email liên hệ không hợp lệ",
    en: "Contact email is invalid",
  },
  EMAIL_DUPLICATE_IN_FILE: {
    vi: "Email trùng trong file Excel",
    en: "Duplicate email in the Excel file",
  },
  EMAIL_EXISTS_IN_SYSTEM: {
    vi: "Email đã tồn tại trong hệ thống, không thể thêm",
    en: "Email already exists in the system",
  },
  PHONE_INVALID: {
    vi: "Số điện thoại không hợp lệ (0xxxxxxxxx hoặc +84xxxxxxxxx)",
    en: "Invalid phone number (use 0xxxxxxxxx or +84xxxxxxxxx)",
  },
  PHONE_DUPLICATE_IN_FILE: {
    vi: "Số điện thoại trùng trong file Excel",
    en: "Duplicate phone number in the Excel file",
  },
  PHONE_EXISTS_IN_SYSTEM: {
    vi: "Số điện thoại đã tồn tại trong hệ thống",
    en: "Phone number already exists in the system",
  },
  DOB_INVALID: {
    vi: "Ngày sinh không hợp lệ (dd/MM/yyyy)",
    en: "Invalid date of birth (dd/MM/yyyy)",
  },
  DOB_TOO_YOUNG: {
    vi: "Ngày sinh không hợp lệ — người dùng phải ít nhất 10 tuổi",
    en: "Invalid date of birth — user must be at least 10 years old",
  },
  DOB_TOO_OLD: {
    vi: "Ngày sinh không hợp lệ — người dùng không thể quá 100 tuổi",
    en: "Invalid date of birth — user cannot be over 100 years old",
  },
  ADDRESS_TOO_LONG: {
    vi: "Địa chỉ không được quá 500 ký tự",
    en: "Address must be 500 characters or fewer",
  },
  ROLE_REQUIRED: {
    vi: "Mã vai trò không được để trống",
    en: "Role code is required",
  },
  ROLE_NOT_FOUND: {
    vi: "Mã vai trò không tồn tại hoặc không được phép",
    en: "Role code does not exist or is not allowed",
  },
  ROLE_FORBIDDEN: {
    vi: (p) => `Không được gán vai trò ${p[0] ?? ""}`,
    en: (p) => `Cannot assign role ${p[0] ?? ""}`,
  },
  DEPT_NOT_FOUND: {
    vi: "Mã phòng ban không tồn tại hoặc không active",
    en: "Department code does not exist or is inactive",
  },
  DEPT_SCOPE_FORBIDDEN: {
    vi: "Bạn chỉ được import nhân viên trong phòng ban của mình",
    en: "You can only import employees in your own department",
  },
};

/** Legacy Vietnamese messages from older API responses (before error codes). */
const LEGACY_VI_TO_CODE: Record<string, string> = {
  "Họ tên không được để trống": "FULL_NAME_REQUIRED",
  "Contact email không được để trống": "CONTACT_EMAIL_REQUIRED",
  "Contact email không hợp lệ": "CONTACT_EMAIL_INVALID",
  "Email trùng trong file Excel": "EMAIL_DUPLICATE_IN_FILE",
  "Email đã tồn tại trong hệ thống, không thể thêm": "EMAIL_EXISTS_IN_SYSTEM",
  "Số điện thoại không hợp lệ (0xxxxxxxxx hoặc +84xxxxxxxxx)": "PHONE_INVALID",
  "Số điện thoại trùng trong file Excel": "PHONE_DUPLICATE_IN_FILE",
  "Số điện thoại đã tồn tại trong hệ thống": "PHONE_EXISTS_IN_SYSTEM",
  "Ngày sinh không hợp lệ (dd/MM/yyyy)": "DOB_INVALID",
  "Mã vai trò không được để trống": "ROLE_REQUIRED",
  "Mã vai trò không tồn tại hoặc không được phép": "ROLE_NOT_FOUND",
  "Mã phòng ban không tồn tại hoặc không active": "DEPT_NOT_FOUND",
  "Bạn chỉ được import nhân viên trong phòng ban của mình": "DEPT_SCOPE_FORBIDDEN",
  "Địa chỉ không được quá 500 ký tự": "ADDRESS_TOO_LONG",
};

const API_ERRORS: Record<string, { vi: string | MsgFn; en: string | MsgFn }> = {
  FILE_EMPTY: {
    vi: "File Excel không được để trống",
    en: "Excel file cannot be empty",
  },
  FILE_TYPE_XLSX_ONLY: {
    vi: "Chỉ chấp nhận file .xlsx",
    en: "Only .xlsx files are accepted",
  },
  SHEET_MISSING: {
    vi: "File Excel không có sheet dữ liệu",
    en: "Excel file has no data sheet",
  },
  HEADERS_MISSING: {
    vi: "Thiếu cột bắt buộc. Cần: Họ và tên, Email liên hệ, Mã vai trò (tải lại file mẫu)",
    en: "Missing required columns: Full name, Contact email, Role code (download the template again)",
  },
  MAX_ROWS: {
    vi: (p) => `Vượt quá giới hạn ${p[0] ?? ""} dòng dữ liệu mỗi lần import`,
    en: (p) => `Exceeds the limit of ${p[0] ?? ""} data rows per import`,
  },
  NO_DATA_ROWS: {
    vi: "File không có dòng dữ liệu nào",
    en: "File has no data rows",
  },
  SESSION_NOT_FOUND: {
    vi: "Phiên import không tồn tại hoặc đã hết hạn",
    en: "Import session not found or expired",
  },
  SESSION_ALREADY_DONE: {
    vi: "Phiên import đã được xử lý",
    en: "Import session has already been processed",
  },
  SESSION_EXPIRED: {
    vi: "Phiên import đã hết hạn. Vui lòng upload lại file",
    en: "Import session expired. Please upload the file again",
  },
  SESSION_FORBIDDEN: {
    vi: "Phiên import không thuộc tài khoản của bạn",
    en: "Import session does not belong to your account",
  },
  NO_VALID_ROWS: {
    vi: "Không có dòng hợp lệ để import",
    en: "No valid rows to import",
  },
  UNKNOWN: {
    vi: "Lỗi không xác định",
    en: "Unknown error",
  },
};

const LEGACY_API_VI: Record<string, string> = {
  "File Excel không được để trống": "FILE_EMPTY",
  "Chỉ chấp nhận file .xlsx": "FILE_TYPE_XLSX_ONLY",
  "File Excel không có sheet dữ liệu": "SHEET_MISSING",
  "Thiếu cột bắt buộc. Cần: Họ và tên, Email liên hệ, Mã vai trò (tải lại file mẫu)":
    "HEADERS_MISSING",
  "File không có dòng dữ liệu nào": "NO_DATA_ROWS",
  "Phiên import không tồn tại hoặc đã hết hạn": "SESSION_NOT_FOUND",
  "Phiên import đã được xử lý": "SESSION_ALREADY_DONE",
  "Phiên import đã hết hạn. Vui lòng upload lại file": "SESSION_EXPIRED",
  "Phiên import không thuộc tài khoản của bạn": "SESSION_FORBIDDEN",
  "Không có dòng hợp lệ để import": "NO_VALID_ROWS",
  "Lỗi không xác định": "UNKNOWN",
};

function resolveEntry(
  table: Record<string, { vi: string | MsgFn; en: string | MsgFn }>,
  code: string,
  params: string[],
  lang: ImportErrorLang
): string | undefined {
  const entry = table[code];
  if (!entry) return undefined;
  const msg = entry[lang];
  return typeof msg === "function" ? msg(params) : msg;
}

function normalizeRaw(raw: string): { code: string; params: string[] } {
  const trimmed = raw.trim();
  if (LEGACY_VI_TO_CODE[trimmed]) {
    return { code: LEGACY_VI_TO_CODE[trimmed], params: [] };
  }
  const roleMatch = trimmed.match(/^Không được gán role (.+)$/);
  if (roleMatch) {
    return { code: "ROLE_FORBIDDEN", params: [roleMatch[1]] };
  }
  const roleMatchVi = trimmed.match(/^Không được gán vai trò (.+)$/);
  if (roleMatchVi) {
    return { code: "ROLE_FORBIDDEN", params: [roleMatchVi[1]] };
  }
  if (trimmed.includes("Vượt quá giới hạn") && trimmed.includes("dòng")) {
    const n = trimmed.match(/giới hạn (\d+)/)?.[1];
    return { code: "MAX_ROWS", params: n ? [n] : [] };
  }
  const parts = trimmed.split("|");
  return { code: parts[0], params: parts.slice(1) };
}

/** Translate a row validation error (code or legacy Vietnamese text). */
export function translateImportRowError(raw: string, lang: ImportErrorLang): string {
  const { code, params } = normalizeRaw(raw);
  const localized = resolveEntry(ROW_ERRORS, code, params, lang);
  if (localized) return localized;
  if (lang === "vi") return raw;
  return resolveEntry(ROW_ERRORS, code, params, "en") ?? raw;
}

/** Translate preview/confirm API error messages. */
export function translateImportApiError(message: string, lang: ImportErrorLang): string {
  const trimmed = message.trim();
  if (!trimmed) return message;

  if (LEGACY_API_VI[trimmed]) {
    const code = LEGACY_API_VI[trimmed];
    return resolveEntry(API_ERRORS, code, [], lang) ?? trimmed;
  }
  if (trimmed === "MAX_ROWS" || trimmed.startsWith("MAX_ROWS|")) {
    const params = trimmed.includes("|") ? trimmed.split("|").slice(1) : [];
    return resolveEntry(API_ERRORS, "MAX_ROWS", params, lang) ?? trimmed;
  }
  if (ROW_ERRORS[trimmed]) {
    return resolveEntry(ROW_ERRORS, trimmed, [], lang) ?? trimmed;
  }
  if (trimmed.includes("Vượt quá giới hạn")) {
    const n = trimmed.match(/giới hạn (\d+)/)?.[1];
    return resolveEntry(API_ERRORS, "MAX_ROWS", n ? [n] : [], lang) ?? trimmed;
  }

  const localized = resolveEntry(API_ERRORS, trimmed, [], lang);
  if (localized) return localized;

  if (lang === "vi") return trimmed;
  return trimmed;
}
