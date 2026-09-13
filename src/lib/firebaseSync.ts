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
import firebaseConfig from '../../firebase-applet-config.json';

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

/**
 * Pushes the full consolidated state to the central Firestore cloud document.
 * This guarantees real-time synchronization across GitHub Pages, mobile tablets, and desktop workstations.
 */
export async function syncStateToCloud(state: FactoryState): Promise<boolean> {
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
    }, { merge: true });

    return true;
  } catch (err) {
    console.error('[FirebaseSync] Error syncing state to Firestore cloud:', err);
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
  } catch (err) {
    console.error('[FirebaseSync] Error fetching state from Firestore cloud:', err);
    return null;
  }
}

/**
 * Subscribes to live real-time state changes from Firestore.
 * When any mobile or computer records a change on GitHub Pages,
 * all other connected devices instantly receive and merge the update.
 */
export function subscribeToCloudSync(
  onRemoteStateReceived: (mergedState: FactoryState, fromDeviceId: string) => void
): Unsubscribe | null {
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
