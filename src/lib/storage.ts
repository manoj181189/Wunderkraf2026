import { FactoryState, Job, LogEntry } from '../types';
import { LOCAL_STORAGE_KEY, INITIAL_STATE } from './constants';
import { mergeFactoryStates } from './syncMerge';
import {
  syncStateToCloud,
  fetchStateFromCloud,
  subscribeToCloudSync,
  LOCAL_DEVICE_ID,
  isFirebaseConfigured,
  getFirebaseProjectId,
  testFirestoreConnection,
  getCloudSyncMode,
  setCloudSyncMode,
  isStudioOrDevEnvironment,
  CloudSyncMode
} from './firebaseSync';

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
    const timeoutId = setTimeout(() => controller.abort(), 12000);

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
/**
 * Self-healing stage reconciliation:
 * Detects jobs where slitting of 8 or 9 layers is 100% completed.
 * Automatically marks them 'Slitting Completed' / 'READY_FOR_CUTTING' with available rolls,
 * and marks their production plans 'Completed' so they cleanly move from Slitting to Cutting.
 */
export function reconcileJobStageTransitions(state: FactoryState): FactoryState {
  if (!state || !state.jobs || !Array.isArray(state.jobs)) return state;

  let hasChanges = false;
  const plans = state.productionPlans || [];

  const updatedJobs = state.jobs.map((job) => {
    let updatedJob = { ...job };
    const linkedPlan = job.planId ? plans.find(p => p.id === job.planId) : null;
    const targetLayers = linkedPlan?.targetLayers || job.targetLayers || 8;
    const completedReelsCount = job.reelsList?.length || 0;
    const allBatches = job.runningBatches || [];
    
    // Slitting batches
    const slitBatches = allBatches.filter(b => b.stage === 'Slitting' || b.machine?.startsWith('Slitting'));
    const totalSlitRollsProduced = slitBatches.reduce((sum, b) => sum + (b.producedQty || 0), 0) ||
      (job.reelsList || []).reduce((sum, r) => sum + (r.rolls || 0), 0) ||
      targetLayers;

    // Cutting batches
    const cutBatches = allBatches.filter(b => b.stage === 'Cutting' || b.machine?.startsWith('Cutting'));
    const hasCompletedCut = cutBatches.some(b => b.status === 'Completed');
    const hasRunningCut = cutBatches.some(b => b.status === 'Running' || b.status === 'Held');
    const totalCutRollsConsumed = cutBatches.reduce((sum, b) => sum + (b.issuedQty || b.consumedQty || 0), 0);

    // Downstream batches
    const formBatches = allBatches.filter(b => b.stage === 'Forming' || b.machine?.startsWith('Forming'));
    const qcBatches = allBatches.filter(b => b.stage === 'QC');
    const packBatches = allBatches.filter(b => b.stage === 'Packing');

    // Crate quantities per stage
    const totalCutCratesProduced = cutBatches.reduce((sum, b) => sum + (Number(b.producedQty) || 0), 0);
    const totalFormCratesIssued = formBatches.reduce((sum, b) => sum + (Number(b.issuedQty) || 0), 0);
    const totalFormCratesProduced = formBatches.reduce((sum, b) => sum + (Number(b.producedQty) || 0), 0);
    const totalQcCratesIssued = qcBatches.reduce((sum, b) => sum + (Number(b.issuedQty) || 0), 0);
    const totalQcCratesApproved = qcBatches.reduce((sum, b) => sum + (Number(b.producedQty) || 0), 0);
    const totalPackCratesIssued = packBatches.reduce((sum, b) => sum + (Number(b.issuedQty) || 0), 0);

    // Dynamic Crate Reconciliation
    const calcAvailCutCrates = totalCutCratesProduced > 0
      ? Math.max(0, totalCutCratesProduced - totalFormCratesIssued)
      : (totalFormCratesIssued > 0
          ? Math.max(0, (Number(job.totalCutCrates) || Number(job.availableCuttingCrates) || 0) - totalFormCratesIssued)
          : Number(job.availableCuttingCrates) || 0);

    const calcAvailFormCrates = totalFormCratesProduced > 0
      ? Math.max(0, totalFormCratesProduced - totalQcCratesIssued)
      : (totalQcCratesIssued > 0
          ? Math.max(0, (Number(job.availableFormingCrates) || 0) - totalQcCratesIssued)
          : Number(job.availableFormingCrates) || 0);

    const calcAvailQcCrates = totalQcCratesApproved > 0
      ? Math.max(0, totalQcCratesApproved - totalPackCratesIssued)
      : (totalPackCratesIssued > 0
          ? Math.max(0, (Number(job.availableQcCrates) || 0) - totalPackCratesIssued)
          : Number(job.availableQcCrates) || 0);

    if (updatedJob.availableCuttingCrates !== calcAvailCutCrates) {
      updatedJob.availableCuttingCrates = calcAvailCutCrates;
      hasChanges = true;
    }
    if (updatedJob.availableFormingCrates !== calcAvailFormCrates) {
      updatedJob.availableFormingCrates = calcAvailFormCrates;
      hasChanges = true;
    }
    if (updatedJob.availableQcCrates !== calcAvailQcCrates) {
      updatedJob.availableQcCrates = calcAvailQcCrates;
      hasChanges = true;
    }

    // Dynamic Stage & Status Progression across all production desks
    const hasRunningSlitting = slitBatches.some(b => b.status === 'Running' || b.status === 'Held');
    const hasRunningCutting = cutBatches.some(b => b.status === 'Running' || b.status === 'Held');
    const hasRunningForming = formBatches.some(b => b.status === 'Running' || b.status === 'Held');
    const hasRunningQc = qcBatches.some(b => b.status === 'Running' || b.status === 'Held');
    const hasRunningPacking = packBatches.some(b => b.status === 'Running' || b.status === 'Held');

    const hasCompletedSlitting = slitBatches.some(b => b.status === 'Completed');
    const hasCompletedCutting = cutBatches.some(b => b.status === 'Completed');
    const hasCompletedForming = formBatches.some(b => b.status === 'Completed');
    const hasCompletedQc = qcBatches.some(b => b.status === 'Completed');

    if (updatedJob.stage === 'Completed' || updatedJob.status === 'Completed') {
      // Retain completed state
    } else if (hasRunningPacking) {
      if (updatedJob.stage !== 'Packing') { updatedJob.stage = 'Packing'; hasChanges = true; }
      if (updatedJob.status !== 'PACKING_IN_PROGRESS') { updatedJob.status = 'PACKING_IN_PROGRESS'; hasChanges = true; }
    } else if (calcAvailQcCrates > 0 && calcAvailFormCrates === 0 && calcAvailCutCrates === 0 && !hasRunningForming && !hasRunningQc) {
      if (updatedJob.stage !== 'Packing') { updatedJob.stage = 'Packing'; hasChanges = true; }
      if (updatedJob.status !== 'READY_FOR_PACKING') { updatedJob.status = 'READY_FOR_PACKING'; hasChanges = true; }
    } else if (hasRunningQc) {
      if (updatedJob.stage !== 'QC') { updatedJob.stage = 'QC'; hasChanges = true; }
      if (updatedJob.status !== 'QC_IN_PROGRESS') { updatedJob.status = 'QC_IN_PROGRESS'; hasChanges = true; }
    } else if ((calcAvailFormCrates > 0 || updatedJob.stage === 'QC') && !hasRunningForming) {
      if (updatedJob.stage !== 'QC') { updatedJob.stage = 'QC'; hasChanges = true; }
      if (updatedJob.status !== 'READY_FOR_QC') { updatedJob.status = 'READY_FOR_QC'; hasChanges = true; }
    } else if (hasRunningForming) {
      if (updatedJob.stage !== 'Forming') { updatedJob.stage = 'Forming'; hasChanges = true; }
      if (updatedJob.status !== 'FORMING_IN_PROGRESS') { updatedJob.status = 'FORMING_IN_PROGRESS'; hasChanges = true; }
    } else if ((calcAvailCutCrates > 0 || updatedJob.stage === 'Forming') && (hasCompletedCutting || updatedJob.status === 'CUTTING_COMPLETED')) {
      if (updatedJob.stage !== 'Forming') { updatedJob.stage = 'Forming'; hasChanges = true; }
      if (updatedJob.status !== 'READY_FOR_FORMING') { updatedJob.status = 'READY_FOR_FORMING'; hasChanges = true; }
    } else if (hasRunningCutting) {
      if (updatedJob.stage !== 'Cutting') { updatedJob.stage = 'Cutting'; hasChanges = true; }
      if (updatedJob.status !== 'CUTTING_IN_PROGRESS') { updatedJob.status = 'CUTTING_IN_PROGRESS'; hasChanges = true; }
    }

    if (totalCutRollsConsumed >= totalSlitRollsProduced && totalSlitRollsProduced > 0 && updatedJob.availableRolls !== 0) {
      updatedJob.availableRolls = 0;
      hasChanges = true;
    }

    // 2. Reconciliation for jobs that have COMPLETED SLITTING and ready for Cutting
    const isSlitting100PercentDone = 
      (completedReelsCount >= targetLayers && targetLayers > 0) ||
      (job.stage === 'Slitting Completed') ||
      (slitBatches.length > 0 && slitBatches.every(b => b.status === 'Completed') && (job.outputWeightKg || 0) > 0);

    if (isSlitting100PercentDone && cutBatches.length === 0 && formBatches.length === 0 && qcBatches.length === 0 && packBatches.length === 0) {
      const isPastSlitting = 
        ['Cutting', 'Forming', 'QC', 'Packing', 'Dispatched', 'Cutting Completed'].includes(updatedJob.stage) ||
        ['CUTTING_IN_PROGRESS', 'CUTTING_COMPLETED', 'Completed'].includes(updatedJob.status) ||
        calcAvailCutCrates > 0 ||
        (updatedJob.totalCutPieces || 0) > 0;

      const effectiveRolls = (updatedJob.availableRolls !== undefined && updatedJob.availableRolls > 0) 
        ? updatedJob.availableRolls 
        : Math.max(completedReelsCount, targetLayers);

      if (!isPastSlitting && updatedJob.status !== 'READY_FOR_CUTTING') {
        updatedJob.stage = 'Slitting Completed';
        updatedJob.status = 'READY_FOR_CUTTING';
        updatedJob.availableRolls = effectiveRolls;
        hasChanges = true;
      } else if (!isPastSlitting && updatedJob.availableRolls === undefined) {
        updatedJob.availableRolls = effectiveRolls;
        hasChanges = true;
      }
    }

    return updatedJob;
  });

  const updatedPlans = plans.map((plan) => {
    if (plan.status === 'Completed' || plan.status === 'Cancelled') return plan;
    const linkedJob = updatedJobs.find(j => j.planId === plan.id || j.id === plan.jobId);
    if (!linkedJob) return plan;

    const targetLayers = plan.targetLayers || linkedJob.targetLayers || 8;
    const completedReelsCount = linkedJob.reelsList?.length || 0;
    const isDone = 
      (completedReelsCount >= targetLayers && targetLayers > 0) ||
      linkedJob.stage === 'Slitting Completed' ||
      linkedJob.stage === 'Cutting' ||
      linkedJob.status === 'READY_FOR_CUTTING' ||
      linkedJob.status === 'CUTTING_IN_PROGRESS' ||
      linkedJob.status === 'Completed';

    if (isDone) {
      hasChanges = true;
      return {
        ...plan,
        status: 'Completed' as const,
        actualLayersUsed: completedReelsCount || targetLayers
      };
    }
    return plan;
  });

  if (!hasChanges) return state;

  return {
    ...state,
    jobs: updatedJobs,
    productionPlans: updatedPlans
  };
}

