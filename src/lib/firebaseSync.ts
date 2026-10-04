import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  Firestore,
  Unsubscribe
} from 'firebase/firestore';
import { FactoryState } from '../types';
import { mergeFactoryStates } from './syncMerge';
import { firebaseConfig } from './firebaseConfig';

// Unique persistent device identifier to identify origin across multi-device fleet
export const LOCAL_DEVICE_ID = (() => {
  try {
    let id = localStorage.getItem('wk_erp_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('wk_erp_device_id', id);
    }
    return id;
  } catch {
    return 'dev_' + Math.random().toString(36).substring(2, 9);
  }
})();

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let isInitialized = false;

export function getFirebaseDb(): Firestore | null {
  if (db) return db;
  try {
    if (!firebaseConfig || !firebaseConfig.projectId || !firebaseConfig.apiKey) {
      console.warn('[FirebaseSync] Firebase config missing or incomplete in firebase-applet-config.json');
      return null;
    }

    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }

    db = getFirestore(app);
    isInitialized = true;
    console.log('[FirebaseSync] Connected to Firestore project:', firebaseConfig.projectId);
    return db;
  } catch (err) {
    console.error('[FirebaseSync] Error initializing Firebase:', err);
    return null;
  }
}

export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig && firebaseConfig.projectId && firebaseConfig.apiKey);
}

export function getFirebaseProjectId(): string {
  return firebaseConfig?.projectId || '';
}

export function isStudioOrDevEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname || '';
  return (
    hostname.includes('ais-dev') ||
    hostname.includes('ais-pre') ||
    hostname.includes('googleusercontent.com') ||
    hostname.includes('run.app') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  );
}

export type CloudSyncMode = 'manual' | 'auto';

export function getCloudSyncMode(): CloudSyncMode {
  if (typeof window === 'undefined') return 'manual';
  try {
    const saved = localStorage.getItem('wunderkraf_cloud_sync_mode');
    if (saved === 'auto' || saved === 'manual') {
      return saved;
    }
  } catch (e) {}
  
  // Default to 'manual' (Safe Sandbox mode) in AI Studio / Dev environments
  if (isStudioOrDevEnvironment()) {
    return 'manual';
  }
  // In production (e.g. GitHub Pages or custom domain), default to 'auto'
  return 'auto';
}

export function setCloudSyncMode(mode: CloudSyncMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('wunderkraf_cloud_sync_mode', mode);
  } catch (e) {}
}

/**
 * Pushes the full consolidated state to the central Firestore cloud document.
 * In Manual/Safe mode (default for AI Studio), background auto-sync is skipped unless force=true.
 */
export async function syncStateToCloud(state: FactoryState, force: boolean = false): Promise<boolean> {
  const syncMode = getCloudSyncMode();
  if (!force && syncMode === 'manual') {
    console.info('[FirebaseSync] Auto-push skipped (Safe/Manual Mode is active in Studio). Use "Push to Live Cloud" in Admin Settings to push changes.');
    return false;
  }

  const database = getFirebaseDb();
  if (!database) {
    return false;
  }

  try {
    const docRef = doc(database, 'factory_sync', 'current_state');
    
    // Deep clone and ensure no undefined values for Firestore compatibility
    const cleanState = JSON.parse(JSON.stringify(state));

    await setDoc(docRef, {
      state: cleanState,
      updatedAt: new Date().toISOString(),
      timestamp: Date.now(),
      deviceId: LOCAL_DEVICE_ID
    });

    console.info('[FirebaseSync] State successfully pushed to Firestore Cloud!');
    return true;
  } catch (err: any) {
    if (err?.message?.includes('offline') || err?.code === 'unavailable') {
      console.info('[FirebaseSync] Offline mode: State queued in local cache.');
    } else {
      console.warn('[FirebaseSync] Cloud sync notice:', err?.message || err);
    }
    return false;
  }
}

/**
 * Fetches the latest remote factory state from Firestore cloud.
 */
export async function fetchStateFromCloud(): Promise<FactoryState | null> {
  const database = getFirebaseDb();
  if (!database) return null;

  try {
    const docRef = doc(database, 'factory_sync', 'current_state');
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data && data.state) {
        return data.state as FactoryState;
      }
    }
    return null;
  } catch (err: any) {
    if (err?.message?.includes('offline') || err?.code === 'unavailable') {
      console.info('[FirebaseSync] Client is offline - using local IndexedDB cache.');
    } else {
      console.warn('[FirebaseSync] Fetch state notice:', err?.message || err);
    }
    return null;
  }
}

/**
 * Subscribes to live real-time state changes from Firestore.
 * In Manual/Safe mode (AI Studio), automatic live overwrite is bypassed.
 */
export function subscribeToCloudSync(
  onRemoteStateReceived: (mergedState: FactoryState, fromDeviceId: string) => void
): Unsubscribe | null {
  const syncMode = getCloudSyncMode();
  if (syncMode === 'manual') {
    console.info('[FirebaseSync] Live auto-listener skipped because Safe/Manual Mode is active in Studio.');
    return null;
  }

  const database = getFirebaseDb();
  if (!database) return null;

  try {
    const docRef = doc(database, 'factory_sync', 'current_state');

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        if (!data || !data.state) return;

        const remoteDeviceId = data.deviceId || 'unknown';
        const remoteState = data.state as FactoryState;

        onRemoteStateReceived(remoteState, remoteDeviceId);
      },
      (error) => {
        console.warn('[FirebaseSync] Live listener error (will retry automatically):', error.message);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error('[FirebaseSync] Failed to subscribe to Firestore cloud sync:', err);
    return null;
  }
}

/**
 * Verifies live Firestore connectivity to ensure the cloud synchronization
 * is functioning reliably on GitHub Pages, mobile, and desktop.
 */
export async function testFirestoreConnection(): Promise<{ connected: boolean; message: string }> {
  const database = getFirebaseDb();
  if (!database) {
    return { connected: false, message: 'Firebase not initialized. Check firebaseConfig.ts' };
  }

  try {
    const docRef = doc(database, 'factory_sync', 'current_state');
    const snap = await getDoc(docRef);
    return {
      connected: true,
      message: snap.exists()
        ? `Firestore live & connected (last synced: ${snap.data()?.updatedAt || 'active'})`
        : 'Firestore connected and ready for initial state upload'
    };
  } catch (err: any) {
    const msg = err?.message || 'Unable to connect to Firestore';
    const isOffline = msg.includes('offline') || err?.code === 'unavailable';
    return {
      connected: false,
      message: isOffline ? 'Client is offline. Operating in resilient offline IndexedDB mode.' : msg
    };
  }
}
