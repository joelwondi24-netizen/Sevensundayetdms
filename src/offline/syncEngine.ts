export type ConflictPolicy = 'server-wins' | 'client-wins' | 'manual';

export interface QueuedMutation {
  tx_id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body?: unknown;
  created_at: string;
  status: 'Pending' | 'Failed';
  last_error?: string;
}

export interface OfflineStorageStats {
  indexedDbCount: number;
  localStorageKeys: number;
  localStorageBytes: number;
  conflictPolicy: ConflictPolicy;
  lastSync: string | null;
}

const DB_NAME = 'seven-sunday-ems-offline';
const DB_VERSION = 1;
const STORE_CACHE = 'get_cache';
const STORE_QUEUE = 'mutation_queue';

const POLICY_KEY = 'seven_sunday_conflict_policy';
const LAST_SYNC_KEY = 'seven_sunday_last_sync';

function notifyQueueListeners() {
  window.dispatchEvent(new Event('sevensunday-sync-queue-updated'));
  window.dispatchEvent(new Event('seven-sunday-sync-updated'));
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'url' });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'tx_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function cacheGetResponse(url: string, data: unknown): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CACHE, 'readwrite');
      tx.objectStore(STORE_CACHE).put({ url, data, updated_at: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore storage quota errors
  }
}

export async function getCachedResponse<T>(url: string): Promise<T | null> {
  try {
    const db = await openOfflineDb();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE_CACHE, 'readonly');
      const req = tx.objectStore(STORE_CACHE).get(url);
      req.onsuccess = () => {
        const record = req.result as { data?: T } | undefined;
        resolve(record?.data ?? null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function enqueueMutation(
  method: QueuedMutation['method'],
  url: string,
  body?: unknown
): Promise<QueuedMutation> {
  const item: QueuedMutation = {
    tx_id: `TX-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    method,
    url,
    body,
    created_at: new Date().toISOString(),
    status: 'Pending',
  };
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      tx.objectStore(STORE_QUEUE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
  notifyQueueListeners();
  return item;
}

export async function getPendingQueue(): Promise<QueuedMutation[]> {
  try {
    const db = await openOfflineDb();
    return await new Promise<QueuedMutation[]>((resolve) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => {
        const list = (req.result as QueuedMutation[]) || [];
        list.sort((a, b) => a.created_at.localeCompare(b.created_at));
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function removeQueuedMutation(txId: string): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      tx.objectStore(STORE_QUEUE).delete(txId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
  notifyQueueListeners();
}

export async function clearPendingQueue(): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      tx.objectStore(STORE_QUEUE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
  notifyQueueListeners();
}

export async function clearOfflineCache(): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_CACHE, 'readwrite');
      tx.objectStore(STORE_CACHE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
  notifyQueueListeners();
}

export function getConflictPolicy(): ConflictPolicy {
  try {
    const val = localStorage.getItem(POLICY_KEY) as ConflictPolicy | null;
    if (val === 'server-wins' || val === 'client-wins' || val === 'manual') return val;
  } catch {
    // ignore
  }
  return 'server-wins';
}

export function setConflictPolicy(policy: ConflictPolicy): void {
  try {
    localStorage.setItem(POLICY_KEY, policy);
  } catch {
    // ignore
  }
  notifyQueueListeners();
}

export async function retrySingleMutation(
  txId: string,
  headers: Record<string, string>
): Promise<boolean> {
  const queue = await getPendingQueue();
  const item = queue.find((q) => q.tx_id === txId);
  if (!item) return false;
  try {
    const res = await fetch(item.url, {
      method: item.method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        'x-conflict-policy': getConflictPolicy(),
      },
      body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    await removeQueuedMutation(txId);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    notifyQueueListeners();
    return true;
  } catch (err) {
    try {
      const db = await openOfflineDb();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        tx.objectStore(STORE_QUEUE).put({
          ...item,
          status: 'Failed',
          last_error: err instanceof Error ? err.message : 'Sync failed',
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
    notifyQueueListeners();
    return false;
  }
}

export async function syncQueuedMutations(
  headers: Record<string, string>
): Promise<{ synced: number; failed: number }> {
  const queue = await getPendingQueue();
  let synced = 0;
  let failed = 0;
  for (const item of queue) {
    const ok = await retrySingleMutation(item.tx_id, headers);
    if (ok) synced += 1;
    else failed += 1;
  }
  if (synced > 0) {
    try {
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
  }
  notifyQueueListeners();
  return { synced, failed };
}

export async function getOfflineStorageStats(): Promise<OfflineStorageStats> {
  let indexedDbCount = 0;
  try {
    const db = await openOfflineDb();
    indexedDbCount = await new Promise<number>((resolve) => {
      const tx = db.transaction(STORE_CACHE, 'readonly');
      const req = tx.objectStore(STORE_CACHE).count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch {
    indexedDbCount = 0;
  }

  let localStorageKeys = 0;
  let localStorageBytes = 0;
  try {
    localStorageKeys = localStorage.length;
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i) || '';
      const v = localStorage.getItem(k) || '';
      localStorageBytes += k.length + v.length;
    }
  } catch {
    // ignore
  }

  return {
    indexedDbCount,
    localStorageKeys,
    localStorageBytes,
    conflictPolicy: getConflictPolicy(),
    lastSync: localStorage.getItem(LAST_SYNC_KEY),
  };
}