export async function persistFactoryState(
  nextState: FactoryState,
  _currentState?: FactoryState
): Promise<{
  success: boolean;
  savedToIndexedDB: boolean;
  savedToLocalStorage: boolean;
  mergedState: FactoryState;
}> {
  let savedToIndexedDB = false;
  let savedToLocalStorage = false;

  // Run reconciliation to ensure completed slitting jobs transition smoothly to cutting
  const reconciled = reconcileJobStageTransitions(nextState);

  // Use nextState directly as the authoritative state to persist (do not merge old deleted items back)
  const stateToSave: FactoryState = {
    ...reconciled,
    lastResetTimestamp: Math.max(reconciled.lastResetTimestamp || 0, _currentState?.lastResetTimestamp || 0),
    lastUpdated: reconciled.lastUpdated || new Date().toISOString()
  };

  // 1. Primary IndexedDB write
  try {
    savedToIndexedDB = await saveToIndexedDB(stateToSave);
  } catch (e) {
    console.error('[Storage] Error during IndexedDB persistence:', e);
  }

  // 2. Mirror to localStorage with auto-pruning if quota reached
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
    savedToLocalStorage = true;
  } catch (localStorageErr: any) {
    console.warn('[Storage] localStorage quota reached. Attempting defensive pruning...', localStorageErr);
    try {
      const trimmedState: FactoryState = {
        ...stateToSave,
        logs: (stateToSave.logs || []).slice(-100)
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmedState));
      savedToLocalStorage = true;
    } catch (innerErr) {
      console.error('[Storage] localStorage mirror completely full. IndexedDB remains primary authority.', innerErr);
    }
  }

  // 3. Enqueue to offline write-queue for central sync
  await enqueueOfflineSync(stateToSave);

  // 4. Notify all local tabs on same browser
  syncBus?.postMessage({ type: 'STATE_CHANGED', state: stateToSave });

  // 5. Real-time Multi-Device Cloud Sync (Firestore: Works on GitHub Pages worldwide)
  // In Manual Mode (AI Studio / Dev), auto-push is skipped to prevent accidental live overwrites
  if (isFirebaseConfigured() && getCloudSyncMode() === 'auto') {
    syncStateToCloud(stateToSave, false).catch((err) => {
      console.warn('[FirebaseSync] Background cloud sync deferred:', err);
    });
  }

  // 6. Direct instant push to Central Server Bridge (for 0ms multi-device live sync)
  let serverMergedState = stateToSave;
  if (typeof window !== 'undefined') {
    try {
      const endpoint = getCentralSyncEndpoint();
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: stateToSave,
          clientTimestamp: Date.now()
        })
      });
      if (res.ok) {
        const result = await res.json();
        if (result && result.state && Array.isArray(result.state.jobs)) {
          serverMergedState = result.state;
          await saveToIndexedDB(serverMergedState);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverMergedState));
          } catch (e) {}
          syncBus?.postMessage({ type: 'STATE_SYNCED', state: serverMergedState });
        }
      }
    } catch (pushErr) {
      console.warn('[Sync Bridge] Direct push deferred, state queued for retry:', pushErr);
    }
  }

  // 7. Trigger non-blocking offline queue flush fallback
  flushOfflineSyncQueue().catch(() => {});

  return {
    success: savedToIndexedDB || savedToLocalStorage,
    savedToIndexedDB,
    savedToLocalStorage,
    mergedState: serverMergedState
  };
}

