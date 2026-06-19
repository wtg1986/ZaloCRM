// API client mỏng cho backend ZaloCRM.
//  - DEV: NEXT_PUBLIC_API_URL trống → gọi tương đối "/api/v1/*" (Next rewrite
//    proxy sang Fastify:3000, same-origin).
//  - PROD (Vercel): NEXT_PUBLIC_API_URL = domain backend (vd https://api.x.com)
//    → gọi THẲNG backend (backend phải bật CORS cho domain Vercel).
// Đính kèm JWT Bearer từ localStorage.

// NEXT_PUBLIC_* được Next inline lúc build cho client.
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

const TOKEN_KEY = "zalocrm.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Tham số query — undefined/"" sẽ bị bỏ qua. */
  params?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, params?: ApiOptions["params"]): string {
  const rel = path.startsWith("/api/") ? path : `/api/v1${path}`;
  const base = API_ORIGIN ? `${API_ORIGIN}${rel}` : rel;
  if (!params) return base;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, params, headers, ...rest } = opts;
  const token = getToken();

  const res = await fetch(buildUrl(path, params), {
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    // Fastify để câu lỗi dễ hiểu ở `message` ("Invalid email or password"),
    // còn `error` chỉ là HTTP status text ("Unauthorized"). Ưu tiên `message`.
    const err = data as
      | { error?: string; message?: string; code?: string }
      | null;
    throw new ApiError(
      res.status,
      err?.message || err?.error || res.statusText,
      err?.code,
    );
  }
  return data as T;
}

export const apiGet = <T>(path: string, params?: ApiOptions["params"]) =>
  api<T>(path, { method: "GET", params });

export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body });

export const apiPatch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body });

export const apiPut = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PUT", body });

export const apiDelete = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "DELETE", body });

/** Upload multipart (ảnh/file) — KHÔNG set Content-Type để browser tự thêm boundary. */
export async function apiUpload<T>(
  path: string,
  form: FormData,
): Promise<T> {
  const token = getToken();
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const err = data as { error?: string; message?: string } | null;
    throw new ApiError(res.status, err?.message || err?.error || res.statusText);
  }
  return data as T;
}
