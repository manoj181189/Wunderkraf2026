import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const CENTRAL_STATE_FILE = path.join(process.cwd(), 'data', 'central_factory_state.json');
const FIREBASE_CONFIG_FILE = path.join(process.cwd(), 'firebase-applet-config.json');

async function main() {
  console.log('Starting factory state reset procedure...');

  // 1. Read the current central state
  if (!fs.existsSync(CENTRAL_STATE_FILE)) {
    console.error(`Central state file not found at: ${CENTRAL_STATE_FILE}`);
    process.exit(1);
  }

  const rawState = fs.readFileSync(CENTRAL_STATE_FILE, 'utf8');
  const state = JSON.parse(rawState);

  console.log(`Current state read. Active jobs found: ${state.jobs?.length || 0}`);

  // 2. Clear transactional data as requested
  state.jobs = [];
  state.packJobs = [];
  state.logs = [];
  state.auditLogs = [];
  state.shiftHandovers = [];
  state.glueUsageLogs = [];
  state.materialRequisitions = [];
  state.maintenanceIncidents = [];
  state.machineReadyAlerts = [];
  state.productionPlans = [];
  state.customerComplaints = [];
  state.scrapSales = [];

  // Reset trackers
  state.deletedJobIds = [];
  state.deletedOrderIds = [];
  state.deletedLogIds = [];
  state.deletedPlanIds = [];

  // 3. Remove worker machine allocations while preserving names & rosters
  if (Array.isArray(state.floorWorkers)) {
    console.log(`Resetting allocations for ${state.floorWorkers.length} workers...`);
    state.floorWorkers = state.floorWorkers.map((w: any) => {
      const cleanWorker = { ...w };
      cleanWorker.assignedMachine = "";
      cleanWorker.pairedWithOperator = "";
      return cleanWorker;
    });
  }

  // 4. Remove mother reel allocations
  if (Array.isArray(state.motherReelInventory)) {
    console.log(`Resetting allocations for ${state.motherReelInventory.length} mother reels...`);
    state.motherReelInventory = state.motherReelInventory.map((reel: any) => {
      const cleanReel = { ...reel, status: 'Available' };
      delete cleanReel.allocatedJobId;
      delete cleanReel.allocatedDate;
      return cleanReel;
    });
  }

  // 5. Establish the central barrier timestamp
  const barrierTimestamp = Date.now();
  state.lastResetTimestamp = barrierTimestamp;

  console.log(`Reset completed in-memory. Barrier lastResetTimestamp set to: ${barrierTimestamp}`);

  // 6. Save back to central JSON file
  fs.writeFileSync(CENTRAL_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  console.log('Saved clean state to central_factory_state.json.');

  // 7. Sync to Firestore Cloud directly if config is available
  if (fs.existsSync(FIREBASE_CONFIG_FILE)) {
    try {
      console.log('Firebase config file found. Initializing cloud sync...');
      const firebaseConfig = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf8'));

      const firebaseApp = initializeApp(firebaseConfig);
      const db = getFirestore(firebaseApp);
      const docRef = doc(db, 'factory_sync', 'current_state');

      console.log('Uploading clean state to Firestore (factory_sync/current_state)...');
      await setDoc(docRef, {
        state: state,
        updatedAt: new Date().toISOString(),
        timestamp: barrierTimestamp,
        deviceId: 'server_reset_trigger'
      });
      console.log('Firestore cloud document updated successfully!');
    } catch (err) {
      console.error('Failed to sync to Firestore cloud:', err);
    }
  } else {
    console.log('No firebase-applet-config.json found. Skipping cloud sync.');
  }

  console.log('State reset procedure completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error during reset procedure:', err);
  process.exit(1);
});
