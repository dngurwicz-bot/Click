// Use empty base so requests go through Next.js rewrites proxy -> backend
const API_BASE = "";

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
  const token = getCookie("click_token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers ?? {}),
  };
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
  const token = getCookie("click_token");
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

    if (res.status === 401 && token && path !== "/api/auth/login") {
      logout();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const loginUrl = `/login?reason=session_expired&next=${encodeURIComponent(next)}`;
        window.location.replace(loginUrl);
      }
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
  setCookie("click_token", data.access_token, 60 * 60 * 24);
  localStorage.setItem("click_user", JSON.stringify(data.user));
  return data;
}

export function logout() {
  removeCookie("click_token");
  localStorage.removeItem("click_user");
  localStorage.removeItem("click_open_screens");
  localStorage.removeItem("click_recent_screens");
  localStorage.removeItem("click_active_screen");
  localStorage.removeItem("click_recent_panel_open");
  localStorage.removeItem("click_selected_tenant_id");
}

export function getStoredUser(): UserInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("click_user");
  return raw ? (JSON.parse(raw) as UserInfo) : null;
}

export function isLoggedIn(): boolean {
  return !!getCookie("click_token");
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
