import Cookies from "js-cookie";

// Use empty base so requests go through Next.js rewrites proxy → backend
const API_BASE = "";

export interface ApiError {
  error: string;
  code: string;
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  error?: string;
  details?: unknown;

  constructor({
    message,
    status,
    code,
    error,
    details,
  }: {
    message: string;
    status: number;
    code?: string;
    error?: string;
    details?: unknown;
  }) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.error = error;
    this.details = details;
  }
}

function getErrorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object") {
    const candidate = detail as { message?: unknown; error?: unknown; detail?: unknown };
    if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
    if (typeof candidate.error === "string" && candidate.error.trim()) return candidate.error;
    if (typeof candidate.detail === "string" && candidate.detail.trim()) return candidate.detail;
  }
  return fallback;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = Cookies.get("click_token");

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ detail: { error: "Unknown error", code: "UNKNOWN" } }));
    const detail = body.detail ?? body;
    const fallbackMessage = `Request failed with status ${res.status}`;
    throw new ApiRequestError({
      message: getErrorMessage(detail, fallbackMessage),
      status: res.status,
      code: typeof detail?.code === "string" ? detail.code : undefined,
      error: typeof detail?.error === "string" ? detail.error : undefined,
      details: detail,
    });
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface PermissionInfo {
  resource: string;
  can_view: boolean;
  can_edit: boolean;
}

export interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  role: string;
  permissions: PermissionInfo[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserInfo;
}

// ── Auth helpers ───────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await api.post<LoginResponse>("/api/auth/login", { email, password });
  Cookies.set("click_token", data.access_token, { expires: 1, sameSite: "strict" });
  localStorage.setItem("click_user", JSON.stringify(data.user));
  return data;
}

export function logout() {
  Cookies.remove("click_token");
  localStorage.removeItem("click_user");
}

export function getStoredUser(): UserInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("click_user");
  return raw ? (JSON.parse(raw) as UserInfo) : null;
}

export function isLoggedIn(): boolean {
  return !!Cookies.get("click_token");
}

// ── Permission helpers ─────────────────────────────────────────────────────

export function canView(resource: string): boolean {
  const user = getStoredUser();
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return user.permissions.some((p) => p.resource === resource && p.can_view);
}

export function canEdit(resource: string): boolean {
  const user = getStoredUser();
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return user.permissions.some((p) => p.resource === resource && p.can_edit);
}
