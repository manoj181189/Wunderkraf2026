import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Settings,
  Users,
  ShieldAlert,
  Database,
  Smartphone,
  Sliders,
  Clock,
  KeyRound,
  Download,
  Upload,
  RotateCcw,
  Plus,
  Trash2,
  Edit,
  Save,
  Check,
  X,
  Search,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  Send,
  Layers,
  Scissors,
  Cog,
  SearchCheck,
  Package,
  Truck,
  RefreshCw,
  Eye,
  CheckCircle2,
  Tag,
  Box,
  Wrench,
  Phone,
  User,
  Cloud,
  Wifi,
  Scale,
  Undo2,
  History,
  Coffee
} from 'lucide-react';
import {
  FactoryState,
  Job,
  PackJob,
  LogEntry,
  ProductType,
  RunningBatch,
  UserAccount,
  ProductCrateCapacity,
  CoordinationMatrixItem,
  MaintenanceContact,
  ProductionPlan,
  NumberingSeriesMaster
} from '../../types';
import {
  PRODUCTS,
  PAPER_BRANDS,
  DEPT_WORKERS,
  INITIAL_STATE,
  DEFAULT_USERS,
  PRODUCT_PREFIX_MAP,
  DEFAULT_CRATE_CAPACITY_MASTER,
  DEFAULT_COORDINATION_MATRIX,
  DEFAULT_MAINTENANCE_CONTACTS,
  DEFAULT_OPERATIONAL_PAUSE_REASONS,
  DEFAULT_BREAKDOWN_REASONS_MAP,
  TARGET_LAYERS_DEFAULT,
  TARGET_GSM_DEFAULT
} from '../../lib/constants';
import { triggerWhatsAppShiftNotification } from '../../lib/whatsappReports';
import { exportToJSON, getCurrentExpectedShift, exportToCSV, getJobDeletionWarningInfo, performCascadeDeleteAndBackup } from '../../lib/utils';
import { exportDatabaseBackup, importDatabaseBackup, getStorageHealth, pruneFactoryState, getCentralSyncEndpoint, setCustomSyncEndpoint, forceSyncWithCentral, getPendingSyncCount, getCloudSyncStatus } from '../../lib/storage';
import { syncStateToCloud, isFirebaseConfigured } from '../../lib/firebaseSync';
import { getNumberingMaster, repairAndSyncAllSequences } from '../../lib/numberingMaster';
import { OpeningStockModal } from '../OpeningStockModal';
import { EmployeeMasterView } from './EmployeeMasterView';

interface AdminSettingsViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  currentUser?: { username: string; perms: string[] } | null;
}