/**
 * Initialize factory state on startup:
 * 1. Loads local cached state from IndexedDB (or localStorage fallback).
 * 2. Fetches authoritative shared state from Central Sync Bridge (/api/sync/state).
 *    If local is fresh/empty, adopts central state without wiping data.
 * 3. Converges with Firestore Cloud if configured and in Auto mode.
 * 4. Fallback to local offline state or INITIAL_STATE.
 */
export async function initializeFactoryState(): Promise<FactoryState> {
  const syncMode = getCloudSyncMode();

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

  // Step 2: Query the Central Sync Bridge HTTP endpoint (/api/sync/state)
  // The central server holds the shared production database across all factory devices.
  try {
    const centralState = await fetchCentralState();
    if (centralState && Array.isArray(centralState.jobs)) {
      // Adopt central state, but safely preserve any new local jobs or plans that were entered locally!
      const merged = (localState && localState.jobs && localState.jobs.length > 0)
        ? reconcileJobStageTransitions(mergeFactoryStates(centralState, localState))
        : reconcileJobStageTransitions(centralState);

      merged.glueBrands = ['Pidilite FS35'];

      // Save converged authoritative state to local storage
      await saveToIndexedDB(merged);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {}

      // If local state had additional jobs not on server, push merged state up to server immediately
      if (localState && localState.jobs && localState.jobs.some(lj => !centralState.jobs.some(cj => cj.id === lj.id))) {
        persistFactoryState(merged).catch(() => {});
      }

      // Flush any pending offline queue items
      flushOfflineSyncQueue().catch(() => {});

      return merged;
    }
  } catch (syncErr) {
    console.warn('[Sync Bridge] Central sync failed on boot. Using local cached state:', syncErr);
  }

  // Step 3: Attempt to pull latest shared state from Firestore Cloud (Primary for GitHub Pages / Multi-Device Fleet in Auto Mode)
  if (isFirebaseConfigured() && syncMode === 'auto') {
    try {
      const cloudState = await fetchStateFromCloud();
      if (cloudState && Array.isArray(cloudState.jobs)) {
        console.info('[FirebaseSync] Authoritative cloud state received. Converging with local state...');
        const merged = reconcileJobStageTransitions(mergeFactoryStates(cloudState, localState || INITIAL_STATE));
        merged.glueBrands = ['Pidilite FS35'];
        await saveToIndexedDB(merged);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
        } catch (e) {}
        syncStateToCloud(merged, true).catch(() => {});
        flushOfflineSyncQueue().catch(() => {});
        return merged;
      }
    } catch (cloudErr) {
      console.warn('[FirebaseSync] Cloud fetch on startup deferred:', cloudErr);
    }
  }

  // Step 4: Fallback to local state if server was unreachable
  if (localState && localState.jobs && Array.isArray(localState.jobs)) {
    console.info('[Storage] Initialized with local offline state.');
    localState.glueBrands = ['Pidilite FS35'];
    return reconcileJobStageTransitions(localState);
  }

  console.info('[Storage] Initializing fresh default state.');
  const defaultSt = reconcileJobStageTransitions({ ...INITIAL_STATE, glueBrands: ['Pidilite FS35'] });
  saveToIndexedDB(defaultSt).catch(() => {});
  return defaultSt;
}

