import { FactoryState, Job, LogEntry } from '../types';
import { LOCAL_STORAGE_KEY, INITIAL_STATE } from './constants';

const DB_NAME = 'WunderkrafFactoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'factory_state';
const STATE_RECORD_KEY = 'current_state';

/**
 * Open or upgrade native browser IndexedDB for high-capacity offline storage.
 * Bypasses browser localStorage 5MB quota limit, providing gigabytes of safe local storage.
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

/**
 * Dual-persistence engine:
 * 1. Writes complete unpruned state into IndexedDB (supports >1GB storage).
 * 2. Mirrors to localStorage with automatic defensive pruning if QuotaExceededError occurs.
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
    console.warn('[Storage] localStorage quota reached or error occurred. Attempting defensive pruning for mirror...', localStorageErr);
    try {
      // Create a trimmed mirror for localStorage (keep recent 100 logs and active jobs)
      const trimmedState: FactoryState = {
        ...nextState,
        logs: (nextState.logs || []).slice(-100)
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmedState));
      savedToLocalStorage = true;
      console.info('[Storage] Successfully saved trimmed mirror to localStorage.');
    } catch (innerErr) {
      console.error('[Storage] localStorage mirror completely full. IndexedDB remains primary authority.', innerErr);
    }
  }

  return {
    success: savedToIndexedDB || savedToLocalStorage,
    savedToIndexedDB,
    savedToLocalStorage
  };
}

/**
 * Initialize factory state on startup:
 * 1. Checks IndexedDB first.
 * 2. Falls back to localStorage.
 * 3. Falls back to INITIAL_STATE.
 */
export async function initializeFactoryState(): Promise<FactoryState> {
  // Try IndexedDB first
  try {
    const idbState = await loadFromIndexedDB();
    if (idbState && idbState.jobs && Array.isArray(idbState.jobs)) {
      console.info('[Storage] Loaded primary state from IndexedDB.');
      return idbState;
    }
  } catch (e) {
    console.warn('[Storage] IndexedDB check failed, falling back to localStorage', e);
  }

  // Fallback to localStorage
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.jobs && Array.isArray(parsed.jobs)) {
        console.info('[Storage] Loaded fallback state from localStorage.');
        // Seed IndexedDB for future runs
        saveToIndexedDB(parsed).catch(() => {});
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Storage] localStorage parse failed', e);
  }

  console.info('[Storage] Initializing fresh default state.');
  // Seed IndexedDB with initial state
  saveToIndexedDB(INITIAL_STATE).catch(() => {});
  return INITIAL_STATE;
}

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

        // Check if wrapped in payload metadata or raw FactoryState
        const stateCandidate: FactoryState = parsed.data || parsed;

        if (!stateCandidate || typeof stateCandidate !== 'object') {
          throw new Error('Invalid JSON file structure');
        }

        if (!Array.isArray(stateCandidate.jobs)) {
          throw new Error('Backup file is missing required "jobs" array');
        }

        // Save imported state immediately to IndexedDB and localStorage
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
    // Keep running/pending jobs or recent completed jobs
    const isCompleted = j.stage === 'Completed' || (j.availableRolls === 0 && j.availableCuttingCrates === 0 && j.availableFormingCrates === 0 && (j.availableQcCrates || 0) === 0);
    // If completed and runningBatches have old end times
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
      const quotaBytes = estimate.quota || 1024 * 1024 * 1024; // Default 1GB estimate
      const percentage = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;

      return {
        usedBytes,
        quotaBytes,
        percentage: Math.min(100, Math.round(percentage * 100) / 100),
        isIndexedDBSupported,
        engine: isIndexedDBSupported ? 'IndexedDB (Enterprise High-Capacity)' : 'localStorage'
      };
    } catch (e) {
      console.warn('[Storage] Storage estimate failed:', e);
    }
  }

  // Fallback estimation using localStorage
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
    quotaBytes: 5 * 1024 * 1024, // 5MB standard localStorage
    percentage: Math.round((approxBytes / (5 * 1024 * 1024)) * 100),
    isIndexedDBSupported,
    engine: isIndexedDBSupported ? 'IndexedDB' : 'localStorage (5MB Max)'
  };
}
