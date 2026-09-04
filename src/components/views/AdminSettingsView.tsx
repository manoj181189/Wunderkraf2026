import React, { useState } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import {
  FactoryState,
  Job,
  PackJob,
  LogEntry,
  ProductType,
  RunningBatch,
  UserAccount
} from '../../types';
import {
  PRODUCTS,
  PAPER_BRANDS,
  DEPT_WORKERS,
  INITIAL_STATE,
  DEFAULT_USERS
} from '../../lib/constants';
import { exportToJSON, getCurrentExpectedShift } from '../../lib/utils';

interface AdminSettingsViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
}

type AdminTab = 'users' | 'master_data' | 'whatsapp' | 'sequences_shifts' | 'backup_restore';
type MasterDataSubTab = 'jobs' | 'orders' | 'logs';

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  state,
  onBackToHub,
  onSaveState
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [masterSubTab, setMasterSubTab] = useState<MasterDataSubTab>('jobs');

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

  // ==========================================
  // TAB 3: WHATSAPP CONFIG & REPORT STATE
  // ==========================================
  const [waPhone, setWaPhone] = useState(state.whatsappConfig?.phone || '');
  const [waApiKey, setWaApiKey] = useState(state.whatsappConfig?.apiKey || '');
  const [waAutoSend, setWaAutoSend] = useState(state.whatsappConfig?.autoSend || false);
  const [waWebhookUrl, setWaWebhookUrl] = useState(state.whatsappConfig?.webhookUrl || '');
  const [waCustomMessage, setWaCustomMessage] = useState(
    state.whatsappConfig?.customMessage || 'Wünderkraf Paperware Factory Live Shift Report'
  );

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
  const handleSelectJobToEdit = (jobId: string) => {
    setSelectedJobIdToEdit(jobId);
    const j = state.jobs.find((x) => x.id === jobId);
    setJobEditForm(j ? JSON.parse(JSON.stringify(j)) : null);
  };

  const handleSelectOrderToEdit = (ordId: string) => {
    setSelectedOrderIdToEdit(ordId);
    const o = state.packJobs.find((x) => x.id === ordId);
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
      alert('⚠️ Security Protection: Master Admin account cannot be deleted!');
      return;
    }
    if (!confirm(`Are you sure you want to delete user account [${userKey}]?`)) return;

    const updatedUsers = { ...usersRecord };
    delete updatedUsers[userKey];

    onSaveState({
      ...state,
      users: updatedUsers
    });

    setSelectedUserKey('admin');
    handleSelectUser('admin');
    alert(`✅ User [${userKey}] deleted successfully.`);
  };

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
      newPerms = [
        'Admin',
        'Marketing',
        'Dispatch',
        'Slitting',
        'Cutting',
        'Forming',
        'QC',
        'Packing',
        'Stock',
        'Orders',
        'Analytics',
        'Audit'
      ];
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

    const updatedJobs = state.jobs.map((j) => {
      if (j.id === selectedJobIdToEdit) {
        return {
          ...jobEditForm,
          availableRolls: Number(jobEditForm.availableRolls) || 0,
          availableCuttingCrates: Number(jobEditForm.availableCuttingCrates) || 0,
          availableFormingCrates: Number(jobEditForm.availableFormingCrates) || 0,
          availableQcCrates: Number(jobEditForm.availableQcCrates) || 0
        };
      }
      return j;
    });

    const newLog: LogEntry = {
      jobId: jobEditForm.id,
      product: jobEditForm.product,
      stage: 'Admin Master',
      machine: 'MASTER-OVERWRITE',
      shift: 'DAY',
      action: `🛠️ Master Overwrite on Job [${jobEditForm.id}]: Stock balances & batch data updated by Admin`,
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

    setSelectedJobIdToEdit(jobEditForm.id);
    alert(`✅ Production Job [${jobEditForm.id}] Master Overwrite Saved Successfully!`);
  };

  const handleDeleteJob = (jobId: string) => {
    if (
      !confirm(
        `⚠️ CRITICAL: Delete Job [${jobId}] completely from factory database?\nAll associated running batches will be removed.`
      )
    ) {
      return;
    }

    const updatedJobs = state.jobs.filter((j) => j.id !== jobId);
    const newLog: LogEntry = {
      jobId: jobId,
      stage: 'Admin Master',
      machine: 'MASTER-OVERWRITE',
      shift: 'DAY',
      action: `🗑️ Deleted Job [${jobId}] completely from database`,
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

    const nextJob = updatedJobs[0]?.id || '';
    handleSelectJobToEdit(nextJob);
    alert(`✅ Job [${jobId}] deleted from database.`);
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
    alert(`✅ Customer Order [${orderEditForm.id}] Master Overwrite Saved Successfully!`);
  };

  const handleDeleteOrder = (ordId: string) => {
    if (!confirm(`⚠️ CRITICAL: Delete Customer Order [${ordId}] completely from database?`)) {
      return;
    }

    const updatedPackJobs = state.packJobs.filter((o) => o.id !== ordId);
    onSaveState({
      ...state,
      packJobs: updatedPackJobs
    });

    const nextOrd = updatedPackJobs[0]?.id || '';
    handleSelectOrderToEdit(nextOrd);
    alert(`✅ Customer Order [${ordId}] deleted.`);
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
    alert('✅ Log Entry Updated Successfully!');
  };

  const handleDeleteLogEntry = (originalIndex: number) => {
    if (!confirm('Are you sure you want to delete this log entry?')) return;

    const updatedLogs = state.logs.filter((_, idx) => idx !== originalIndex);
    onSaveState({
      ...state,
      logs: updatedLogs
    });
    alert('✅ Log entry deleted.');
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
        customMessage: waCustomMessage.trim()
      }
    });
    alert('✅ WhatsApp Backup & Notification Settings Saved Successfully!');
  };

  const handleSendWhatsAppShiftReport = () => {
    const currentShift = getCurrentExpectedShift(state.shiftConfig);
    const todayStr = new Date().toISOString().split('T')[0];

    // Compute floor totals
    const totalRollsStock = state.jobs.reduce((acc, j) => acc + (j.availableRolls || 0), 0);
    const totalCutStock = state.jobs.reduce((acc, j) => acc + (j.availableCuttingCrates || 0), 0);
    const totalFormedStock = state.jobs.reduce((acc, j) => acc + (j.availableFormingCrates || 0), 0);
    const totalQcStock = state.jobs.reduce((acc, j) => acc + (j.availableQcCrates || 0), 0);

    const pendingOrdersCount = state.packJobs.filter((o) => o.status !== 'Dispatched').length;
    const totalPackedBoxes = state.packJobs.reduce((acc, o) => acc + (o.packedBoxes || 0), 0);
    const totalDispatchedBoxes = state.packJobs.reduce((acc, o) => acc + (o.dispatchedBoxes || 0), 0);

    const reportMessage = `🏭 *WÜNDERKRAF PAPERWARE ERP - LIVE SHIFT REPORT*
📅 *Date:* ${todayStr} | *Shift:* ${currentShift}
⏱️ *Generated At:* ${new Date().toLocaleTimeString()}

📊 *CURRENT WIP STOCK MATRIX:*
• 📜 Slit Rolls Stock: *${totalRollsStock} Rolls*
• ✂️ Cut Crates Stock: *${totalCutStock} Crates*
• ⚙️ Formed Crates Stock: *${totalFormedStock} Crates*
• 🔍 QC Passed Stock: *${totalQcStock} Crates*

📦 *PACKING & DISPATCH STATUS:*
• 📋 Active Pending Orders: *${pendingOrdersCount} Orders*
• 📦 Total Packed Boxes: *${totalPackedBoxes} Boxes*
• 🚚 Dispatched Delivered: *${totalDispatchedBoxes} Boxes*

👥 *SYSTEM STATUS:* All 5 Workstations Operational.
✅ *Admin Suite Verified.*`;

    const encodedText = encodeURIComponent(reportMessage);
    const cleanPhone = waPhone.replace(/[^0-9]/g, '');

    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${encodedText}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    }
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
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.jobs && parsed.packJobs && parsed.logs) {
          onSaveState(parsed);
          alert('✅ Factory database state restored successfully from JSON backup!');
        } else {
          alert('Invalid state JSON structure!');
        }
      } catch (err) {
        alert('Failed to parse JSON file!');
      }
    };
    reader.readAsText(file);
  };

  const handleHardReset = () => {
    if (
      !confirm(
        '⚠️ CRITICAL WARNING: This will completely wipe all current factory jobs, orders, and logs and restore clean default initial state!\nAre you sure you want to proceed?'
      )
    ) {
      return;
    }
    const pass = prompt('Enter Master Admin Password to confirm factory wipe:');
    if (pass !== (state.adminPassword || '1234')) {
      alert('❌ Incorrect Admin Password! Reset aborted.');
      return;
    }

    onSaveState(INITIAL_STATE);
    alert('✅ Factory database has been reset to clean default initial state.');
  };

  const AVAILABLE_PERMS = [
    { key: '*', label: '👑 FULL MASTER ACCESS (*)', desc: 'Full control over all modules & admin settings' },
    { key: 'Admin', label: '⚙️ Admin Settings & Overwrite', desc: 'Manage users, sequences & overwrite data' },
    { key: 'Marketing', label: '💼 Customer Marketing & Orders', desc: 'Create and book new packing orders' },
    { key: 'Dispatch', label: '🚚 Dispatch & Gatepass Invoicing', desc: 'Process box dispatches and bills' },
    { key: 'Slitting', label: '📜 Slitting Desk (Stage 1)', desc: 'Jumbo reel loading & slitting runs' },
    { key: 'Cutting', label: '✂️ Cutting Desk (Stage 2)', desc: 'Slit rolls to cut crates' },
    { key: 'Forming', label: '⚙️ Forming Desk (Stage 3)', desc: 'Hydraulic moulding & pressing' },
    { key: 'QC', label: '🔍 QC Inspection Desk (Stage 4)', desc: 'Formed crates quality check & scrap' },
    { key: 'Packing', label: '📦 Packing Desk (Stage 5)', desc: 'Kit assembly & box packaging' },
    { key: 'Maintenance', label: '🛠️ Maintenance Desk & Downtime', desc: 'Machine breakdowns, spare parts, logs & ready handover' },
    { key: 'Stock', label: '📊 Raw & WIP Stock Matrix', desc: 'Real-time inventory levels' },
    { key: 'Orders', label: '📋 Orders Book & Dispatch Log', desc: 'View customer orders list' },
    { key: 'Analytics', label: '📈 Scrap & Efficiency Analytics', desc: 'Output yield & machine metrics' },
    { key: 'Audit', label: '📜 Factory Shift Audit Logs', desc: 'Activity timestamped records' }
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
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: USER ACCOUNTS & PERMISSIONS (यूज़र आईडी एवं अधिकार प्रबंधन) */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
                User Accounts & Access Rights (यूज़र प्रबंधन व अधिकार)
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
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {u.perms?.includes('*') ? 'ALL' : `${u.perms?.length || 0} Rights`}
                      </span>
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
                    Grant Module Access Rights (अधिकार चेकबॉक्स):
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
              Department Operators & Workers Master (मशीन ऑपरेटर सूची)
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
      {/* TAB 2: 100% MASTER DATA OVERWRITE (जॉब, बैच, क्वालिटी, ऑर्डर व लॉग सुधार) */}
      {/* ========================================================================= */}
      {activeTab === 'master_data' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
                100% Master Data Correction & Overwrite (मास्टर डाटा सुधार)
              </h4>
              <p className="text-xs text-slate-500 m-0">
                Admin full authority: Correct Job IDs, Item IDs, Stock counts, Running Batches, Customer Orders & Logs
              </p>
            </div>
            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
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
                        Job ID (जॉब नंबर):
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
                        Product Item (आइटम प्रकार):
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

                  {/* Stock balances editor */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                    <label className="text-xs font-extrabold text-slate-800 uppercase block">
                      Direct Stage Stock Balances Overwrite (स्टॉक बैलेंस सीधा सुधारें):
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
                  </select>
                </div>
                {orderEditForm && (
                  <button
                    type="button"
                    onClick={() => handleDeleteOrder(orderEditForm.id)}
                    className="mt-4 px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Order
                  </button>
                )}
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
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* SUB-TAB C: AUDIT LOGS OVERWRITE */}
          {/* ------------------------------------------------------------- */}
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
                <div className="flex items-center gap-2">
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WHATSAPP BACKUP & LIVE AUTO-REPORTING (व्हाट्सएप बैकअप) */}
      {/* ========================================================================= */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
                WhatsApp Backup & Shift Reporting (व्हाट्सएप बैकअप व लाइव रिपोर्टिंग)
              </h4>
              <p className="text-xs text-slate-500 m-0">
                Configure auto WhatsApp notifications, recipient mobile number, and dispatch live shift summaries
              </p>
            </div>
            <button
              type="button"
              onClick={handleSendWhatsAppShiftReport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>🚀 Send Live Shift Report via WhatsApp Now</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
              <h5 className="text-xs font-extrabold text-slate-800 uppercase m-0 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                WhatsApp Recipient & API Settings
              </h5>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Recipient Mobile Number (with Country Code):
                </label>
                <input
                  type="text"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Reports will be sent to this WhatsApp mobile number.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  WhatsApp Webhook URL / Gateway API (Optional):
                </label>
                <input
                  type="text"
                  value={waWebhookUrl}
                  onChange={(e) => setWaWebhookUrl(e.target.value)}
                  placeholder="e.g. https://api.whatsapp-gateway.com/send"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="waAutoSendToggle"
                  checked={waAutoSend}
                  onChange={(e) => setWaAutoSend(e.target.checked)}
                  className="rounded text-emerald-600 w-4 h-4"
                />
                <label htmlFor="waAutoSendToggle" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Enable Scheduled Auto Shift Report (Day Shift 20:00 & Night Shift 08:00)
                </label>
              </div>

              <button
                type="button"
                onClick={handleSaveWhatsAppConfig}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Save className="w-4 h-4" /> Save WhatsApp Configurations
              </button>
            </div>

            {/* Live WhatsApp Preview Box */}
            <div className="bg-emerald-950 text-emerald-100 rounded-xl p-4 space-y-3 font-mono text-xs shadow-md border border-emerald-800">
              <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
                <span className="font-extrabold text-emerald-300">WhatsApp Message Live Preview:</span>
                <span className="text-[10px] bg-emerald-800 text-emerald-100 px-2 py-0.5 rounded">Ready</span>
              </div>
              <div className="whitespace-pre-line leading-relaxed text-xs text-emerald-50">
                {`🏭 *WÜNDERKRAF PAPERWARE ERP - SHIFT REPORT*
📅 *Date:* ${new Date().toISOString().split('T')[0]} | *Shift:* ${getCurrentExpectedShift(state.shiftConfig)}

📊 *CURRENT WIP STOCK:*
• 📜 Slit Rolls: ${state.jobs.reduce((a, b) => a + (b.availableRolls || 0), 0)} Rolls
• ✂️ Cut Crates: ${state.jobs.reduce((a, b) => a + (b.availableCuttingCrates || 0), 0)} Crates
• ⚙️ Formed Crates: ${state.jobs.reduce((a, b) => a + (b.availableFormingCrates || 0), 0)} Crates
• 🔍 QC OK Crates: ${state.jobs.reduce((a, b) => a + (b.availableQcCrates || 0), 0)} Crates

📦 *PACKING & DISPATCH:*
• 📋 Pending Orders: ${state.packJobs.filter((o) => o.status !== 'Dispatched').length}
• 🚚 Total Dispatches: ${state.packJobs.reduce((a, b) => a + (b.dispatchedBoxes || 0), 0)} Boxes`}
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
                {PRODUCTS.map((prod) => (
                  <div key={prod}>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      {prod} Next Seq:
                    </label>
                    <input
                      type="number"
                      value={productSeqs[prod] || 1}
                      onChange={(e) =>
                        setProductSeqs({
                          ...productSeqs,
                          [prod]: Number(e.target.value) || 1
                        })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>
                ))}
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
      {/* TAB 5: DATABASE BACKUP & JSON RESTORE */}
      {/* ========================================================================= */}
      {activeTab === 'backup_restore' && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
              Database JSON Backup, Restore & Recovery
            </h4>
            <p className="text-xs text-slate-500 m-0">
              Export full factory database to offline JSON, restore previous state, or hard reset system
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-2">
                  <Download className="w-4 h-4" />
                </div>
                <h5 className="text-xs font-extrabold text-slate-900 uppercase m-0">Export JSON Database</h5>
                <p className="text-[11px] text-slate-500 mt-1">
                  Download a complete backup copy of all jobs, logs, orders, and user settings.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  exportToJSON(`wunderkraf_backup_${new Date().toISOString().split('T')[0]}.json`, state)
                }
                className="mt-4 w-full py-2 bg-[#2b6cb0] hover:bg-[#1a365d] text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download JSON Backup
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2">
                  <Upload className="w-4 h-4" />
                </div>
                <h5 className="text-xs font-extrabold text-slate-900 uppercase m-0">Restore from JSON</h5>
                <p className="text-[11px] text-slate-500 mt-1">
                  Upload an existing factory backup JSON file to restore all previous records.
                </p>
              </div>
              <label className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Select Backup JSON File
                <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
              </label>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold mb-2">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <h5 className="text-xs font-extrabold text-rose-950 uppercase m-0">Factory State Reset</h5>
                <p className="text-[11px] text-rose-700 mt-1">
                  Wipe all current operational data and restore clean default sample records.
                </p>
              </div>
              <button
                type="button"
                onClick={handleHardReset}
                className="mt-4 w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Hard Reset Factory
              </button>
            </div>
          </div>
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
    </div>
  );
};