/**
 * Explicit manual synchronization with Cloud and Central Sync Bridge.
 * When called explicitly by user, forces cloud push even in Manual Mode.
 */
export async function forceSyncWithCentral(
  currentState: FactoryState,
  overwriteServer: boolean = true
): Promise<{
  success: boolean;
  syncedState: FactoryState;
  message: string;
}> {
  let cloudSuccess = false;
  let httpSuccess = false;

  if (overwriteServer) {
    currentState.lastResetTimestamp = Date.now();
    // Clear offline write queue to remove old stale operations
    try {
      const db = await openIndexedDB();
      const tx = db.transaction(QUEUE_STORE_NAME, 'readwrite');
      tx.objectStore(QUEUE_STORE_NAME).clear();
    } catch (e) {}
  }

  let serverState = currentState;

  // 1. Flush offline queue if not an overwrite reset
  if (!overwriteServer) {
    await flushOfflineSyncQueue().catch(() => {});
  }

  // 2. Push current local state to Firestore Cloud
  if (isFirebaseConfigured()) {
    try {
      const pushed = await syncStateToCloud(currentState, true);
      cloudSuccess = pushed;
    } catch (e) {
      console.warn('[FirebaseSync] Force sync push error:', e);
    }
  }

  // 3. Push to local/custom HTTP endpoint with overwrite flag
  try {
    const endpoint = getCentralSyncEndpoint();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: currentState, overwrite: overwriteServer, force: overwriteServer, reset: overwriteServer, clientTimestamp: Date.now() })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.state && Array.isArray(data.state.jobs)) {
        httpSuccess = true;
        serverState = data.state;
      }
    }
  } catch (err: any) {
    console.warn('[Sync Bridge] HTTP Force sync push error:', err);
  }

  // 4. Persist locally
  await saveToIndexedDB(serverState);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverState));
  } catch (e) {}

  // Broadcast event locally to all open components and tabs
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wunderkraf-state-synced', { detail: serverState }));
  }
  try {
    syncBus?.postMessage({ type: 'STATE_SYNCED', state: serverState });
  } catch (e) {}

  if (cloudSuccess || httpSuccess) {
    return {
      success: true,
      syncedState: serverState,
      message: overwriteServer
        ? `⚡ Live Sync Overwrite Complete: Server database replaced & synchronized across all live connected devices (${serverState.jobs?.length || 0} jobs).`
        : 'Cloud Sync Successful: Studio state pushed to Firestore Cloud & Central Server.'
    };
  }

  return {
    success: true,
    syncedState: serverState,
    message: 'Local state saved and persisted successfully.'
  };
}

