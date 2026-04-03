import Cookies from "js-cookie";

// Use empty base so requests go through Next.js rewrites proxy → backend
const API_BASE = "";

export interface ApiError {
  error: string;
  code: string;
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
    const body = await res.json().catch(() => ({ detail: { error: "Unknown error", code: "UNKNOWN" } }));
    const detail = body.detail ?? body;
    throw { status: res.status, ...detail } as ApiError & { status: number };
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
