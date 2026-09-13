import { FactoryState, Job, LogEntry } from '../types';
import { LOCAL_STORAGE_KEY, INITIAL_STATE } from './constants';
import { mergeFactoryStates } from './syncMerge';

const DB_NAME = 'WunderkrafFactoryDB';
const DB_VERSION = 2;
const STORE_NAME = 'factory_state';
const QUEUE_STORE_NAME = 'offline_sync_queue';
const STATE_RECORD_KEY = 'current_state';
const SYNC_META_KEY = 'last_sync_meta';

// BroadcastChannel for instant cross-tab synchronization on the same device
let syncBus: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncBus = new BroadcastChannel('wunderkraf_sync_bus');
  }
} catch (e) {
  console.warn('[Sync] BroadcastChannel not supported:', e);
}

/**
 * Open or upgrade native browser IndexedDB with both state store and offline write-queue.
 */
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        db.createObjectStore(QUEUE_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Saves state directly into IndexedDB.
 */
export async function saveToIndexedDB(state: FactoryState): Promise<boolean> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putRequest = store.put(state, STATE_RECORD_KEY);

      putRequest.onsuccess = () => resolve(true);
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch (err) {
    console.warn('[Storage] IndexedDB save failed, falling back to localStorage:', err);
    return false;
  }
}

/**
 * Loads state directly from IndexedDB.
 */
export async function loadFromIndexedDB(): Promise<FactoryState | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(STATE_RECORD_KEY);

      getRequest.onsuccess = () => {
        if (getRequest.result && typeof getRequest.result === 'object') {
          resolve(getRequest.result as FactoryState);
        } else {
          resolve(null);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (err) {
    console.warn('[Storage] IndexedDB read failed:', err);
    return null;
  }
}

// -------------------------------------------------------------
// CENTRAL SYNC BRIDGE (100_2026_V1 ARCHITECTURE)
// -------------------------------------------------------------

/**
 * Resolves the active Central Sync Endpoint.
 * Supports custom URLs configured in Admin, environment variables, or local/remote origin.
 */
export function getCentralSyncEndpoint(): string {
  if (typeof window === 'undefined') return '/api/sync/state';

  // 1. Explicit admin override in localStorage
  const userOverride = localStorage.getItem('wunderkraf_central_sync_url');
  if (userOverride && userOverride.trim()) {
    return userOverride.trim();
  }

  // 2. Environment variable injected at build time
  const envUrl = (import.meta as any).env?.VITE_CENTRAL_SYNC_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }

  // 3. Same-origin default endpoint
  const origin = window.location.origin || '';
  return `${origin}/api/sync/state`;
}

/**
 * Sets a custom Central Sync Endpoint (for cross-network multi-device factory sync).
 */
export function setCustomSyncEndpoint(url: string): void {
  if (typeof window === 'undefined') return;
  if (!url || !url.trim()) {
    localStorage.removeItem('wunderkraf_central_sync_url');
  } else {
    localStorage.setItem('wunderkraf_central_sync_url', url.trim());
  }
}

/**
 * Enqueues a state update into the offline IndexedDB write-queue.
 */
async function enqueueOfflineSync(state: FactoryState): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    store.add({
      timestamp: Date.now(),
      state: state
    });
  } catch (e) {
    console.warn('[Sync Bridge] Could not enqueue to offline write-queue:', e);
  }
}

/**
 * Counts un-synced operations currently waiting in the offline queue.
 */
export async function getPendingSyncCount(): Promise<number> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(QUEUE_STORE_NAME, 'readonly');
      const store = tx.objectStore(QUEUE_STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch (e) {
    return 0;
  }
}

/**
 * Flushes the offline write-queue to the central shared source.
 * Called automatically when online, periodically, and on save.
 */