type AdminTab = 'brand_items_paper' | 'crate_master' | 'users' | 'master_data' | 'whatsapp' | 'sequences_shifts' | 'backup_restore' | 'maintenance_master' | 'staff_escalation' | 'opening_stock_inward' | 'employee_master';
type MasterDataSubTab = 'plans' | 'jobs' | 'reconcile' | 'batches' | 'orders' | 'logs' | 'numbering' | 'vault';

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  currentUser
}) => {
  const currentUserRole = currentUser ? (state.users[currentUser.username.toLowerCase()]?.role || '') : '';
  const isAdmin = currentUser && (
    currentUser.perms.includes('*') ||
    currentUser.perms.includes('Admin') ||
    currentUser.username.toLowerCase() === 'admin' ||
    currentUserRole.toLowerCase() === 'admin' ||
    currentUserRole.toLowerCase() === 'administrator'
  );

  const [activeTab, setActiveTab] = useState<AdminTab>('brand_items_paper');
  const [masterPasswordInput, setMasterPasswordInput] = useState(state.adminPassword || '1234');
  const [masterSubTab, setMasterSubTab] = useState<MasterDataSubTab>('jobs');

  // Coordination Matrix State
  const [coordinationMatrixList, setCoordinationMatrixList] = useState<CoordinationMatrixItem[]>(() => {
    return state.coordinationMatrix && state.coordinationMatrix.length > 0
      ? state.coordinationMatrix
      : DEFAULT_COORDINATION_MATRIX;
  });

  const [newRoleName, setNewRoleName] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newMachineBreakdown, setNewMachineBreakdown] = useState(false);
  const [newElectricalAlert, setNewElectricalAlert] = useState(false);
  const [newProductionHandover, setNewProductionHandover] = useState(false);
  const [newMaterialIndent, setNewMaterialIndent] = useState(false);
  const [newQcFailure, setNewQcFailure] = useState(false);
  const [newIsActive, setNewIsActive] = useState(true);

  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<CoordinationMatrixItem | null>(null);

  const validateMatrixItem = (role: string, name: string, phone: string): boolean => {
    if (!role.trim()) {
      alert('⚠️ Role / Department Name is required!');
      return false;
    }
    if (!name.trim()) {
      alert('⚠️ Contact Person Name is required!');
      return false;
    }
    if (!phone.trim()) {
      alert('⚠️ Phone Number is required!');
      return false;
    }
    if (!phone.trim().startsWith('+')) {
      alert('⚠️ Phone Number must include country code starting with "+" (e.g., +91 98250 12345).');
      return false;
    }
    return true;
  };

  const handleAddMatrixItem = () => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators are allowed to edit the Coordination Matrix.');
      return;
    }
    if (!validateMatrixItem(newRoleName, newContactName, newPhone)) return;

    const newItem: CoordinationMatrixItem = {
      id: `CM-${Date.now()}`,
      roleName: newRoleName.trim(),
      contactName: newContactName.trim(),
      phone: newPhone.trim(),
      alertCategories: {
        machineBreakdown: newMachineBreakdown,
        electricalAlert: newElectricalAlert,
        productionHandover: newProductionHandover,
        materialIndent: newMaterialIndent,
        qcFailure: newQcFailure
      },
      isActive: newIsActive
    };

    const nextList = [...coordinationMatrixList, newItem];
    setCoordinationMatrixList(nextList);
    onSaveState({
      ...state,
      coordinationMatrix: nextList
    });

    // Reset fields
    setNewRoleName('');
    setNewContactName('');
    setNewPhone('');
    setNewMachineBreakdown(false);
    setNewElectricalAlert(false);
    setNewProductionHandover(false);
    setNewMaterialIndent(false);
    setNewQcFailure(false);
    setNewIsActive(true);

    alert('✅ Department Head Contact Added Successfully!');
  };

  const handleStartEditMatrixItem = (idx: number) => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators are allowed to edit the Coordination Matrix.');
      return;
    }
    setEditingItemIdx(idx);
    setEditingItem({ ...coordinationMatrixList[idx] });
  };

  const handleSaveMatrixItem = () => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators are allowed to edit the Coordination Matrix.');
      return;
    }
    if (editingItemIdx === null || !editingItem) return;

    if (!validateMatrixItem(editingItem.roleName, editingItem.contactName, editingItem.phone)) return;

    const nextList = [...coordinationMatrixList];
    nextList[editingItemIdx] = { ...editingItem };
    setCoordinationMatrixList(nextList);
    onSaveState({
      ...state,
      coordinationMatrix: nextList
    });

    setEditingItemIdx(null);
    setEditingItem(null);
    alert('✅ Coordination Matrix Contact Updated Successfully!');
  };

  const handleDeleteMatrixItem = (idx: number) => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators are allowed to edit the Coordination Matrix.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this Department Head contact from the matrix?')) return;

    const nextList = coordinationMatrixList.filter((_, i) => i !== idx);
    setCoordinationMatrixList(nextList);
    onSaveState({
      ...state,
      coordinationMatrix: nextList
    });
    alert('✅ Department Head Contact Deleted!');
  };

  const handleToggleMatrixItemActive = (idx: number) => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators are allowed to edit the Coordination Matrix.');
      return;
    }
    const nextList = [...coordinationMatrixList];
    nextList[idx] = {
      ...nextList[idx],
      isActive: !nextList[idx].isActive
    };
    setCoordinationMatrixList(nextList);
    onSaveState({
      ...state,
      coordinationMatrix: nextList
    });
  };

  const handleTestWhatsAppAlert = (item: CoordinationMatrixItem) => {
    const categories: string[] = [];
    if (item.alertCategories.machineBreakdown) categories.push('Machine Breakdown');
    if (item.alertCategories.electricalAlert) categories.push('Electrical Alert');
    if (item.alertCategories.productionHandover) categories.push('Production Handover');
    if (item.alertCategories.materialIndent) categories.push('Material Indent');
    if (item.alertCategories.qcFailure) categories.push('QC Failure');

    const message = `🏭 *WÜNDERKRAF PAPERWARE ERP*
📱 *TEST SYSTEM ALERT DISPATCH*
━━━━━━━━━━━━━━━━━━━━
Dear *${item.contactName}* (${item.roleName}),

This is a test notification to verify your subscription to Wünderkraf Auto-Alert system.

⚙️ *Your Configured Alert Subscriptions:*
${categories.length > 0 ? categories.map(c => `• ${c}`).join('\n') : 'None (No categories subscribed)'}

🟢 *Status:* Active & Subscribed

_If you received this message, your contact number and routing configuration are correctly set up._`;

    triggerWhatsAppShiftNotification(item.phone, message, state.whatsappConfig?.webhookUrl);
    alert(`⚡ Dispatching test alert connection on WhatsApp to ${item.contactName} (${item.phone}). Please check the opened window/tab.`);
  };

  // Storage Health Telemetry
  const [storageHealth, setStorageHealth] = useState<{
    usedBytes: number;
    quotaBytes: number;
    percentage: number;
    isIndexedDBSupported: boolean;
    engine: string;
  } | null>(null);

  // Central Sync Bridge Telemetry & Controls
  const [syncEndpoint, setSyncEndpointState] = useState<string>(() => getCentralSyncEndpoint());
  const [isEditingEndpoint, setIsEditingEndpoint] = useState<boolean>(false);
  const [endpointInput, setEndpointInput] = useState<string>('');
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [isSyncingBridge, setIsSyncingBridge] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const refreshSyncTelemetry = () => {
    setSyncEndpointState(getCentralSyncEndpoint());
    getPendingSyncCount().then(setPendingQueueCount).catch(() => {});
  };

  useEffect(() => {
    if (activeTab === 'backup_restore') {
      getStorageHealth().then(setStorageHealth).catch(() => {});
      refreshSyncTelemetry();
    }
  }, [activeTab]);

  const handleManualCentralSync = async () => {
    setIsSyncingBridge(true);
    setSyncStatusMsg(null);
    try {
      const result = await forceSyncWithCentral(state);
      if (result.syncedState) {
        onSaveState(result.syncedState);
      }
      setSyncStatusMsg(result.message);
      refreshSyncTelemetry();
    } catch (err: any) {
      setSyncStatusMsg(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncingBridge(false);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    }
  };

  const handleSaveCustomEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSyncEndpoint(endpointInput);
    setSyncEndpointState(getCentralSyncEndpoint());
    setIsEditingEndpoint(false);
    refreshSyncTelemetry();
    alert('Central Sync Endpoint updated!');
  };

  const handleResetEndpoint = () => {
    setCustomSyncEndpoint('');
    setSyncEndpointState(getCentralSyncEndpoint());
    setIsEditingEndpoint(false);
    refreshSyncTelemetry();
    alert('Reset to default same-origin /api/sync/state endpoint.');
  };

  // ==========================================
  // AUTO-NUMBERING & BATCH PREFIX MASTER STATE
  // ==========================================
  const [numberingForm, setNumberingForm] = useState<NumberingSeriesMaster>(() =>
    getNumberingMaster(state.seriesConfig)
  );

  useEffect(() => {
    setNumberingForm(getNumberingMaster(state.seriesConfig));
  }, [state.seriesConfig]);

  const handleSaveNumberingMaster = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators are authorized to configure Numbering & Batch Series.');
      return;
    }
    const nextConfig = {
      ...(state.seriesConfig || { orderSeq: 1, productSeqs: {} }),
      numberingMaster: numberingForm
    };
    onSaveState({
      ...state,
      seriesConfig: nextConfig
    });
    alert('✅ Auto-Numbering & Batch Prefix Master successfully saved and active!');
  };

  const handleRepairAndSyncSequences = () => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators can execute collision repair.');
      return;
    }
    if (
      !window.confirm(
        '⚠️ RESET COUNTERS & REPAIR SEQUENCE COLLISIONS?\n\n' +
        'This procedure will safely scan all existing production jobs, standardize any legacy or collision batch IDs into the clean parent lot hierarchy, and synchronize next sequence counters beyond the highest active numbers in IndexedDB.\n\n' +
        'Would you like to execute this repair now?'
      )
    ) {
      return;
    }
    const { repairedState, repairedJobsCount, repairedBatchesCount } = repairAndSyncAllSequences(state);
    const newMaster = getNumberingMaster(repairedState.seriesConfig);
    setNumberingForm(newMaster);
    onSaveState(repairedState);
    alert(
      `✅ Sequence Repair & Collision Resolution Complete!\n\n` +
      `• Records Standardized & Repaired: ${repairedBatchesCount} batches across ${repairedJobsCount} jobs\n` +
      `• Job ID Next Counter: ${newMaster.jobSeries.nextSeq}\n` +
      `• Slitting Run Next Counter: ${newMaster.slitSeries.nextSeq}\n` +
      `• Cutting Crate Next Counter: ${newMaster.cutSeries.nextSeq}\n` +
      `• QC Inspection Next Counter: ${newMaster.qcSeries.nextSeq}\n\n` +
      `All counters are now cleanly synchronized in IndexedDB with zero collision risk.`
    );
  };

  // ==========================================
  // BRAND ITEMS & PAPER MILL MASTER STATE
  // ==========================================
  const [paperBrandsList, setPaperBrandsList] = useState<string[]>(() => {
    return state.paperBrands && state.paperBrands.length > 0 ? state.paperBrands : PAPER_BRANDS;
  });
  const [newPaperBrandInput, setNewPaperBrandInput] = useState('');
  const [editingPaperBrandIdx, setEditingPaperBrandIdx] = useState<number | null>(null);
  const [editingPaperBrandName, setEditingPaperBrandName] = useState('');

  const [productsList, setProductsList] = useState<string[]>(() => {
    return state.products && state.products.length > 0 ? state.products : PRODUCTS;
  });
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrefix, setNewProductPrefix] = useState('');
  const [glueBrandsList, setGlueBrandsList] = useState<string[]>(state.glueBrands || []);
  const [newGlueBrandInput, setNewGlueBrandInput] = useState('');
  
  const [targetLayersList, setTargetLayersList] = useState<number[]>(() => {
    if (state.targetLayersMaster && state.targetLayersMaster.length > 0) {
      const isLegacy = state.targetLayersMaster.some((l) => l !== 8 && l !== 9) && state.targetLayersMaster.length > 2;
      return isLegacy ? TARGET_LAYERS_DEFAULT : state.targetLayersMaster;
    }
    return TARGET_LAYERS_DEFAULT;
  });
  const [newTargetLayerInput, setNewTargetLayerInput] = useState('');
  const [editingTargetLayerIdx, setEditingTargetLayerIdx] = useState<number | null>(null);
  const [editingTargetLayerVal, setEditingTargetLayerVal] = useState<string>('');
  
  const [editingGlueBrandIdx, setEditingGlueBrandIdx] = useState<number | null>(null);
  const [editingGlueBrandName, setEditingGlueBrandName] = useState('');


  const [targetGsmList, setTargetGsmList] = useState<string[]>(() => {
    if (state.targetGsmMaster && state.targetGsmMaster.length > 0) {
      const isLegacy = state.targetGsmMaster.some((g) => g !== '60 GSM' && g !== '120 GSM') && state.targetGsmMaster.length > 2;
      return isLegacy ? TARGET_GSM_DEFAULT : state.targetGsmMaster;
    }
    return TARGET_GSM_DEFAULT;
  });
  const [newTargetGsmInput, setNewTargetGsmInput] = useState('');

  const [newProductSeq, setNewProductSeq] = useState('1');
  const [editingProductIdx, setEditingProductIdx] = useState<number | null>(null);
  const [editingProductName, setEditingProductName] = useState('');
  const [editingProductPrefix, setEditingProductPrefix] = useState('');
  const [editingProductSeq, setEditingProductSeq] = useState('1');

  // ==========================================
  // CRATE CAPACITY MASTER (FLAT VS 3D PIECES)
  // ==========================================
  const [crateMaster, setCrateMaster] = useState<Record<string, ProductCrateCapacity>>(() => {
    return state.crateCapacityMaster || DEFAULT_CRATE_CAPACITY_MASTER;
  });
  const [editingCrateProd, setEditingCrateProd] = useState<string | null>(null);
  const [editCutPcs, setEditCutPcs] = useState<number>(10000);
  const [editFormPcs, setEditFormPcs] = useState<number>(7000);
  const [newCrateProd, setNewCrateProd] = useState<string>('');
  const [newCrateCutPcs, setNewCrateCutPcs] = useState<string>('');
  const [newCrateFormPcs, setNewCrateFormPcs] = useState<string>('');

  const handleSaveCrateRow = (prod: string, cut: number, form: number) => {
    const updated = {
      ...crateMaster,
      [prod]: { cuttingPcs: Math.max(1, cut), formingPcs: Math.max(1, form) }
    };
    setCrateMaster(updated);
    const newLog: LogEntry = {
      stage: 'Admin Settings',
      machine: 'ADMIN_DESK',
      action: `🧺 Updated Crate Master for ${prod}: Cutting=${cut} Pcs, Forming=${form} Pcs`,
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };
    onSaveState({
      ...state,
      crateCapacityMaster: updated,
      logs: [...state.logs, newLog]
    });
    setEditingCrateProd(null);
    showToast(`✅ Crate Standard for ${prod} saved (${cut.toLocaleString()} Cut / ${form.toLocaleString()} Formed)!`);
  };

  const handleSaveAllCrateMaster = () => {
    const newLog: LogEntry = {
      stage: 'Admin Settings',
      machine: 'ADMIN_DESK',
      action: `🧺 Saved Master Crate Capacity Matrix (${Object.keys(crateMaster).length} Products)`,
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };
    onSaveState({
      ...state,
      crateCapacityMaster: crateMaster,
      logs: [...state.logs, newLog]
    });
    showToast('✅ All Crate Capacities successfully saved into Master Database!');
  };

  const handleResetCrateMaster = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Crate Capacity Master to Defaults?',
      message: 'Are you sure you want to reset all product crate capacities back to factory defaults (Spoon: 10,000/7,000, Fork: 9,000/6,500, Knife: 11,000/7,500)?',
      confirmLabel: 'Yes, Reset to Defaults',
      isDanger: true,
      onConfirm: () => {
        setCrateMaster({});
        const newLog: LogEntry = {
          stage: 'Admin Settings',
          machine: 'ADMIN_DESK',
          action: '🧺 Reset Crate Capacity Master to Empty',
          user: 'admin',
          rawDate: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleString()
        };
        onSaveState({
          ...state,
          crateCapacityMaster: {},
          logs: [...state.logs, newLog]
        });
        showToast('✅ Crate Master successfully cleared!');
      }
    });
  };

  const handleAddCustomCrateProd = () => {
    if (!newCrateProd.trim()) {
      showToast('Please select or type a product name!', 'error');
      return;
    }
    const cut = parseInt(newCrateCutPcs, 10);
    const form = parseInt(newCrateFormPcs, 10);
    
    if (isNaN(cut) || isNaN(form)) {
      showToast('Please enter valid capacity numbers!', 'error');
      return;
    }

    handleSaveCrateRow(newCrateProd.trim(), cut, form);
    setNewCrateProd('');
    setNewCrateCutPcs('');
    setNewCrateFormPcs('');
  };

  // In-app Alert / Toast notification (replaces window.alert)
  const [adminToast, setAdminToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setAdminToast({ msg, type });
    setTimeout(() => setAdminToast(null), 4500);
  };

  // In-app Confirm Modal (replaces window.confirm which fails inside iframe)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    isDanger?: boolean;
  } | null>(null);

  // ==========================================
  // TAB 1: USERS & PERMISSIONS STATE
  // ==========================================
  const usersRecord = state.users || DEFAULT_USERS;
  const [selectedUserKey, setSelectedUserKey] = useState<string>('admin');
  const [editingUser, setEditingUser] = useState<UserAccount>(() => {
    const adminU = usersRecord['admin'] as any;
    return {
      pass: adminU?.pass || '1234',
      perms: adminU?.perms || ['*'],
      name: adminU?.name || 'Master Administrator',
      role: adminU?.role || 'Administrator',
      phone: adminU?.phone || ''
    };
  });

  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState('Operator');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  // Department workers state
  const [deptWorkersState, setDeptWorkersState] = useState<Record<string, string[]>>(() => {
    return state.deptWorkers || DEPT_WORKERS;
  });
  const [selectedDeptForWorker, setSelectedDeptForWorker] = useState<string>('Slitting');
  const [newWorkerNameInput, setNewWorkerNameInput] = useState('');

  // ==========================================
  // TAB 2: MASTER DATA OVERWRITE STATE
  // ==========================================
  // Job Overwrite state
  const [selectedJobIdToEdit, setSelectedJobIdToEdit] = useState<string>(state.jobs[0]?.id || '');
  const jobToEdit = state.jobs.find((j) => j.id === selectedJobIdToEdit);
  const [jobEditForm, setJobEditForm] = useState<Job | null>(jobToEdit ? JSON.parse(JSON.stringify(jobToEdit)) : null);

  // Plan Overwrite state
  const [selectedPlanIdToEdit, setSelectedPlanIdToEdit] = useState<string>((state.productionPlans && state.productionPlans[0]?.id) || '');
  const planToEdit = (state.productionPlans || []).find((p) => p.id === selectedPlanIdToEdit);
  const [planEditForm, setPlanEditForm] = useState<ProductionPlan | null>(planToEdit ? JSON.parse(JSON.stringify(planToEdit)) : null);

  // Order Overwrite state
  const [selectedOrderIdToEdit, setSelectedOrderIdToEdit] = useState<string>(state.packJobs[0]?.id || '');
  const orderToEdit = state.packJobs.find((o) => o.id === selectedOrderIdToEdit);
  const [orderEditForm, setOrderEditForm] = useState<PackJob | null>(
    orderToEdit ? JSON.parse(JSON.stringify(orderToEdit)) : null
  );

  // Audit Logs Overwrite state
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logFilterStage, setLogFilterStage] = useState('');
  const [editingLogIndex, setEditingLogIndex] = useState<number | null>(null);
  const [logEditForm, setLogEditForm] = useState<LogEntry | null>(null);

  // Keep form editors synchronized when selection changes or original state is updated by parent
  useEffect(() => {
    const foundJob = state.jobs.find((j) => j.id === selectedJobIdToEdit);
    if (foundJob) {
      setJobEditForm(JSON.parse(JSON.stringify(foundJob)));
    } else {
      setJobEditForm(null);
    }
  }, [state.jobs, selectedJobIdToEdit]);

  useEffect(() => {
    const foundPlan = (state.productionPlans || []).find((p) => p.id === selectedPlanIdToEdit);
    if (foundPlan) {
      setPlanEditForm(JSON.parse(JSON.stringify(foundPlan)));
    } else {
      setPlanEditForm(null);
    }
  }, [state.productionPlans, selectedPlanIdToEdit]);

  useEffect(() => {
    const foundOrder = state.packJobs.find((o) => o.id === selectedOrderIdToEdit);
    if (foundOrder) {
      setOrderEditForm(JSON.parse(JSON.stringify(foundOrder)));
    } else {
      setOrderEditForm(null);
    }
  }, [state.packJobs, selectedOrderIdToEdit]);

  // ==========================================
  // DIRECT STOCK RECONCILIATION SUITE STATE
  // ==========================================
  const [reconcileJobId, setReconcileJobId] = useState<string>(state.jobs[0]?.id || '');
  const [reconcileJobTarget, setReconcileJobTarget] = useState<Job | null>(() => state.jobs[0] ? JSON.parse(JSON.stringify(state.jobs[0])) : null);
  const [reconcileReason, setReconcileReason] = useState<string>('Physical Cycle Count Verification');
  const [reconcileDocRef, setReconcileDocRef] = useState<string>('');
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);

  // ==========================================
  // IN-FLIGHT BATCH CORRECTIONS & MATERIAL REVERSAL STATE
  // ==========================================
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [batchFilterStage, setBatchFilterStage] = useState('');
  const [correctingBatchModal, setCorrectingBatchModal] = useState<{
    jobId: string;
    batch: RunningBatch;
    bIdx: number;
  } | null>(null);
  const [batchCorrectionForm, setBatchCorrectionForm] = useState<RunningBatch | null>(null);
  const [batchCorrectionReason, setBatchCorrectionReason] = useState<string>('Floor Operator / Machine Assignment Fix');

  const [reversingMaterialModal, setReversingMaterialModal] = useState<{
    jobId: string;
    batch: RunningBatch;
    bIdx: number;
    returnQty: number;
    maxQty: number;
    stageName: string;
    targetStockName: string;
    reason: string;
  } | null>(null);

  // ==========================================
  // TAB 3: WHATSAPP CONFIG & REPORT STATE
  // ==========================================
  const [waPhone, setWaPhone] = useState(state.whatsappConfig?.phone || '');
  const [waApiKey, setWaApiKey] = useState(state.whatsappConfig?.apiKey || '');
  const [waAutoSend, setWaAutoSend] = useState(state.whatsappConfig?.autoSend || false);
  const [waDayReportTime, setWaDayReportTime] = useState(state.whatsappConfig?.dayShiftReportTime || '20:00');
  const [waNightReportTime, setWaNightReportTime] = useState(state.whatsappConfig?.nightShiftReportTime || '08:00');
  const [waAutoDay, setWaAutoDay] = useState(state.whatsappConfig?.autoSendShiftReportDay !== false);
  const [waAutoNight, setWaAutoNight] = useState(state.whatsappConfig?.autoSendShiftReportNight !== false);
  const [waPreviewShift, setWaPreviewShift] = useState<'DAY' | 'NIGHT'>('DAY');
  const [waWebhookUrl, setWaWebhookUrl] = useState(state.whatsappConfig?.webhookUrl || '');
  const [waCustomMessage, setWaCustomMessage] = useState(
    state.whatsappConfig?.customMessage || 'Wünderkraf Paperware Factory Live Shift Report'
  );

  // ==========================================
  // TAB 7: MAINTENANCE MASTER & RIGHTS STATE
  // ==========================================
  const [maintenanceContacts, setMaintenanceContacts] = useState<MaintenanceContact[]>(() => {
    return state.maintenanceContacts && state.maintenanceContacts.length > 0
      ? state.maintenanceContacts
      : DEFAULT_MAINTENANCE_CONTACTS;
  });
  const [newTechPhone, setNewTechPhone] = useState('');
  const [newTechRole, setNewTechRole] = useState('');
  const [newTechDept, setNewTechDept] = useState('Mechanical');
  const [newTechName, setNewTechName] = useState('');
  const [maintSpareParts, setMaintSpareParts] = useState<string[]>(() => {
    return state.maintenanceSparePartsMaster || [
      'Upper Mould Heater Band (220V/1500W)',
      'High-Speed Cutting Blade Punch Set',
      'Thermocouple K-Type Sensor Cable',
      'Festo 5/2 Directional Solenoid Valve',
      'Hydraulic Piston Rod Oil Seal 45x60x10',
      'NSK High-Precision Deep Groove Ball Bearing',
      'PTFE Non-Stick Mould Liner Strip'
    ];
  });
  const [newPartName, setNewPartName] = useState('');
  const [editingSparePartIdx, setEditingSparePartIdx] = useState<number | null>(null);
  const [editingSparePartText, setEditingSparePartText] = useState('');
  const [maxRollPieces, setMaxRollPieces] = useState<number>(state.maxPiecesPerSlitRoll || 12000);
  const [strictRollAudit, setStrictRollAudit] = useState<boolean>(state.strictAuditRollYield || false);

  // Operational Pause Reasons Master state
  const [pauseReasons, setPauseReasons] = useState<string[]>(() => {
    return state.maintenancePauseReasonsMaster && state.maintenancePauseReasonsMaster.length > 0
      ? state.maintenancePauseReasonsMaster
      : DEFAULT_OPERATIONAL_PAUSE_REASONS;
  });
  const [newPauseReasonInput, setNewPauseReasonInput] = useState('');
  const [editingPauseReasonIdx, setEditingPauseReasonIdx] = useState<number | null>(null);
  const [editingPauseReasonText, setEditingPauseReasonText] = useState('');

  // Department Breakdown Faults Master state
  const [breakdownReasonsMap, setBreakdownReasonsMap] = useState<Record<string, string[]>>(() => {
    return state.maintenanceBreakdownReasonsMaster || DEFAULT_BREAKDOWN_REASONS_MAP;
  });
  const [selectedBreakdownDept, setSelectedBreakdownDept] = useState<string>('Cutting');
  const [newFaultReasonInput, setNewFaultReasonInput] = useState('');
  const [editingFaultReasonIdx, setEditingFaultReasonIdx] = useState<number | null>(null);
  const [editingFaultReasonText, setEditingFaultReasonText] = useState('');

  // ==========================================
  // TAB 4: SEQUENCES & SHIFTS STATE
  // ==========================================
  const [adminPass, setAdminPass] = useState(state.adminPassword || '1234');
  const [productSeqs, setProductSeqs] = useState({ ...state.seriesConfig.productSeqs });
  const [orderSeq, setOrderSeq] = useState(state.seriesConfig.orderSeq || 1);

  const [dayStart, setDayStart] = useState(state.shiftConfig?.dayStart || '08:00');
  const [dayEnd, setDayEnd] = useState(state.shiftConfig?.dayEnd || '20:00');
  const [nightStart, setNightStart] = useState(state.shiftConfig?.nightStart || '20:00');
  const [nightEnd, setNightEnd] = useState(state.shiftConfig?.nightEnd || '08:00');

  // Sync selected job/order when dropdown changes
  const handleSelectJobToEdit = (jobId: string, customJobs?: Job[]) => {
    setSelectedJobIdToEdit(jobId);
    const list = customJobs || state.jobs;
    const j = list.find((x) => x.id === jobId);
    setJobEditForm(j ? JSON.parse(JSON.stringify(j)) : null);
  };

  const handleSelectPlanToEdit = (planId: string, customPlans?: ProductionPlan[]) => {
    setSelectedPlanIdToEdit(planId);
    const list = customPlans || state.productionPlans || [];
    const p = list.find((x) => x.id === planId);
    setPlanEditForm(p ? JSON.parse(JSON.stringify(p)) : null);
  };

  const handleSelectOrderToEdit = (ordId: string, customPackJobs?: PackJob[]) => {
    setSelectedOrderIdToEdit(ordId);
    const list = customPackJobs || state.packJobs;
    const o = list.find((x) => x.id === ordId);
    setOrderEditForm(o ? JSON.parse(JSON.stringify(o)) : null);
  };

  const handleSelectUser = (userKey: string) => {
    setSelectedUserKey(userKey);
    const u = usersRecord[userKey] as any;
    if (u) {
      setEditingUser({
        pass: u.pass || '',
        perms: [...(u.perms || [])],
        name: u.name || userKey,
        role: u.role || 'Operator',
        phone: u.phone || ''
      });
    }
  };

  // ==========================================
  // USER MANAGEMENT HANDLERS
  // ==========================================
    const handleUpdateMasterPassword = () => {
    if (!masterPasswordInput.trim()) {
      alert('Password cannot be empty');
      return;
    }
    onSaveState({
      ...state,
      adminPassword: masterPasswordInput
    });
    alert('✅ Master Admin Password updated successfully! This password will now be required for all Factory Resets and Backup Restores.');
  };

  const handleSaveUserPermissions = () => {
    const updatedUsers = {
      ...usersRecord,
      [selectedUserKey]: {
        ...editingUser
      }
    };

    const newLog: LogEntry = {
      stage: 'Admin Master',
      machine: 'CONTROL-PANEL',
      shift: 'DAY',
      action: `👤 Updated User Account & Permissions for [${selectedUserKey}]`,
      worker: 'ADMIN',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      users: updatedUsers,
      logs: [...state.logs, newLog]
    });

    alert(`✅ User Account [${selectedUserKey}] and Permissions Saved Successfully!`);
  };

  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newUserId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!cleanId) return alert('Enter a valid User ID!');
    if (usersRecord[cleanId]) return alert(`User ID [${cleanId}] already exists!`);
    if (!newUserPass.trim()) return alert('Enter user password / PIN!');

    const newUserObj: UserAccount = {
      pass: newUserPass.trim(),
      perms: ['Stock', 'Orders'],
      name: newUserName.trim() || cleanId,
      role: newUserRole,
      phone: ''
    };

    const updatedUsers = {
      ...usersRecord,
      [cleanId]: newUserObj
    };

    onSaveState({
      ...state,
      users: updatedUsers
    });

    setIsAddUserModalOpen(false);
    setSelectedUserKey(cleanId);
    setEditingUser(newUserObj);
    setNewUserId('');
    setNewUserName('');
    setNewUserPass('');
    alert(`✅ New User Account [${cleanId}] Created Successfully!`);
  };

  const handleDeleteUser = (userKey: string) => {
    if (userKey === 'admin') {
      showToast('⚠️ Security Protection: Master Admin account cannot be deleted!', 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete User Account',
      message: `Are you sure you want to permanently delete user account [${userKey}]? All login access and assigned workstation permissions will be revoked immediately.`,
      confirmLabel: 'Yes, Delete Account',
      isDanger: true,
      onConfirm: () => {
        setConfirmModal(null);
        const updatedUsers = { ...usersRecord };
        delete updatedUsers[userKey];

        onSaveState({
          ...state,
          users: updatedUsers
        });

        setSelectedUserKey('admin');
        const adminU = updatedUsers['admin'] || usersRecord['admin'];
        if (adminU) {
          setEditingUser({
            pass: adminU.pass || '1234',
            perms: adminU.perms || ['*'],
            name: adminU.name || 'Master Administrator',
            role: adminU.role || 'Administrator',
            phone: adminU.phone || ''
          });
        }
        showToast(`🗑️ User account [${userKey}] deleted successfully!`);
      }
    });
  };

  const ALL_OPERATIONAL_PERMS = [
    'Admin',
    'Dashboard',
    'Marketing',
    'Dispatch',
    'Slitting',
    'Cutting',
    'Forming',
    'QC',
    'Packing',
    'Maintenance',
    'Mnt_LogIncident',
    'Mnt_AssignTech',
    'Mnt_Repair',
    'Mnt_SpareParts',
    'Mnt_Preventative',
    'Mnt_RCA',
    'Purchase',
    'Stock',
    'Orders',
    'Analytics',
    'Search',
    'Audit'
  ];

  const handleTogglePerm = (perm: string) => {
    if (perm === '*') {
      if (editingUser.perms.includes('*')) {
        setEditingUser({ ...editingUser, perms: [] });
      } else {
        setEditingUser({ ...editingUser, perms: ['*'] });
      }
      return;
    }

    let newPerms = [...editingUser.perms];
    if (newPerms.includes('*')) {
      newPerms = [...ALL_OPERATIONAL_PERMS];
    }

    if (newPerms.includes(perm)) {
      newPerms = newPerms.filter((p) => p !== perm);
    } else {
      newPerms.push(perm);
    }

    setEditingUser({ ...editingUser, perms: newPerms });
  };

  // Department worker handlers
  const handleAddWorker = () => {
    if (!newWorkerNameInput.trim()) return;
    const cleanName = newWorkerNameInput.trim().toUpperCase();
    const existing = deptWorkersState[selectedDeptForWorker] || [];
    if (existing.includes(cleanName)) return alert('Worker already exists in this department!');

    const updated = {
      ...deptWorkersState,
      [selectedDeptForWorker]: [...existing, cleanName]
    };

    setDeptWorkersState(updated);
    setNewWorkerNameInput('');
    onSaveState({
      ...state,
      deptWorkers: updated
    });
    alert(`✅ Worker [${cleanName}] added to ${selectedDeptForWorker} team!`);
  };

  const handleRemoveWorker = (dept: string, workerName: string) => {
    const existing = deptWorkersState[dept] || [];
    const updatedList = existing.filter((w) => w !== workerName);
    const updated = {
      ...deptWorkersState,
      [dept]: updatedList
    };
    setDeptWorkersState(updated);
    onSaveState({
      ...state,
      deptWorkers: updated
    });
  };

  // ==========================================
  // MASTER DATA OVERWRITE: PRODUCTION JOBS
  // ==========================================
  const handleSaveJobOverwrite = () => {
    if (!jobEditForm) return;

    const cleanId = jobEditForm.id.trim().toUpperCase();
    if (!cleanId) {
      showToast('⚠️ Job ID cannot be empty!', 'error');
      return;
    }
    const inKg = Math.max(0, Number(jobEditForm.inputWeightKg) || 0);
    const outKg = Math.max(0, Number(jobEditForm.outputWeightKg) || 0);
    const calculatedScrapKg = Math.max(0, inKg - outKg);
    const actualScrapKg = jobEditForm.scrapKg !== undefined ? Math.max(0, Number(jobEditForm.scrapKg) || 0) : calculatedScrapKg;
    const scrapPct = inKg > 0 ? Number(((actualScrapKg / inKg) * 100).toFixed(1)) : 0;

    const updatedJobs = state.jobs.map((j) => {
      if (j.id === selectedJobIdToEdit) {
        return {
          ...j,
          ...jobEditForm,
          id: cleanId,
          reelNo: String(jobEditForm.reelNo || '').trim().toUpperCase(),
          gsm: String(jobEditForm.gsm || '').trim(),
          inputWeightKg: inKg,
          outputWeightKg: outKg,
          scrapKg: actualScrapKg,
          scrapPercent: scrapPct,
          availableRolls: Number(jobEditForm.availableRolls) || 0,
          availableCuttingCrates: Number(jobEditForm.availableCuttingCrates) || 0,
          availableFormingCrates: Number(jobEditForm.availableFormingCrates) || 0,
          availableQcCrates: Number(jobEditForm.availableQcCrates) || 0,
          pcsPerCrateCutting: Number(jobEditForm.pcsPerCrateCutting) || undefined,
          pcsPerCrateForming: Number(jobEditForm.pcsPerCrateForming) || undefined,
          totalCutPieces: Number(jobEditForm.totalCutPieces) || undefined,
          totalFormedPieces: Number(jobEditForm.totalFormedPieces) || undefined,
          totalQcPieces: Number(jobEditForm.totalQcPieces) || undefined
        };
      }
      return j;
    });

    const newLog: LogEntry = {
      jobId: cleanId,
      product: jobEditForm.product,
      stage: 'Admin Master',
      machine: 'MASTER-OVERWRITE',
      shift: 'DAY',
      action: `🛠️ Master Overwrite on Job [${cleanId}]: Admin modified details (Reel: ${jobEditForm.reelNo || '-'}, GSM: ${jobEditForm.gsm || '-'}, In: ${inKg}kg, Out: ${outKg}kg, Scrap: ${actualScrapKg}kg)`,
      worker: 'ADMIN',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    setSelectedJobIdToEdit(cleanId);
    showToast(`✅ Production Job [${cleanId}] Master Overwrite Saved Successfully!`);
  };

  const executeDeleteJob = (jobId: string) => {
    const updatedState = performCascadeDeleteAndBackup(jobId, state, currentUser?.username || 'admin');
    onSaveState(updatedState);

    const nextJob = updatedState.jobs[0]?.id || '';
    handleSelectJobToEdit(nextJob, updatedState.jobs);
    showToast(`✅ Cascading Deletion & Backup of Job [${jobId}] completed! Rolled back mother reels & purged all downstream runs.`);
  };

  const handleDeleteJob = (jobId: string) => {
    const pass = prompt(`Enter Master Password 'MANOJ' to Delete Job [${jobId}]:`);
    if (pass !== 'MANOJ') {
      alert('❌ Access Denied: Incorrect Password. Deletion aborted.');
      return;
    }
    const warningInfo = getJobDeletionWarningInfo(jobId, state);
    const hasDownstream = warningInfo.hasSlitting || warningInfo.hasCutting || warningInfo.hasForming || warningInfo.hasPacking;
    
    const message = hasDownstream
      ? `⚠️ CASCADE WARNING (कैस्केड चेतावनी):\n${warningInfo.description}\n\nयह जॉब आगे की प्रोडक्शन स्टेज में सक्रिय है। यदि आप इसे डिलीट करते हैं, तो स्लिटिंग, कटिंग, फॉर्मिंग और पैकिंग के सभी रन पूरी तरह से डिलीट हो जाएंगे।\n\nAre you sure you want to CASCADE delete everything? A secure backup will be saved automatically.`
      : `Are you sure you want to permanently delete Job [${jobId}] completely from the factory database? This action will back up and remove the job record safely.`;

    setConfirmModal({
      isOpen: true,
      title: hasDownstream ? '🚨 Warning: Delete Active Job' : 'Delete Production Job',
      message: message,
      confirmLabel: 'Yes, Delete & Cascade Everything',
      isDanger: true,
      onConfirm: () => {
        executeDeleteJob(jobId);
        setConfirmModal(null);
      }
    });
  };

  // ==========================================
  // MASTER DATA OVERWRITE: PRODUCTION PLANS
  // ==========================================
  const handleSavePlanEdit = () => {
    if (!planEditForm) return;
    const updatedPlans = (state.productionPlans || []).map((p) => {
      if (p.id === selectedPlanIdToEdit) {
        return { ...planEditForm };
      }
      return p;
    });

    const newLog: LogEntry = {
      jobId: planEditForm.id,
      product: planEditForm.product,
      stage: 'Admin Master',
      machine: 'MASTER-OVERWRITE',
      shift: 'DAY',
      action: `🛠️ Master Overwrite on Production Plan [${planEditForm.id}]`,
      worker: 'ADMIN',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      productionPlans: updatedPlans,
      logs: [...state.logs, newLog]
    });
    showToast('✅ Production Plan master data overwritten successfully!');
  };

  const executeDeletePlan = (planId: string) => {
    const updatedPlans = (state.productionPlans || []).filter((p) => p.id !== planId);
    
    const newLog: LogEntry = {
      jobId: planId,
      product: 'N/A',
      stage: 'Admin Master',
      machine: 'HARD-DELETE',
      shift: 'DAY',
      action: `🗑️ Hard Deleted Production Plan [${planId}]`,
      worker: 'ADMIN',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    const nextPlan = updatedPlans[0];
    onSaveState({
      ...state,
      deletedPlanIds: Array.from(new Set([...(state.deletedPlanIds || []), planId])),
      productionPlans: updatedPlans,
      logs: [...state.logs, newLog]
    });
    if (nextPlan) {
      handleSelectPlanToEdit(nextPlan.id, updatedPlans);
    } else {
      setSelectedPlanIdToEdit('');
      setPlanEditForm(null);
    }
    showToast(`✅ Production Plan [${planId}] deleted.`);
  };

  const handleDeletePlan = (planId: string) => {
    const pass = prompt(`Enter Master Password 'MANOJ' to Delete Plan [${planId}]:`);
    if (pass !== 'MANOJ') {
      alert('❌ Access Denied: Incorrect Password. Deletion aborted.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Delete Production Plan',
      message: `Are you sure you want to permanently delete Production Plan [${planId}]? This cannot be undone.`,
      confirmLabel: 'Yes, Delete Plan',
      isDanger: true,
      onConfirm: () => {
        executeDeletePlan(planId);
        setConfirmModal(null);
      }
    });
  };

  // ==========================================
  // MASTER DATA OVERWRITE: PACKING ORDERS
  // ==========================================
  const handleSaveOrderOverwrite = () => {
    if (!orderEditForm) return;

    const updatedPackJobs = state.packJobs.map((o) => {
      if (o.id === selectedOrderIdToEdit) {
        return {
          ...orderEditForm,
          pcsPerBox: Number(orderEditForm.pcsPerBox) || 1,
          orderQty: Number(orderEditForm.orderQty) || 1,
          packedBoxes: Number(orderEditForm.packedBoxes) || 0,
          dispatchedBoxes: Number(orderEditForm.dispatchedBoxes) || 0
        };
      }
      return o;
    });

    const newLog: LogEntry = {
      jobId: orderEditForm.id,
      product: orderEditForm.packType,
      stage: 'Admin Master',
      machine: 'MASTER-OVERWRITE',
      shift: 'DAY',
      action: `🛠️ Master Overwrite on Order [${orderEditForm.id}] (${orderEditForm.customer})`,
      worker: 'ADMIN',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      packJobs: updatedPackJobs,
      logs: [...state.logs, newLog]
    });

    setSelectedOrderIdToEdit(orderEditForm.id);
    showToast(`✅ Customer Order [${orderEditForm.id}] Master Overwrite Saved Successfully!`);
  };

  const executeDeleteOrder = (ordId: string) => {
    const updatedPackJobs = state.packJobs.filter((o) => o.id !== ordId);
    const newLog: LogEntry = {
      jobId: ordId,
      stage: 'Admin Master',
      machine: 'MASTER-OVERWRITE',
      shift: 'DAY',
      action: `🗑️ Deleted Customer Order [${ordId}] completely from database`,
      worker: 'ADMIN',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      deletedOrderIds: Array.from(new Set([...(state.deletedOrderIds || []), ordId])),
      packJobs: updatedPackJobs,
      logs: [...state.logs, newLog]
    });

    const nextOrd = updatedPackJobs[0]?.id || '';
    handleSelectOrderToEdit(nextOrd, updatedPackJobs);
    showToast(`✅ Customer Order [${ordId}] deleted from database.`);
  };

  const handleDeleteOrder = (ordId: string) => {
    const pass = prompt(`Enter Master Password 'MANOJ' to Delete Order [${ordId}]:`);
    if (pass !== 'MANOJ') {
      alert('❌ Access Denied: Incorrect Password. Deletion aborted.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Delete Customer Order',
      message: `Are you sure you want to permanently delete Customer Order [${ordId}] completely from the database?`,
      confirmLabel: 'Yes, Delete Order',
      isDanger: true,
      onConfirm: () => {
        executeDeleteOrder(ordId);
        setConfirmModal(null);
      }
    });
  };

  const handleDeleteAllOrders = () => {
    if (state.packJobs.length === 0) return;
    const pass = prompt(`Enter Master Password 'MANOJ' to Delete ALL Customer Packing Orders:`);
    if (pass !== 'MANOJ') {
      alert('❌ Access Denied: Incorrect Password. Deletion aborted.');
      return;
    }
    const allOrdIds = state.packJobs.map((o) => o.id);
    setConfirmModal({
      isOpen: true,
      title: 'Delete ALL Customer Packing Orders',
      message: `⚠️ Are you sure you want to permanently delete ALL ${state.packJobs.length} Customer Packing Orders? This action cannot be undone and will record deletion tombstones.`,
      confirmLabel: 'Yes, Delete All Orders',
      isDanger: true,
      onConfirm: () => {
        const newLog: LogEntry = {
          jobId: 'ALL-ORDERS',
          stage: 'Admin Master',
          machine: 'BULK-DELETE',
          shift: 'DAY',
          action: `🗑️ Bulk deleted all ${allOrdIds.length} customer packing orders`,
          worker: 'ADMIN',
          user: 'admin',
          rawDate: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleString()
        };
        onSaveState({
          ...state,
          deletedOrderIds: Array.from(new Set([...(state.deletedOrderIds || []), ...allOrdIds])),
          packJobs: [],
          logs: [...state.logs, newLog]
        });
        setSelectedOrderIdToEdit('');
        setOrderEditForm(null);
        setConfirmModal(null);
        showToast(`✅ All ${allOrdIds.length} Customer Packing Orders deleted successfully.`);
      }
    });
  };

  const handleDownloadOrdersCSV = () => {
    if (state.packJobs.length === 0) return;
    const data = state.packJobs.map((o) => ({
      'Order ID': o.id,
      'Customer': o.customer,
      'Pack Type': o.packType,
      'Status': o.status,
      'Order Qty (Boxes)': o.orderQty,
      'Pcs Per Box': o.pcsPerBox,
      'Packed Boxes': o.packedBoxes || 0,
      'Dispatched Boxes': o.dispatchedBoxes || 0,
      'Dispatch Date': o.dispatchDate || ''
    }));
    exportToCSV(`Packing_Orders_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  // ==========================================
  // BRAND ITEMS & PAPER MILL MASTER HANDLERS
  // ==========================================
  const handleAddPaperBrand = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newPaperBrandInput.trim().toUpperCase();
    if (!cleanName) {
      showToast('⚠️ Please enter a Paper Mill / Brand name!', 'error');
      return;
    }
    if (paperBrandsList.some((b) => b.toUpperCase() === cleanName)) {
      showToast(`⚠️ Brand "${cleanName}" already exists in the list!`, 'error');
      return;
    }

    const updatedBrands = [...paperBrandsList, cleanName];
    setPaperBrandsList(updatedBrands);
    setNewPaperBrandInput('');

    const newLog: LogEntry = {
      jobId: 'MASTER-BRAND',
      stage: 'Admin Master',
      machine: 'ADMIN-SETTINGS',
      shift: 'DAY',
      action: `🏷️ Added New Paper Mill Brand: ${cleanName}`,
      worker: 'ADMIN',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      paperBrands: updatedBrands,
      logs: [...(state.logs || []), newLog]
    });
    showToast(`✅ Paper Mill "${cleanName}" added successfully!`);
  };

  const handleSaveEditPaperBrand = (index: number) => {
    const cleanName = editingPaperBrandName.trim().toUpperCase();
    if (!cleanName) {
      showToast('⚠️ Brand name cannot be empty!', 'error');
      return;
    }
    const updatedBrands = [...paperBrandsList];
    const oldName = updatedBrands[index];
    updatedBrands[index] = cleanName;
    setPaperBrandsList(updatedBrands);
    setEditingPaperBrandIdx(null);

    const newLog: LogEntry = {
      jobId: 'MASTER-BRAND',
      stage: 'Admin Master',
      machine: 'ADMIN-SETTINGS',
      shift: 'DAY',
      action: `✏️ Renamed Paper Mill Brand from ${oldName} to ${cleanName}`,
      worker: 'ADMIN',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      paperBrands: updatedBrands,
      logs: [...(state.logs || []), newLog]
    });
    showToast(`✅ Paper Mill updated to "${cleanName}"!`);
  };

  const handleDeletePaperBrand = (brandName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Paper Mill / Brand',
      message: `Are you sure you want to remove "${brandName}" from the Paper Mill dropdown? Existing jobs with this brand will remain unchanged.`,
      confirmLabel: 'Yes, Remove Brand',
      isDanger: true,
      onConfirm: () => {
        const updatedBrands = paperBrandsList.filter((b) => b !== brandName);
        setPaperBrandsList(updatedBrands);
        const newLog: LogEntry = {
          jobId: 'MASTER-BRAND',
          stage: 'Admin Master',
          machine: 'ADMIN-SETTINGS',
          shift: 'DAY',
          action: `🗑️ Removed Paper Mill Brand: ${brandName}`,
          worker: 'ADMIN',
          user: 'admin',
          rawDate: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleString()
        };
        onSaveState({
          ...state,
          paperBrands: updatedBrands,
          logs: [...(state.logs || []), newLog]
        });
        setConfirmModal(null);
        showToast(`🗑️ Paper Mill "${brandName}" removed.`);
      }
    });
  };

  
  const handleAddGlueBrand = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newGlueBrandInput.trim().toUpperCase();
    if (!cleanName) return;
    if (glueBrandsList.includes(cleanName)) return;
    const updated = [...glueBrandsList, cleanName];
    setGlueBrandsList(updated);
    onSaveState({ ...state, glueBrands: updated });
    setNewGlueBrandInput('');
    showToast(`✅ Glue Brand "${cleanName}" added!`);
  };
  
  const handleSaveEditGlueBrand = (index: number) => {
    const cleanName = editingGlueBrandName.trim().toUpperCase();
    if (!cleanName) return setEditingGlueBrandIdx(null);
    const oldName = glueBrandsList[index];
    if (cleanName !== oldName && glueBrandsList.includes(cleanName)) {
      alert('Glue brand already exists!');
      return;
    }
    const updated = [...glueBrandsList];
    updated[index] = cleanName;
    setGlueBrandsList(updated);
    onSaveState({ ...state, glueBrands: updated });
    setEditingGlueBrandIdx(null);
  };

  const handleSaveEditTargetLayer = (index: number) => {
    const val = parseInt(editingTargetLayerVal);
    if (isNaN(val) || val <= 0) return setEditingTargetLayerIdx(null);
    const oldVal = targetLayersList[index];
    if (val !== oldVal && targetLayersList.includes(val)) {
      alert('Target layer already exists!');
      return;
    }
    const updated = [...targetLayersList];
    updated[index] = val;
    updated.sort((a,b) => a-b);
    setTargetLayersList(updated);
    onSaveState({ ...state, targetLayersMaster: updated });
    setEditingTargetLayerIdx(null);
  };

  const handleDeleteGlueBrand = (brand: string) => {
    setConfirmModal({
      isOpen: true, title: 'Remove Glue Brand',
      message: `Are you sure you want to remove ${brand} from the master list?`,
      confirmLabel: 'Remove',
      
      onConfirm: () => {
        const updated = glueBrandsList.filter(b => b !== brand);
        setGlueBrandsList(updated);
        onSaveState({ ...state, glueBrands: updated });
        setConfirmModal(null);
      }
    });
  };

  const handleAddTargetLayer = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(newTargetLayerInput);
    if (isNaN(val) || val <= 0) return;
    if (targetLayersList.includes(val)) return;
    const updated = [...targetLayersList, val].sort((a,b) => a-b);
    setTargetLayersList(updated);
    onSaveState({ ...state, targetLayersMaster: updated });
    setNewTargetLayerInput('');
    showToast(`✅ Layer "${val}" added!`);
  };
  const handleDeleteTargetLayer = (val: number) => {
    setConfirmModal({
      isOpen: true, title: 'Remove Target Layer',
      message: `Are you sure you want to remove ${val} Layers from the master list?`,
      confirmLabel: 'Remove',
      
      onConfirm: () => {
        const updated = targetLayersList.filter(b => b !== val);
        setTargetLayersList(updated);
        onSaveState({ ...state, targetLayersMaster: updated });
        setConfirmModal(null);
      }
    });
  };

  const handleAddTargetGsm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newTargetGsmInput.trim().toUpperCase();
    if (!cleanName) return;
    if (targetGsmList.includes(cleanName)) return;
    const updated = [...targetGsmList, cleanName];
    setTargetGsmList(updated);
    onSaveState({ ...state, targetGsmMaster: updated });
    setNewTargetGsmInput('');
    showToast(`✅ GSM "${cleanName}" added!`);
  };
  const handleDeleteTargetGsm = (brand: string) => {
    if(confirm(`Remove ${brand}?`)) {
      const updated = targetGsmList.filter(b => b !== brand);
      setTargetGsmList(updated);
      onSaveState({ ...state, targetGsmMaster: updated });
    }
  };

  const handleResetBrandsToDefault = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Brands & Products to Defaults',
      message: 'Restore the standard factory paper mills and cutlery items? Any custom brands added will be overwritten with defaults.',
      confirmLabel: 'Restore Defaults',
      isDanger: false,
      onConfirm: () => {
        setPaperBrandsList(PAPER_BRANDS);
        setProductsList(PRODUCTS);
        onSaveState({
          ...state,
          paperBrands: PAPER_BRANDS,
          products: PRODUCTS
        });
        setConfirmModal(null);
        showToast('✅ Reset to factory default Paper Mills and Products.');
      }
    });
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newProductName.trim();
    if (!cleanName) {
      showToast('⚠️ Please enter a product / brand item name!', 'error');
      return;
    }
    if (productsList.some((p) => p.toLowerCase() === cleanName.toLowerCase())) {
      showToast(`⚠️ Product "${cleanName}" already exists!`, 'error');
      return;
    }

    const cleanPrefix = (newProductPrefix.trim().toUpperCase() || cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'ITM');
    const startSeq = Math.max(1, parseInt(newProductSeq, 10) || 1);

    const updatedProducts = [...productsList, cleanName];
    const updatedPrefixMap = {
      ...PRODUCT_PREFIX_MAP,
      ...(state.productPrefixMap || {}),
      [cleanName]: cleanPrefix
    };
    const updatedSeqs = {
      ...(state.seriesConfig?.productSeqs || {}),
      [cleanName]: startSeq
    };

    setProductsList(updatedProducts);
    setNewProductName('');
    setNewProductPrefix('');
    setNewProductSeq('1');

    const newLog: LogEntry = {
      jobId: 'MASTER-PROD',
      stage: 'Admin Master',
      machine: 'ADMIN-SETTINGS',
      shift: 'DAY',
      action: `🍽️ Added New Brand Item / Product: ${cleanName} (Prefix: ${cleanPrefix}, Seq: ${startSeq})`,
      worker: 'ADMIN',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      products: updatedProducts,
      productPrefixMap: updatedPrefixMap,
      seriesConfig: {
        ...state.seriesConfig,
        productSeqs: updatedSeqs
      },
      logs: [...(state.logs || []), newLog]
    });
    showToast(`✅ Brand Item "${cleanName}" (${cleanPrefix}) added successfully!`);
  };

  const handleSaveEditProduct = (index: number) => {
    const oldName = productsList[index];
    const cleanName = editingProductName.trim();
    if (!cleanName) {
      showToast('⚠️ Product name cannot be empty!', 'error');
      return;
    }
    const cleanPrefix = (editingProductPrefix.trim().toUpperCase() || cleanName.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'ITM');
    const parsedSeq = Math.max(1, parseInt(editingProductSeq, 10) || 1);

    const updatedProducts = [...productsList];
    updatedProducts[index] = cleanName;

    const updatedPrefixMap = {
      ...PRODUCT_PREFIX_MAP,
      ...(state.productPrefixMap || {}),
      [cleanName]: cleanPrefix
    };

    const updatedSeqs = {
      ...(state.seriesConfig?.productSeqs || {}),
      [cleanName]: parsedSeq
    };
    if (oldName && oldName !== cleanName && updatedSeqs[oldName]) {
      delete updatedSeqs[oldName];
    }

    setProductsList(updatedProducts);
    setProductSeqs(updatedSeqs);
    setEditingProductIdx(null);

    const newLog: LogEntry = {
      stage: 'Admin Master',
      machine: 'ADMIN-CONTROL',
      shift: 'DAY',
      action: `🔢 Admin updated Item [${cleanName}] sequence counter to #${parsedSeq} (Prefix: ${cleanPrefix})`,
      worker: 'ADMIN',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      products: updatedProducts,
      productPrefixMap: updatedPrefixMap,
      seriesConfig: {
        ...state.seriesConfig,
        productSeqs: updatedSeqs
      },
      logs: [...state.logs, newLog]
    });
    showToast(`✅ Product "${cleanName}" (${cleanPrefix}) next sequence set to #${parsedSeq}!`);
  };

  const handleDeleteProduct = (prodName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Brand Item / Product',
      message: `Are you sure you want to remove "${prodName}" from the product list?`,
      confirmLabel: 'Yes, Delete Item',
      isDanger: true,
      onConfirm: () => {
        const updatedProducts = productsList.filter((p) => p !== prodName);
        setProductsList(updatedProducts);
        onSaveState({
          ...state,
          products: updatedProducts
        });
        setConfirmModal(null);
        showToast(`🗑️ Product "${prodName}" removed.`);
      }
    });
  };

  const executeZeroAllData = () => {
    const zeroState: FactoryState = {
      ...state,
      jobs: [],
      packJobs: [],
      logs: [
        {
          jobId: 'SYSTEM-RESET',
          stage: 'Admin Master',
          machine: 'ADMIN-ZERO',
          shift: 'DAY',
          action: '⚡ All Factory Data Reset to 0 for Clean Testing',
          worker: 'ADMIN',
          user: 'admin',
          rawDate: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleString()
        }
      ],
      scrapSales: [],
      maintenanceIncidents: [],
      customerComplaints: [],
      materialRequisitions: []
    };
    onSaveState(zeroState);
    handleSelectJobToEdit('');
    handleSelectOrderToEdit('');
    showToast('⚡ Factory Data successfully zeroed! You can now test with fresh entries.');
  };

  const promptZeroAllData = () => {
    setConfirmModal({
      isOpen: true,
      title: '⚡ Zero All Operational Data',
      message: 'Are you sure you want to wipe all production jobs, customer packing orders, and logs to 0? This lets you test from a fresh beginning. User accounts, custom products, and paper mills will NOT be deleted.',
      confirmLabel: 'Yes, Reset All to 0',
      isDanger: true,
      onConfirm: () => {
        executeZeroAllData();
        setConfirmModal(null);
      }
    });
  };

  // ==========================================
  // MASTER DATA OVERWRITE: AUDIT LOGS
  // ==========================================
  const filteredLogs = state.logs
    .map((log, idx) => ({ log, originalIndex: idx }))
    .filter(({ log }) => {
      const matchesSearch =
        !logSearchQuery ||
        (log.jobId && log.jobId.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
        (log.action && log.action.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
        (log.worker && log.worker.toLowerCase().includes(logSearchQuery.toLowerCase())) ||
        (log.machine && log.machine.toLowerCase().includes(logSearchQuery.toLowerCase()));
      const matchesStage = !logFilterStage || log.stage === logFilterStage;
      return matchesSearch && matchesStage;
    })
    .reverse();

  const handleStartEditLog = (originalIndex: number) => {
    setEditingLogIndex(originalIndex);
    setLogEditForm(JSON.parse(JSON.stringify(state.logs[originalIndex])));
  };

  const handleSaveLogEdit = () => {
    if (editingLogIndex === null || !logEditForm) return;

    const updatedLogs = [...state.logs];
    updatedLogs[editingLogIndex] = logEditForm;

    onSaveState({
      ...state,
      logs: updatedLogs
    });

    setEditingLogIndex(null);
    setLogEditForm(null);
    showToast('✅ Log Entry Updated Successfully!');
  };

  const handleDeleteLogEntry = (originalIndex: number) => {
    const targetLog = state.logs[originalIndex];
    const logDesc = targetLog
      ? `[${targetLog.stage || 'Log'} - ${targetLog.action ? targetLog.action.slice(0, 60) : 'Entry'}...]`
      : 'this audit log entry';

    setConfirmModal({
      isOpen: true,
      title: 'Delete Audit Log Entry',
      message: `Are you sure you want to permanently delete this audit log entry from database: ${logDesc}?`,
      confirmLabel: 'Yes, Delete Entry',
      isDanger: true,
      onConfirm: () => {
        const updatedLogs = state.logs.filter((_, idx) => idx !== originalIndex);
        onSaveState({
          ...state,
          logs: updatedLogs
        });
        setConfirmModal(null);
        showToast('🗑️ Audit log entry deleted successfully.');
      }
    });
  };

  // ==========================================
  // DIRECT STOCK RECONCILIATION HANDLERS
  // ==========================================
  const handleOpenReconcileModal = (job: Job) => {
    setReconcileJobId(job.id);
    setReconcileJobTarget(JSON.parse(JSON.stringify(job)));
    setReconcileReason('Physical Cycle Count Verification');
    setReconcileDocRef('');
    setIsReconcileModalOpen(true);
  };

  const handleSaveReconciliation = () => {
    if (!reconcileJobTarget) return;
    const cleanReason = reconcileReason.trim();
    if (!cleanReason) {
      showToast('⚠️ Mandatory reason required for inventory reconciliation audit!', 'error');
      return;
    }

    const origJob = state.jobs.find((j) => j.id === reconcileJobTarget.id);
    const prevRolls = origJob?.availableRolls || 0;
    const prevCutCrates = origJob?.availableCuttingCrates || 0;
    const prevFormCrates = origJob?.availableFormingCrates || 0;
    const prevQcCrates = origJob?.availableQcCrates || 0;

    const newRolls = Math.max(0, Number(reconcileJobTarget.availableRolls) || 0);
    const newCutCrates = Math.max(0, Number(reconcileJobTarget.availableCuttingCrates) || 0);
    const newFormCrates = Math.max(0, Number(reconcileJobTarget.availableFormingCrates) || 0);
    const newQcCrates = Math.max(0, Number(reconcileJobTarget.availableQcCrates) || 0);

    const diffRolls = newRolls - prevRolls;
    const diffCutCrates = newCutCrates - prevCutCrates;
    const diffFormCrates = newFormCrates - prevFormCrates;
    const diffQcCrates = newQcCrates - prevQcCrates;

    const updatedJobs = state.jobs.map((j) => {
      if (j.id === reconcileJobTarget.id) {
        return {
          ...j,
          availableRolls: newRolls,
          availableCuttingCrates: newCutCrates,
          availableFormingCrates: newFormCrates,
          availableQcCrates: newQcCrates,
          totalCutPieces: Number(reconcileJobTarget.totalCutPieces) || undefined,
          totalFormedPieces: Number(reconcileJobTarget.totalFormedPieces) || undefined,
          totalQcPieces: Number(reconcileJobTarget.totalQcPieces) || undefined
        };
      }
      return j;
    });

    const auditText = `⚖️ Super-Admin Stock Reconciliation on Job [${reconcileJobTarget.id}] (${reconcileJobTarget.product}): ` +
      `Slit Rolls: ${prevRolls} ➔ ${newRolls} (${diffRolls >= 0 ? '+' : ''}${diffRolls}), ` +
      `Cut Crates: ${prevCutCrates} ➔ ${newCutCrates} (${diffCutCrates >= 0 ? '+' : ''}${diffCutCrates}), ` +
      `Formed Crates: ${prevFormCrates} ➔ ${newFormCrates} (${diffFormCrates >= 0 ? '+' : ''}${diffFormCrates}), ` +
      `QC OK Crates: ${prevQcCrates} ➔ ${newQcCrates} (${diffQcCrates >= 0 ? '+' : ''}${diffQcCrates}). ` +
      `Reason: "${cleanReason}"${reconcileDocRef ? ` | Ref Slip: ${reconcileDocRef}` : ''}`;

    const newLog: LogEntry = {
      jobId: reconcileJobTarget.id,
      product: reconcileJobTarget.product,
      stage: 'Admin Master',
      machine: 'STOCK-RECONCILER',
      shift: 'DAY',
      action: auditText,
      worker: 'SUPER-ADMIN',
      user: currentUser?.username || 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    setIsReconcileModalOpen(false);
    showToast(`✅ Physical Stage Stock Reconciled & Logged for Job [${reconcileJobTarget.id}]!`);
  };

  // ==========================================
  // IN-FLIGHT BATCH CORRECTIONS & MATERIAL REVERSAL HANDLERS
  // ==========================================
  const handleStartCorrectBatch = (jobId: string, batch: RunningBatch, bIdx: number) => {
    setCorrectingBatchModal({ jobId, batch, bIdx });
    setBatchCorrectionForm(JSON.parse(JSON.stringify(batch)));
    setBatchCorrectionReason('Operator ID / Machine Assignment Correction');
  };

  const handleSaveBatchCorrection = () => {
    if (!correctingBatchModal || !batchCorrectionForm) return;
    const { jobId, bIdx, batch: oldBatch } = correctingBatchModal;
    const cleanReason = batchCorrectionReason.trim() || 'Floor Data Correction';

    const updatedJobs = state.jobs.map((j) => {
      if (j.id === jobId) {
        const batches = [...(j.runningBatches || [])];
        batches[bIdx] = {
          ...batches[bIdx],
          ...batchCorrectionForm,
          batchId: String(batchCorrectionForm.batchId || '').trim().toUpperCase(),
          machine: String(batchCorrectionForm.machine || '').trim(),
          worker: String(batchCorrectionForm.worker || '').trim().toUpperCase(),
          issuedQty: Number(batchCorrectionForm.issuedQty) || 0,
          outputPieces: Number(batchCorrectionForm.outputPieces) || 0,
          scrapPieces: Number(batchCorrectionForm.scrapPieces) || 0,
          status: batchCorrectionForm.status || 'Running'
        };
        return {
          ...j,
          runningBatches: batches
        };
      }
      return j;
    });

    const newLog: LogEntry = {
      jobId: jobId,
      stage: 'Admin Master',
      machine: batchCorrectionForm.machine || 'BATCH-CORRECTION',
      shift: 'DAY',
      action: `🛠️ In-Flight Batch Correction on [${batchCorrectionForm.batchId}]: Machine: "${oldBatch.machine}" ➔ "${batchCorrectionForm.machine}", Operator: "${oldBatch.worker}" ➔ "${batchCorrectionForm.worker}", Status: "${oldBatch.status}" ➔ "${batchCorrectionForm.status}", Issued: ${oldBatch.issuedQty || 0} ➔ ${batchCorrectionForm.issuedQty || 0}. Reason: "${cleanReason}"`,
      worker: 'SUPER-ADMIN',
      user: currentUser?.username || 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    setCorrectingBatchModal(null);
    setBatchCorrectionForm(null);
    showToast(`✅ In-flight batch [${batchCorrectionForm.batchId}] corrected & logged.`);
  };

  const handleStartReverseMaterial = (jobId: string, batch: RunningBatch, bIdx: number) => {
    const isCutting = batch.machine?.toLowerCase().includes('cutting') || batch.batchId?.includes('CUT');
    const isForming = batch.machine?.toLowerCase().includes('forming') || batch.batchId?.includes('FRM') || batch.batchId?.includes('FORM');
    const isQc = batch.machine?.toLowerCase().includes('qc') || batch.batchId?.includes('QC');

    let stageName = 'Forming Run';
    let targetStockName = 'Cutting Crates (Cut Stock)';
    if (isCutting) {
      stageName = 'Cutting Run';
      targetStockName = 'Slit Rolls Inventory';
    } else if (isQc) {
      stageName = 'QC Inspection';
      targetStockName = 'Formed Crates Floor Stock';
    }

    setReversingMaterialModal({
      jobId,
      batch,
      bIdx,
      returnQty: batch.issuedQty || 1,
      maxQty: batch.issuedQty || 1,
      stageName,
      targetStockName,
      reason: 'Material Issued in Error / Machine Breakdown'
    });
  };

  const handleConfirmMaterialReversal = () => {
    if (!reversingMaterialModal) return;
    const { jobId, batch, bIdx, returnQty, targetStockName, reason } = reversingMaterialModal;
    const cleanReason = reason.trim() || 'Material un-issue to preceding stage';

    const qtyToReturn = Math.max(1, Math.min(returnQty, batch.issuedQty || 1));

    const isCutting = batch.machine?.toLowerCase().includes('cutting') || batch.batchId?.includes('CUT');
    const isForming = batch.machine?.toLowerCase().includes('forming') || batch.batchId?.includes('FRM') || batch.batchId?.includes('FORM');
    const isQc = batch.machine?.toLowerCase().includes('qc') || batch.batchId?.includes('QC');

    const updatedJobs = state.jobs.map((j) => {
      if (j.id === jobId) {
        let rolls = j.availableRolls || 0;
        let cutCrates = j.availableCuttingCrates || 0;
        let formCrates = j.availableFormingCrates || 0;
        let qcCrates = j.availableQcCrates || 0;

        if (isCutting) {
          rolls += qtyToReturn;
        } else if (isForming) {
          cutCrates += qtyToReturn;
        } else if (isQc) {
          formCrates += qtyToReturn;
        } else {
          cutCrates += qtyToReturn;
        }

        const batches = [...(j.runningBatches || [])];
        const curBatch = batches[bIdx];
        if (curBatch) {
          const remainingIssued = Math.max(0, (curBatch.issuedQty || 0) - qtyToReturn);
          if (remainingIssued === 0 && (!curBatch.outputPieces || curBatch.outputPieces === 0)) {
            // Remove batch entirely if 0 remaining and no production
            batches.splice(bIdx, 1);
          } else {
            batches[bIdx] = {
              ...curBatch,
              issuedQty: remainingIssued,
              status: remainingIssued === 0 ? 'Completed' : curBatch.status
            };
          }
        }

        return {
          ...j,
          availableRolls: rolls,
          availableCuttingCrates: cutCrates,
          availableFormingCrates: formCrates,
          availableQcCrates: qcCrates,
          runningBatches: batches
        };
      }
      return j;
    });

    const newLog: LogEntry = {
      jobId: jobId,
      stage: 'Admin Master',
      machine: batch.machine || 'REVERSAL-DESK',
      shift: 'DAY',
      action: `↩️ Super-Admin Material Reversal: Returned ${qtyToReturn} units from Batch [${batch.batchId}] (${batch.machine}) back to ${targetStockName} on Job [${jobId}]. Reason: "${cleanReason}"`,
      worker: 'SUPER-ADMIN',
      user: currentUser?.username || 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    setReversingMaterialModal(null);
    showToast(`✅ Returned ${qtyToReturn} units back to ${targetStockName}!`);
  };

  const handleExpungeBatch = (jobId: string, batchId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Expunge In-Flight Batch Record',
      message: `Are you sure you want to permanently delete / purge Batch [${batchId}] from Job [${jobId}]?`,
      confirmLabel: 'Yes, Expunge Batch',
      isDanger: true,
      onConfirm: () => {
        const updatedJobs = state.jobs.map((j) => {
          if (j.id === jobId) {
            return {
              ...j,
              runningBatches: (j.runningBatches || []).filter((b) => b.batchId !== batchId)
            };
          }
          return j;
        });

        const newLog: LogEntry = {
          jobId: jobId,
          stage: 'Admin Master',
          machine: 'PURGE-DESK',
          shift: 'DAY',
          action: `🗑️ Super-Admin Expunged In-Flight Batch [${batchId}] from Job [${jobId}]`,
          worker: 'SUPER-ADMIN',
          user: currentUser?.username || 'admin',
          rawDate: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleString()
        };

        onSaveState({
          ...state,
          jobs: updatedJobs,
          logs: [...state.logs, newLog]
        });

        setConfirmModal(null);
        showToast(`🗑️ Batch [${batchId}] expunged from database.`);
      }
    });
  };

  // ==========================================
  // PERMANENT RECORD EXPUNCTION HANDLERS
  // ==========================================
  const handlePurgeCompletedPlans = () => {
    const activePlans = (state.productionPlans || []).filter(
      (p) => p.status !== 'Completed' && p.status !== 'Cancelled'
    );
    const purgedCount = (state.productionPlans || []).length - activePlans.length;
    if (purgedCount === 0) {
      showToast('No completed or cancelled plans to purge.', 'info');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Purge Completed & Cancelled Plans',
      message: `Are you sure you want to permanently delete all ${purgedCount} Completed & Cancelled production plans? Active / Scheduled plans will be kept intact.`,
      confirmLabel: `Purge ${purgedCount} Plans`,
      isDanger: true,
      onConfirm: () => {
        const pass = prompt("Enter Master Password 'MANOJ' to Confirm Purge of Completed Plans:");
        if (pass !== 'MANOJ') {
          showToast('❌ Incorrect Master Password! Purge aborted.', 'error');
          return;
        }
        const newLog: LogEntry = {
          jobId: 'PLAN-PURGE',
          stage: 'Admin Master',
          machine: 'EXPUNGE-DESK',
          shift: 'DAY',
          action: `🗑️ Purged ${purgedCount} completed / cancelled production plans from database`,
          worker: 'SUPER-ADMIN',
          user: currentUser?.username || 'admin',
          rawDate: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleString()
        };
        const nextPlan = activePlans[0];
        onSaveState({
          ...state,
          productionPlans: activePlans,
          logs: [...state.logs, newLog]
        });
        if (nextPlan) {
          handleSelectPlanToEdit(nextPlan.id, activePlans);
        } else {
          setSelectedPlanIdToEdit('');
          setPlanEditForm(null);
        }
        setConfirmModal(null);
        showToast(`✅ Successfully purged ${purgedCount} completed/cancelled plans.`);
      }
    });
  };

  const handlePurgeAllPlans = () => {
    const totalPlans = (state.productionPlans || []).length;
    if (totalPlans === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'Expunge ALL Production Plans',
      message: `⚠️ DANGER: Are you sure you want to permanently purge ALL ${totalPlans} production plans in the database? This cannot be undone.`,
      confirmLabel: 'Yes, Purge ALL Plans',
      isDanger: true,
      onConfirm: () => {
        const pass = prompt("Enter Master Password 'MANOJ' to Purge ALL Production Plans:");
        if (pass !== 'MANOJ') {
          showToast('❌ Incorrect Master Password! Expunge aborted.', 'error');
          return;
        }
        const newLog: LogEntry = {
          jobId: 'ALL-PLANS',
          stage: 'Admin Master',
          machine: 'EXPUNGE-DESK',
          shift: 'DAY',
          action: `🗑️ Super-Admin permanently expunged ALL ${totalPlans} production plans`,
          worker: 'SUPER-ADMIN',
          user: currentUser?.username || 'admin',
          rawDate: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleString()
        };
        onSaveState({
          ...state,
          productionPlans: [],
          logs: [...state.logs, newLog]
        });
        setSelectedPlanIdToEdit('');
        setPlanEditForm(null);
        setConfirmModal(null);
        showToast(`✅ All ${totalPlans} production plans expunged.`);
      }
    });
  };

  const handlePurgeDispatchedOrders = () => {
    const activeOrders = state.packJobs.filter(
      (o) => o.status !== 'Dispatched' && o.status !== 'Completed'
    );
    const purgedCount = state.packJobs.length - activeOrders.length;
    if (purgedCount === 0) {
      showToast('No dispatched or completed orders to purge.', 'info');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Purge Dispatched & Completed Orders',
      message: `Are you sure you want to permanently delete ${purgedCount} Dispatched & Completed packing orders? Pending & In-Progress orders will remain intact.`,
      confirmLabel: `Purge ${purgedCount} Orders`,
      isDanger: true,
      onConfirm: () => {
        const pass = prompt("Enter Master Password 'MANOJ' to Purge Dispatched Orders:");
        if (pass !== 'MANOJ') {
          showToast('❌ Incorrect Master Password! Purge aborted.', 'error');
          return;
        }
        const newLog: LogEntry = {
          jobId: 'ORDER-PURGE',
          stage: 'Admin Master',
          machine: 'EXPUNGE-DESK',
          shift: 'DAY',
          action: `🗑️ Purged ${purgedCount} dispatched / completed packing orders from database`,
          worker: 'SUPER-ADMIN',
          user: currentUser?.username || 'admin',
          rawDate: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleString()
        };
        onSaveState({
          ...state,
          packJobs: activeOrders,
          logs: [...state.logs, newLog]
        });
        setSelectedOrderIdToEdit(activeOrders[0]?.id || '');
        setOrderEditForm(activeOrders[0] ? JSON.parse(JSON.stringify(activeOrders[0])) : null);
        setConfirmModal(null);
        showToast(`✅ Successfully purged ${purgedCount} dispatched/completed orders.`);
      }
    });
  };

  const handlePurgeFilteredLogs = () => {
    if (filteredLogs.length === 0) return;
    const indicesToRemove = new Set(filteredLogs.map((f) => f.originalIndex));
    const remainingLogs = state.logs.filter((_, idx) => !indicesToRemove.has(idx));

    setConfirmModal({
      isOpen: true,
      title: 'Purge Filtered Audit Logs',
      message: `Are you sure you want to permanently delete all ${filteredLogs.length} logs currently matching your search/stage filters?`,
      confirmLabel: `Purge ${filteredLogs.length} Logs`,
      isDanger: true,
      onConfirm: () => {
        const pass = prompt("Enter Master Password 'MANOJ' to Purge Filtered Logs:");
        if (pass !== 'MANOJ') {
          showToast('❌ Incorrect Master Password! Purge aborted.', 'error');
          return;
        }
        const newLog: LogEntry = {
          jobId: 'LOG-PURGE',
          stage: 'Admin Master',
          machine: 'EXPUNGE-DESK',
          shift: 'DAY',
          action: `🗑️ Purged ${filteredLogs.length} audit logs matching filter [Search: "${logSearchQuery}", Stage: "${logFilterStage || 'All'}"]`,
          worker: 'SUPER-ADMIN',
          user: currentUser?.username || 'admin',
          rawDate: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleString()
        };
        onSaveState({
          ...state,
          logs: [...remainingLogs, newLog]
        });
        setConfirmModal(null);
        showToast(`✅ Successfully purged ${filteredLogs.length} audit log entries.`);
      }
    });
  };

  const handlePurgeAllLogs = () => {
    if (state.logs.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Expunge ALL Audit Logs',
      message: `⚠️ DANGER: Are you sure you want to permanently delete ALL ${state.logs.length} audit log entries from the database?`,
      confirmLabel: 'Yes, Expunge ALL Logs',
      isDanger: true,
      onConfirm: () => {
        const pass = prompt("Enter Master Password 'MANOJ' to Expunge ALL Audit Logs:");
        if (pass !== 'MANOJ') {
          showToast('❌ Incorrect Master Password! Expunge aborted.', 'error');
          return;
        }
        const freshLog: LogEntry = {
          jobId: 'SYSTEM-PURGE',
          stage: 'Admin Master',
          machine: 'EXPUNGE-DESK',
          shift: 'DAY',
          action: `⚡ Super-Admin purged entire audit log history (${state.logs.length} entries expunged)`,
          worker: 'SUPER-ADMIN',
          user: currentUser?.username || 'admin',
          rawDate: new Date().toISOString().split('T')[0],
          timestamp: new Date().toLocaleString()
        };
        onSaveState({
          ...state,
          logs: [freshLog]
        });
        setConfirmModal(null);
        showToast('✅ All historical audit logs expunged.');
      }
    });
  };

  // ==========================================
  // WHATSAPP REPORT GENERATOR & DISPATCHER
  // ==========================================
  const handleSaveWhatsAppConfig = () => {
    onSaveState({
      ...state,
      whatsappConfig: {
        phone: waPhone.trim(),
        apiKey: waApiKey.trim(),
        autoSend: waAutoSend,
        webhookUrl: waWebhookUrl.trim(),
        customMessage: waCustomMessage.trim(),
        dayShiftReportTime: waDayReportTime,
        nightShiftReportTime: waNightReportTime,
        autoSendShiftReportDay: waAutoDay,
        autoSendShiftReportNight: waAutoNight
      }
    });
    showToast('✅ WhatsApp Shift Reporting & Changeover Settings Saved Successfully!');
  };

  const generateShiftChangeoverReportText = (targetShift: 'DAY' | 'NIGHT') => {
    const todayStr = new Date().toISOString().split('T')[0];
    const shiftLogs = (state.logs || []).filter((l) => {
      const matchDate = !l.rawDate || l.rawDate === todayStr;
      const matchShift = !l.shift || l.shift.toUpperCase() === targetShift;
      return matchDate && matchShift;
    });

    // 1. Slitting
    const slitLogs = shiftLogs.filter(
      (l) => l.stage?.toLowerCase().includes('slitting') || l.machine?.toLowerCase().includes('slitting')
    );
    const slitOps = Array.from(new Set(slitLogs.map((l) => l.worker).filter(Boolean))).join(', ') || 'Ramesh Patel (Slit)';
    const slitRollsProduced = slitLogs.reduce((acc, l) => {
      const m = l.action?.match(/(\d+)\s*(Rolls)/i);
      return acc + (m ? parseInt(m[1], 10) : 0);
    }, 0) || state.jobs.reduce((s, j) => s + (j.availableRolls || 0), 0);

    // 2. Cutting
    const cutLogs = shiftLogs.filter(
      (l) => l.stage?.toLowerCase().includes('cutting') || l.machine?.toLowerCase().includes('cutting')
    );
    const cut1Logs = cutLogs.filter((l) => l.machine === 'Cutting-1');
    const cut1Op = Array.from(new Set(cut1Logs.map((l) => l.worker).filter(Boolean))).join(', ') || 'Kishore Parmar';
    const cut2Logs = cutLogs.filter((l) => l.machine === 'Cutting-2');
    const cut2Op = Array.from(new Set(cut2Logs.map((l) => l.worker).filter(Boolean))).join(', ') || 'Mahesh Solanki';
    const cutCratesStock = state.jobs.reduce((s, j) => s + (j.availableCuttingCrates || 0), 0);

    // 3. Forming Machines (M-01 to M-08)
    const formLogs = shiftLogs.filter(
      (l) => l.stage?.toLowerCase().includes('forming') || l.machine?.toLowerCase().includes('forming')
    );
    const formMachines = ['Forming-1', 'Forming-2', 'Forming-3', 'Forming-4', 'Forming-5', 'Forming-6', 'Forming-7', 'Forming-8'];
    const formLines = formMachines.map((m) => {
      const mLogs = formLogs.filter((l) => l.machine === m);
      const op = Array.from(new Set(mLogs.map((l) => l.worker).filter(Boolean))).join(', ') || 'Operator Assigned';
      const crates = mLogs.reduce((acc, l) => {
        const match = l.action?.match(/(\d+)\s*(Crates|crates|Crate)/i);
        return acc + (match ? parseInt(match[1], 10) : 0);
      }, 0);
      return `• ${m}: Op: *${op}* | Out: ${crates > 0 ? `${crates} Crates` : 'Active Run'}`;
    });

    // 4. QC Inspection
    const qcLogs = shiftLogs.filter(
      (l) => l.stage?.toLowerCase().includes('qc') || l.machine?.toLowerCase().includes('qc')
    );
    const qcInspectors = Array.from(new Set(qcLogs.map((l) => l.worker).filter(Boolean))).join(', ') || 'Kavita Ben / QC Desk';
    const qcOkCrates = state.jobs.reduce((s, j) => s + (j.availableQcCrates || 0), 0);

    // 5. Packing & Dispatch
    const packLogs = shiftLogs.filter(
      (l) => l.stage?.toLowerCase().includes('packing') || l.machine?.toLowerCase().includes('packing')
    );
    const packOps = Array.from(new Set(packLogs.map((l) => l.worker).filter(Boolean))).join(', ') || 'Suresh & Packing Staff';
    const totalPackedBoxes = state.packJobs.reduce((s, p) => s + (p.packedBoxes || 0), 0);
    const totalDispatched = state.packJobs.reduce((s, p) => s + (p.dispatchedBoxes || 0), 0);

    const shiftTimeRange = targetShift === 'DAY'
      ? `${state.shiftConfig?.dayStart || '08:00'} to ${state.shiftConfig?.dayEnd || '20:00'}`
      : `${state.shiftConfig?.nightStart || '20:00'} to ${state.shiftConfig?.nightEnd || '08:00'}`;

    return `🏭 *WÜNDERKRAF PAPERWARE ERP*
📋 *DAILY ${targetShift} SHIFT CHANGEOVER REPORT*
📅 *Date:* ${todayStr} | *Shift:* ${targetShift} (${shiftTimeRange})
⏱️ *Changeover Trigger Time:* ${new Date().toLocaleTimeString()}

━━━━━━━━━━━━━━━━━━━━━
📜 *1. SLITTING SECTION:*
• Slitting-1: Operator: *${slitOps}*
  Output: ${slitRollsProduced} Slit Rolls

✂️ *2. CUTTING SECTION:*
• Cutting-1: Operator: *${cut1Op}*
• Cutting-2: Operator: *${cut2Op}*
  Floor Cut Stock: ${cutCratesStock} Crates

⚙️ *3. FORMING MACHINES (M-01 to M-08):*
${formLines.join('\n')}

🔍 *4. QUALITY CONTROL (QC):*
• QC Inspector: *${qcInspectors}*
• Passed QC Stock: *${qcOkCrates} Crates*

📦 *5. PACKING & DISPATCH:*
• Supervisor/Packer: *${packOps}*
• Total Packed: *${totalPackedBoxes} Boxes*
• Dispatched Today: *${totalDispatched} Boxes*
━━━━━━━━━━━━━━━━━━━━━
✅ *Auto Shift Changeover Handover Complete.*`;
  };

  const handleSendShiftWhatsApp = (shift: 'DAY' | 'NIGHT') => {
    const reportMessage = generateShiftChangeoverReportText(shift);
    const encodedText = encodeURIComponent(reportMessage);
    const cleanPhone = waPhone.replace(/[^0-9]/g, '');

    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${encodedText}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    }
  };

  const handleSendWhatsAppShiftReport = () => {
    const currentShift = getCurrentExpectedShift(state.shiftConfig);
    handleSendShiftWhatsApp(currentShift === 'NIGHT' ? 'NIGHT' : 'DAY');
  };

  // Maintenance Master Handlers
  const handleSaveMaintenanceMaster = () => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators can modify Maintenance Master settings.');
      return;
    }
    onSaveState({
      ...state,
      maintenanceContacts: maintenanceContacts,
      maintenanceTechniciansMaster: maintenanceContacts.map(c => c.name),
      maintenanceSparePartsMaster: maintSpareParts,
      maintenancePauseReasonsMaster: pauseReasons,
      maintenanceBreakdownReasonsMaster: breakdownReasonsMap,
      maxPiecesPerSlitRoll: Number(maxRollPieces) || 12000,
      strictAuditRollYield: strictRollAudit
    });
    showToast('✅ Maintenance Master, Rights, Pause & Breakdown Dropdowns Saved Successfully!');
  };

  const handleAddTech = () => {
    if (!newTechName.trim() || !newTechPhone.trim() || !newTechRole.trim()) {
      alert('Name, Phone, and Role are required!');
      return;
    }
    const newContact: MaintenanceContact = {
      id: `MC-${Date.now()}`,
      name: newTechName.trim(),
      phone: newTechPhone.trim(),
      role: newTechRole.trim(),
      dept: newTechDept
    };
    setMaintenanceContacts([...maintenanceContacts, newContact]);
    setNewTechName('');
    setNewTechPhone('');
    setNewTechRole('');
  };

  const handleRemoveTech = (idx: number) => {
    setMaintenanceContacts(maintenanceContacts.filter((_, i) => i !== idx));
  };

  const handleAddSparePart = () => {
    if (!newPartName.trim()) return;
    if (maintSpareParts.includes(newPartName.trim())) return alert('Spare part already in catalogue!');
    setMaintSpareParts([...maintSpareParts, newPartName.trim()]);
    setNewPartName('');
  };

  const handleStartEditSparePart = (idx: number) => {
    setEditingSparePartIdx(idx);
    setEditingSparePartText(maintSpareParts[idx] || '');
  };

  const handleSaveEditSparePart = (idx: number) => {
    const cleanText = editingSparePartText.trim();
    if (!cleanText) return;
    const updated = [...maintSpareParts];
    updated[idx] = cleanText;
    setMaintSpareParts(updated);
    setEditingSparePartIdx(null);
    setEditingSparePartText('');
  };

  const handleCancelEditSparePart = () => {
    setEditingSparePartIdx(null);
    setEditingSparePartText('');
  };

  const handleRemoveSparePart = (idx: number) => {
    setMaintSpareParts(maintSpareParts.filter((_, i) => i !== idx));
  };

  // Operational Pause Handlers
  const handleAddPauseReason = () => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators can add pause reasons.');
      return;
    }
    const clean = newPauseReasonInput.trim();
    if (!clean) return;
    if (pauseReasons.includes(clean)) return alert('⚠️ Pause reason already exists in list!');
    setPauseReasons([...pauseReasons, clean]);
    setNewPauseReasonInput('');
  };

  const handleStartEditPauseReason = (idx: number) => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators can edit pause reasons.');
      return;
    }
    setEditingPauseReasonIdx(idx);
    setEditingPauseReasonText(pauseReasons[idx] || '');
  };

  const handleSaveEditPauseReason = (idx: number) => {
    const clean = editingPauseReasonText.trim();
    if (!clean) return;
    const updated = [...pauseReasons];
    updated[idx] = clean;
    setPauseReasons(updated);
    setEditingPauseReasonIdx(null);
    setEditingPauseReasonText('');
  };

  const handleCancelEditPauseReason = () => {
    setEditingPauseReasonIdx(null);
    setEditingPauseReasonText('');
  };

  const handleRemovePauseReason = (idx: number) => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators can delete pause reasons.');
      return;
    }
    setPauseReasons(pauseReasons.filter((_, i) => i !== idx));
  };

  const handleResetPauseReasonsToDefault = () => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators can reset master settings.');
      return;
    }
    if (confirm('Are you sure you want to reset Operational Pause Reasons to factory defaults?')) {
      setPauseReasons([...DEFAULT_OPERATIONAL_PAUSE_REASONS]);
      showToast('🔄 Operational Pause reasons reset to factory defaults.');
    }
  };

  // Department Breakdown Reasons Handlers
  const currentDeptFaults = breakdownReasonsMap[selectedBreakdownDept] || [];

  const handleAddFaultReason = () => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators can add fault reasons.');
      return;
    }
    const clean = newFaultReasonInput.trim();
    if (!clean) return;
    if (currentDeptFaults.includes(clean)) return alert(`⚠️ Fault reason already exists in ${selectedBreakdownDept}!`);
    const updated = {
      ...breakdownReasonsMap,
      [selectedBreakdownDept]: [...currentDeptFaults, clean]
    };
    setBreakdownReasonsMap(updated);
    setNewFaultReasonInput('');
  };

  const handleStartEditFaultReason = (idx: number) => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators can edit fault reasons.');
      return;
    }
    setEditingFaultReasonIdx(idx);
    setEditingFaultReasonText(currentDeptFaults[idx] || '');
  };

  const handleSaveEditFaultReason = (idx: number) => {
    const clean = editingFaultReasonText.trim();
    if (!clean) return;
    const updatedDeptList = [...currentDeptFaults];
    updatedDeptList[idx] = clean;
    const updated = {
      ...breakdownReasonsMap,
      [selectedBreakdownDept]: updatedDeptList
    };
    setBreakdownReasonsMap(updated);
    setEditingFaultReasonIdx(null);
    setEditingFaultReasonText('');
  };

  const handleCancelEditFaultReason = () => {
    setEditingFaultReasonIdx(null);
    setEditingFaultReasonText('');
  };

  const handleRemoveFaultReason = (idx: number) => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators can delete fault reasons.');
      return;
    }
    const updated = {
      ...breakdownReasonsMap,
      [selectedBreakdownDept]: currentDeptFaults.filter((_, i) => i !== idx)
    };
    setBreakdownReasonsMap(updated);
  };

  const handleResetFaultReasonsToDefault = () => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators can reset master settings.');
      return;
    }
    if (confirm('Are you sure you want to reset all department breakdown fault reasons to factory defaults?')) {
      setBreakdownReasonsMap({ ...DEFAULT_BREAKDOWN_REASONS_MAP });
      showToast('🔄 Breakdown fault reasons reset to factory defaults.');
    }
  };

  const handleRevokeMaintenanceRightsFromUser = (userKey: string) => {
    const u = usersRecord[userKey];
    if (!u) return;
    const mntRights = [
      'Maintenance',
      'Mnt_LogIncident',
      'Mnt_AssignTech',
      'Mnt_Repair',
      'Mnt_SpareParts',
      'Mnt_Preventative',
      'Mnt_RCA'
    ];
    const existing = u.perms || [];
    // Remove all specific maintenance rights
    const filtered = existing.filter(p => !mntRights.includes(p));
    const updatedUsers = {
      ...usersRecord,
      [userKey]: {
        ...u,
        perms: filtered
      }
    };
    onSaveState({
      ...state,
      users: updatedUsers
    });
    if (selectedUserKey === userKey) {
      setEditingUser({ ...editingUser, perms: filtered });
    }
  };

  const handleGrantAllMaintenanceRightsToUser = (userKey: string) => {
    const u = usersRecord[userKey];
    if (!u) return;
    const mntRights = [
      'Maintenance',
      'Mnt_LogIncident',
      'Mnt_AssignTech',
      'Mnt_Repair',
      'Mnt_SpareParts',
      'Mnt_Preventative',
      'Mnt_RCA'
    ];
    const existing = u.perms || [];
    const combined = Array.from(new Set([...existing, ...mntRights]));
    const updatedUsers = {
      ...usersRecord,
      [userKey]: {
        ...u,
        perms: combined
      }
    };
    onSaveState({
      ...state,
      users: updatedUsers
    });
    if (selectedUserKey === userKey) {
      setEditingUser({ ...editingUser, perms: combined });
    }
    showToast(`✅ Granted All Maintenance Desk Rights to [${userKey}]!`);
  };

  // ==========================================
  // SEQUENCES, SHIFTS & ADMIN PIN
  // ==========================================
  const handleSaveSequencesAndShifts = (e: React.FormEvent) => {
    e.preventDefault();

    onSaveState({
      ...state,
      adminPassword: adminPass.trim() || '1234',
      seriesConfig: {
        ...state.seriesConfig,
        productSeqs: productSeqs,
        orderSeq: Number(orderSeq) || 1
      },
      shiftConfig: {
        dayStart,
        dayEnd,
        nightStart,
        nightEnd
      }
    });

    alert('✅ Numbering Sequences, Shift Timings & Master PIN Saved Successfully!');
  };

  // ==========================================
  // BACKUP, RESTORE & HARD RESET
  // ==========================================
  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const pass = prompt('Enter Admin Master Password to Confirm Restoration:');
    if (pass !== (state.adminPassword || '1234')) {
      alert('❌ Access Denied: Incorrect Master Password. Restoration aborted.');
      e.target.value = '';
      return;
    }

    try {
      const restored = await importDatabaseBackup(file);
      onSaveState(restored);
      getStorageHealth().then(setStorageHealth).catch(() => {});
      alert(`✅ Factory database state restored successfully from backup!\n• Jobs: ${restored.jobs?.length || 0}\n• Orders: ${restored.packJobs?.length || 0}\n• Logs: ${restored.logs?.length || 0}`);
    } catch (err: any) {
      alert(`❌ Restore failed: ${err.message || 'Invalid backup JSON file'}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleRunPruning = () => {
    if (
      !confirm(
        'Run database archival and pruning for completed records older than 30 days?\nThis will protect storage space by moving older logs and completed jobs into cold archival records.'
      )
    ) {
      return;
    }
    const result = pruneFactoryState(state, 30);
    onSaveState(result.prunedState);
    getStorageHealth().then(setStorageHealth).catch(() => {});
    alert(
      `✅ Pruning completed!\n• Archived ${result.archivedJobsCount} completed jobs\n• Archived ${result.archivedLogsCount} historical logs\nActive database is lean and optimized.`
    );
  };


  const handleModularReset = async (categoryId: string, categoryName: string) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const cleanName = categoryName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Wunderkraf_AutoBackup_PreReset_${cleanName}_${timestamp}.json`;
    
    try {
      exportDatabaseBackup(state, fileName);
    } catch (err) {
      alert('⚠️ Failed to generate backup! Reset aborted to prevent data loss.');
      return;
    }

    const confirmText = prompt(`Safety Backup Downloaded to your device!\n\nType 'MANOJ' (or 'CONFIRM RESET') to wipe ${categoryName}.`);
    if (confirmText !== 'CONFIRM RESET' && confirmText !== 'MANOJ' && confirmText !== 'manoj') {
      alert('❌ Reset confirmation failed. Aborted.');
      return;
    }

    const pass = prompt(`Enter Master Password (MANOJ) to Confirm Reset for ${categoryName}:`);
    if (pass !== 'MANOJ' && pass !== 'manoj' && pass !== (state.adminPassword || '1234')) {
      alert('❌ Access Denied: Incorrect Master Password. Reset aborted.');
      return;
    }

    let newState = { ...state };
    switch (categoryId) {
      case 'slitting':
        newState = {
          ...state,
          jobs: state.jobs.filter(j => j.stage !== 'Slitting').map(j => ({
            ...j,
            availableRolls: 0,
            runningBatches: j.runningBatches?.filter(b => b.stage !== 'Slitting' && !b.machine.startsWith('Slitting'))
          })),
          logs: state.logs.filter(l => l.stage !== 'Slitting')
        };
        break;
      case 'cutting':
        newState = {
          ...state,
          jobs: state.jobs.filter(j => j.stage !== 'Cutting').map(j => ({
            ...j,
            availableCuttingCrates: 0,
            totalCutPieces: 0,
            runningBatches: j.runningBatches?.filter(b => b.stage !== 'Cutting' && !b.machine.startsWith('Cutting'))
          })),
          logs: state.logs.filter(l => l.stage !== 'Cutting')
        };
        break;
      case 'forming':
        newState = {
          ...state,
          jobs: state.jobs.filter(j => j.stage !== 'Forming').map(j => ({
            ...j,
            availableFormingCrates: 0,
            totalFormedPieces: 0,
            runningBatches: j.runningBatches?.filter(b => b.stage !== 'Forming' && !b.machine.startsWith('Forming'))
          })),
          logs: state.logs.filter(l => l.stage !== 'Forming')
        };
        break;
      case 'qc':
        newState = {
          ...state,
          jobs: state.jobs.filter(j => j.stage !== 'QC').map(j => ({
            ...j,
            availableQcCrates: 0,
            runningBatches: j.runningBatches?.filter(b => b.stage !== 'QC' && !b.machine.startsWith('QC'))
          })),
          logs: state.logs.filter(l => l.stage !== 'QC' && l.stage !== 'Quality Control' && l.jobId !== 'DIRECT-QC')
        };
        break;
      case 'packing':
        newState = {
          ...state,
          packJobs: [],
          logs: state.logs.filter(l => l.stage !== 'Packing')
        };
        break;
      case 'master':
        newState = {
          ...state,
          paperBrands: INITIAL_STATE.paperBrands,
          glueBrands: INITIAL_STATE.glueBrands,
          targetGsmMaster: INITIAL_STATE.targetGsmMaster,
          targetLayersMaster: INITIAL_STATE.targetLayersMaster,
          maintenanceSparePartsMaster: INITIAL_STATE.maintenanceSparePartsMaster,
          products: INITIAL_STATE.products
        };
        break;
      case 'maintenance':
        newState = {
          ...state,
          maintenanceIncidents: [],
          maintenanceTechniciansMaster: INITIAL_STATE.maintenanceTechniciansMaster,
          maintenancePauseReasonsMaster: INITIAL_STATE.maintenancePauseReasonsMaster,
          maintenanceBreakdownReasonsMaster: INITIAL_STATE.maintenanceBreakdownReasonsMaster,
          machineReadyAlerts: [],
          logs: state.logs.filter(l => l.stage !== 'Maintenance')
        };
        break;
      case 'full':
        newState = {
          ...state,
          lastResetTimestamp: Date.now(),
          jobs: [],
          logs: [],
          packJobs: [],
          scrapSales: [],
          maintenanceIncidents: [],
          machineReadyAlerts: [],
          customerComplaints: [],
          materialRequisitions: [],
          archivedJobs: [],
          archivedLogs: [],
          glueUsageLogs: [],
          productionPlans: [],
          motherReelInventory: [],
          shiftHandovers: [],
          users: state.users,
          adminPassword: state.adminPassword
        };
        break;
    }

    onSaveState(newState);
    if (categoryId === 'full') {
      if (isFirebaseConfigured()) {
        syncStateToCloud(newState).catch(() => {});
      }
      try {
        const endpoint = getCentralSyncEndpoint();
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: newState, clientTimestamp: Date.now() })
        }).catch(() => {});
      } catch (e) {}
    }
    alert(`✅ ${categoryName} reset successfully. All transactional entries wiped clean. Backup saved in Downloads.`);
  };

  const handleHardReset = () => {
    if (
      !confirm(
        '⚠️ CRITICAL WARNING: This will completely wipe all current factory jobs, orders, and logs and restore clean empty factory state!\nAre you sure you want to proceed?'
      )
    ) {
      return;
    }
    const pass = prompt('Enter Master Admin Password (or MANOJ) to confirm factory wipe:');
    if (pass !== 'MANOJ' && pass !== 'manoj' && pass !== (state.adminPassword || '1234')) {
      alert('❌ Incorrect Admin Password! Reset aborted.');
      return;
    }

    const cleanState: FactoryState = {
      ...state,
      lastResetTimestamp: Date.now(),
      jobs: [],
      logs: [],
      packJobs: [],
      scrapSales: [],
      maintenanceIncidents: [],
      machineReadyAlerts: [],
      customerComplaints: [],
      materialRequisitions: [],
      archivedJobs: [],
      archivedLogs: [],
      glueUsageLogs: [],
      productionPlans: [],
      motherReelInventory: [],
      shiftHandovers: [],
      users: state.users,
      adminPassword: state.adminPassword
    };

    onSaveState(cleanState);
    if (isFirebaseConfigured()) {
      syncStateToCloud(cleanState).catch(() => {});
    }
    try {
      const endpoint = getCentralSyncEndpoint();
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: cleanState, clientTimestamp: Date.now() })
      }).catch(() => {});
    } catch (e) {}

    alert('✅ Factory database has been completely wiped clean of all entries.');
  };

  const AVAILABLE_PERMS = [
    { key: '*', label: '👑 FULL MASTER ACCESS (*)', desc: 'Full control over all modules & admin settings' },
    { key: 'Admin', label: '⚙️ Admin Settings & Overwrite', desc: 'Manage users, sequences & overwrite data' },
    { key: 'Dashboard', label: '📊 Executive Dashboard', desc: 'Live Floor Pulse & Real-time Machine Status' },
    { key: 'Marketing', label: '💼 Customer Marketing & Orders', desc: 'Create and book new packing orders' },
    { key: 'Dispatch', label: '🚚 Dispatch & Gatepass Invoicing', desc: 'Process box dispatches and bills' },
    { key: 'Slitting', label: '📜 Slitting Desk (Stage 1)', desc: 'Jumbo reel loading & slitting runs' },
    { key: 'Cutting', label: '✂️ Cutting Desk (Stage 2)', desc: 'Slit rolls to cut crates' },
    { key: 'Forming', label: '⚙️ Forming Desk (Stage 3)', desc: 'Hydraulic moulding & pressing' },
    { key: 'QC', label: '🔍 QC Inspection Desk (Stage 4)', desc: 'Formed crates quality check & scrap' },
    { key: 'Manpower', label: '👷‍♂️ Manpower Desk', desc: 'Operator & Helper Roster' },
    { key: 'Packing', label: '📦 Packing Desk (Stage 5)', desc: 'Kit assembly & box packaging' },
    { key: 'Planning', label: '📅 Planning Desk (PPC)', desc: 'Production Plans, Target Layers, Mother Reels & Glue Brands' },
    { key: 'Maintenance', label: '🛠️ Maintenance Desk (Full Control)', desc: 'Machine breakdowns, spare parts, logs & ready handover' },
    { key: 'Mnt_LogIncident', label: '🚨 Log Machine Breakdown / Down', desc: 'Can report machine breakdowns and stoppage reasons' },
    { key: 'Mnt_AssignTech', label: '👨‍🔧 Assign Technician & Priority', desc: 'Can assign maintenance leads, priority, and acknowledge' },
    { key: 'Mnt_Repair', label: '🔧 Mark Repaired & Action Log', desc: 'Can mark machines repaired, ready for production handover' },
    { key: 'Mnt_SpareParts', label: '⚙️ Spare Parts Consumption & Stock', desc: 'Can record replacement parts and adjust inventory' },
    { key: 'Mnt_Preventative', label: '📋 Preventative Maintenance Schedules', desc: 'Can manage routine PM checklists and machine health' },
    { key: 'Mnt_RCA', label: '📊 Root Cause Analysis (RCA) & Audit', desc: 'Can edit failure root cause and CAPA preventive actions' },
    { key: 'Purchase', label: '🛒 Purchase & Indent Desk', desc: 'Material Indents, Vendor POs & Incoming Goods' },
    { key: 'Stock', label: '📊 Raw & WIP Stock Matrix', desc: 'Real-time inventory levels' },
    { key: 'Orders', label: '📋 Orders Book & Customer Specs', desc: 'View customer orders list' },
    { key: 'Analytics', label: '📈 Scrap & Efficiency Analytics', desc: 'Output yield & machine metrics' },
    { key: 'Search', label: '🔎 Universal Search Desk', desc: 'Search Job ID, Invoices, Customers & Operators' },
    { key: 'Audit', label: '📜 Traceability & Batch Reports', desc: 'Box-to-raw trace, customer complaints & audit logs' }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs mb-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Main Menu</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#1a365d] uppercase tracking-wide m-0">
              Master Admin Control Center (100% Rights Suite)
            </h3>
            <p className="text-[11px] text-slate-500 m-0">
              User Accounts, Role Permissions, 100% Master Data Overwrite, WhatsApp Backup & Configs
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('brand_items_paper')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'brand_items_paper'
              ? 'bg-[#1a365d] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>🏷️ Brand Items & Paper Mill ({productsList.length} Items / {paperBrandsList.length} Mills)</span>
        </button>

        <button
          onClick={() => setActiveTab('crate_master')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'crate_master'
              ? 'bg-[#1a365d] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Box className="w-4 h-4" />
          <span>🧺 Crate Capacity Master ({Object.keys(crateMaster).length} Products Matrix)</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-[#1a365d] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>👥 User Accounts & Roles ({Object.keys(usersRecord).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('master_data')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'master_data'
              ? 'bg-[#1a365d] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Edit className="w-4 h-4" />
          <span>🛠️ Master Data Overwrite (Job / Batch / Order / Log)</span>
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'whatsapp'
              ? 'bg-[#1a365d] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>📱 WhatsApp Backup & Live Reporting</span>
        </button>

        <button
          onClick={() => setActiveTab('sequences_shifts')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'sequences_shifts'
              ? 'bg-[#1a365d] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>🔢 Sequences, Shifts & Master PIN</span>
        </button>

        <button
          onClick={() => setActiveTab('maintenance_master')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'maintenance_master'
              ? 'bg-[#1a365d] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>🔧 Maintenance Master & Desk Rights</span>
        </button>

        <button
          onClick={() => setActiveTab('staff_escalation')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'staff_escalation'
              ? 'bg-[#1a365d] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Smartphone className="w-4 h-4 text-emerald-500" />
          <span>📱 Staff & Escalation Hierarchy</span>
        </button>

        <button
          onClick={() => setActiveTab('opening_stock_inward')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'opening_stock_inward'
              ? 'bg-[#1a365d] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-500" />
          <span>⚡ Go-Live Opening WIP & Stock Inward</span>
        </button>

        <button
          onClick={() => setActiveTab('backup_restore')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'backup_restore'
              ? 'bg-[#1a365d] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>💾 Database Backup & JSON Recovery</span>
        </button>

        <button
          onClick={() => setActiveTab('employee_master')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'employee_master'
              ? 'bg-[#1a365d] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-500" />
          <span>👥 Employee Master</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 0: BRAND ITEMS & PAPER MILL MASTER */}
      {/* ========================================================================= */}
      {activeTab === 'brand_items_paper' && (
        <div className="space-y-6">
          {/* Section 1: Paper Mill Brands */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0 flex items-center gap-2">
                  <span>📜 Paper Mill / Supplier Brands</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black">
                    {paperBrandsList.length} Brands
                  </span>
                </h4>
                <p className="text-xs text-slate-500 m-0">
                  These paper brand names appear in the Slitting Reel Creation dropdown. Add your supplier mills here.
                </p>
              </div>
            </div>

            {/* Add Brand Form */}
            <form onSubmit={handleAddPaperBrand} className="flex items-center gap-2 max-w-xl">
              <input
                type="text"
                value={newPaperBrandInput}
                onChange={(e) => setNewPaperBrandInput(e.target.value)}
                placeholder="Enter Paper Mill Name (e.g., ITC, CENTURY, BILT, WEST COAST, JK PAPER)"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none uppercase placeholder:normal-case focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#2b6cb0] hover:bg-[#1a365d] text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Mill Brand</span>
              </button>
            </form>

            {/* List of Paper Brands */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
              {paperBrandsList.map((brand, idx) => (
                <div
                  key={brand}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-blue-200 transition shadow-2xs"
                >
                  {editingPaperBrandIdx === idx ? (
                    <div className="flex items-center gap-1.5 w-full">
                      <input
                        type="text"
                        value={editingPaperBrandName}
                        onChange={(e) => setEditingPaperBrandName(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs font-bold border border-blue-400 rounded-lg uppercase outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEditPaperBrand(idx)}
                        className="p-1 bg-green-600 hover:bg-green-700 text-white rounded-lg cursor-pointer"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPaperBrandIdx(null)}
                        className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-black">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-black text-slate-800 tracking-wide">{brand}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPaperBrandIdx(idx);
                            setEditingPaperBrandName(brand);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition"
                          title="Rename Brand"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePaperBrand(brand)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition"
                          title="Remove Brand"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Cutlery Products / Brand Items */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0 flex items-center gap-2">
                  <span>🍽️ Brand Cutlery Items & Products</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                    {productsList.length} Products
                  </span>
                </h4>
                <p className="text-xs text-slate-500 m-0">
                  Configure Spoon, Fork, Knife, or custom sizes/items. Set custom prefix codes and sequence counters for automatic Job ID generation.
                </p>
              </div>
            </div>

            {/* Add Product Form */}
            <form onSubmit={handleAddProduct} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider m-0">Add New Product / Cutlery Item</h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Product Name:</label>
                  <input
                    type="text"
                    value={newProductName}
                    onChange={(e) => {
                      setNewProductName(e.target.value);
                      if (!newProductPrefix) {
                        setNewProductPrefix(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase());
                      }
                    }}
                    placeholder="e.g. Soup Spoon, Tea Spoon, Spork"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Job ID Prefix (3-4 chars):</label>
                  <input
                    type="text"
                    value={newProductPrefix}
                    onChange={(e) => setNewProductPrefix(e.target.value.toUpperCase())}
                    placeholder="e.g. SPN, FRK, TSP, SPR"
                    maxLength={5}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-black text-slate-800 outline-none uppercase focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Starting Sequence Number:</label>
                  <input
                    type="number"
                    min="1"
                    value={newProductSeq}
                    onChange={(e) => setNewProductSeq(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-slate-500 m-0">
                  Example generated Job ID:{' '}
                  <span className="font-mono font-bold text-blue-700">
                    {(newProductPrefix || 'ITM').toUpperCase()}-{String(newProductSeq || '1').padStart(3, '0')}
                  </span>
                </p>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product Item</span>
                </button>
              </div>
            </form>

            {/* Product Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Item Name</th>
                    <th className="px-4 py-2.5">Job Prefix</th>
                    <th className="px-4 py-2.5">Current Seq</th>
                    <th className="px-4 py-2.5">Next Job ID</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productsList.map((prod, idx) => {
                    const prefixMap: Record<string, string> = {
                      ...PRODUCT_PREFIX_MAP,
                      ...(state.productPrefixMap || {})
                    };
                    const prefix = prefixMap[prod] || prod.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'ITM';
                    const currentSeq = (state.seriesConfig?.productSeqs && state.seriesConfig.productSeqs[prod]) || 1;
                    const nextJobId = `${prefix}-${String(currentSeq).padStart(3, '0')}`;

                    return (
                      <tr key={prod} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-black text-slate-800">
                          {editingProductIdx === idx ? (
                            <input
                              type="text"
                              value={editingProductName}
                              onChange={(e) => setEditingProductName(e.target.value)}
                              className="px-2 py-1 text-xs font-bold border border-blue-400 rounded-lg outline-none"
                              autoFocus
                            />
                          ) : (
                            prod
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-black text-blue-700">
                          {editingProductIdx === idx ? (
                            <input
                              type="text"
                              value={editingProductPrefix}
                              onChange={(e) => setEditingProductPrefix(e.target.value.toUpperCase())}
                              className="px-2 py-1 text-xs font-mono font-bold border border-blue-400 rounded-lg uppercase outline-none w-20"
                              maxLength={5}
                            />
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                              {prefix}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-600">
                          {editingProductIdx === idx ? (
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 font-bold">#</span>
                              <input
                                type="number"
                                min={1}
                                value={editingProductSeq}
                                onChange={(e) => setEditingProductSeq(e.target.value)}
                                className="px-2 py-1 text-xs font-mono font-bold border border-blue-400 rounded-lg outline-none w-20 bg-white"
                                title="Edit Next Sequence Counter (e.g. 1, 2, 3...)"
                              />
                            </div>
                          ) : (
                            <span>#{currentSeq}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-extrabold text-emerald-700">
                          {editingProductIdx === idx
                            ? `${editingProductPrefix || prefix}${String(Math.max(1, parseInt(editingProductSeq, 10) || 1)).padStart(3, '0')}`
                            : nextJobId}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {editingProductIdx === idx ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleSaveEditProduct(idx)}
                                className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg cursor-pointer"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingProductIdx(null)}
                                className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProductIdx(idx);
                                  setEditingProductName(prod);
                                  setEditingProductPrefix(prefix);
                                  setEditingProductSeq(String(currentSeq));
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition"
                                title="Edit Product & Sequence Number"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(prod)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition"
                                title="Delete Product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Glue Brands */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0 flex items-center gap-2">
                  <span>💧 Adhesive / Glue Brands</span>
                </h4>
              </div>
            </div>
            <form onSubmit={handleAddGlueBrand} className="flex items-center gap-2 max-w-xl">
              <input
                type="text"
                value={newGlueBrandInput}
                onChange={(e) => setNewGlueBrandInput(e.target.value)}
                placeholder="Enter Glue Brand"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none uppercase"
              />
              <button type="submit" className="px-4 py-2 bg-[#2b6cb0] hover:bg-[#1a365d] text-white rounded-xl text-xs font-extrabold">Add Glue</button>
            </form>
            <div className="flex flex-wrap gap-2 pt-2">
              {glueBrandsList.map((brand, idx) => (
                <div key={brand} className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700">
                  {editingGlueBrandIdx === idx ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingGlueBrandName}
                        onChange={(e) => setEditingGlueBrandName(e.target.value)}
                        className="px-2 py-1 text-xs border border-blue-400 rounded outline-none w-24"
                        autoFocus
                      />
                      <button type="button" onClick={() => handleSaveEditGlueBrand(idx)} className="text-green-600 hover:text-green-800"><Check className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => setEditingGlueBrandIdx(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <>
                      <span>{brand}</span>
                      <div className="flex items-center gap-1 ml-2 border-l border-slate-300 pl-2">
                        <button type="button" onClick={() => { setEditingGlueBrandIdx(idx); setEditingGlueBrandName(brand); }} className="text-blue-500 hover:text-blue-700" title="Edit"><Edit className="w-3 h-3" /></button>
                        <button type="button" onClick={() => handleDeleteGlueBrand(brand)} className="text-rose-500 hover:text-rose-700 font-bold" title="Delete">×</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Target Layers */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0 flex items-center gap-2">
                  <span>📚 Target Layers Master</span>
                </h4>
              </div>
            </div>
            <form onSubmit={handleAddTargetLayer} className="flex items-center gap-2 max-w-xl">
              <input
                type="number"
                value={newTargetLayerInput}
                onChange={(e) => setNewTargetLayerInput(e.target.value)}
                placeholder="Enter Layer (e.g. 8, 9)"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
              />
              <button type="submit" className="px-4 py-2 bg-[#2b6cb0] hover:bg-[#1a365d] text-white rounded-xl text-xs font-extrabold">Add Layer</button>
            </form>
            <div className="flex flex-wrap gap-2 pt-2">
              {targetLayersList.map((val, idx) => (
                <div key={val} className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700">
                  {editingTargetLayerIdx === idx ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editingTargetLayerVal}
                        onChange={(e) => setEditingTargetLayerVal(e.target.value)}
                        className="px-2 py-1 text-xs border border-blue-400 rounded outline-none w-16"
                        autoFocus
                      />
                      <button type="button" onClick={() => handleSaveEditTargetLayer(idx)} className="text-green-600 hover:text-green-800"><Check className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => setEditingTargetLayerIdx(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <>
                      <span>{val} Layers</span>
                      <div className="flex items-center gap-1 ml-2 border-l border-slate-300 pl-2">
                        <button type="button" onClick={() => { setEditingTargetLayerIdx(idx); setEditingTargetLayerVal(val.toString()); }} className="text-blue-500 hover:text-blue-700" title="Edit"><Edit className="w-3 h-3" /></button>
                        <button type="button" onClick={() => handleDeleteTargetLayer(val)} className="text-rose-500 hover:text-rose-700 font-bold" title="Delete">×</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Target GSM */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0 flex items-center gap-2">
                  <span>⚖️ Target GSM Master</span>
                </h4>
              </div>
            </div>
            <form onSubmit={handleAddTargetGsm} className="flex items-center gap-2 max-w-xl">
              <input
                type="text"
                value={newTargetGsmInput}
                onChange={(e) => setNewTargetGsmInput(e.target.value)}
                placeholder="Enter GSM (e.g. 60 GSM, 120 GSM)"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none uppercase"
              />
              <button type="submit" className="px-4 py-2 bg-[#2b6cb0] hover:bg-[#1a365d] text-white rounded-xl text-xs font-extrabold">Add GSM</button>
            </form>
            <div className="flex flex-wrap gap-2 pt-2">
              {targetGsmList.map((val) => (
                <div key={val} className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700">
                  {val}
                  <button type="button" onClick={() => handleDeleteTargetGsm(val)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">×</button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 0.5: CRATE CAPACITY MASTER (Crate Capacity & Volume Expansion Master) */}
      {/* ========================================================================= */}
      {activeTab === 'crate_master' && (
        <div className="space-y-6">
          {/* Header & Controls */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                  <Box className="w-5 h-5" />
                </span>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide m-0">
                  Crate Capacity Master & Volume Expansion
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-1 m-0">
                🔐 <strong>Admin Exclusive Control:</strong> Set how many pieces of Cutting (Flat Blanks) and Forming (3D Molded) come in each Crate.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetCrateMaster}
                className="px-3 py-2 bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                title="Restore default factory capacities"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAllCrateMaster}
                className="px-4 py-2 bg-[#2b6cb0] hover:bg-[#1a365d] text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Master Matrix</span>
              </button>
            </div>
          </div>

          {/* Technical & Production Logic Banner */}
          <div className="bg-linear-to-r from-blue-50 via-indigo-50 to-amber-50 border border-indigo-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="p-2 bg-indigo-100 text-indigo-700 rounded-xl mt-0.5 shrink-0">
                <Sliders className="w-5 h-5" />
              </span>
              <div className="space-y-2 text-xs text-slate-700">
                <h5 className="font-extrabold text-indigo-950 text-xs uppercase tracking-wide m-0">
                  Physical Manufacturing Law: Flat Blanks vs. 3D Molded Volume Expansion
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="bg-white/80 border border-blue-200 p-2.5 rounded-xl">
                    <span className="font-black text-blue-900 block mb-1">
                      ✂️ 1. Cutting (Flat Blanks)
                    </span>
                    <p className="text-[11px] text-slate-600 m-0">
                      Paper remains completely flat. Stacking is dense, so more Pieces fit in a Crate (e.g. Spoon: <strong>10,000 Pcs/Crate</strong>).
                    </p>
                  </div>
                  <div className="bg-white/80 border border-indigo-200 p-2.5 rounded-xl">
                    <span className="font-black text-indigo-900 block mb-1">
                      ⚙️ 2. Forming (3D Curved Shape)
                    </span>
                    <p className="text-[11px] text-slate-600 m-0">
                      Molding adds depth (Depth/Curve) increasing the volume of each piece. Fewer Pieces fit in a Crate (e.g. Spoon: <strong>7,000 Pcs/Crate</strong>).
                    </p>
                  </div>
                  <div className="bg-white/80 border border-emerald-200 p-2.5 rounded-xl">
                    <span className="font-black text-emerald-900 block mb-1">
                      🔍 3. QC Locking (Strict 1:1)
                    </span>
                    <p className="text-[11px] text-slate-600 m-0">
                      No shape changes after forming. So 1:1 Crate locking remains in QC (<strong>15 Formed Crates In = 15 QC Crates Max</strong>).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Master Crate Capacities Matrix Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                Standard Crate Capacity per Product
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                Formula: Total Pieces = Full Crates × Pcs/Crate + Loose Pcs
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 text-slate-700 font-extrabold uppercase border-b border-slate-200 text-[11px]">
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4 text-blue-800">
                      ✂️ Cutting Capacity (Flat Pcs/Crate)
                    </th>
                    <th className="py-3 px-4 text-indigo-800">
                      ⚙️ Forming Capacity (3D Pcs/Crate)
                    </th>
                    <th className="py-3 px-4 text-amber-800">
                      📈 Crate Expansion Ratio
                    </th>
                    <th className="py-3 px-4 text-slate-700">
                      Simulation (15 Cut Crates)
                    </th>
                    <th className="py-3 px-4 text-center">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {Object.entries(crateMaster).map(([prod, cap]) => {
                    const isEditing = editingCrateProd === prod;
                    const expansionRatio = cap.formingPcs > 0 ? (cap.cuttingPcs / cap.formingPcs).toFixed(2) : '1.00';
                    const expansionPct = cap.formingPcs > 0 ? (((cap.cuttingPcs / cap.formingPcs) - 1) * 100).toFixed(1) : '0';
                    const formedSimCrates = cap.formingPcs > 0 ? ((15 * cap.cuttingPcs) / cap.formingPcs).toFixed(1) : '15.0';

                    return (
                      <tr key={prod} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-black text-slate-900 flex items-center gap-2">
                          <Tag className="w-4 h-4 text-indigo-500" />
                          <span>{prod}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                value={editCutPcs}
                                onChange={(e) => setEditCutPcs(Number(e.target.value))}
                                className="w-28 px-2 py-1 bg-white border border-blue-400 rounded-lg text-xs font-bold text-slate-800 outline-none"
                              />
                              <span className="text-[11px] text-slate-500">Pcs</span>
                            </div>
                          ) : (
                            <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                              {cap.cuttingPcs.toLocaleString()} Flat Pcs
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                value={editFormPcs}
                                onChange={(e) => setEditFormPcs(Number(e.target.value))}
                                className="w-28 px-2 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-bold text-slate-800 outline-none"
                              />
                              <span className="text-[11px] text-slate-500">Pcs</span>
                            </div>
                          ) : (
                            <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                              {cap.formingPcs.toLocaleString()} 3D Pcs
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold">
                          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                            {expansionRatio}x (+{expansionPct}% Crates)
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-slate-600">
                          15 Cut Crates ➔ <strong className="text-indigo-800 font-extrabold">{formedSimCrates} Formed Crates</strong>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveCrateRow(prod, editCutPcs, editFormPcs)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" /> Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCrateProd(null)}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCrateProd(prod);
                                setEditCutPcs(cap.cuttingPcs);
                                setEditFormPcs(cap.formingPcs);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" /> Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add / Override Custom Product Crate Capacity */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide m-0">
              ➕ Add / Update Crate Capacity for Another Product (Add New Product Crate Standard)
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Select or Type Product:
                </label>
                <input
                  type="text"
                  list="admin-products-datalist"
                  value={newCrateProd}
                  onChange={(e) => setNewCrateProd(e.target.value)}
                  placeholder="e.g. Soup Spoon or Bowl"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                />
                <datalist id="admin-products-datalist">
                  {productsList.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">
                  ✂️ Cutting Capacity (Flat Pcs/Crate):
                </label>
                <input
                  type="number"
                  value={newCrateCutPcs}
                  onChange={(e) => setNewCrateCutPcs(e.target.value)}
                  placeholder="Enter cutting pieces"
                  className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-indigo-800 uppercase mb-1">
                  ⚙️ Forming Capacity (3D Pcs/Crate):
                </label>
                <input
                  type="number"
                  value={newCrateFormPcs}
                  onChange={(e) => setNewCrateFormPcs(e.target.value)}
                  placeholder="Enter forming pieces"
                  className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddCustomCrateProd}
                  className="w-full py-2.5 bg-[#2b6cb0] hover:bg-[#1a365d] text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add to Master Matrix</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: USER ACCOUNTS & PERMISSIONS (User ID & Access Management) */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
                    {/* Master Admin Password Setup */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-red-900 uppercase m-0 tracking-wide">
                    Master Admin Security Lock
                  </h4>
                  <p className="text-[11px] text-red-700 font-medium m-0 mt-0.5">
                    This password is required to perform Modular Resets, Full Factory Wipes, and JSON Backup Restorations.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4 bg-white p-3 rounded-lg border border-red-100 shadow-sm inline-flex">
                <div className="flex flex-col">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1">Set Global Master Password</label>
                  <input
                    type="text"
                    value={masterPasswordInput}
                    onChange={(e) => setMasterPasswordInput(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-md text-sm font-black text-slate-900 w-64 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition"
                    placeholder="e.g. 1234 or Admin@123"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUpdateMasterPassword}
                  className="mt-5 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-md shadow-xs transition cursor-pointer"
                >
                  Update Lock
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
                User Accounts & Access Rights (User Management & Access Rights)
              </h4>
              <p className="text-xs text-slate-500 m-0">
                Set individual passwords, module rights and permissions for each operator / department
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddUserModalOpen(true)}
              className="px-3 py-1.5 bg-[#2b6cb0] hover:bg-[#1a365d] text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add New User Account</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* User List Column */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <label className="text-xs font-extrabold text-slate-700 uppercase block mb-1">
                Select User to Configure:
              </label>
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {Object.keys(usersRecord).map((userKey) => {
                  const u = usersRecord[userKey] as any;
                  const isSelected = selectedUserKey === userKey;
                  const isMaster = userKey === 'admin';
                  return (
                    <button
                      key={userKey}
                      type="button"
                      onClick={() => handleSelectUser(userKey)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 font-bold text-blue-950 shadow-xs ring-1 ring-blue-500'
                          : 'border-slate-200 bg-white hover:bg-slate-100/80 text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold flex items-center gap-1.5">
                          <span>{userKey}</span>
                          {isMaster && (
                            <span className="text-[10px] bg-red-100 text-red-700 font-extrabold px-1.5 py-0.2 rounded">
                              MASTER
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {u.name || userKey} • {u.role || 'User'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {u.perms?.includes('*') ? 'ALL' : `${u.perms?.length || 0} Rights`}
                        </span>
                        {!isMaster && (
                          <span
                            role="button"
                            title={`Delete user account ${userKey}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteUser(userKey);
                            }}
                            className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* User Rights & Edit Column */}
            <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  <span className="font-extrabold text-sm text-slate-900">
                    Editing User: <span className="text-blue-700">[{selectedUserKey}]</span>
                  </span>
                </div>
                {selectedUserKey !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(selectedUserKey)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete User
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name / Display:</label>
                  <input
                    type="text"
                    value={editingUser.name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Login Password / PIN:</label>
                  <input
                    type="text"
                    value={editingUser.pass}
                    onChange={(e) => setEditingUser({ ...editingUser, pass: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-bold text-blue-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Designation / Role:</label>
                  <input
                    type="text"
                    value={editingUser.role || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Permissions Checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-extrabold text-slate-800 uppercase">
                    Grant Module Access Rights (Rights Checkbox):
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, perms: ['*'] })}
                      className="text-[11px] text-blue-700 font-extrabold hover:underline cursor-pointer"
                    >
                      Select All (*)
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, perms: [] })}
                      className="text-[11px] text-slate-500 font-extrabold hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-3 rounded-xl border border-slate-200">
                  {AVAILABLE_PERMS.map((perm) => {
                    const isChecked =
                      editingUser.perms.includes('*') || editingUser.perms.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                          isChecked ? 'border-blue-300 bg-blue-50/50 text-blue-950 font-bold' : 'border-slate-100 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePerm(perm.key)}
                          className="mt-0.5 rounded text-blue-600"
                        />
                        <div>
                          <div className="font-extrabold">{perm.label}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{perm.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveUserPermissions}
                className="w-full py-2.5 bg-[#2b6cb0] hover:bg-[#1a365d] text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save User Rights & Password for [{selectedUserKey}]</span>
              </button>
            </div>
          </div>

          {/* Department Workers Master List */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide m-0">
              Department Operators & Workers Master (Machine Operators List)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Department:</label>
                <select
                  value={selectedDeptForWorker}
                  onChange={(e) => setSelectedDeptForWorker(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="Slitting">Slitting Department</option>
                  <option value="Cutting">Cutting Department</option>
                  <option value="Forming">Forming Department</option>
                  <option value="QC">QC Inspection Team</option>
                  <option value="Packing">Packing Team</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">New Worker Name:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWorkerNameInput}
                    onChange={(e) => setNewWorkerNameInput(e.target.value)}
                    placeholder="e.g. SURESH_CUT"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase text-slate-800 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddWorker}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Active {selectedDeptForWorker} Workers:
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {(deptWorkersState[selectedDeptForWorker] || []).map((workerName) => (
                    <span
                      key={workerName}
                      className="text-[11px] font-extrabold bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-800 flex items-center gap-1 shadow-2xs"
                    >
                      {workerName}
                      <X
                        onClick={() => handleRemoveWorker(selectedDeptForWorker, workerName)}
                        className="w-3 h-3 text-slate-400 hover:text-rose-600 cursor-pointer"
                      />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 100% MASTER DATA OVERWRITE (Job, Batch, Quality, Order & Log Correction) */}
      {/* ========================================================================= */}
      {activeTab === 'master_data' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
                100% Master Data Correction & Overwrite (Master Data Correction)
              </h4>
              <p className="text-xs text-slate-500 m-0">
                Admin full authority: Correct Job IDs, Item IDs, Stock counts, Running Batches, Customer Orders & Logs
              </p>
            </div>
            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
              <button
                type="button"
                onClick={() => setMasterSubTab('plans')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  masterSubTab === 'plans' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                PPC / Planning Master
              </button>
              <button
                type="button"
                onClick={() => setMasterSubTab('jobs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  masterSubTab === 'jobs' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Production Jobs Master
              </button>
              <button
                type="button"
                onClick={() => setMasterSubTab('reconcile')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  masterSubTab === 'reconcile' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-800 hover:text-amber-950 hover:bg-amber-50'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                Stock Reconciliation
              </button>
              <button
                type="button"
                onClick={() => setMasterSubTab('batches')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  masterSubTab === 'batches' ? 'bg-purple-600 text-white shadow-xs' : 'text-purple-800 hover:text-purple-950 hover:bg-purple-50'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                In-Flight Batches & Reversal
              </button>
              <button
                type="button"
                onClick={() => setMasterSubTab('orders')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  masterSubTab === 'orders' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Packing Orders Master
              </button>
              <button
                type="button"
                onClick={() => setMasterSubTab('logs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  masterSubTab === 'logs' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Audit History Logs
              </button>
              <button
                type="button"
                onClick={() => setMasterSubTab('numbering')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  masterSubTab === 'numbering' ? 'bg-indigo-600 text-white shadow-xs' : 'text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Auto-Numbering Master
              </button>
              <button
                type="button"
                onClick={() => setMasterSubTab('vault')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  masterSubTab === 'vault' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:text-rose-900 hover:bg-rose-50'
                }`}
              >
                🗑️ Deletion Vault ({(state.deletedVaultItems || []).length})
              </button>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* SUB-TAB A: PRODUCTION JOBS OVERWRITE */}
          {/* ------------------------------------------------------------- */}
          {masterSubTab === 'jobs' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Select Production Job to Edit / Overwrite:
                  </label>
                  <select
                    value={selectedJobIdToEdit}
                    onChange={(e) => handleSelectJobToEdit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  >
                    {state.jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.id} - {j.product} [{j.paperBrand || 'ITC'}] (Rolls: {j.availableRolls || 0}, Cut:{' '}
                        {j.availableCuttingCrates || 0}, Form: {j.availableFormingCrates || 0}, QC:{' '}
                        {j.availableQcCrates || 0})
                      </option>
                    ))}
                  </select>
                </div>
                {jobEditForm && (
                  <button
                    type="button"
                    onClick={() => handleDeleteJob(jobEditForm.id)}
                    className="mt-4 px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Job
                  </button>
                )}
              </div>

              {jobEditForm ? (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-blue-900 uppercase mb-1">
                        Job ID (Job Number):
                      </label>
                      <input
                        type="text"
                        value={jobEditForm.id}
                        onChange={(e) => setJobEditForm({ ...jobEditForm, id: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-extrabold text-blue-950 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Product Item (Item Type):
                      </label>
                      <select
                        value={jobEditForm.product}
                        onChange={(e) => setJobEditForm({ ...jobEditForm, product: e.target.value as ProductType })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      >
                        {PRODUCTS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Paper Brand / Mill:
                      </label>
                      <select
                        value={jobEditForm.paperBrand || PAPER_BRANDS[0]}
                        onChange={(e) => setJobEditForm({ ...jobEditForm, paperBrand: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      >
                        {PAPER_BRANDS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Reel Traceability & Weight Scrap Inputs */}
                  <div className="border border-blue-200 rounded-xl p-3 bg-blue-50/40 space-y-2">
                    <label className="text-xs font-extrabold text-blue-900 uppercase block flex items-center justify-between">
                      <span>🎯 Reel Traceability & Jumbo Weights (Correct Reel Number & Weight):</span>
                      <span className="text-[11px] font-bold text-purple-700">Admin Master Edit</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">
                          Reel No. (Reel Number):
                        </label>
                        <input
                          type="text"
                          value={jobEditForm.reelNo || ''}
                          onChange={(e) => setJobEditForm({ ...jobEditForm, reelNo: e.target.value.toUpperCase() })}
                          placeholder="e.g. RL-ITC-0012"
                          className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-amber-800 uppercase mb-1">
                          GSM Thickness:
                        </label>
                        <input
                          type="text"
                          value={jobEditForm.gsm || ''}
                          onChange={(e) => setJobEditForm({ ...jobEditForm, gsm: e.target.value })}
                          placeholder="e.g. 120 GSM"
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-blue-700 uppercase mb-1">
                          Jumbo In Weight (KG):
                        </label>
                        <input
                          type="number"
                          value={jobEditForm.inputWeightKg || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            const outVal = Number(jobEditForm.outputWeightKg) || 0;
                            const scrap = Math.max(0, val - outVal);
                            setJobEditForm({
                              ...jobEditForm,
                              inputWeightKg: val,
                              scrapKg: scrap,
                              scrapPercent: val > 0 ? Number(((scrap / val) * 100).toFixed(1)) : 0
                            });
                          }}
                          placeholder="KG"
                          className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-teal-700 uppercase mb-1">
                          Slit Out Weight (KG):
                        </label>
                        <input
                          type="number"
                          value={jobEditForm.outputWeightKg || ''}
                          onChange={(e) => {
                            const outVal = Number(e.target.value) || 0;
                            const inVal = Number(jobEditForm.inputWeightKg) || 0;
                            const scrap = Math.max(0, inVal - outVal);
                            setJobEditForm({
                              ...jobEditForm,
                              outputWeightKg: outVal,
                              scrapKg: scrap,
                              scrapPercent: inVal > 0 ? Number(((scrap / inVal) * 100).toFixed(1)) : 0
                            });
                          }}
                          placeholder="KG"
                          className="w-full px-3 py-2 bg-white border border-teal-300 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-rose-700 uppercase mb-1">
                          Scrap (KG / %):
                        </label>
                        <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs font-mono font-extrabold text-rose-800">
                          {jobEditForm.scrapKg || 0} KG ({jobEditForm.scrapPercent || 0}%)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stock balances editor */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <label className="text-xs font-extrabold text-slate-800 uppercase block">
                      Direct Stage Stock Balances Overwrite (Correct Stock Balances Directly):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-teal-800 uppercase mb-1">
                          📜 Slit Rolls:
                        </label>
                        <input
                          type="number"
                          value={jobEditForm.availableRolls || 0}
                          onChange={(e) =>
                            setJobEditForm({ ...jobEditForm, availableRolls: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 bg-white border border-teal-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">
                          ✂️ Cut Crates:
                        </label>
                        <input
                          type="number"
                          value={jobEditForm.availableCuttingCrates || 0}
                          onChange={(e) =>
                            setJobEditForm({ ...jobEditForm, availableCuttingCrates: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-indigo-800 uppercase mb-1">
                          ⚙️ Formed Crates:
                        </label>
                        <input
                          type="number"
                          value={jobEditForm.availableFormingCrates || 0}
                          onChange={(e) =>
                            setJobEditForm({ ...jobEditForm, availableFormingCrates: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">
                          🔍 QC OK Crates:
                        </label>
                        <input
                          type="number"
                          value={jobEditForm.availableQcCrates || 0}
                          onChange={(e) =>
                            setJobEditForm({ ...jobEditForm, availableQcCrates: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                        />
                      </div>
                    </div>

                    {/* Crate Capacity & Piece Tracking Overrides for this Job */}
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-extrabold text-amber-900 uppercase flex items-center gap-1.5">
                          <Box className="w-3.5 h-3.5 text-amber-600" />
                          <span>Crate Packing & Piece Counts (Pieces) Overrides:</span>
                        </label>
                        <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded">
                          Job-Specific Override
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                            ✂️ Cut Pcs/Crate:
                          </label>
                          <input
                            type="number"
                            value={jobEditForm.pcsPerCrateCutting ?? (crateMaster[jobEditForm.product]?.cuttingPcs || 10000)}
                            onChange={(e) =>
                              setJobEditForm({ ...jobEditForm, pcsPerCrateCutting: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded text-xs font-bold text-slate-800 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                            ⚙️ Form Pcs/Crate:
                          </label>
                          <input
                            type="number"
                            value={jobEditForm.pcsPerCrateForming ?? (crateMaster[jobEditForm.product]?.formingPcs || 7000)}
                            onChange={(e) =>
                              setJobEditForm({ ...jobEditForm, pcsPerCrateForming: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded text-xs font-bold text-slate-800 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-blue-800 uppercase mb-0.5">
                            Cut Total Pcs:
                          </label>
                          <input
                            type="number"
                            value={jobEditForm.totalCutPieces ?? ((jobEditForm.availableCuttingCrates || 0) * (jobEditForm.pcsPerCrateCutting || crateMaster[jobEditForm.product]?.cuttingPcs || 10000))}
                            onChange={(e) =>
                              setJobEditForm({ ...jobEditForm, totalCutPieces: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded text-xs font-bold text-slate-800 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-0.5">
                            Formed Total Pcs:
                          </label>
                          <input
                            type="number"
                            value={jobEditForm.totalFormedPieces ?? ((jobEditForm.availableFormingCrates || 0) * (jobEditForm.pcsPerCrateForming || crateMaster[jobEditForm.product]?.formingPcs || 7000))}
                            onChange={(e) =>
                              setJobEditForm({ ...jobEditForm, totalFormedPieces: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1.5 bg-white border border-indigo-300 rounded text-xs font-bold text-slate-800 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-0.5">
                            QC Total Pcs:
                          </label>
                          <input
                            type="number"
                            value={jobEditForm.totalQcPieces ?? ((jobEditForm.availableQcCrates || 0) * (jobEditForm.pcsPerCrateForming || crateMaster[jobEditForm.product]?.formingPcs || 7000))}
                            onChange={(e) =>
                              setJobEditForm({ ...jobEditForm, totalQcPieces: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded text-xs font-bold text-slate-800 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Running/Active Batches on this Job */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold text-slate-800 uppercase">
                        Running / Active Batches on Job [{jobEditForm.id}] (
                        {jobEditForm.runningBatches?.length || 0}):
                      </label>
                    </div>

                    <div className="space-y-2">
                      {(jobEditForm.runningBatches || []).map((batch, bIdx) => (
                        <div
                          key={batch.batchId || bIdx}
                          className="p-3 bg-white border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs items-center"
                        >
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Batch ID:</span>
                            <input
                              type="text"
                              value={batch.batchId}
                              onChange={(e) => {
                                const updated = [...(jobEditForm.runningBatches || [])];
                                updated[bIdx] = { ...updated[bIdx], batchId: e.target.value };
                                setJobEditForm({ ...jobEditForm, runningBatches: updated });
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded font-bold text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Machine:</span>
                            <input
                              type="text"
                              value={batch.machine}
                              onChange={(e) => {
                                const updated = [...(jobEditForm.runningBatches || [])];
                                updated[bIdx] = { ...updated[bIdx], machine: e.target.value };
                                setJobEditForm({ ...jobEditForm, runningBatches: updated });
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded font-bold text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Operator:</span>
                            <input
                              type="text"
                              value={batch.worker}
                              onChange={(e) => {
                                const updated = [...(jobEditForm.runningBatches || [])];
                                updated[bIdx] = { ...updated[bIdx], worker: e.target.value.toUpperCase() };
                                setJobEditForm({ ...jobEditForm, runningBatches: updated });
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded font-bold text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Status:</span>
                            <select
                              value={batch.status}
                              onChange={(e) => {
                                const updated = [...(jobEditForm.runningBatches || [])];
                                updated[bIdx] = { ...updated[bIdx], status: e.target.value as any };
                                setJobEditForm({ ...jobEditForm, runningBatches: updated });
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded font-bold text-xs"
                            >
                              <option value="Running">Running</option>
                              <option value="Held">Held</option>
                              <option value="Completed">Completed</option>
                            </select>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">Issued Qty:</span>
                            <input
                              type="number"
                              value={batch.issuedQty || 0}
                              onChange={(e) => {
                                const updated = [...(jobEditForm.runningBatches || [])];
                                updated[bIdx] = { ...updated[bIdx], issuedQty: Number(e.target.value) };
                                setJobEditForm({ ...jobEditForm, runningBatches: updated });
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded font-bold text-xs"
                            />
                          </div>
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (jobEditForm.runningBatches || []).filter((_, idx) => idx !== bIdx);
                                setJobEditForm({ ...jobEditForm, runningBatches: updated });
                              }}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Delete this batch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {(!jobEditForm.runningBatches || jobEditForm.runningBatches.length === 0) && (
                        <div className="text-xs text-slate-400 text-center py-2">No active batches on this job</div>
                      )}
                    </div>
                  </div>

                  {/* Linked Job Audit Entry List */}
                  {(() => {
                    const jobLogs = state.logs
                      .map((log, idx) => ({ log, originalIndex: idx }))
                      .filter(({ log }) => log.jobId === jobEditForm.id)
                      .reverse();

                    return (
                      <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <label className="text-xs font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5 text-blue-600" />
                            <span>Audit Entries & Production History for Job [{jobEditForm.id}] ({jobLogs.length}):</span>
                          </label>
                          <span className="text-[10px] text-slate-500 font-bold">
                            Live Audit Trail • Delete or Edit Any Entry
                          </span>
                        </div>

                        {jobLogs.length === 0 ? (
                          <div className="text-xs text-slate-400 text-center py-3 bg-white rounded-lg border border-dashed border-slate-200">
                            No audit log entries recorded for this job yet.
                          </div>
                        ) : (
                          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto max-h-60">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] sticky top-0 border-b border-slate-200">
                                <tr>
                                  <th className="p-2">Date / Time</th>
                                  <th className="p-2">Stage</th>
                                  <th className="p-2">Machine</th>
                                  <th className="p-2">Action</th>
                                  <th className="p-2">Worker</th>
                                  <th className="p-2 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {jobLogs.map(({ log, originalIndex }) => (
                                  <tr key={originalIndex} className="hover:bg-slate-50 transition">
                                    <td className="p-2 whitespace-nowrap text-[11px] text-slate-500">
                                      {log.timestamp || log.rawDate || '-'}
                                    </td>
                                    <td className="p-2 whitespace-nowrap">
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                                        {log.stage || 'Floor'}
                                      </span>
                                    </td>
                                    <td className="p-2 whitespace-nowrap font-semibold">{log.machine || '-'}</td>
                                    <td className="p-2 text-slate-800 max-w-xs truncate" title={log.action}>
                                      {log.action}
                                    </td>
                                    <td className="p-2 whitespace-nowrap font-bold text-slate-900">
                                      {log.worker || log.user || '-'}
                                    </td>
                                    <td className="p-2 text-right whitespace-nowrap">
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditLog(originalIndex)}
                                          className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                          title="Edit this log entry"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteLogEntry(originalIndex)}
                                          className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                          title="Delete this log entry"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={handleSaveJobOverwrite}
                    className="w-full py-3 bg-[#2b6cb0] hover:bg-[#1a365d] text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Master Overwrite for Job [{jobEditForm.id}]</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-6">Select a job above to edit</div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* SUB-TAB: DIRECT STOCK RECONCILIATION SUITE */}
          {/* ------------------------------------------------------------- */}
          {masterSubTab === 'reconcile' && (
            <div className="space-y-4">
              {(() => {
                const deletedJobIdsSet = new Set(state.deletedJobIds || []);
                const activeJobs = (state.jobs || []).filter((j) => !deletedJobIdsSet.has(j.id));
                const totalRolls = activeJobs.reduce((acc, j) => acc + (j.availableRolls || 0), 0);
                const totalCutCrates = activeJobs.reduce((acc, j) => acc + (j.availableCuttingCrates || 0), 0);
                const totalFormedCrates = activeJobs.reduce((acc, j) => acc + (j.availableFormingCrates || 0), 0);
                const totalQcCrates = activeJobs.reduce((acc, j) => acc + (j.availableQcCrates || 0), 0);

                return (
                  <>
                    {/* Header Banner */}
                    <div className="bg-linear-to-r from-amber-900 via-amber-950 to-slate-900 rounded-2xl p-5 text-white shadow-lg border border-amber-800/40">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[11px] font-extrabold uppercase tracking-wider mb-1.5">
                            <Scale className="w-3.5 h-3.5 text-amber-400" />
                            Physical Stage Inventory Reconciler
                          </div>
                          <h3 className="text-lg font-black tracking-tight text-white m-0">
                            Direct Stage Stock Reconciliation & Reason Audit
                          </h3>
                          <p className="text-xs text-amber-200/80 mt-1 max-w-2xl">
                            Live-reconcile physical stage floor inventories (Slit Rolls, Cut Crates, Formed Crates, QC Crates, Finished Cartons) with mandatory reason audit logging.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="bg-white/10 px-3 py-2 rounded-xl text-center backdrop-blur-xs border border-white/10">
                            <div className="text-[10px] text-amber-200 uppercase font-bold">Total Jobs in Floor</div>
                            <div className="text-base font-black text-amber-300">{activeJobs.length}</div>
                          </div>
                        </div>
                      </div>

                      {/* Aggregate Summary */}
                      <div className="mt-4 pt-4 border-t border-amber-800/60 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                          <div className="text-[10px] text-amber-300 font-bold uppercase">Total Slit Rolls Stock</div>
                          <div className="text-sm font-black text-white font-mono">
                            {totalRolls} Rolls
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                          <div className="text-[10px] text-cyan-300 font-bold uppercase">Total Cut Crates Stock</div>
                          <div className="text-sm font-black text-white font-mono">
                            {totalCutCrates} Crates
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                          <div className="text-[10px] text-purple-300 font-bold uppercase">Total Formed Crates Stock</div>
                          <div className="text-sm font-black text-white font-mono">
                            {totalFormedCrates} Crates
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                          <div className="text-[10px] text-emerald-300 font-bold uppercase">Total QC OK Crates Stock</div>
                          <div className="text-sm font-black text-white font-mono">
                            {totalQcCrates} Crates
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Jobs Table Matrix */}
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide m-0">
                          Floor Stage Inventory Matrix ({activeJobs.length} Active Production Jobs)
                        </h4>
                        <span className="text-[11px] font-bold text-slate-500">
                          Click "Reconcile" on any job to live-adjust physical stage inventory counts with audit logging
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase text-[10px]">
                            <tr>
                              <th className="p-2.5">Job ID</th>
                              <th className="p-2.5">Product</th>
                              <th className="p-2.5">Status</th>
                              <th className="p-2.5 text-right bg-teal-50 text-teal-900">📜 Slit Rolls</th>
                              <th className="p-2.5 text-right bg-blue-50 text-blue-900">✂️ Cut Crates</th>
                              <th className="p-2.5 text-right bg-indigo-50 text-indigo-900">⚙️ Formed Crates</th>
                              <th className="p-2.5 text-right bg-emerald-50 text-emerald-900">🔍 QC OK Crates</th>
                              <th className="p-2.5 text-right">Total Output Pcs</th>
                              <th className="p-2.5 text-center">Reconcile</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                            {activeJobs.map((job) => (
                              <tr key={job.id} className="hover:bg-amber-50/40 transition">
                                <td className="p-2.5 font-extrabold text-blue-900 font-mono">{job.id}</td>
                                <td className="p-2.5 font-bold text-slate-800">
                                  {job.product}
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    {job.paperBrand || 'ITC'} • {job.gsm || 60} GSM • {job.targetLayers || 8}L
                                  </span>
                                </td>
                                <td className="p-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                      job.status === 'Completed'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : job.status === 'Running'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {job.status}
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold bg-teal-50/50 text-teal-950">
                                  {job.availableRolls || 0}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold bg-blue-50/50 text-blue-950">
                                  {job.availableCuttingCrates || 0}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold bg-indigo-50/50 text-indigo-950">
                                  {job.availableFormingCrates || 0}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold bg-emerald-50/50 text-emerald-950">
                                  {job.availableQcCrates || 0}
                                </td>
                                <td className="p-2.5 text-right font-mono font-extrabold text-slate-900">
                                  {(job.totalQcPieces || job.totalFormedPieces || job.totalCutPieces || 0).toLocaleString()}
                                </td>
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReconcileModal(job)}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] rounded-lg transition shadow-xs flex items-center justify-center gap-1 cursor-pointer mx-auto"
                                    title={`Reconcile physical stock for ${job.id}`}
                                  >
                                    <Scale className="w-3.5 h-3.5" /> Reconcile
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {activeJobs.length === 0 && (
                              <tr>
                                <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
                                  No production jobs available in database.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* SUB-TAB: IN-FLIGHT BATCH CORRECTIONS & MATERIAL REVERSAL */}
          {/* ------------------------------------------------------------- */}
          {masterSubTab === 'batches' && (
            <div className="space-y-4">
              {/* Header Banner */}
              <div className="bg-linear-to-r from-purple-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-lg border border-purple-800/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-[11px] font-extrabold uppercase tracking-wider mb-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                      In-Flight Corrections & Material Reversal Suite
                    </div>
                    <h3 className="text-lg font-black tracking-tight text-white m-0">
                      In-Flight Batch Corrections & Material Reversal Desk
                    </h3>
                    <p className="text-xs text-purple-200/80 mt-1 max-w-2xl">
                      Edit timestamps, re-assign running machines, update operator IDs, and adjust piece counts on active runs. Securely reverse incorrectly assigned raw materials or cut crates back to preceding stage floor stock.
                    </p>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    placeholder="Search in-flight batches by Job ID, Batch ID, Machine, or Worker..."
                    className="w-full bg-white px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Stage / Machine:</span>
                  <select
                    value={batchFilterStage}
                    onChange={(e) => setBatchFilterStage(e.target.value)}
                    className="bg-white px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold outline-none"
                  >
                    <option value="">All Machines / Batches</option>
                    <option value="CUT">Cutting Batches</option>
                    <option value="FRM">Forming Batches</option>
                    <option value="QC">QC Batches</option>
                    <option value="SLIT">Slitting Batches</option>
                  </select>
                </div>
              </div>

              {/* Batches Table */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide m-0">
                    Active & Completed Floor Batches Across All Jobs
                  </h4>
                  <span className="text-[11px] font-bold text-slate-500">
                    Correct timestamps/machines or perform safe material un-issue
                  </span>
                </div>

                {(() => {
                  const allBatches: { jobId: string; jobProduct: string; batch: RunningBatch; bIdx: number }[] = [];
                  state.jobs.forEach((job) => {
                    (job.runningBatches || []).forEach((b, idx) => {
                      allBatches.push({
                        jobId: job.id,
                        jobProduct: job.product,
                        batch: b,
                        bIdx: idx
                      });
                    });
                  });

                  const filteredBatches = allBatches.filter(({ jobId, batch }) => {
                    const q = batchSearchQuery.toLowerCase();
                    const matchesSearch =
                      !q ||
                      jobId.toLowerCase().includes(q) ||
                      (batch.batchId && batch.batchId.toLowerCase().includes(q)) ||
                      (batch.machine && batch.machine.toLowerCase().includes(q)) ||
                      (batch.worker && batch.worker.toLowerCase().includes(q));

                    const matchesFilter =
                      !batchFilterStage ||
                      (batchFilterStage === 'CUT' && (batch.machine?.includes('Cutting') || batch.batchId?.includes('CUT'))) ||
                      (batchFilterStage === 'FRM' && (batch.machine?.includes('Forming') || batch.batchId?.includes('FRM') || batch.batchId?.includes('FORM'))) ||
                      (batchFilterStage === 'QC' && (batch.machine?.includes('QC') || batch.batchId?.includes('QC'))) ||
                      (batchFilterStage === 'SLIT' && (batch.machine?.includes('Slitting') || batch.batchId?.includes('SLIT')));

                    return matchesSearch && matchesFilter;
                  });

                  return filteredBatches.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No matching in-flight or running batches found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase text-[10px]">
                          <tr>
                            <th className="p-2.5">Job ID</th>
                            <th className="p-2.5">Batch ID</th>
                            <th className="p-2.5">Stage / Machine</th>
                            <th className="p-2.5">Operator</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5 text-right">Issued Qty</th>
                            <th className="p-2.5 text-right">Output Pcs</th>
                            <th className="p-2.5 text-right">Scrap Pcs</th>
                            <th className="p-2.5">Start Time</th>
                            <th className="p-2.5 text-center">Super-Admin Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                          {filteredBatches.map(({ jobId, jobProduct, batch, bIdx }) => (
                            <tr key={`${jobId}-${batch.batchId || bIdx}`} className="hover:bg-purple-50/40 transition">
                              <td className="p-2.5 font-extrabold text-blue-900 font-mono">
                                {jobId}
                                <span className="block text-[10px] text-slate-400 font-normal">{jobProduct}</span>
                              </td>
                              <td className="p-2.5 font-mono font-bold text-purple-950">
                                {batch.batchId || `BATCH-${bIdx + 1}`}
                              </td>
                              <td className="p-2.5 font-bold text-slate-800">{batch.machine || '-'}</td>
                              <td className="p-2.5 font-semibold text-slate-700">{batch.worker || '-'}</td>
                              <td className="p-2.5">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                    batch.status === 'Completed'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : batch.status === 'Running'
                                      ? 'bg-blue-100 text-blue-800 animate-pulse'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {batch.status || 'Running'}
                                </span>
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                                {batch.issuedQty || 0}
                              </td>
                              <td className="p-2.5 text-right font-mono font-extrabold text-emerald-700">
                                {(batch.outputPieces || 0).toLocaleString()}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-rose-700">
                                {batch.scrapPieces || 0}
                              </td>
                              <td className="p-2.5 text-slate-500 text-[11px] whitespace-nowrap">
                                {batch.startTime || '-'}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartCorrectBatch(jobId, batch, bIdx)}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] rounded-md transition flex items-center gap-1 cursor-pointer border border-blue-200"
                                    title="Correct Machine / Operator / Counts"
                                  >
                                    <Edit className="w-3 h-3" /> Correct
                                  </button>
                                  {(batch.issuedQty || 0) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleStartReverseMaterial(jobId, batch, bIdx)}
                                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] rounded-md transition flex items-center gap-1 cursor-pointer border border-amber-200"
                                      title="Reverse / Return Issued Crates or Rolls"
                                    >
                                      <Undo2 className="w-3 h-3" /> Reverse Issue
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleExpungeBatch(jobId, batch.batchId)}
                                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                                    title="Expunge Batch"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* SUB-TAB B: CUSTOMER PACKING ORDERS OVERWRITE */}
          {/* ------------------------------------------------------------- */}
          {masterSubTab === 'orders' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Select Customer Order to Edit / Overwrite:
                  </label>
                  <select
                    value={selectedOrderIdToEdit}
                    onChange={(e) => handleSelectOrderToEdit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  >
                    {state.packJobs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} - {o.customer} ({o.packType}) | Status: {o.status} | Packed: {o.packedBoxes || 0}/
                        {o.orderQty}
                      </option>
                    ))}
                    {state.packJobs.length === 0 && (
                      <option value="">No packing orders found</option>
                    )}
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-4 sm:mt-0">
                  {state.packJobs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadOrdersCSV}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                      title="Download Orders CSV"
                    >
                      <Download className="w-3.5 h-3.5" /> Download CSV
                    </button>
                  )}
                  {orderEditForm && (
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(orderEditForm.id)}
                      className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Selected Order
                    </button>
                  )}
                  {state.packJobs.some((o) => o.status === 'Dispatched' || o.status === 'Completed') && (
                    <button
                      type="button"
                      onClick={handlePurgeDispatchedOrders}
                      className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                      title="Purge Dispatched & Completed Orders"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Purge Dispatched
                    </button>
                  )}
                  {state.packJobs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteAllOrders}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete ALL ({state.packJobs.length}) Orders
                    </button>
                  )}
                </div>
              </div>

              {orderEditForm ? (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Order ID:</label>
                      <input
                        type="text"
                        value={orderEditForm.id}
                        onChange={(e) => setOrderEditForm({ ...orderEditForm, id: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-extrabold text-slate-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Customer Name:</label>
                      <input
                        type="text"
                        value={orderEditForm.customer}
                        onChange={(e) => setOrderEditForm({ ...orderEditForm, customer: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Order Status:</label>
                      <select
                        value={orderEditForm.status}
                        onChange={(e) => setOrderEditForm({ ...orderEditForm, status: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Partially Packed">Partially Packed</option>
                        <option value="Completed">Completed</option>
                        <option value="Dispatched">Dispatched</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Total Target Boxes:</label>
                      <input
                        type="number"
                        value={orderEditForm.orderQty}
                        onChange={(e) =>
                          setOrderEditForm({ ...orderEditForm, orderQty: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pcs Per Box:</label>
                      <input
                        type="number"
                        value={orderEditForm.pcsPerBox}
                        onChange={(e) =>
                          setOrderEditForm({ ...orderEditForm, pcsPerBox: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-purple-800 uppercase mb-1">Packed Boxes Count:</label>
                      <input
                        type="number"
                        value={orderEditForm.packedBoxes || 0}
                        onChange={(e) =>
                          setOrderEditForm({ ...orderEditForm, packedBoxes: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-white border border-purple-300 rounded-lg text-xs font-bold text-purple-950 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-emerald-800 uppercase mb-1">Dispatched Boxes Count:</label>
                      <input
                        type="number"
                        value={orderEditForm.dispatchedBoxes || 0}
                        onChange={(e) =>
                          setOrderEditForm({ ...orderEditForm, dispatchedBoxes: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-emerald-950 outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveOrderOverwrite}
                    className="w-full py-3 bg-[#2b6cb0] hover:bg-[#1a365d] text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Master Overwrite for Order [{orderEditForm.id}]</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-6">Select an order above to edit</div>
              )}

              {/* Master Data Table: All Customer Packing Orders */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    📦 All Customer Packing Orders ({state.packJobs.length})
                  </h4>
                  <span className="text-[11px] font-bold text-slate-500">
                    Click Trash Icon (🗑️) on any order row to delete permanently
                  </span>
                </div>

                {state.packJobs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No packing orders present in database.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase text-[10px]">
                          <th className="p-2.5">Order ID</th>
                          <th className="p-2.5">Customer</th>
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Target Boxes</th>
                          <th className="p-2.5 text-right">Packed Boxes</th>
                          <th className="p-2.5 text-right">Dispatched</th>
                          <th className="p-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                        {state.packJobs.map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-50 transition">
                            <td className="p-2.5 font-extrabold text-slate-900">{ord.id}</td>
                            <td className="p-2.5 font-bold text-slate-800">{ord.customer}</td>
                            <td className="p-2.5 text-slate-600">{ord.packType}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                  ord.status === 'Completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : ord.status === 'Dispatched'
                                    ? 'bg-blue-100 text-blue-800'
                                    : ord.status === 'In Progress' || ord.status === 'Partially Packed'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {ord.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-bold text-slate-900">{ord.orderQty}</td>
                            <td className="p-2.5 text-right font-bold text-purple-700">{ord.packedBoxes || 0}</td>
                            <td className="p-2.5 text-right font-bold text-emerald-700">{ord.dispatchedBoxes || 0}</td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSelectOrderToEdit(ord.id)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                  title="Edit Order"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOrder(ord.id)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title={`Delete Order ${ord.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* SUB-TAB C: AUDIT LOGS OVERWRITE */}
          {/* ------------------------------------------------------------- */}

          {/* ------------------------------------------------------------- */}
          {/* SUB-TAB D: PPC / PLANNING MASTER OVERWRITE */}
          {/* ------------------------------------------------------------- */}
          {masterSubTab === 'plans' && (
            <div className="space-y-4">
              {/* Auto-init plan edit form if null */}
              {(() => {
                if (!planEditForm && (state.productionPlans || []).length > 0) {
                  const targetPlan = (state.productionPlans || []).find((p) => p.id === selectedPlanIdToEdit) || state.productionPlans[0];
                  if (targetPlan) {
                    setTimeout(() => {
                      setSelectedPlanIdToEdit(targetPlan.id);
                      setPlanEditForm(JSON.parse(JSON.stringify(targetPlan)));
                    }, 0);
                  }
                }
                return null;
              })()}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Select Production Plan to Edit / Overwrite:
                  </label>
                  <select
                    value={selectedPlanIdToEdit}
                    onChange={(e) => handleSelectPlanToEdit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  >
                    {(state.productionPlans || []).length === 0 && (
                      <option value="">No Production Plans Found in Database</option>
                    )}
                    {(state.productionPlans || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} - {p.product} (Job: {p.jobId}) - Status: {p.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-4 sm:mt-0 flex-wrap">
                  {planEditForm && (
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(planEditForm.id)}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Selected Plan [{planEditForm.id}]
                    </button>
                  )}
                  {(state.productionPlans || []).some((p) => p.status === 'Completed' || p.status === 'Cancelled') && (
                    <button
                      type="button"
                      onClick={handlePurgeCompletedPlans}
                      className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                      title="Purge Completed & Cancelled Production Plans"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Purge Completed/Cancelled
                    </button>
                  )}
                  {(state.productionPlans || []).length > 0 && (
                    <button
                      type="button"
                      onClick={handlePurgeAllPlans}
                      className="px-3 py-2 bg-rose-800 hover:bg-rose-900 text-white font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                      title="Expunge all production plans permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Purge ALL ({state.productionPlans.length}) Plans
                    </button>
                  )}
                </div>
              </div>

              {planEditForm ? (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h5 className="text-xs font-black text-slate-800 uppercase m-0 flex items-center gap-1.5">
                      <span>Editing Plan: {planEditForm.id}</span>
                    </h5>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(planEditForm.id)}
                      className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-[11px] rounded transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Delete This Plan
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-blue-900 uppercase mb-1">
                        Plan ID:
                      </label>
                      <input
                        type="text"
                        value={planEditForm.id}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, id: e.target.value })}
                        className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-xs font-bold text-slate-800 bg-blue-50/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Job ID (Linked Job):
                      </label>
                      <input
                        type="text"
                        value={planEditForm.jobId}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, jobId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Plan Status:
                      </label>
                      <select
                        value={planEditForm.status}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, status: e.target.value as any })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      >
                        <option value="Scheduled">Scheduled (PLANNED)</option>
                        <option value="In-Progress">In-Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Product:
                      </label>
                      <select
                        value={planEditForm.product}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, product: e.target.value as any })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      >
                        {productsList.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Layers:</label>
                      <input
                        type="number"
                        value={planEditForm.targetLayers || 0}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, targetLayers: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Length (M):</label>
                      <input
                        type="number"
                        value={planEditForm.targetLengthMeters || 0}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, targetLengthMeters: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target GSM:</label>
                      <input
                        type="text"
                        value={planEditForm.targetGsm || ''}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, targetGsm: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Paper Brand:</label>
                      <input
                        type="text"
                        value={planEditForm.paperBrand || ''}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, paperBrand: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Glue Brand:</label>
                      <input
                        type="text"
                        value={planEditForm.adhesiveBrand || ''}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, adhesiveBrand: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Scrap Limit (%):</label>
                      <input
                        type="number"
                        step={0.1}
                        value={planEditForm.targetScrapLimitPct || 0}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, targetScrapLimitPct: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Qty (Pcs):</label>
                      <input
                        type="number"
                        value={planEditForm.targetQuantity || 0}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, targetQuantity: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="adminPrintedRollRequired"
                        checked={planEditForm.printedRollRequired || false}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, printedRollRequired: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                      />
                      <label htmlFor="adminPrintedRollRequired" className="text-xs font-extrabold text-slate-700 uppercase cursor-pointer">
                        Requires Printed Roll?
                      </label>
                    </div>
                    {planEditForm.printedRollRequired && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Printed Brand / Design Name</label>
                          <input
                            type="text"
                            value={planEditForm.printedRollDesign || ''}
                            onChange={(e) => setPlanEditForm({ ...planEditForm, printedRollDesign: e.target.value })}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Printed Layers</label>
                          <input
                            type="number"
                            min={1}
                            value={planEditForm.printedLayersCount || 2}
                            onChange={(e) => setPlanEditForm({ 
                              ...planEditForm, 
                              printedLayersCount: Number(e.target.value),
                              plainLayersCount: planEditForm.targetLayers - Number(e.target.value) 
                            })}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Plain Layers</label>
                          <input
                            type="number"
                            disabled
                            value={planEditForm.plainLayersCount || (planEditForm.targetLayers - (planEditForm.printedLayersCount || 2))}
                            className="w-full px-2 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-500 cursor-not-allowed"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Allocated Machine:</label>
                      <input
                        type="text"
                        value={planEditForm.assignedMachine || ''}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, assignedMachine: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(planEditForm.id)}
                      className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Plan
                    </button>

                    <button
                      type="button"
                      onClick={handleSavePlanEdit}
                      className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Save Master Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  No Production Plan selected or available in database.
                </div>
              )}

              {/* PRODUCTION PLANS MASTER LIST TABLE WITH DIRECT DELETE BUTTONS */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h5 className="text-xs font-black text-slate-900 uppercase m-0 flex items-center gap-2">
                    <span>All Production Plans Master List ({state.productionPlans?.length || 0})</span>
                  </h5>
                  <span className="text-[11px] text-slate-500 font-medium">
                    1-Click Delete or Edit any plan directly
                  </span>
                </div>

                {(state.productionPlans || []).length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 font-medium bg-slate-50 rounded-lg border border-slate-200">
                    No active production plans in factory database.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-80 border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Plan ID</th>
                          <th className="p-2.5">Job ID</th>
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5">Target Layers / Length</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {(state.productionPlans || []).map((p) => (
                          <tr
                            key={p.id}
                            className={`hover:bg-slate-50 transition ${
                              selectedPlanIdToEdit === p.id ? 'bg-blue-50/60 font-semibold' : ''
                            }`}
                          >
                            <td className="p-2.5 font-bold text-blue-900">{p.id}</td>
                            <td className="p-2.5 font-mono text-slate-700">{p.jobId}</td>
                            <td className="p-2.5 font-bold">{p.product}</td>
                            <td className="p-2.5">
                              {p.targetLayers} L | {p.targetLengthMeters} M ({p.paperBrand || 'Std'})
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  p.status === 'Completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : p.status === 'In-Progress'
                                    ? 'bg-blue-100 text-blue-800 font-extrabold'
                                    : p.status === 'Cancelled'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSelectPlanToEdit(p.id)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold transition cursor-pointer"
                                  title="Edit plan master parameters"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePlan(p.id)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                  title="Delete plan from database"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          {masterSubTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    placeholder="Search logs by Job ID, Action text, Worker or Machine..."
                    className="w-full bg-white px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-600">Stage:</span>
                  <select
                    value={logFilterStage}
                    onChange={(e) => setLogFilterStage(e.target.value)}
                    className="bg-white px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold outline-none"
                  >
                    <option value="">All Stages</option>
                    <option value="Slitting">Slitting</option>
                    <option value="Cutting">Cutting</option>
                    <option value="Forming">Forming</option>
                    <option value="QC">QC</option>
                    <option value="Packing">Packing</option>
                    <option value="Dispatch">Dispatch</option>
                    <option value="Admin Master">Admin Master</option>
                  </select>
                  {filteredLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePurgeFilteredLogs}
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                      title="Purge only the currently filtered logs"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Purge Filtered ({filteredLogs.length})
                    </button>
                  )}
                  {(state.logs || []).length > 0 && (
                    <button
                      type="button"
                      onClick={handlePurgeAllLogs}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                      title="Expunge all audit logs permanently"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Purge ALL ({state.logs.length}) Logs
                    </button>
                  )}
                </div>
              </div>

              {/* Log Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[11px] sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Date / Time</th>
                      <th className="p-2.5">Job / Order</th>
                      <th className="p-2.5">Stage</th>
                      <th className="p-2.5">Machine</th>
                      <th className="p-2.5">Action Details</th>
                      <th className="p-2.5">Worker</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredLogs.map(({ log, originalIndex }) => (
                      <tr key={originalIndex} className="hover:bg-slate-50 transition">
                        <td className="p-2.5 whitespace-nowrap text-slate-500 text-[11px]">
                          {log.timestamp || log.rawDate || '-'}
                        </td>
                        <td className="p-2.5 font-bold text-blue-900 whitespace-nowrap">
                          {log.jobId || '-'}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-800">
                            {log.stage}
                          </span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap font-semibold">{log.machine || '-'}</td>
                        <td className="p-2.5 text-slate-800 max-w-xs truncate" title={log.action}>
                          {log.action}
                        </td>
                        <td className="p-2.5 whitespace-nowrap font-bold text-slate-900">
                          {log.worker || log.user}
                        </td>
                        <td className="p-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditLog(originalIndex)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                              title="Edit this log entry"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLogEntry(originalIndex)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Delete this log entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400">
                          No matching logs found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* SUB-TAB E: AUTO-NUMBERING & BATCH PREFIX MASTER */}
          {/* ------------------------------------------------------------- */}
          {masterSubTab === 'numbering' && (
            <div className="space-y-6">
              {/* Header & Quick Action Card */}
              <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-900/40">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      Traceability Architecture & Sequence Master
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-white m-0">
                      Auto-Numbering & Batch Prefix Master
                    </h3>
                    <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl leading-relaxed">
                      Configure Prefix formatting, padding digit length (e.g., 3-digit <span className="font-mono text-amber-300">001</span> vs 4-digit <span className="font-mono text-amber-300">0001</span>), and Next Sequence Counters across all manufacturing stages with unified traceability hierarchy.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleRepairAndSyncSequences}
                      className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
                      title="Scan IndexedDB, standardize legacy rogue batch IDs to parent lot, and sync counters safely past highest existing IDs."
                    >
                      <RotateCcw className="w-4 h-4 text-amber-400" />
                      Reset Counter / Repair Collision
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNumberingMaster}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30"
                    >
                      <Save className="w-4 h-4" />
                      Save Numbering Master
                    </button>
                  </div>
                </div>

                {/* Live Architecture Lineage Hierarchy Banner */}
                <div className="mt-6 pt-5 border-t border-indigo-800/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
                      1. Parent Job / Master Lot
                    </div>
                    <div className="font-mono font-black text-sm text-emerald-300 truncate">
                      {!numberingForm.useGlobalJobPrefix ? 'SPN' : numberingForm.jobSeries.prefix}-{String(numberingForm.jobSeries.nextSeq).padStart(numberingForm.jobSeries.paddingDigits, '0')}
                    </div>
                    <div className="text-[10px] text-indigo-200/60 mt-0.5">Primary Root Lot ID</div>
                  </div>

                  <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
                      2. Slitted Mother Reel Run
                    </div>
                    <div className="font-mono font-black text-sm text-cyan-300 truncate">
                      [LOT]-{numberingForm.slitSeries.prefix}-{String(numberingForm.slitSeries.nextSeq).padStart(numberingForm.slitSeries.paddingDigits, '0')}
                    </div>
                    <div className="text-[10px] text-indigo-200/60 mt-0.5">e.g. WK-LOT-001-SLIT-01</div>
                  </div>

                  <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
                      3. Blank Punching / Cutting Crate
                    </div>
                    <div className="font-mono font-black text-sm text-amber-300 truncate">
                      [LOT]-{numberingForm.cutSeries.prefix}-{String(numberingForm.cutSeries.nextSeq).padStart(numberingForm.cutSeries.paddingDigits, '0')}
                    </div>
                    <div className="text-[10px] text-indigo-200/60 mt-0.5">e.g. WK-LOT-001-CUT-01</div>
                  </div>

                  <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/10">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
                      4. QC Stage Inspection Lot
                    </div>
                    <div className="font-mono font-black text-sm text-purple-300 truncate">
                      [LOT]-{numberingForm.qcSeries.prefix}-{String(numberingForm.qcSeries.nextSeq).padStart(numberingForm.qcSeries.paddingDigits, '0')}
                    </div>
                    <div className="text-[10px] text-indigo-200/60 mt-0.5">e.g. WK-LOT-001-QC-01</div>
                  </div>
                </div>
              </div>

              {/* Grid of Configuration Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Job ID Master Series */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-indigo-300 transition-colors">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-800 uppercase m-0">
                          Job ID Master Series
                        </h4>
                        <span className="text-[11px] text-slate-500">Root production lot number configuration</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                      LIVE PREVIEW: {!numberingForm.useGlobalJobPrefix ? 'SPN' : numberingForm.jobSeries.prefix}-{String(numberingForm.jobSeries.nextSeq).padStart(numberingForm.jobSeries.paddingDigits, '0')}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Global Prefix Code:
                      </label>
                      <input
                        type="text"
                        value={numberingForm.jobSeries.prefix}
                        disabled={!numberingForm.useGlobalJobPrefix}
                        onChange={(e) =>
                          setNumberingForm({
                            ...numberingForm,
                            jobSeries: { ...numberingForm.jobSeries, prefix: e.target.value.toUpperCase().trim() }
                          })
                        }
                        placeholder="e.g. WK-LOT or JOB"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 disabled:opacity-50 outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <input
                        type="checkbox"
                        id="useProductPrefixCheck"
                        checked={!numberingForm.useGlobalJobPrefix}
                        onChange={(e) =>
                          setNumberingForm({
                            ...numberingForm,
                            useGlobalJobPrefix: !e.target.checked
                          })
                        }
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="useProductPrefixCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                        Use Product-specific prefix (e.g. <span className="font-mono font-bold text-indigo-600">SPN, FRK, TBL</span>) instead of single global prefix
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Padding Digits:
                        </label>
                        <select
                          value={numberingForm.jobSeries.paddingDigits}
                          onChange={(e) =>
                            setNumberingForm({
                              ...numberingForm,
                              jobSeries: { ...numberingForm.jobSeries, paddingDigits: Number(e.target.value) }
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                        >
                          <option value={3}>3 Digits (001 - 999)</option>
                          <option value={4}>4 Digits (0001 - 9999)</option>
                          <option value={5}>5 Digits (00001 - 99999)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Next Sequence Counter:
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={numberingForm.jobSeries.nextSeq}
                          onChange={(e) =>
                            setNumberingForm({
                              ...numberingForm,
                              jobSeries: { ...numberingForm.jobSeries, nextSeq: Math.max(1, Number(e.target.value) || 1) }
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Slitting Sub-Batch Series */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-cyan-300 transition-colors">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600">
                        <Scissors className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-800 uppercase m-0">
                          Slitting Run Series
                        </h4>
                        <span className="text-[11px] text-slate-500">Sub-lot code for slitted reels</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-cyan-50 text-cyan-800 border border-cyan-200">
                      LIVE PREVIEW: [LOT]-{numberingForm.slitSeries.prefix}-{String(numberingForm.slitSeries.nextSeq).padStart(numberingForm.slitSeries.paddingDigits, '0')}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Stage Tag / Sub-Prefix:
                      </label>
                      <input
                        type="text"
                        value={numberingForm.slitSeries.prefix}
                        onChange={(e) =>
                          setNumberingForm({
                            ...numberingForm,
                            slitSeries: { ...numberingForm.slitSeries, prefix: e.target.value.toUpperCase().trim() }
                          })
                        }
                        placeholder="e.g. SLIT"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Padding Digits:
                        </label>
                        <select
                          value={numberingForm.slitSeries.paddingDigits}
                          onChange={(e) =>
                            setNumberingForm({
                              ...numberingForm,
                              slitSeries: { ...numberingForm.slitSeries, paddingDigits: Number(e.target.value) }
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                        >
                          <option value={2}>2 Digits (01 - 99)</option>
                          <option value={3}>3 Digits (001 - 999)</option>
                          <option value={4}>4 Digits (0001 - 9999)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Default Next Counter:
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={numberingForm.slitSeries.nextSeq}
                          onChange={(e) =>
                            setNumberingForm({
                              ...numberingForm,
                              slitSeries: { ...numberingForm.slitSeries, nextSeq: Math.max(1, Number(e.target.value) || 1) }
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-cyan-500 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Cutting Crate Series */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-amber-300 transition-colors">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                        <Box className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-800 uppercase m-0">
                          Cutting Crate Series
                        </h4>
                        <span className="text-[11px] text-slate-500">Punching blanks & crate ID code</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-amber-50 text-amber-800 border border-amber-200">
                      LIVE PREVIEW: [LOT]-{numberingForm.cutSeries.prefix}-{String(numberingForm.cutSeries.nextSeq).padStart(numberingForm.cutSeries.paddingDigits, '0')}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Stage Tag / Sub-Prefix:
                      </label>
                      <input
                        type="text"
                        value={numberingForm.cutSeries.prefix}
                        onChange={(e) =>
                          setNumberingForm({
                            ...numberingForm,
                            cutSeries: { ...numberingForm.cutSeries, prefix: e.target.value.toUpperCase().trim() }
                          })
                        }
                        placeholder="e.g. CUT"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Padding Digits:
                        </label>
                        <select
                          value={numberingForm.cutSeries.paddingDigits}
                          onChange={(e) =>
                            setNumberingForm({
                              ...numberingForm,
                              cutSeries: { ...numberingForm.cutSeries, paddingDigits: Number(e.target.value) }
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                        >
                          <option value={2}>2 Digits (01 - 99)</option>
                          <option value={3}>3 Digits (001 - 999)</option>
                          <option value={4}>4 Digits (0001 - 9999)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Default Next Counter:
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={numberingForm.cutSeries.nextSeq}
                          onChange={(e) =>
                            setNumberingForm({
                              ...numberingForm,
                              cutSeries: { ...numberingForm.cutSeries, nextSeq: Math.max(1, Number(e.target.value) || 1) }
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. QC Inspection Stage Series */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-purple-300 transition-colors">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
                        <SearchCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-800 uppercase m-0">
                          QC Inspection Lot Series
                        </h4>
                        <span className="text-[11px] text-slate-500">Quality inspection audit code</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-black bg-purple-50 text-purple-800 border border-purple-200">
                      LIVE PREVIEW: [LOT]-{numberingForm.qcSeries.prefix}-{String(numberingForm.qcSeries.nextSeq).padStart(numberingForm.qcSeries.paddingDigits, '0')}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Stage Tag / Sub-Prefix:
                      </label>
                      <input
                        type="text"
                        value={numberingForm.qcSeries.prefix}
                        onChange={(e) =>
                          setNumberingForm({
                            ...numberingForm,
                            qcSeries: { ...numberingForm.qcSeries, prefix: e.target.value.toUpperCase().trim() }
                          })
                        }
                        placeholder="e.g. QC"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-purple-500 focus:bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Padding Digits:
                        </label>
                        <select
                          value={numberingForm.qcSeries.paddingDigits}
                          onChange={(e) =>
                            setNumberingForm({
                              ...numberingForm,
                              qcSeries: { ...numberingForm.qcSeries, paddingDigits: Number(e.target.value) }
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-purple-500 focus:bg-white"
                        >
                          <option value={2}>2 Digits (01 - 99)</option>
                          <option value={3}>3 Digits (001 - 999)</option>
                          <option value={4}>4 Digits (0001 - 9999)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Default Next Counter:
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={numberingForm.qcSeries.nextSeq}
                          onChange={(e) =>
                            setNumberingForm({
                              ...numberingForm,
                              qcSeries: { ...numberingForm.qcSeries, nextSeq: Math.max(1, Number(e.target.value) || 1) }
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-purple-500 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Collision Repair & IndexedDB Integrity Card */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-extrabold text-amber-950 uppercase m-0">
                      IndexedDB Auto-Repair & Collision Synchronization Engine
                    </h5>
                    <p className="text-xs text-amber-800 mt-1 max-w-2xl leading-relaxed">
                      If legacy random batch identifiers (<code className="font-mono bg-amber-200/60 px-1 py-0.5 rounded text-[11px]">B-XXXX</code>) or conflicting numbers exist in browser storage, clicking below will scan all active jobs, standardize sub-batches into their parent lot hierarchy, and push counters ahead to prevent any duplicate key errors.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRepairAndSyncSequences}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 shrink-0 shadow-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  Run Sequence Repair Now
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* SUB-TAB: DELETION VAULT & RECYCLE BIN */}
          {/* ------------------------------------------------------------- */}
          {masterSubTab === 'vault' && (
            <div className="space-y-4">
              <div className="bg-linear-to-r from-slate-900 via-rose-950 to-slate-900 rounded-2xl p-5 text-white shadow-xl border border-rose-900/40">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-base font-black m-0 flex items-center gap-2">
                      🗑️ Deletion Vault & Recycle Bin (डेटा रिकवरी वॉल्ट)
                    </h3>
                    <p className="text-xs text-rose-200 mt-1 m-0">
                      All deleted jobs, plans, shift handovers, and orders are securely archived here. Inspect who deleted them under which login, and restore them instantly.
                    </p>
                  </div>
                  <div className="bg-rose-950/80 border border-rose-700/50 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-200">
                    Archived Items: {(state.deletedVaultItems || []).length}
                  </div>
                </div>
              </div>

              {(state.deletedVaultItems || []).length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                  <span className="text-3xl block mb-2">✨</span>
                  <p className="text-sm font-bold text-slate-700">Deletion Vault is Clean</p>
                  <p className="text-xs text-slate-400">No records have been deleted in this session, or the vault is empty.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(state.deletedVaultItems || []).map((vaultItem) => (
                    <div key={vaultItem.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between flex-wrap gap-4 hover:border-rose-300 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800">
                            {vaultItem.type}
                          </span>
                          <span className="font-mono text-xs font-black text-slate-800">{vaultItem.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({vaultItem.originalId})</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span>👤 Deleted By Login: <strong className="text-slate-800">{vaultItem.deletedBy}</strong></span>
                          <span>🕒 Timestamp: <strong className="text-slate-800">{vaultItem.deletedAt}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(`Restore [${vaultItem.title}] back to active factory database?`)) return;
                            let nextState = { ...state };
                            if (vaultItem.type === 'JOB') {
                              const restoredJob = vaultItem.data?.job;
                              const restoredPlan = vaultItem.data?.productionPlan;
                              if (restoredJob) {
                                nextState.jobs = [restoredJob, ...(nextState.jobs || [])];
                                nextState.deletedJobIds = (nextState.deletedJobIds || []).filter(id => id !== restoredJob.id);
                              }
                              if (restoredPlan) {
                                nextState.productionPlans = [restoredPlan, ...(nextState.productionPlans || [])];
                                nextState.deletedPlanIds = (nextState.deletedPlanIds || []).filter(id => id !== restoredPlan.id);
                              }
                            } else if (vaultItem.type === 'SHIFT_HANDOVER') {
                              const restoredHo = vaultItem.data;
                              if (restoredHo) {
                                nextState.shiftHandovers = [restoredHo, ...(nextState.shiftHandovers || [])];
                              }
                            }
                            nextState.deletedVaultItems = (nextState.deletedVaultItems || []).filter(v => v.id !== vaultItem.id);
                            onSaveState(nextState);
                            alert(`✅ Successfully restored [${vaultItem.title}] to active production database!`);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold transition shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          🔄 Restore / Recover
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(`Permanently delete [${vaultItem.title}] from vault? This cannot be undone.`)) return;
                            const nextVault = (state.deletedVaultItems || []).filter(v => v.id !== vaultItem.id);
                            onSaveState({
                              ...state,
                              deletedVaultItems: nextVault
                            });
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          🗑️ Permanent Purge
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
                WhatsApp Live Shift Changeover & Machine Reports (WhatsApp Shift Changeover Reports)
              </h4>
              <p className="text-xs text-slate-500 m-0">
                Daily Shift Changeover hone ke baad all machines ke short reports with Operator names WhatsApp par auto/manual bhejein.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSendShiftWhatsApp('DAY')}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>☀️ Send Day Shift Report</span>
              </button>
              <button
                type="button"
                onClick={() => handleSendShiftWhatsApp('NIGHT')}
                className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>🌙 Send Night Shift Report</span>
              </button>
            </div>
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h5 className="text-xs font-black text-slate-900 uppercase m-0 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  WhatsApp API Configuration
                </h5>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Target WhatsApp Number (With Country Code)</label>
                    <input type="text" value={waPhone} onChange={e => setWaPhone(e.target.value)} placeholder="+919876543210" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">API Key / Token</label>
                    <input type="password" value={waApiKey} onChange={e => setWaApiKey(e.target.value)} placeholder="Enter API Key" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none" />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                <h5 className="text-xs font-black text-indigo-900 uppercase m-0 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  Automated Reporting Triggers
                </h5>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={waAutoDay} onChange={e => setWaAutoDay(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-xs font-bold text-indigo-900">Auto-Send Day Shift Report</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={waAutoNight} onChange={e => setWaAutoNight(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-xs font-bold text-indigo-900">Auto-Send Night Shift Report</span>
                  </label>
                </div>
                <div className="pt-2 border-t border-indigo-200">
                  <button type="button" onClick={handleSaveWhatsAppConfig} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow transition">Save WhatsApp Configuration</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: MAINTENANCE MASTER & RIGHTS STATE */}
      {/* ========================================================================= */}
      {activeTab === 'maintenance_master' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
                🔧 Maintenance Desk Master & Rights Suite
              </h4>
              <p className="text-xs text-slate-500 m-0">
                Admin controls for Maintenance Desk permissions, technician directory, spare parts catalogue, and roll yield limits.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveMaintenanceMaster}
              className="px-4 py-2 bg-[#1a365d] hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Maintenance Masters</span>
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Maintenance Rights Assignment */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h5 className="text-xs font-black text-slate-900 uppercase m-0 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-blue-600" />
                  Maintenance Rights Quick-Grant
                </h5>
              </div>
              <p className="text-[11px] text-slate-600 m-0">
                Select an active user to immediately grant or revoke full Maintenance Desk operational rights:
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {Object.keys(usersRecord).map((userKey) => {
                  const u = usersRecord[userKey];
                  if (u.role === 'ADMIN') return null;
                  const hasRights = u.perms.includes('MAINTENANCE_LOGS') && u.perms.includes('MAINTENANCE_RESOLVE');
                  return (
                    <div key={userKey} className="flex flex-col gap-2 p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{u.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{userKey}</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${hasRights ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                          {hasRights ? 'GRANTED' : 'NO ACCESS'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={hasRights}
                          onClick={() => handleGrantAllMaintenanceRightsToUser(userKey)}
                          className={`flex-1 py-1 rounded text-[10px] font-bold transition ${hasRights ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer'}`}
                        >
                          Grant Access
                        </button>
                        <button
                          type="button"
                          disabled={!hasRights}
                          onClick={() => handleRevokeMaintenanceRightsFromUser(userKey)}
                          className={`flex-1 py-1 rounded text-[10px] font-bold transition ${!hasRights ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer'}`}
                        >
                          Revoke Access
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Technicians Master Directory */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h5 className="text-xs font-black text-slate-900 uppercase m-0 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Maintenance Team Directory ({maintenanceContacts.length})
                </h5>
              </div>
              <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newTechName}
                    onChange={(e) => setNewTechName(e.target.value)}
                    placeholder="Name (e.g. Mukesh Kumar)"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
                  />
                  <input
                    type="text"
                    value={newTechPhone}
                    onChange={(e) => setNewTechPhone(e.target.value)}
                    placeholder="Phone (e.g. +91 98...)"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
                  />
                  <input
                    type="text"
                    value={newTechRole}
                    onChange={(e) => setNewTechRole(e.target.value)}
                    placeholder="Role (e.g. Sr. Fitter)"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
                  />
                  <select
                    value={newTechDept}
                    onChange={(e) => setNewTechDept(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
                  >
                    <option value="Mechanical">Mechanical</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Pneumatic">Pneumatic</option>
                    <option value="Tooling">Tooling</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddTech}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Team Member
                </button>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {maintenanceContacts.map((tech, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col p-2 bg-white rounded-lg border border-slate-200 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1">
                      <span className="font-extrabold text-slate-800">{tech.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTech(idx)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                      <div><span className="font-bold text-slate-700">Phone:</span> {tech.phone}</div>
                      <div><span className="font-bold text-slate-700">Dept:</span> {tech.dept}</div>
                      <div className="col-span-2"><span className="font-bold text-slate-700">Role:</span> {tech.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Spare Parts & Settings */}
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h5 className="text-xs font-black text-slate-900 uppercase m-0 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-purple-600" />
                    Common Spare Parts Catalogue
                  </h5>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPartName}
                    onChange={(e) => setNewPartName(e.target.value)}
                    placeholder="e.g. 50mm Heater Band"
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddSparePart}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {maintSpareParts.map((part, idx) => (
                    <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 text-xs">
                      {editingSparePartIdx === idx ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingSparePartText}
                            onChange={(e) => setEditingSparePartText(e.target.value)}
                            className="flex-1 px-2 py-1 bg-purple-50 border border-purple-300 rounded text-xs font-bold text-slate-800 outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditSparePart(idx);
                              if (e.key === 'Escape') handleCancelEditSparePart();
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditSparePart(idx)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition cursor-pointer"
                            title="Save Changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditSparePart}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded transition cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{part}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditSparePart(idx)}
                              className="text-slate-400 hover:text-blue-600 p-1 rounded transition cursor-pointer hover:bg-blue-50"
                              title="Edit Part Name"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSparePart(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer hover:bg-rose-50"
                              title="Delete Part"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h5 className="text-xs font-black text-slate-900 uppercase m-0 flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-slate-600" />
                    Production Limits
                  </h5>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Max Pieces Per Slit Roll</label>
                  <input type="number" value={maxRollPieces} onChange={(e) => setMaxRollPieces(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800" />
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={strictRollAudit} onChange={e => setStrictRollAudit(e.target.checked)} className="rounded" />
                  <span className="text-xs font-bold text-slate-800">Strict Roll Audit Yield Validation</span>
                </label>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 4 & 5. OPERATIONAL PAUSE & BREAKDOWN DROPDOWN REASONS MASTER */}
            {/* ========================================================================= */}
            <div className="col-span-1 lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              
              {/* 4. Operational Pause Reasons Master */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-blue-600" />
                    <div>
                      <h5 className="text-xs font-black text-slate-900 uppercase m-0">
                        ☕ Operational Pause Dropdown Options ({pauseReasons.length})
                      </h5>
                      <p className="text-[10px] text-slate-500 m-0">
                        Meal/Tea Breaks & Routine Pauses (No breakdown tickets created)
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleResetPauseReasonsToDefault}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition"
                      title="Reset to factory default pause reasons"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset Defaults
                    </button>
                  )}
                </div>

                {isAdmin ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPauseReasonInput}
                      onChange={(e) => setNewPauseReasonInput(e.target.value)}
                      placeholder="e.g. Afternoon Tea Break (15 Min)"
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPauseReason();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddPauseReason}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Reason
                    </button>
                  </div>
                ) : (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 font-medium">
                    🔒 Admin rights required to add or edit Operational Pause dropdown options.
                  </div>
                )}

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {pauseReasons.map((reason, idx) => (
                    <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 text-xs">
                      {editingPauseReasonIdx === idx ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingPauseReasonText}
                            onChange={(e) => setEditingPauseReasonText(e.target.value)}
                            className="flex-1 px-2 py-1 bg-blue-50 border border-blue-300 rounded text-xs font-bold text-slate-800 outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditPauseReason(idx);
                              if (e.key === 'Escape') handleCancelEditPauseReason();
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditPauseReason(idx)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition cursor-pointer"
                            title="Save Changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditPauseReason}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded transition cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 font-black text-[10px] flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-800">{reason}</span>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditPauseReason(idx)}
                                className="text-slate-400 hover:text-blue-600 p-1 rounded transition cursor-pointer hover:bg-blue-50"
                                title="Edit Reason"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePauseReason(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer hover:bg-rose-50"
                                title="Delete Reason"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Department Breakdown Faults Master */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <div>
                      <h5 className="text-xs font-black text-slate-900 uppercase m-0">
                        🛑 Department Breakdown Faults Master ({currentDeptFaults.length})
                      </h5>
                      <p className="text-[10px] text-slate-500 m-0">
                        Technical fault dropdown reasons mapped per department
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleResetFaultReasonsToDefault}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition"
                      title="Reset to factory default breakdown reasons"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset Defaults
                    </button>
                  )}
                </div>

                {/* Department Selector Tabs */}
                <div className="flex flex-wrap gap-1.5 bg-white p-1.5 rounded-lg border border-slate-200">
                  {['Cutting', 'Forming', 'Slitting', 'Packing', 'QC', 'General'].map((dept) => {
                    const count = (breakdownReasonsMap[dept] || []).length;
                    const isSelected = selectedBreakdownDept === dept;
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => {
                          setSelectedBreakdownDept(dept);
                          setEditingFaultReasonIdx(null);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span>{dept}</span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-black ${
                          isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {isAdmin ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFaultReasonInput}
                      onChange={(e) => setNewFaultReasonInput(e.target.value)}
                      placeholder={`Add new ${selectedBreakdownDept} breakdown reason...`}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFaultReason();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddFaultReason}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Fault
                    </button>
                  </div>
                ) : (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 font-medium">
                    🔒 Admin rights required to add or edit Breakdown fault reasons.
                  </div>
                )}

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {currentDeptFaults.map((fault, idx) => (
                    <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 text-xs">
                      {editingFaultReasonIdx === idx ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingFaultReasonText}
                            onChange={(e) => setEditingFaultReasonText(e.target.value)}
                            className="flex-1 px-2 py-1 bg-rose-50 border border-rose-300 rounded text-xs font-bold text-slate-800 outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditFaultReason(idx);
                              if (e.key === 'Escape') handleCancelEditFaultReason();
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditFaultReason(idx)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition cursor-pointer"
                            title="Save Changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditFaultReason}
                            className="p-1 text-slate-400 hover:bg-slate-100 rounded transition cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-rose-50 text-rose-700 font-black text-[10px] flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-800">{fault}</span>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditFaultReason(idx)}
                                className="text-slate-400 hover:text-blue-600 p-1 rounded transition cursor-pointer hover:bg-blue-50"
                                title="Edit Fault Reason"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveFaultReason(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer hover:bg-rose-50"
                                title="Delete Fault Reason"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* TAB 4: NUMBERING SEQUENCES, SHIFTS & MASTER PIN */}
      {/* ========================================================================= */}
      {activeTab === 'sequences_shifts' && (
        <form onSubmit={handleSaveSequencesAndShifts} className="space-y-6">
          <div>
            <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
              Numbering Sequences, Shift Timings & Master PIN
            </h4>
            <p className="text-xs text-slate-500 m-0">
              Configure automatic Job ID prefixes, Next Sequence numbers, Shift Day/Night times and Admin PIN
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Numbering Sequences */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h5 className="text-xs font-extrabold text-slate-800 uppercase m-0 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-600" />
                Product Job Numbering Next Counters:
              </h5>

              <div className="grid grid-cols-2 gap-2">
                {(productsList && productsList.length > 0 ? productsList : PRODUCTS).map((prod) => {
                  const pfx = state.productPrefixMap?.[prod] || PRODUCT_PREFIX_MAP[prod as ProductType] || prod.slice(0, 3).toUpperCase();
                  return (
                    <div key={prod} className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-700 uppercase truncate">
                          {prod}
                        </label>
                        <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded border border-blue-200">
                          {pfx}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={productSeqs[prod] || 1}
                        onChange={(e) =>
                          setProductSeqs({
                            ...productSeqs,
                            [prod]: Math.max(1, Number(e.target.value) || 1)
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none"
                      />
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Customer Packing Order (ORD-) Next Counter:
                </label>
                <input
                  type="number"
                  value={orderSeq}
                  onChange={(e) => setOrderSeq(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-indigo-900 uppercase">
                    Stage-Wise Batch Lineage & Master Padding
                  </div>
                  <div className="text-[10px] text-indigo-700">
                    Configure Slitting, Cutting, and QC prefix tags, padding digits (001 vs 0001), and collision repairs.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('master_data');
                    setMasterSubTab('numbering');
                  }}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold cursor-pointer shrink-0"
                >
                  Open Prefix Master →
                </button>
              </div>
            </div>

            {/* Shift Timings & Master PIN */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h5 className="text-xs font-extrabold text-slate-800 uppercase m-0 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                Shift Timings & Master PIN
              </h5>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Day Shift Start:</label>
                  <input
                    type="time"
                    value={dayStart}
                    onChange={(e) => setDayStart(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Day Shift End:</label>
                  <input
                    type="time"
                    value={dayEnd}
                    onChange={(e) => setDayEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Night Shift Start:</label>
                  <input
                    type="time"
                    value={nightStart}
                    onChange={(e) => setNightStart(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Night Shift End:</label>
                  <input
                    type="time"
                    value={nightEnd}
                    onChange={(e) => setNightEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-red-700 uppercase mb-1">
                  Master Admin Password / PIN:
                </label>
                <input
                  type="text"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-red-300 rounded-lg text-xs font-extrabold text-red-900 outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#2b6cb0] hover:bg-[#1a365d] text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Configurations & Shift Schedules</span>
          </button>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: DATABASE BACKUP, RESTORE & MODULAR RESET */}
      {/* ========================================================================= */}
      {activeTab === 'backup_restore' && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
              Database Storage Health, Archival & Safe Recovery
            </h4>
            <p className="text-xs text-slate-500 m-0">
              High-capacity IndexedDB persistence with mandatory auto-backup safety protocols.
            </p>
          </div>

          {/* Storage Health & Resilience Telemetry Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-[#1a365d] rounded-2xl p-5 text-white shadow-md border border-slate-700">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center font-black">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Persistence Engine</div>
                  <div className="text-base font-black text-white flex items-center gap-2">
                    <span>{storageHealth?.engine || 'IndexedDB (Enterprise High-Capacity)'}</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                      ACTIVE & PROTECTED
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRunPruning}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-blue-400/30"
                title="Archive historical records older than 30 days to free up operational memory"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Run Archival & Auto-Prune</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block">Current Footprint</span>
                <span className="font-extrabold text-white text-sm">
                  {storageHealth?.usedBytes ? `${(storageHealth.usedBytes / 1024).toFixed(1)} KB` : '< 1 MB'}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Quota: {storageHealth?.quotaBytes ? `${Math.round(storageHealth.quotaBytes / (1024 * 1024))} MB` : '1024 MB'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Operational Records</span>
                <span className="font-extrabold text-white text-sm">
                  {(state.jobs?.length || 0) + (state.packJobs?.length || 0)} Total
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {state.jobs?.length || 0} Jobs, {state.packJobs?.length || 0} Orders
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Audit Logs</span>
                <span className="font-extrabold text-white text-sm">{state.logs?.length || 0} Entries</span>
                <span className="text-[10px] text-slate-400 block">Zero Data Loss Policy</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Cold Archival Records</span>
                <span className="font-extrabold text-white text-sm">
                  {(state.archivedJobs?.length || 0) + (state.archivedLogs?.length || 0)} Archived
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {state.archivedJobs?.length || 0} Jobs, {state.archivedLogs?.length || 0} Logs
                </span>
              </div>
            </div>
          </div>

          {/* Central Sync Bridge (100_2026_V1 Multi-Device Bidirectional Sync) */}
          <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-black">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Central Sync Bridge (100_2026_V1)</div>
                  <div className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>Multi-Device Convergence & Offline Write-Queue</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <Wifi className="w-3 h-3" /> LIVE BIDIRECTIONAL
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualCentralSync}
                  disabled={isSyncingBridge}
                  className="px-4 py-2 bg-[#2b6cb0] hover:bg-[#1a365d] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBridge ? 'animate-spin' : ''}`} />
                  <span>{isSyncingBridge ? 'Synchronizing...' : 'Force Central Sync Now'}</span>
                </button>
              </div>
            </div>

            {syncStatusMsg && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{syncStatusMsg}</span>
              </div>
            )}

            {/* Cloud Real-Time Sync Banner */}
            <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-extrabold">Cloud Database Engine: Firebase Firestore Active</span>
                <span className="text-[11px] text-emerald-700 font-normal">
                  (Permits 100% Real-Time sync on GitHub Pages across different phones & computers)
                </span>
              </div>
              <div className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                Project: {getCloudSyncStatus().projectId} | Device: {getCloudSyncStatus().deviceId}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold block">GitHub Pages & Cloud Sync</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4" /> Live Multi-Device Sync Active
                </span>
                <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                  Entries saved on any phone, tablet, or PC automatically sync via Google Cloud Firestore. No separate Node server required for GitHub Pages.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold block">Offline Write-Queue & IndexedDB</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-extrabold text-slate-900 text-base">{pendingQueueCount}</span>
                  <span className="text-[11px] text-slate-500">entries in local buffer</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                  Entries made during factory floor WiFi dropouts remain securely preserved in browser IndexedDB and automatically flush when connectivity resumes.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold block">Local Express HTTP Sync (Optional)</span>
                <span className="font-mono text-xs text-slate-800 break-all font-semibold block mt-1">
                  {syncEndpoint}
                </span>
                <div className="mt-2 flex items-center gap-2">
                  {!isEditingEndpoint ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEndpointInput(syncEndpoint);
                        setIsEditingEndpoint(true);
                      }}
                      className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit className="w-3 h-3" /> Change HTTP URL
                    </button>
                  ) : (
                    <form onSubmit={handleSaveCustomEndpoint} className="w-full mt-2 space-y-2">
                      <input
                        type="url"
                        value={endpointInput}
                        onChange={(e) => setEndpointInput(e.target.value)}
                        placeholder="https://your-server.com/api/sync/state"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="px-2.5 py-1 bg-blue-600 text-white rounded font-bold text-[11px] cursor-pointer hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingEndpoint(false)}
                          className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded font-bold text-[11px] cursor-pointer hover:bg-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleResetEndpoint}
                          className="text-[11px] text-red-600 hover:underline cursor-pointer ml-auto"
                        >
                          Reset to Default
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-3 shadow-xs">
                  <Download className="w-5 h-5" />
                </div>
                <h5 className="text-sm font-black text-slate-900 uppercase m-0">Manual Backup Export</h5>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Download a complete factory snapshot containing metadata, production jobs, pack orders, and full audit logs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportDatabaseBackup(state)}
                className="mt-5 w-full py-2.5 bg-[#2b6cb0] hover:bg-[#1a365d] text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" /> Download Full JSON Backup
              </button>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-5 flex flex-col justify-between shadow-[inset_0_2px_10px_rgba(16,185,129,0.05)]">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-3 shadow-xs border border-emerald-200">
                  <Upload className="w-5 h-5" />
                </div>
                <h5 className="text-sm font-black text-emerald-950 uppercase m-0">Restore Factory Backup / Undo Reset</h5>
                <p className="text-xs text-emerald-700/80 mt-1.5 leading-relaxed font-medium">
                  Select ANY previously saved JSON backup (including pre-reset Auto-Backups). Restoring validates JSON integrity and requires the Admin Password.
                </p>
              </div>
              <label className="mt-5 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm">
                <Upload className="w-4 h-4" /> Secure JSON Upload & Restore
                <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
              </label>
            </div>
          </div>

          {/* Cascade Deletions Backup Repository */}
          <div className="bg-indigo-50/40 border border-indigo-200 rounded-2xl p-5 mt-6 shadow-[inset_0_2px_10px_rgba(99,102,241,0.02)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-indigo-100 pb-3 mb-4 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-sm font-black text-indigo-950 uppercase m-0">Cascade Deletions Backup Repository</h5>
                  <p className="text-[11px] text-indigo-700 mt-0.5 m-0 font-medium">
                    All cascade deletions of production jobs and plans are securely archived here. You can view, download, or restore them instantly.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!confirm('Are you sure you want to permanently clear the deleted backups history? This cannot be undone.')) return;
                  localStorage.removeItem('paperware_deleted_backups');
                  showToast('🧹 Deleted backups repository cleared successfully.');
                  // force re-render
                  onSaveState({ ...state });
                }}
                className="px-3 py-1.5 text-[10px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold border border-rose-200 hover:border-rose-300 rounded-lg transition self-start sm:self-auto cursor-pointer"
              >
                Clear Repository
              </button>
            </div>

            {(() => {
              const backupsRaw = localStorage.getItem('paperware_deleted_backups');
              const backups = backupsRaw ? JSON.parse(backupsRaw) : [];

              if (backups.length === 0) {
                return (
                  <div className="text-center py-6 text-xs text-slate-500 italic bg-white rounded-xl border border-dashed border-indigo-100">
                    No deleted records in the archive. Every job or plan deletion automatically triggers a secure snapshot backup.
                  </div>
                );
              }

              return (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {backups.map((b: any) => (
                    <div key={b.backupId} className="bg-white border border-indigo-100 rounded-xl p-3.5 shadow-xs flex items-center justify-between text-xs hover:border-indigo-200 transition">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px]">{b.backupId}</span>
                          <span className="font-black text-slate-800">Job: {b.jobId}</span>
                          {b.planId && <span className="text-slate-500 font-semibold">• Plan: {b.planId}</span>}
                          <span className="text-slate-400">• {b.date || 'N/A'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
                          <span>Deleted: <strong>{b.deletedAt}</strong></span>
                          <span>• By: <strong>{b.deletedBy}</strong></span>
                          <span>• Active Runs Purged: <strong className="text-indigo-700">{b.job?.runningBatches?.length || 0} batches</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Backup_Deleted_${b.jobId}_${b.backupId}.json`;
                            a.click();
                          }}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
                          title="Download JSON Snapshot"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(`Are you sure you want to RESTORE Job [${b.jobId}] and Plan [${b.planId}] from backup #${b.backupId}?\nThis will recreate the plan and job records back to the factory database.`)) return;
                            
                            const nextJobs = [...state.jobs];
                            if (b.job && !nextJobs.some(j => j.id === b.jobId)) {
                              nextJobs.push(b.job);
                            }

                            const nextPlans = [...(state.productionPlans || [])];
                            if (b.productionPlan && !nextPlans.some(p => p.id === b.planId)) {
                              nextPlans.push(b.productionPlan);
                            }

                            // Remove from deleted list
                            const nextDeletedJobs = (state.deletedJobIds || []).filter(id => id !== b.jobId);
                            const nextDeletedPlans = (state.deletedPlanIds || []).filter(id => id !== b.planId);

                            const newLog: LogEntry = {
                              jobId: b.jobId,
                              stage: 'Admin Master',
                              machine: 'BACKUP-RESTORE',
                              shift: 'DAY',
                              action: `🔄 Restored Job [${b.jobId}] & Plan [${b.planId}] from Cascade Backup Archive #${b.backupId}`,
                              worker: 'ADMIN',
                              user: currentUser?.username || 'admin',
                              rawDate: new Date().toISOString().split('T')[0],
                              timestamp: new Date().toLocaleString()
                            };

                            onSaveState({
                              ...state,
                              jobs: nextJobs,
                              productionPlans: nextPlans,
                              deletedJobIds: nextDeletedJobs,
                              deletedPlanIds: nextDeletedPlans,
                              logs: [...state.logs, newLog]
                            });

                            // remove this backup from localStorage list
                            const updatedBackups = backups.filter((bk: any) => bk.backupId !== b.backupId);
                            localStorage.setItem('paperware_deleted_backups', JSON.stringify(updatedBackups));

                            showToast(`✅ Successfully Restored Job [${b.jobId}] and production plan!`);
                          }}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] transition cursor-pointer shadow-xs"
                        >
                          Restore Data
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="mt-6 border border-rose-200 bg-rose-50/30 rounded-2xl overflow-hidden">
            <div className="bg-rose-100/50 border-b border-rose-200 p-4">
              <h5 className="text-sm font-black text-rose-950 flex items-center gap-2 uppercase">
                <RotateCcw className="w-4 h-4 text-rose-600" /> Modular Reset Console
              </h5>
              <p className="text-[11px] font-medium text-rose-700 mt-1 leading-tight">
                Mandatory Auto-Backup applies to all actions. A factory state snapshot will be downloaded to your device before any deletion is finalized. Requires Master Admin Password.
              </p>
            </div>
            
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { id: 'slitting', title: 'Slitting Floor Data', desc: 'Clear Slit Jobs, slit rolls buffer, and slitting activity logs only.' },
                { id: 'cutting', title: 'Cutting Floor Data', desc: 'Clear Cut Crates, cutting batches, and cutting scrap logs only.' },
                { id: 'forming', title: 'Forming Floor Data', desc: 'Clear Forming batches, line logs FM-01 to FM-04, and heater telemetry.' },
                { id: 'qc', title: 'QC & Inspection Data', desc: 'Clear QC vouchers, inspected crate balances, and defect Pareto logs.' },
                { id: 'packing', title: 'Packing & Dispatch Data', desc: 'Clear packed cartons, pallet records, and dispatch challan logs.' },
                { id: 'master', title: 'Master Configs & Brands', desc: 'Reset glue/paper brands, custom GSMs, spare parts to defaults.' },
                { id: 'maintenance', title: 'Maintenance & Incidents', desc: 'Clear breakdown history, technician attend logs, and tickets.' },
              ].map(cat => (
                <div key={cat.id} className="bg-white border border-rose-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition group">
                  <div className="mb-2">
                    <h6 className="text-xs font-extrabold text-slate-800 m-0 group-hover:text-rose-700 transition">{cat.title}</h6>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{cat.desc}</p>
                  </div>
                  <button
                    onClick={() => handleModularReset(cat.id, cat.title)}
                    className="w-full py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 font-bold text-[10px] rounded-lg transition"
                  >
                    Wipe {cat.title.split(' ')[0]}
                  </button>
                </div>
              ))}
              
              <div className="bg-rose-600 border border-rose-800 rounded-xl p-3.5 shadow-md hover:shadow-lg transition group text-white md:col-span-2 lg:col-span-1">
                <div className="mb-2">
                  <h6 className="text-xs font-black m-0 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Complete Factory Wipe
                  </h6>
                  <p className="text-[10px] text-rose-200 mt-0.5 leading-tight">Master hard reset of all production state, keeping only Admin credentials.</p>
                </div>
                <button
                  onClick={() => handleModularReset('full', 'Complete Factory Wipe')}
                  className="w-full py-1.5 bg-rose-900 hover:bg-black text-white font-black text-[10px] rounded-lg transition border border-rose-950"
                >
                  DANGER: FULL WIPE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* TAB 6: DEPARTMENT HEADS COORDINATION MATRIX & AUTO-ALERT RECIPIENTS */}
      {/* ========================================================================= */}
      {activeTab === 'staff_escalation' && (
        <div className="space-y-6" id="coordination-matrix-tab">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-3 border-b border-slate-200">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
                Department Heads Coordination Matrix & Auto-Alert Subscriptions
              </h4>
              <p className="text-xs text-slate-500 m-0">
                Configure WhatsApp routing paths, mobile numbers, and subscribed alert categories for automated notifications.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                isAdmin 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                  : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}>
                {isAdmin ? '🛡️ ADMIN EDIT MODE' : '👁️ VIEW-ONLY FLOOR MODE'}
              </span>
            </div>
          </div>

          {!isAdmin && (
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-amber-900 m-0">Read-Only Mode Active</h5>
                <p className="text-[11px] text-amber-700 mt-0.5 m-0">
                  Editing or updating the coordination matrix is restricted to authorized Administrators. Supervisors and operators have view-only access.
                </p>
              </div>
            </div>
          )}

          {/* Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h5 className="text-xs font-black text-slate-700 uppercase m-0">Subscribed Recipients Directory</h5>
              <span className="text-[10px] text-slate-500 font-bold">{coordinationMatrixList.length} Contacts Listed</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Role / Department</th>
                    <th className="py-3 px-4">Contact Name</th>
                    <th className="py-3 px-4">WhatsApp Phone</th>
                    <th className="py-3 px-4">Subscribed Alert Categories</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {coordinationMatrixList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        No contacts configured. Use the form below to add department heads.
                      </td>
                    </tr>
                  ) : (
                    coordinationMatrixList.map((item, idx) => {
                      const isEditing = editingItemIdx === idx;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition">
                          {isEditing && editingItem ? (
                            <>
                              {/* Inline Editing Mode */}
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={editingItem.roleName}
                                  onChange={(e) => setEditingItem({ ...editingItem, roleName: e.target.value })}
                                  placeholder="e.g. Electrical Breakdown Head"
                                  className="px-2 py-1.5 border border-blue-300 bg-white text-xs font-bold rounded-lg w-full text-blue-950"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={editingItem.contactName}
                                  onChange={(e) => setEditingItem({ ...editingItem, contactName: e.target.value })}
                                  placeholder="e.g. Kishan Patel"
                                  className="px-2 py-1.5 border border-blue-300 bg-white text-xs font-bold rounded-lg w-full text-blue-950"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={editingItem.phone}
                                  onChange={(e) => setEditingItem({ ...editingItem, phone: e.target.value })}
                                  placeholder="e.g. +91 98251 67890"
                                  className="px-2 py-1.5 border border-blue-300 bg-white text-xs font-bold rounded-lg w-full text-blue-950"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-200 max-w-xs">
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingItem.alertCategories.machineBreakdown}
                                      onChange={(e) => setEditingItem({
                                        ...editingItem,
                                        alertCategories: { ...editingItem.alertCategories, machineBreakdown: e.target.checked }
                                      })}
                                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span>Breakdown</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingItem.alertCategories.electricalAlert}
                                      onChange={(e) => setEditingItem({
                                        ...editingItem,
                                        alertCategories: { ...editingItem.alertCategories, electricalAlert: e.target.checked }
                                      })}
                                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span>Electrical</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingItem.alertCategories.productionHandover}
                                      onChange={(e) => setEditingItem({
                                        ...editingItem,
                                        alertCategories: { ...editingItem.alertCategories, productionHandover: e.target.checked }
                                      })}
                                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span>Handover</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingItem.alertCategories.materialIndent}
                                      onChange={(e) => setEditingItem({
                                        ...editingItem,
                                        alertCategories: { ...editingItem.alertCategories, materialIndent: e.target.checked }
                                      })}
                                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span>Indent</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer col-span-2">
                                    <input
                                      type="checkbox"
                                      checked={editingItem.alertCategories.qcFailure}
                                      onChange={(e) => setEditingItem({
                                        ...editingItem,
                                        alertCategories: { ...editingItem.alertCategories, qcFailure: e.target.checked }
                                      })}
                                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span>QC Failure</span>
                                  </label>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setEditingItem({ ...editingItem, isActive: !editingItem.isActive })}
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase transition ${
                                    editingItem.isActive
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : 'bg-slate-100 text-slate-500 border-slate-300'
                                  }`}
                                >
                                  {editingItem.isActive ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={handleSaveMatrixItem}
                                    className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer"
                                    title="Save changes"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItemIdx(null);
                                      setEditingItem(null);
                                    }}
                                    className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              {/* Read/Display Mode */}
                              <td className="py-3 px-4 font-black text-slate-800">
                                {item.roleName}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-600">
                                {item.contactName}
                              </td>
                              <td className="py-3 px-4 font-extrabold text-blue-800">
                                {item.phone}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1">
                                  {item.alertCategories.machineBreakdown && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black uppercase">
                                      Breakdown
                                    </span>
                                  )}
                                  {item.alertCategories.electricalAlert && (
                                    <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[9px] font-black uppercase">
                                      Electrical
                                    </span>
                                  )}
                                  {item.alertCategories.productionHandover && (
                                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black uppercase">
                                      Handover
                                    </span>
                                  )}
                                  {item.alertCategories.materialIndent && (
                                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-black uppercase">
                                      Indent
                                    </span>
                                  )}
                                  {item.alertCategories.qcFailure && (
                                    <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-black uppercase">
                                      QC Failure
                                    </span>
                                  )}
                                  {!item.alertCategories.machineBreakdown &&
                                   !item.alertCategories.electricalAlert &&
                                   !item.alertCategories.productionHandover &&
                                   !item.alertCategories.materialIndent &&
                                   !item.alertCategories.qcFailure && (
                                    <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-200 text-[9px] font-medium italic">
                                      No categories
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  disabled={!isAdmin}
                                  onClick={() => handleToggleMatrixItemActive(idx)}
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase transition ${
                                    item.isActive
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : 'bg-slate-100 text-slate-500 border-slate-300'
                                  } ${!isAdmin ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:bg-emerald-100'}`}
                                >
                                  {item.isActive ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleTestWhatsAppAlert(item)}
                                    className="px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg transition text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-xs"
                                    title="Send a live test notification using WhatsApp Link"
                                  >
                                    <Send className="w-3 h-3" /> Test WA
                                  </button>
                                  {isAdmin && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditMatrixItem(idx)}
                                        className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                                        title="Edit this recipient config"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMatrixItem(idx)}
                                        className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition cursor-pointer"
                                        title="Delete contact"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add New Contact Form Card (Admin Only) */}
          {isAdmin && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                <Plus className="w-4 h-4 text-blue-600" />
                <h5 className="text-xs font-black text-slate-800 uppercase m-0">Add New Recipient Contact to Matrix</h5>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Department / Role Name:
                  </label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Mechanical Breakdown Head"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none animate-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Contact Person Name:
                  </label>
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="e.g. Suresh Patel"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none animate-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    WhatsApp Phone Number (With Country Code):
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. +91 98250 11001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none animate-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 m-0">
                    Always start with country code (e.g. +91)
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wide">
                  Subscribe Alert Categories (Check to auto-alert):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newMachineBreakdown}
                      onChange={(e) => setNewMachineBreakdown(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Machine Breakdown</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newElectricalAlert}
                      onChange={(e) => setNewElectricalAlert(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Electrical Alert</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newProductionHandover}
                      onChange={(e) => setNewProductionHandover(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Production Handover</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newMaterialIndent}
                      onChange={(e) => setNewMaterialIndent(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Material Indent</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newQcFailure}
                      onChange={(e) => setNewQcFailure(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>QC Failure</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600 uppercase">Initial Status:</label>
                  <button
                    type="button"
                    onClick={() => setNewIsActive(!newIsActive)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase transition ${
                      newIsActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-slate-100 text-slate-500 border-slate-300'
                    }`}
                  >
                    {newIsActive ? 'Active' : 'Inactive'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddMatrixItem}
                  className="px-5 py-2.5 bg-[#1a365d] hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Recipient to Matrix
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD NEW USER ACCOUNT */}
      {/* ======================================================== */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateNewUser}
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in duration-150"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 m-0">Create New User Account</h3>
                <p className="text-[11px] text-slate-500 m-0">Add login credentials & initial role for an operator</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                User ID / Login Key <span className="text-rose-600">*Mandatory</span>:
              </label>
              <input
                type="text"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="e.g. shift_supervisor_1"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name:</label>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="e.g. Ramesh Sharma"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Password / PIN:</label>
                <input
                  type="text"
                  value={newUserPass}
                  onChange={(e) => setNewUserPass(e.target.value)}
                  placeholder="e.g. 5566"
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg text-xs font-bold text-blue-900 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Role:</label>
                <input
                  type="text"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  placeholder="e.g. QC Lead"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer shadow-xs flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> Create User
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT AUDIT LOG ENTRY */}
      {/* ======================================================== */}
      {logEditForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Edit className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 m-0">Edit Factory Audit Log Entry</h3>
                <p className="text-[11px] text-slate-500 m-0">Modify timestamp, action text or worker attribution</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Job / Order ID:</label>
                <input
                  type="text"
                  value={logEditForm.jobId || ''}
                  onChange={(e) => setLogEditForm({ ...logEditForm, jobId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Stage:</label>
                <input
                  type="text"
                  value={logEditForm.stage || ''}
                  onChange={(e) => setLogEditForm({ ...logEditForm, stage: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Action Description:</label>
              <textarea
                value={logEditForm.action}
                onChange={(e) => setLogEditForm({ ...logEditForm, action: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Worker Name:</label>
                <input
                  type="text"
                  value={logEditForm.worker || ''}
                  onChange={(e) => setLogEditForm({ ...logEditForm, worker: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Machine / Station:</label>
                <input
                  type="text"
                  value={logEditForm.machine || ''}
                  onChange={(e) => setLogEditForm({ ...logEditForm, machine: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingLogIndex(null);
                  setLogEditForm(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLogEdit}
                className="px-4 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer shadow-xs flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> Save Log Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 10: GO-LIVE OPENING STOCK & BUFFER INJECTION MODULE */}
      {/* ========================================================================= */}
      {activeTab === 'opening_stock_inward' && (
        <div className="space-y-6" id="opening-stock-inward-tab">
          <OpeningStockModal
            state={state}
            onSaveState={onSaveState}
            isEmbedded={true}
          />
        </div>
      )}

      {activeTab === 'employee_master' && (
        <div className="space-y-6" id="employee-master-tab">
          <EmployeeMasterView
            state={state}
            onBackToHub={onBackToHub}
            onSaveState={onSaveState}
          />
        </div>
      )}

      {/* In-App Toast Notification */}
      {adminToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border text-xs font-black flex items-center gap-2 animate-bounce ${
            adminToast.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-800'
              : adminToast.type === 'info'
              ? 'bg-blue-50 border-blue-300 text-blue-800'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
          }`}
        >
          <span>{adminToast.msg}</span>
          <button
            type="button"
            onClick={() => setAdminToast(null)}
            className="ml-2 p-1 hover:bg-black/10 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* In-App Confirmation Modal (Safe for iframes) */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                  confirmModal.isDanger
                    ? 'bg-red-100 text-red-600'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide m-0">
                  {confirmModal.title}
                </h3>
                <p className="text-xs text-slate-500 m-0">Confirmation Required</p>
              </div>
            </div>

            <p className="text-xs font-medium text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200 m-0">
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 text-xs font-black text-white rounded-xl cursor-pointer shadow-xs transition ${
                  confirmModal.isDanger
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmModal.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
