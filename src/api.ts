import { cacheGetResponse, enqueueMutation, getCachedResponse } from './offline/syncEngine';

const TENANT_STORAGE_KEY = 'seven_sunday_active_tenant_id';

let actorName = 'System Operator';
let actorRole = 'Employee';
let authToken: string | null = null;
let activeTenantId = (() => {
  try {
    const raw = localStorage.getItem(TENANT_STORAGE_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
  } catch {
    return 1;
  }
})();

export function setAuthToken(token: string | null) {
  authToken = token && token.trim() ? token.trim() : null;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setApiActor(name: string, role: string) {
  actorName = name || 'System Operator';
  actorRole = role || 'Employee';
}

export function setApiTenant(tenantId: number) {
  const valid = Number.isFinite(tenantId) && tenantId >= 1 ? Math.floor(tenantId) : 1;
  activeTenantId = valid;
  try {
    localStorage.setItem(TENANT_STORAGE_KEY, String(valid));
  } catch {
    // ignore storage quota errors
  }
}

export function getApiTenantId(): number {
  return activeTenantId;
}

export function getApiActorHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'x-actor-name': actorName,
    'x-actor-role': actorRole,
    'x-tenant-id': String(activeTenantId),
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

function getTenantCacheKey(url: string): string {
  // Keep global endpoints under tenant-neutral key only when specifically /api/tenants
  if (url === '/api/tenants') return url;
  return `t${activeTenantId}:${url}`;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.error === 'string') return data.error;
    if (data && typeof data.message === 'string') return data.message;
  } catch {
    // ignore
  }
  return `Request failed (${res.status})`;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown
): Promise<T> {
  if (method === 'GET') {
    const cacheKey = getTenantCacheKey(url);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          ...getApiActorHeaders(),
        },
      });
      if (!res.ok) {
        if (res.status === 401 && !url.startsWith('/api/auth/')) {
          window.dispatchEvent(new CustomEvent('sevensunday:unauthorized'));
        }
        throw new Error(await parseErrorMessage(res));
      }
      const data = (await res.json()) as T;
      void cacheGetResponse(cacheKey, data);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!navigator.onLine || msg.includes('Failed to fetch')) {
        const cached = await getCachedResponse<T>(cacheKey);
        if (cached !== null) {
          return cached;
        }
      }
      throw err;
    }
  }

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getApiActorHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      if (res.status === 401 && !url.startsWith('/api/auth/')) {
        window.dispatchEvent(new CustomEvent('sevensunday:unauthorized'));
      }
      throw new Error(await parseErrorMessage(res));
    }
    if (res.status === 204) {
      return {} as T;
    }
    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch (err) {
    if (!navigator.onLine) {
      await enqueueMutation(method, url, body);
      throw new Error('Offline: change queued to IndexedDB and will sync automatically when connected.');
    }
    throw err;
  }
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  del: <T = { ok: boolean }>(url: string) => request<T>('DELETE', url),
};