let isFlushing = false;
export async function flushOfflineSyncQueue(): Promise<{ success: boolean; mergedState?: FactoryState }> {
  if (isFlushing) return { success: false };
  if (typeof window !== 'undefined' && navigator && navigator.onLine === false) {
    return { success: false };
  }

  isFlushing = true;
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(QUEUE_STORE_NAME, 'readonly');
    const store = tx.objectStore(QUEUE_STORE_NAME);
    const getAllReq = store.getAll();

    const queuedEntries: Array<{ id: number; timestamp: number; state: FactoryState }> = await new Promise((resolve, reject) => {
      getAllReq.onsuccess = () => resolve(getAllReq.result || []);
      getAllReq.onerror = () => reject(getAllReq.error);
    });

    if (!queuedEntries || queuedEntries.length === 0) {
      isFlushing = false;
      return { success: true };
    }

    // Merge all queued states sequentially into the latest payload
    let consolidatedState = queuedEntries[0].state;
    for (let i = 1; i < queuedEntries.length; i++) {
      consolidatedState = mergeFactoryStates(consolidatedState, queuedEntries[i].state);
    }

    // Push to central endpoint
    const endpoint = getCentralSyncEndpoint();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        state: consolidatedState,
        queuedCount: queuedEntries.length,
        clientTimestamp: Date.now()
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      if (result && result.success && result.state) {
        // Clear flushed items from the queue
        const clearTx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
        const clearStore = clearTx.objectStore(QUEUE_STORE_NAME);
        clearStore.clear();

        // Update local IndexedDB and localStorage with latest server-merged state
        await saveToIndexedDB(result.state);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(result.state));
        } catch (e) {}

        // Record sync metadata
        try {
          localStorage.setItem(SYNC_META_KEY, JSON.stringify({
            lastSyncTime: Date.now(),
            endpoint: endpoint,
            jobCount: result.state.jobs?.length || 0
          }));
        } catch (e) {}

        // Notify other components & tabs
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('wunderkraf-state-synced', { detail: result.state }));
          syncBus?.postMessage({ type: 'STATE_SYNCED', state: result.state });
        }

        isFlushing = false;
        return { success: true, mergedState: result.state };
      }
    }
  } catch (err) {
    console.warn('[Sync Bridge] Background push failed, offline queue preserved:', err);
  } finally {
    isFlushing = false;
  }

  return { success: false };
}

/**
 * Fetches the latest state from the central shared source.
 */
export async function fetchCentralState(): Promise<FactoryState | null> {
  try {
    const endpoint = getCentralSyncEndpoint();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.success && data.state && Array.isArray(data.state.jobs)) {
        return data.state as FactoryState;
      }
    }
  } catch (err) {
    console.warn('[Sync Bridge] Central fetch unavailable (device offline or remote server unreachable):', err);
  }
  return null;
}

/**
 * Dual-persistence & Central Sync Bridge:
 * 1. Writes complete state into local IndexedDB.
 * 2. Mirrors to localStorage with auto-pruning.
 * 3. Enqueues to offline write-queue in IndexedDB.
 * 4. Broadcasts to same-device tabs.
 * 5. Asynchronously flushes to central shared endpoint.
 */
export async function persistFactoryState(nextState: FactoryState): Promise<{
  success: boolean;
  savedToIndexedDB: boolean;
  savedToLocalStorage: boolean;
}> {
  let savedToIndexedDB = false;
  let savedToLocalStorage = false;

  // 1. Primary IndexedDB write
  try {
    savedToIndexedDB = await saveToIndexedDB(nextState);
  } catch (e) {
    console.error('[Storage] Error during IndexedDB persistence:', e);
  }

  // 2. Mirror to localStorage with auto-pruning if quota reached
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextState));
    savedToLocalStorage = true;
  } catch (localStorageErr: any) {
    console.warn('[Storage] localStorage quota reached. Attempting defensive pruning...', localStorageErr);
    try {
      const trimmedState: FactoryState = {
        ...nextState,
        logs: (nextState.logs || []).slice(-100)
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmedState));
      savedToLocalStorage = true;
    } catch (innerErr) {
      console.error('[Storage] localStorage mirror completely full. IndexedDB remains primary authority.', innerErr);
    }
  }

  // 3. Enqueue to offline write-queue for central sync
  await enqueueOfflineSync(nextState);

  // 4. Notify all local tabs on same browser
  syncBus?.postMessage({ type: 'STATE_CHANGED', state: nextState });

  // 5. Trigger non-blocking central sync flush
  flushOfflineSyncQueue().catch(() => {});

  return {
    success: savedToIndexedDB || savedToLocalStorage,
    savedToIndexedDB,
    savedToLocalStorage
  };
}

/**
 * Initialize factory state on startup:
 * 1. Loads local cached state from IndexedDB (or localStorage fallback).
 * 2. Concurrently fetches authoritative latest state from Central Shared Endpoint.
 * 3. Merges Central State + Local State using 100_2026_V1 merge rules before returning.
 * 4. Ensures all devices display identical counts without data asymmetry.
 */
