'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export class ApiClientError extends Error {
  code: string;
  status: number;
  issues?: Record<string, string[]>;
  /** Полное тело ответа сервера — для случаев, когда нужны доп. поля сверх code/message/issues
   *  (например amnestyRequestId при конфликте Static ID). */
  body?: Record<string, unknown>;
  constructor(code: string, message: string, status: number, issues?: Record<string, string[]>, body?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.issues = issues;
    this.body = body;
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('wc_access_token', token);
    else localStorage.removeItem('wc_access_token');
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('wc_access_token');
  }
  return accessToken;
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const token = auth ? getAccessToken() : null;

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  // Авто-обновление токена при 401
  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options);
    }
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiClientError(data?.error || 'UNKNOWN_ERROR', data?.message || 'Произошла ошибка', res.status, data?.issues, data);
  }

  return data as T;
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await res.json();
      setAccessToken(data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * Загружает файл на сервер через multipart/form-data. Отдельная функция, а не api.post —
 * нельзя ставить Content-Type: application/json для файлового запроса, браузер сам
 * проставляет правильный multipart boundary, когда тело — FormData.
 */
export async function uploadFile(file: File, folder: string): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('folder', folder);
  formData.append('file', file);

  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(data?.error || 'UPLOAD_FAILED', data?.message || 'Не удалось загрузить файл', res.status, undefined, data);
  }
  return data as { url: string };
}