/**
 * Explicit User Action: Pull latest state from Firestore Cloud into local state.
 */
export async function pullStateFromCloudExplicit(currentState: FactoryState): Promise<{
  success: boolean;
  pulledState?: FactoryState;
  message: string;
}> {
  if (!isFirebaseConfigured()) {
    return { success: false, message: 'Firebase is not configured.' };
  }
  try {
    const remoteState = await fetchStateFromCloud();
    if (remoteState && Array.isArray(remoteState.jobs)) {
      await saveToIndexedDB(remoteState);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remoteState));
      } catch (e) {}
      return {
        success: true,
        pulledState: remoteState,
        message: 'Successfully pulled authoritative live state from Firestore Cloud!'
      };
    }
    return { success: false, message: 'No remote state found in Firestore Cloud.' };
  } catch (err: any) {
    return { success: false, message: `Failed to pull from Cloud: ${err.message}` };
  }
}

/**
 * Subscribes to cross-device Cloud Firestore events and local cross-tab events.
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

  // Live Cloud Real-Time Listener (Firestore: Crucial for GitHub Pages multi-device sync)
  let unsubscribeCloud: (() => void) | null = null;
  if (isFirebaseConfigured()) {
    try {
      unsubscribeCloud = subscribeToCloudSync((remoteState, fromDeviceId) => {
        if (fromDeviceId !== LOCAL_DEVICE_ID && remoteState && Array.isArray(remoteState.jobs)) {
          console.info('[FirebaseSync] Live update received from remote device:', fromDeviceId);
          loadFromIndexedDB()
            .then((currentLocal) => {
              const merged = mergeFactoryStates(currentLocal || INITIAL_STATE, remoteState);
              saveToIndexedDB(merged).catch(() => {});
              try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
              } catch (e) {}
              onUpdate(merged);
            })
            .catch(() => {
              onUpdate(remoteState);
            });
        }
      });
    } catch (err) {
      console.warn('[FirebaseSync] Could not establish live listener:', err);
    }
  }

  // Real-Time Multi-Device Sync: Server-Sent Events (SSE) Stream + Lightweight Ping Polling
  let eventSource: EventSource | null = null;
  let pollTimer: any = null;
  let lastObservedRevision = 0;
  let isFetchingState = false;
  let hasPendingFetch = false;

  const pullLatestState = async () => {
    if (isFetchingState) {
      hasPendingFetch = true;
      return;
    }
    isFetchingState = true;
    try {
      const endpoint = getCentralSyncEndpoint();
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.state && Array.isArray(data.state.jobs)) {
          lastObservedRevision = data.revision || Date.now();
          const reconciled = reconcileJobStageTransitions(data.state);
          await saveToIndexedDB(reconciled);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reconciled));
          } catch (e) {}
          onUpdate(reconciled);
        }
      }
    } catch (e) {
      // Ignore network hiccup
    } finally {
      isFetchingState = false;
      if (hasPendingFetch) {
        hasPendingFetch = false;
        pullLatestState();
      }
    }
  };

  if (typeof window !== 'undefined') {
    // Immediately pull latest state on mount so device is 100% in sync right away!
    pullLatestState();

    // 1. Establish Real-Time SSE Stream for instant sub-50ms multi-device updates
    try {
      const origin = window.location.origin || '';
      const streamUrl = `${origin}/api/sync/stream`;
      eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          if (!event.data || event.data.startsWith(':')) return;
          const msg = JSON.parse(event.data);
          if (msg.type === 'CONNECTED' || msg.type === 'STATE_CHANGED') {
            if (msg.state && Array.isArray(msg.state.jobs)) {
              lastObservedRevision = msg.revision || Date.now();
              const reconciled = reconcileJobStageTransitions(msg.state);
              saveToIndexedDB(reconciled).catch(() => {});
              try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reconciled));
              } catch (e) {}
              onUpdate(reconciled);
              return;
            }
            if (msg.revision && msg.revision !== lastObservedRevision) {
              lastObservedRevision = msg.revision;
              pullLatestState();
            }
          }
        } catch (e) {}
      };

      eventSource.onerror = () => {
        // SSE reconnects automatically
      };
    } catch (e) {
      console.warn('[Sync Bridge] SSE not supported, falling back to fast ping polling:', e);
    }

    // 2. Ultra-Lightweight Ping Polling (/api/sync/ping is ~100 bytes) every 1.5 seconds as robust backup
    const checkPing = async () => {
      try {
        const origin = window.location.origin || '';
        const pingUrl = `${origin}/api/sync/ping`;
        const res = await fetch(pingUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.revision) {
            if (data.revision !== lastObservedRevision) {
              lastObservedRevision = data.revision;
              pullLatestState();
            }
          }
        }
      } catch (e) {}
    };

    pollTimer = setInterval(checkPing, 1500);

    // Instant check when operator switches back to this tab/window
    window.addEventListener('focus', checkPing);
  }

  return () => {
    if (pollTimer) {
      clearInterval(pollTimer);
    }
    if (eventSource) {
      eventSource.close();
    }
    syncBus?.removeEventListener('message', handler);
    if (typeof window !== 'undefined') {
      window.removeEventListener('wunderkraf-state-synced', windowHandler);
    }
    if (unsubscribeCloud) {
      unsubscribeCloud();
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

        stateCandidate.lastResetTimestamp = Date.now();

        await saveToIndexedDB(stateCandidate);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateCandidate));
        } catch (e) {}

        try {
          const syncRes = await forceSyncWithCentral(stateCandidate, true);
          if (syncRes && syncRes.syncedState) {
            resolve(syncRes.syncedState);
            return;
          }
        } catch (syncErr) {
          console.warn('[Backup Restore] Force server sync deferred:', syncErr);
        }
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

export function getCloudSyncStatus(): {
  isConfigured: boolean;
  projectId: string;
  deviceId: string;
  syncMode: CloudSyncMode;
  isStudio: boolean;
} {
  return {
    isConfigured: isFirebaseConfigured(),
    projectId: getFirebaseProjectId(),
    deviceId: LOCAL_DEVICE_ID,
    syncMode: getCloudSyncMode(),
    isStudio: isStudioOrDevEnvironment()
  };
}

export { testFirestoreConnection, getCloudSyncMode, setCloudSyncMode, isStudioOrDevEnvironment };
export type { CloudSyncMode };

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