export async function initializeFactoryState(): Promise<FactoryState> {
  // Step 1: Load baseline state from local IndexedDB
  let localState: FactoryState | null = null;
  try {
    localState = await loadFromIndexedDB();
  } catch (e) {
    console.warn('[Storage] IndexedDB load failed, trying localStorage', e);
  }

  if (!localState) {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.jobs && Array.isArray(parsed.jobs)) {
          localState = parsed;
        }
      }
    } catch (e) {
      console.warn('[Storage] localStorage parse failed', e);
    }
  }

  // Step 2: Attempt to pull latest shared state from Central Sync Bridge
  try {
    const centralState = await fetchCentralState();
    if (centralState) {
      console.info('[Sync Bridge] Central state fetched successfully. Merging with local data...');
      const merged = mergeFactoryStates(centralState, localState || INITIAL_STATE);

      // Save converged authoritative state to local storage
      await saveToIndexedDB(merged);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {}

      // Flush any pending offline queue items
      flushOfflineSyncQueue().catch(() => {});

      return merged;
    }
  } catch (syncErr) {
    console.warn('[Sync Bridge] Central sync failed on boot. Using local cached state:', syncErr);
  }

  // Step 3: Fallback to local state or INITIAL_STATE if offline
  if (localState && localState.jobs && Array.isArray(localState.jobs)) {
    console.info('[Storage] Initialized with local offline state.');
    return localState;
  }

  console.info('[Storage] Initializing fresh default state.');
  saveToIndexedDB(INITIAL_STATE).catch(() => {});
  return INITIAL_STATE;
}

/**
 * Explicit manual synchronization with Central Sync Bridge (for UI refresh button).
 */
export async function forceSyncWithCentral(currentState: FactoryState): Promise<{
  success: boolean;
  syncedState: FactoryState;
  message: string;
}> {
  try {
    // 1. Flush any pending offline queue entries first
    await flushOfflineSyncQueue();

    // 2. Fetch latest central state
    const centralState = await fetchCentralState();
    if (centralState) {
      const merged = mergeFactoryStates(centralState, currentState);
      await saveToIndexedDB(merged);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {}

      // 3. Push back converged state to ensure central is also fully updated
      const endpoint = getCentralSyncEndpoint();
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: merged, clientTimestamp: Date.now() })
      }).catch(() => {});

      return {
        success: true,
        syncedState: merged,
        message: 'Central Bridge & All Recording Devices Synchronized!'
      };
    } else {
      // If server has no state yet, push our current state as initial central state
      const endpoint = getCentralSyncEndpoint();
      const pushRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: currentState, clientTimestamp: Date.now() })
      });
      if (pushRes.ok) {
        return {
          success: true,
          syncedState: currentState,
          message: 'Current state uploaded to Central Sync Bridge successfully!'
        };
      }
    }
  } catch (err: any) {
    console.warn('[Sync Bridge] Force sync error:', err);
  }

  return {
    success: false,
    syncedState: currentState,
    message: 'Central Bridge unreachable. Preserved in local offline IndexedDB.'
  };
}

/**
 * Subscribes to cross-tab / background central state synchronization events.
 */
export function subscribeToSyncEvents(onUpdate: (newState: FactoryState) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.data && (event.data.type === 'STATE_SYNCED' || event.data.type === 'STATE_CHANGED')) {
      if (event.data.state && Array.isArray(event.data.state.jobs)) {
        onUpdate(event.data.state);
      }
    }
  };

  const windowHandler = (event: Event) => {
    const customEv = event as CustomEvent;
    if (customEv.detail && Array.isArray(customEv.detail.jobs)) {
      onUpdate(customEv.detail);
    }
  };

  syncBus?.addEventListener('message', handler);
  if (typeof window !== 'undefined') {
    window.addEventListener('wunderkraf-state-synced', windowHandler);
  }

  return () => {
    syncBus?.removeEventListener('message', handler);
    if (typeof window !== 'undefined') {
      window.removeEventListener('wunderkraf-state-synced', windowHandler);
    }
  };
}

// -------------------------------------------------------------
// BACKUP & UTILITY FUNCTIONS
// -------------------------------------------------------------

/**
 * Exports complete factory database backup as a formatted JSON download.
 */
