// Use empty base so requests go through Next.js rewrites proxy -> backend
const API_BASE = "";
const SESSION_COOKIE_NAME = "click_token";
const SESSION_HINT_COOKIE_NAME = "click_session_present";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Strict`;
}

function removeCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Strict`;
}

function getAuthHeaders(options?: RequestInit): HeadersInit {
  const token = getCookie(SESSION_COOKIE_NAME);
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers ?? {}),
  };
}

function hasSessionCookie(): boolean {
  return Boolean(getCookie(SESSION_COOKIE_NAME) || getCookie(SESSION_HINT_COOKIE_NAME));
}

function persistStoredUser(user: UserInfo) {
  if (typeof window === "undefined") return;
  localStorage.setItem("click_user", JSON.stringify(user));
}

function clearStoredSession() {
  removeCookie(SESSION_COOKIE_NAME);
  removeCookie(SESSION_HINT_COOKIE_NAME);
  localStorage.removeItem("click_user");
  localStorage.removeItem("click_open_screens");
  localStorage.removeItem("click_recent_screens");
  localStorage.removeItem("click_active_screen");
  localStorage.removeItem("click_recent_panel_open");
  localStorage.removeItem("click_recent_drawer_open");
  localStorage.removeItem("click_selected_tenant_id");
}

function handleUnauthorizedRedirect() {
  clearStoredSession();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const loginUrl = `/login?reason=session_expired&next=${encodeURIComponent(next)}`;
    window.location.replace(loginUrl);
  }
}

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
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const candidate = item as { msg?: unknown };
        return typeof candidate.msg === "string" && candidate.msg.trim() ? candidate.msg : null;
      })
      .filter((value): value is string => Boolean(value));
    if (messages.length > 0) return messages.join(". ");
  }
  if (detail && typeof detail === "object") {
    const candidate = detail as { message?: unknown; error?: unknown; detail?: unknown };
    if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
    if (typeof candidate.error === "string" && candidate.error.trim()) return candidate.error;
    if (typeof candidate.detail === "string" && candidate.detail.trim()) return candidate.detail;
  }
  return fallback;
}

function getNetworkErrorMessage(path: string): string {
  if (path === "/api/auth/login") {
    return "לא ניתן להתחבר לשרת ההתחברות כרגע. ודא שה-backend פועל ונסה שוב.";
  }
  return "לא ניתן להתחבר לשרת כרגע. בדוק שהשירות פעיל ונסה שוב.";
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getCookie(SESSION_COOKIE_NAME);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch (error: unknown) {
    throw new ApiRequestError({
      message: getNetworkErrorMessage(path),
      status: 0,
      code: "NETWORK_ERROR",
      error: error instanceof Error ? error.message : "Network error",
      details: error,
    });
  }

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ detail: { error: "Unknown error", code: "UNKNOWN" } }));
    const detail = body.detail ?? body;
    const fallbackMessage = `Request failed with status ${res.status}`;

    if (res.status === 401 && hasSessionCookie() && path !== "/api/auth/login") {
      handleUnauthorizedRedirect();
    }

    throw new ApiRequestError({
      message: getErrorMessage(detail, fallbackMessage),
      status: res.status,
      code: typeof detail?.code === "string" ? detail.code : undefined,
      error: typeof detail?.error === "string" ? detail.error : undefined,
      details: detail,
    });
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postForm: async <T>(path: string, body: FormData): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        body,
        headers: getAuthHeaders(),
      });
    } catch (error: unknown) {
      throw new ApiRequestError({
        message: getNetworkErrorMessage(path),
        status: 0,
        code: "NETWORK_ERROR",
        error: error instanceof Error ? error.message : "Network error",
        details: error,
      });
    }

    if (!res.ok) {
      const payload = await res
        .json()
        .catch(() => ({ detail: { error: "Unknown error", code: "UNKNOWN" } }));
      const detail = payload.detail ?? payload;
      throw new ApiRequestError({
        message: getErrorMessage(detail, `Request failed with status ${res.status}`),
        status: res.status,
        code: typeof detail?.code === "string" ? detail.code : undefined,
        error: typeof detail?.error === "string" ? detail.error : undefined,
        details: detail,
      });
    }

    return res.json() as Promise<T>;
  },
};

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: getAuthHeaders(options),
  });

  if (response.status === 401 && path !== "/api/auth/login" && hasSessionCookie()) {
    handleUnauthorizedRedirect();
  }

  return response;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface PermissionInfo {
  resource: string;
  can_view: boolean;
  can_edit: boolean;
  can_manage_sensitive?: boolean;
}

export interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id?: string | null;
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
  setCookie(SESSION_COOKIE_NAME, data.access_token, 60 * 60 * 24);
  setCookie(SESSION_HINT_COOKIE_NAME, "1", 60 * 60 * 24);
  persistStoredUser(data.user);
  if (data.user.role === "org_admin" && data.user.tenant_id) {
    localStorage.setItem("click_selected_tenant_id", data.user.tenant_id);
  }
  return data;
}

export async function forgotPassword(email: string, redirectTo: string): Promise<void> {
  await api.post("/api/auth/forgot-password", { email, redirect_to: redirectTo });
}

export async function restoreSession(): Promise<UserInfo | null> {
  if (typeof window === "undefined" || !hasSessionCookie()) return null;

  try {
    const user = await api.get<UserInfo>("/api/auth/me");
    persistStoredUser(user);
    setCookie(SESSION_HINT_COOKIE_NAME, "1", 60 * 60 * 24);
    return user;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      clearStoredSession();
      return null;
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  clearStoredSession();
  try {
    await api.post("/api/auth/logout", {});
  } catch {
    // Local session state is already cleared; ignore backend logout failures.
  }
}

export function getStoredUser(): UserInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("click_user");
  return raw ? (JSON.parse(raw) as UserInfo) : null;
}

export function isLoggedIn(): boolean {
  return hasSessionCookie();
}

// ── Permission helpers ─────────────────────────────────────────────────────

export function canView(resource: string): boolean {
  const user = getStoredUser();
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return user.permissions?.some((p) => p.resource === resource && p.can_view) ?? false;
}

export function canEdit(resource: string): boolean {
  const user = getStoredUser();
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return user.permissions?.some((p) => p.resource === resource && p.can_edit) ?? false;
}

export function canManageSensitive(resource: string): boolean {
  const user = getStoredUser();
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return user.permissions?.some((p) => p.resource === resource && p.can_manage_sensitive) ?? false;
}

export function isOrgAdmin(): boolean {
  return getStoredUser()?.role === "org_admin";
}

export function getOrgAdminTenantId(): string | null {
  const user = getStoredUser();
  return user?.role === "org_admin" ? (user.tenant_id ?? null) : null;
}