export function exportDatabaseBackup(state: FactoryState, customFilename?: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = customFilename || `Wunderkraf_ERP_Backup_${timestamp}.json`;

  const payload = {
    metadata: {
      application: 'Wünderkraf Paperware Manufacturing ERP',
      schemaVersion: '2026.3',
      exportedAt: new Date().toISOString(),
      jobCount: state.jobs?.length || 0,
      orderCount: state.packJobs?.length || 0,
      logCount: state.logs?.length || 0
    },
    data: state
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates and restores a database backup from an uploaded JSON file.
 */
export function importDatabaseBackup(file: File): Promise<FactoryState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        const stateCandidate: FactoryState = parsed.data || parsed;

        if (!stateCandidate || typeof stateCandidate !== 'object') {
          throw new Error('Invalid JSON file structure');
        }

        if (!Array.isArray(stateCandidate.jobs)) {
          throw new Error('Backup file is missing required "jobs" array');
        }

        await persistFactoryState(stateCandidate);
        resolve(stateCandidate);
      } catch (err: any) {
        reject(new Error(err.message || 'Failed to parse database backup JSON'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file from disk'));
    };

    reader.readAsText(file);
  });
}

/**
 * Prunes historical records older than specified days, moving them to archive collections.
 */
export function pruneFactoryState(
  state: FactoryState,
  olderThanDays: number = 30
): {
  prunedState: FactoryState;
  archivedJobsCount: number;
  archivedLogsCount: number;
} {
  const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  const activeJobs: Job[] = [];
  const newlyArchivedJobs: Job[] = [];

  (state.jobs || []).forEach((j) => {
    const isCompleted = j.stage === 'Completed' || (j.availableRolls === 0 && j.availableCuttingCrates === 0 && j.availableFormingCrates === 0 && (j.availableQcCrates || 0) === 0);
    if (isCompleted && j.runningBatches && j.runningBatches.length > 0) {
      const lastBatch = j.runningBatches[j.runningBatches.length - 1];
      const batchTime = lastBatch.endTime ? new Date(lastBatch.endTime).getTime() : 0;
      if (batchTime > 0 && batchTime < cutoffTime) {
        newlyArchivedJobs.push(j);
        return;
      }
    }
    activeJobs.push(j);
  });

  const activeLogs: LogEntry[] = [];
  const newlyArchivedLogs: LogEntry[] = [];

  (state.logs || []).forEach((l) => {
    const logTime = l.timestamp ? new Date(l.timestamp).getTime() : (l.rawDate ? new Date(l.rawDate).getTime() : 0);
    if (logTime > 0 && logTime < cutoffTime) {
      newlyArchivedLogs.push(l);
    } else {
      activeLogs.push(l);
    }
  });

  const prunedState: FactoryState = {
    ...state,
    jobs: activeJobs,
    logs: activeLogs,
    archivedJobs: [...(state.archivedJobs || []), ...newlyArchivedJobs],
    archivedLogs: [...(state.archivedLogs || []), ...newlyArchivedLogs]
  };

  return {
    prunedState,
    archivedJobsCount: newlyArchivedJobs.length,
    archivedLogsCount: newlyArchivedLogs.length
  };
}

/**
 * Checks storage quotas and estimates bytes currently consumed.
 */
export async function getStorageHealth(): Promise<{
  usedBytes: number;
  quotaBytes: number;
  percentage: number;
  isIndexedDBSupported: boolean;
  engine: string;
}> {
  const isIndexedDBSupported = typeof window !== 'undefined' && !!window.indexedDB;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usedBytes = estimate.usage || 0;
      const quotaBytes = estimate.quota || 1024 * 1024 * 1024;
      const percentage = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;

      return {
        usedBytes,
        quotaBytes,
        percentage: Math.min(100, Math.round(percentage * 100) / 100),
        isIndexedDBSupported,
        engine: isIndexedDBSupported ? 'IndexedDB (Central Sync Bridge Enabled)' : 'localStorage'
      };
    } catch (e) {
      console.warn('[Storage] Storage estimate failed:', e);
    }
  }

  let approxBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        approxBytes += key.length * 2 + (localStorage.getItem(key)?.length || 0) * 2;
      }
    }
  } catch (e) {}

  return {
    usedBytes: approxBytes,
    quotaBytes: 5 * 1024 * 1024,
    percentage: Math.round((approxBytes / (5 * 1024 * 1024)) * 100),
    isIndexedDBSupported,
    engine: isIndexedDBSupported ? 'IndexedDB' : 'localStorage (5MB Max)'
  };
}

// Attach automatic background sync triggers in browser environment
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.info('[Sync Bridge] Network connection restored. Flushing offline queue...');
    flushOfflineSyncQueue();
  });

  window.addEventListener('focus', () => {
    flushOfflineSyncQueue();
  });

  // Periodic queue flush & sync check every 15 seconds
  setInterval(() => {
    flushOfflineSyncQueue();
  }, 15000);
}
