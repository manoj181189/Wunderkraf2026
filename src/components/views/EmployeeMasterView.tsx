import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  Users, 
  UserPlus, 
  Trash2, 
  Search, 
  RotateCcw, 
  CheckCircle2, 
  Download, 
  XCircle, 
  Upload, 
  Edit2, 
  X, 
  AlertTriangle,
  UserX,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Building2,
  Filter
} from 'lucide-react';
import { FactoryState, FloorWorker, WorkforceRole } from '../../types';
import { DEPT_WORKERS, DEFAULT_FLOOR_WORKERS } from '../../lib/constants';

interface EmployeeMasterViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (newState: FactoryState) => void;
}

const ALL_DEPARTMENTS = [
  'All',
  'Slitting',
  'Cutting',
  'Forming',
  'QC',
  'Shorting',
  'Packing',
  'Maintenance',
  'Production',
  'Housekeeping',
  'Printing',
  'HR'
];

export const EmployeeMasterView: React.FC<EmployeeMasterViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
}) => {
  const [deptWorkers, setDeptWorkers] = useState<Record<string, string[]>>(state.deptWorkers || DEPT_WORKERS);
  const [floorWorkers, setFloorWorkers] = useState<FloorWorker[]>(state.floorWorkers !== undefined ? state.floorWorkers : DEFAULT_FLOOR_WORKERS);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals & Panels
  const [editingWorker, setEditingWorker] = useState<FloorWorker | null>(null);
  const [deleteModalWorker, setDeleteModalWorker] = useState<FloorWorker | null>(null);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [showClearAllModal, setShowClearAllModal] = useState<boolean>(false);
  const [isAddFormOpen, setIsAddFormOpen] = useState<boolean>(false);

  // Sync state with parent props to prevent stale state from overwriting deletions/additions
  React.useEffect(() => {
    if (state.floorWorkers !== undefined) {
      setFloorWorkers(state.floorWorkers);
    }
    if (state.deptWorkers !== undefined) {
      setDeptWorkers(state.deptWorkers);
    }
  }, [state.floorWorkers, state.deptWorkers]);

  const [activeDept, setActiveDept] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Add new employee state
  const [staffId, setStaffId] = useState('');
  const [newWorkerName, setNewWorkerName] = useState('');
  const [designation, setDesignation] = useState('Helper');
  const [newRole, setNewRole] = useState<WorkforceRole>('HELPER');
  const [targetDept, setTargetDept] = useState('Packing');
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;

    // Build the new floorWorkers array
    const updatedFloorWorkers = floorWorkers.map(w => w.id === editingWorker.id ? editingWorker : w);
    
    // Automatically rebuild deptWorkers to ensure perfect sync
    const updatedDeptWorkers: Record<string, string[]> = {};
    updatedFloorWorkers.forEach(w => {
      if (w.status !== 'INACTIVE') {
        if (!updatedDeptWorkers[w.department]) updatedDeptWorkers[w.department] = [];
        if (!updatedDeptWorkers[w.department].includes(w.name)) {
          updatedDeptWorkers[w.department].push(w.name);
        }
      }
    });

    setFloorWorkers(updatedFloorWorkers);
    setDeptWorkers(updatedDeptWorkers);
    
    onSaveState({
      ...state,
      floorWorkers: updatedFloorWorkers,
      deptWorkers: updatedDeptWorkers
    });

    showNotification(`Updated details for ${editingWorker.name}`);
    setEditingWorker(null);
  };

  const handleAddWorker = () => {
    if (!newWorkerName.trim()) return;
    const cleanName = newWorkerName.trim();
    const cleanStaffId = staffId.trim() || `EMP${String(Math.floor(10000 + Math.random() * 90000))}`;
    
    // 1. Update deptWorkers mapping
    const currentDeptList = deptWorkers[targetDept] || [];
    const updatedDeptWorkers = {
      ...deptWorkers,
      [targetDept]: currentDeptList.includes(cleanName) ? currentDeptList : [...currentDeptList, cleanName]
    };
    setDeptWorkers(updatedDeptWorkers);

    // 2. Add to full floor roster
    const newWorker: FloorWorker = {
      id: `FW-${Date.now()}`,
      staffId: cleanStaffId,
      name: cleanName,
      designation: designation.trim() || 'Helper',
      role: newRole,
      department: targetDept,
      shift: 'DAY',
      isPresent: true,
      inTime: '08:00 AM',
      status: 'ACTIVE'
    };
    const updatedFloorWorkers = [newWorker, ...floorWorkers];
    setFloorWorkers(updatedFloorWorkers);

    // Save state
    onSaveState({
      ...state,
      deptWorkers: updatedDeptWorkers,
      floorWorkers: updatedFloorWorkers
    });

    setStaffId('');
    setNewWorkerName('');
    setDesignation('Helper');
    setIsAddFormOpen(false);
    showNotification(`Added ${cleanName} to ${targetDept} Master Directory`);
  };

  // Permanent Hard Deletion
  const handlePermanentDelete = (worker: FloorWorker) => {
    const updatedFloorWorkers = floorWorkers.filter(w => w.id !== worker.id);
    setFloorWorkers(updatedFloorWorkers);

    const hasOtherSameName = updatedFloorWorkers.some(w => w.name === worker.name && w.department === worker.department);
    let updatedDeptWorkers = deptWorkers;
    if (!hasOtherSameName && deptWorkers[worker.department]) {
      updatedDeptWorkers = {
        ...deptWorkers,
        [worker.department]: (deptWorkers[worker.department] || []).filter(w => w !== worker.name)
      };
      setDeptWorkers(updatedDeptWorkers);
    }

    const updatedDeletedWorkerIds = Array.from(new Set([...(state.deletedWorkerIds || []), worker.id]));

    onSaveState({
      ...state,
      deptWorkers: updatedDeptWorkers,
      floorWorkers: updatedFloorWorkers,
      deletedWorkerIds: updatedDeletedWorkerIds
    });

    showNotification(`Permanently deleted ${worker.name} from the database.`);
    setDeleteModalWorker(null);
  };

  // Soft Deletion / Toggle Active-Inactive Status
  const handleToggleActiveStatus = (worker: FloorWorker, newStatus: 'ACTIVE' | 'INACTIVE') => {
    const updatedFloorWorkers = floorWorkers.map(w => w.id === worker.id ? { ...w, status: newStatus } : w);
    setFloorWorkers(updatedFloorWorkers);

    const updatedDeptWorkers: Record<string, string[]> = {};
    updatedFloorWorkers.forEach(w => {
      if (w.status !== 'INACTIVE') {
        if (!updatedDeptWorkers[w.department]) updatedDeptWorkers[w.department] = [];
        if (!updatedDeptWorkers[w.department].includes(w.name)) {
          updatedDeptWorkers[w.department].push(w.name);
        }
      }
    });
    setDeptWorkers(updatedDeptWorkers);

    onSaveState({
      ...state,
      floorWorkers: updatedFloorWorkers,
      deptWorkers: updatedDeptWorkers
    });

    showNotification(`${newStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'} ${worker.name}`);
    setDeleteModalWorker(null);
  };

  // Reset to Standard Company Roster
  const handleConfirmResetRoster = () => {
    setDeptWorkers(DEPT_WORKERS);
    setFloorWorkers(DEFAULT_FLOOR_WORKERS);
    onSaveState({
      ...state,
      deptWorkers: DEPT_WORKERS,
      floorWorkers: DEFAULT_FLOOR_WORKERS,
      deletedWorkerIds: [] // Clear all deleted worker tombstones on fresh reset
    });
    setShowSyncModal(false);
    showNotification('Successfully synced master employee directory with 82 company staff members.');
  };

  // Clear All Employees
  const handleConfirmClearAll = () => {
    const allCurrentIds = floorWorkers.map(w => w.id);
    const updatedDeletedIds = Array.from(new Set([...(state.deletedWorkerIds || []), ...allCurrentIds]));
    setDeptWorkers({});
    setFloorWorkers([]);
    onSaveState({
      ...state,
      deptWorkers: {},
      floorWorkers: [],
      deletedWorkerIds: updatedDeletedIds
    });
    setShowClearAllModal(false);
    showNotification('Cleared all employee records from master.');
  };

  // CSV Export
  const handleExportCSV = () => {
    try {
      const headers = ['Staff ID', 'Name', 'Designation', 'Department', 'Shift', 'Status'];
      const rows = filteredWorkers.map(w => [
        w.staffId || '',
        `"${(w.name || '').replace(/"/g, '""')}"`,
        w.designation || w.role,
        w.department,
        w.shift,
        w.status || 'ACTIVE'
      ]);
      
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Wunderkraf_Employee_Master_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 200);
      showNotification('Downloaded employee list as CSV.');
    } catch (err) {
      console.error('Export error:', err);
      showNotification('Failed to download CSV');
    }
  };

  // CSV Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.split('\n');
      
      const newWorkers: FloorWorker[] = [];
      const newDeptMap: Record<string, string[]> = {};

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',');
        if (parts.length < 4) continue;
        
        let staffId = parts[0];
        let name = '';
        let restIndex = 1;
        if (parts[1].startsWith('"')) {
          let combinedName = parts[1];
          let j = 2;
          while (j < parts.length && !combinedName.endsWith('"')) {
            combinedName += ',' + parts[j];
            j++;
          }
          name = combinedName.replace(/(^"|"$)/g, '').trim();
          restIndex = j + 1;
        } else {
          name = parts[1].trim();
          restIndex = 2;
        }

        const designation = parts[restIndex] ? parts[restIndex].trim() : 'Helper';
        const department = parts[restIndex + 1] ? parts[restIndex + 1].trim() : 'Production';
        let shift = parts[restIndex + 2] ? parts[restIndex + 2].trim() : 'DAY';
        if (shift !== 'DAY' && shift !== 'NIGHT') shift = 'DAY';
        
        if (!name) continue;

        const roleMap: Record<string, WorkforceRole> = {
          'Manager': 'MANAGER',
          'Supervisor': 'SUPERVISOR',
          'Operator': 'OPERATOR',
          'Helper': 'HELPER',
          'Technician': 'TECHNICIAN',
          'Executive': 'EXECUTIVE'
        };
        const role = roleMap[designation] || 'HELPER';

        newWorkers.push({
          id: `FW-${Date.now()}-${i}`,
          staffId,
          name,
          designation,
          role,
          department,
          shift: shift as 'DAY' | 'NIGHT',
          isPresent: true,
          inTime: '08:00 AM',
          status: 'ACTIVE'
        });

        if (!newDeptMap[department]) {
          newDeptMap[department] = [];
        }
        if (!newDeptMap[department].includes(name)) {
          newDeptMap[department].push(name);
        }
      }

      if (newWorkers.length > 0) {
        setFloorWorkers(newWorkers);
        setDeptWorkers(newDeptMap);
        onSaveState({
          ...state,
          floorWorkers: newWorkers,
          deptWorkers: newDeptMap
        });
        showNotification(`Successfully uploaded ${newWorkers.length} employees from CSV. Master list updated.`);
      } else {
        showNotification("⚠️ No valid employee rows found in CSV. Please verify formatting.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Metrics for Top Display Cards
  const totalEmployeesCount = floorWorkers.length;
  const activeEmployeesCount = floorWorkers.filter(w => w.status !== 'INACTIVE').length;
  const inactiveEmployeesCount = floorWorkers.filter(w => w.status === 'INACTIVE').length;
  const departmentsCount = ALL_DEPARTMENTS.filter(d => d !== 'All').length;

  // Filtered workers list
  const filteredWorkers = floorWorkers.filter(w => {
    const matchesDept = activeDept === 'All' || w.department === activeDept;
    const matchesStatus = 
      statusFilter === 'ALL' || 
      (statusFilter === 'ACTIVE' && w.status !== 'INACTIVE') ||
      (statusFilter === 'INACTIVE' && w.status === 'INACTIVE');
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      w.name.toLowerCase().includes(q) || 
      (w.staffId && w.staffId.toLowerCase().includes(q)) || 
      (w.designation && w.designation.toLowerCase().includes(q)) ||
      (w.department && w.department.toLowerCase().includes(q));
    return matchesDept && matchesStatus && matchesSearch;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
      {/* Hidden File Input for CSV */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept=".csv,text/csv"
        onChange={handleFileUpload}
        className="hidden" 
      />

      {/* 1. Header & Actions Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBackToHub} 
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              Employee Master Directory
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Enterprise Workforce Master & Active-Inactive Status Management
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => setIsAddFormOpen(!isAddFormOpen)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 ${
              isAddFormOpen 
                ? 'bg-slate-800 text-white hover:bg-slate-900' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
            title="Toggle Add Employee Form"
          >
            {isAddFormOpen ? <ChevronUp className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            <span>{isAddFormOpen ? 'Hide Add Form' : '+ Add Employee'}</span>
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-2 rounded-xl transition-colors shadow-xs cursor-pointer active:scale-95"
            title="Upload CSV to update/replace the roster"
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            Upload CSV
          </button>

          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-xl transition-colors shadow-xs cursor-pointer active:scale-95"
            title="Download full employee roster as CSV template"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Download
          </button>

          <button 
            onClick={() => setShowSyncModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-2 rounded-xl transition-colors shadow-xs cursor-pointer active:scale-95"
            title="Restore factory standard 82 staff roster"
          >
            <RotateCcw className="w-4 h-4 text-amber-600" />
            Sync Roster
          </button>
          
          <button 
            onClick={() => setShowClearAllModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-xl transition-colors shadow-xs cursor-pointer active:scale-95"
            title="Remove all employees from the system"
          >
            <XCircle className="w-4 h-4 text-rose-600" />
            Clear All
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {notification}
        </div>
      )}

      {/* 2. Top KPI Display Cards (शीर्ष मुख्य डिस्प्ले कार्ड्स) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-700 uppercase">Total Workforce</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-950 mt-1">{totalEmployeesCount}</div>
          <div className="text-[10px] text-indigo-600/80 font-semibold mt-0.5">Registered in Directory</div>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Active Staff</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-1">{activeEmployeesCount}</div>
          <div className="text-[10px] text-emerald-600/80 font-semibold mt-0.5">Available for Operations</div>
        </div>

        <div className="bg-slate-100/70 border border-slate-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase">Inactive / Retired</span>
            <UserX className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1">{inactiveEmployeesCount}</div>
          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Hidden from Live Stations</div>
        </div>

        <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 uppercase">Departments</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-950 mt-1">{departmentsCount}</div>
          <div className="text-[10px] text-blue-600/80 font-semibold mt-0.5">Production, QC & Packaging</div>
        </div>
      </div>

      {/* 3. Collapsible "Add New Employee" Form */}
      {isAddFormOpen && (
        <div className="bg-slate-50 border border-indigo-200 rounded-2xl p-4 sm:p-5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-600" /> Register New Employee
            </h3>
            <button 
              onClick={() => setIsAddFormOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Staff ID</label>
              <input
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="e.g. EMP00125"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Employee Full Name *</label>
              <input
                type="text"
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                placeholder="e.g. Rameshbhai Parmar"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Senior Operator"
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Role Type</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as WorkforceRole)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
              >
                <option value="OPERATOR">Operator</option>
                <option value="HELPER">Helper</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="QC_INSPECTOR">QC Inspector</option>
                <option value="TECHNICIAN">Technician</option>
                <option value="MANAGER">Manager</option>
                <option value="EXECUTIVE">Executive</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Department</label>
              <select
                value={targetDept}
                onChange={(e) => setTargetDept(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
              >
                {ALL_DEPARTMENTS.filter(d => d !== 'All').map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3.5 flex justify-end gap-2">
            <button
              onClick={() => setIsAddFormOpen(false)}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleAddWorker}
              disabled={!newWorkerName.trim()}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-xl shadow-sm transition-colors cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" /> Save Employee to Master
            </button>
          </div>
        </div>
      )}

      {/* 4. Horizontal Department Filter Pills (ऊपर क्षैतिज रूप से व्यवस्थित) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-600" /> Filter by Department
          </span>
          <span className="text-[11px] text-slate-500 font-semibold">
            Showing <strong className="text-slate-800">{filteredWorkers.length}</strong> of {totalEmployeesCount}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
          {ALL_DEPARTMENTS.map(dept => {
            const count = dept === 'All' 
              ? floorWorkers.length 
              : floorWorkers.filter(w => w.department === dept).length;
            const isSelected = activeDept === dept;

            return (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                  isSelected 
                    ? 'bg-indigo-600 text-white shadow-indigo-200' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                }`}
              >
                <span>{dept}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Search & Status Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by Name, Staff ID, Designation, or Department..."
            className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">Status:</span>
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition ${
                statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({floorWorkers.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition ${
                statusFilter === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:text-emerald-800'
              }`}
            >
              Active ({activeEmployeesCount})
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition ${
                statusFilter === 'INACTIVE' ? 'bg-slate-600 text-white' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Inactive ({inactiveEmployeesCount})
            </button>
          </div>
        </div>
      </div>

      {/* 6. Main Full-Width Staff Directory Table Display (मुख्य फुल-विड्थ टेबल डिस्प्ले) */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5">#</th>
                <th className="py-3 px-3">Staff ID</th>
                <th className="py-3 px-3">Employee Name</th>
                <th className="py-3 px-3">Designation / Role</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3 text-center">Shift</th>
                <th className="py-3 px-3 text-center">Status Toggle</th>
                <th className="py-3 px-3.5 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWorkers.map((worker, idx) => (
                <tr key={worker.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="py-2.5 px-3.5 text-slate-400 font-medium text-[11px]">{idx + 1}</td>
                  
                  <td className="py-2.5 px-3">
                    <span className="font-mono font-bold text-slate-800 text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {worker.staffId || '-'}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 font-extrabold text-slate-900 text-xs">
                    {worker.name}
                  </td>

                  <td className="py-2.5 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      worker.designation === 'Manager' ? 'bg-purple-100 text-purple-800' :
                      worker.designation === 'Supervisor' ? 'bg-blue-100 text-blue-800' :
                      worker.designation === 'Technician' ? 'bg-amber-100 text-amber-800' :
                      worker.designation === 'Executive' ? 'bg-emerald-100 text-emerald-800' :
                      worker.designation === 'Operator' ? 'bg-cyan-100 text-cyan-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {worker.designation || worker.role}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 font-semibold text-slate-700">
                    {worker.department}
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold border border-slate-200">
                      {worker.shift}
                    </span>
                  </td>

                  {/* Status Toggle Badge */}
                  <td className="py-2.5 px-3 text-center">
                    {worker.status === 'INACTIVE' ? (
                      <button
                        onClick={() => handleToggleActiveStatus(worker, 'ACTIVE')}
                        className="px-2.5 py-1 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-[10px] font-black cursor-pointer transition-colors shadow-2xs border border-slate-300"
                        title="Click to Activate this employee"
                      >
                        ● INACTIVE
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleActiveStatus(worker, 'INACTIVE')}
                        className="px-2.5 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg text-[10px] font-black cursor-pointer transition-colors shadow-2xs border border-emerald-300"
                        title="Click to Deactivate this employee"
                      >
                        ● ACTIVE
                      </button>
                    )}
                  </td>

                  {/* Admin Actions: Edit and Permanent Delete */}
                  <td className="py-2.5 px-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditingWorker(worker)}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors cursor-pointer text-[11px] font-bold border border-indigo-200/60"
                        title={`Edit ${worker.name}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      {/* Explicit Permanent Delete Action Button */}
                      <button
                        onClick={() => setDeleteModalWorker(worker)}
                        className="flex items-center gap-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors cursor-pointer text-[11px] font-bold border border-rose-200/60"
                        title={`Permanently delete or retire ${worker.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredWorkers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium text-xs">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No staff members found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Edit Worker Modal */}
      {/* ========================================================================= */}
      {editingWorker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                <Edit2 className="w-4 h-4" /> Edit Employee Details
              </h3>
              <button onClick={() => setEditingWorker(null)} className="text-indigo-200 hover:text-white transition-colors p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Staff ID</label>
                  <input
                    type="text"
                    required
                    value={editingWorker.staffId || ''}
                    onChange={(e) => setEditingWorker({...editingWorker, staffId: e.target.value})}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Employee Name</label>
                  <input
                    type="text"
                    required
                    value={editingWorker.name}
                    onChange={(e) => setEditingWorker({...editingWorker, name: e.target.value})}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Designation</label>
                  <input
                    type="text"
                    required
                    value={editingWorker.designation || ''}
                    onChange={(e) => {
                      const desig = e.target.value;
                      const desigLower = desig.toLowerCase();
                      let newRole = editingWorker.role;
                      if (desigLower.includes('manager')) newRole = 'MANAGER';
                      else if (desigLower.includes('supervisor')) newRole = 'SUPERVISOR';
                      else if (desigLower.includes('executive')) newRole = 'EXECUTIVE';
                      else if (desigLower.includes('technici')) newRole = 'TECHNICIAN';
                      else if (desigLower.includes('operator')) newRole = 'OPERATOR';
                      else newRole = 'HELPER';
                      
                      setEditingWorker({
                        ...editingWorker, 
                        designation: desig,
                        role: newRole
                      });
                    }}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Department</label>
                  <select
                    value={editingWorker.department}
                    onChange={(e) => setEditingWorker({...editingWorker, department: e.target.value})}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    {ALL_DEPARTMENTS.filter(d => d !== 'All').map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Shift Selection</label>
                <select
                  value={editingWorker.shift}
                  onChange={(e) => setEditingWorker({...editingWorker, shift: e.target.value as 'DAY' | 'NIGHT'})}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                >
                  <option value="DAY">Day Shift</option>
                  <option value="NIGHT">Night Shift</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingWorker(null)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Permanent Delete / Retire Confirmation Modal */}
      {/* ========================================================================= */}
      {deleteModalWorker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" /> Delete Employee Record
              </h3>
              <button onClick={() => setDeleteModalWorker(null)} className="text-rose-200 hover:text-white transition-colors p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-1">
                <div className="font-black text-slate-900 text-sm">{deleteModalWorker.name}</div>
                <div className="text-slate-500">
                  Staff ID: <span className="font-bold text-slate-800">{deleteModalWorker.staffId || 'N/A'}</span> | Dept: <span className="font-bold text-slate-800">{deleteModalWorker.department}</span>
                </div>
                <div className="text-slate-500">
                  Role: <span className="font-bold text-slate-800">{deleteModalWorker.designation || deleteModalWorker.role}</span> | Shift: <span className="font-bold text-slate-800">{deleteModalWorker.shift}</span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {/* Option 1: PERMANENT PURGE (हमेशा के लिए डिलीट) */}
                <button
                  onClick={() => handlePermanentDelete(deleteModalWorker)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border-2 border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 transition-colors cursor-pointer group text-left shadow-xs"
                >
                  <div>
                    <div className="font-black text-xs flex items-center gap-1.5 text-rose-700">
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      Permanently Delete (हमेशा के लिए हटाएँ)
                    </div>
                    <div className="text-[11px] text-rose-700 font-medium mt-1">
                      डेटाबेस और सभी डिवाइस से इस कर्मचारी को पूरी तरह स्थायी रूप से मिटा दिया जाएगा।
                    </div>
                  </div>
                  <span className="text-sm font-black text-rose-600 group-hover:translate-x-1 transition-transform ml-2">→</span>
                </button>

                {/* Option 2: Soft Retire / Mark Inactive */}
                <button
                  onClick={() => handleToggleActiveStatus(deleteModalWorker, deleteModalWorker.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE')}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition-colors cursor-pointer group text-left"
                >
                  <div>
                    <div className="font-bold text-xs flex items-center gap-1.5 text-slate-800">
                      <UserX className="w-4 h-4 text-amber-600" />
                      {deleteModalWorker.status === 'INACTIVE' ? 'Activate Employee (सक्रिय करें)' : 'Mark Inactive Only (सिर्फ निष्क्रिय करें)'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      दैनिक फ्लोर से हटाएँ लेकिन पुराना प्रोडक्शन इतिहास सुरक्षित रखें।
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-500 group-hover:translate-x-1 transition-transform ml-2">→</span>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteModalWorker(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Sync Standard Roster Modal */}
      {/* ========================================================================= */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                <RotateCcw className="w-5 h-5" /> Sync Standard Company Roster
              </h3>
              <button onClick={() => setShowSyncModal(false)} className="text-amber-200 hover:text-white transition-colors p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold mb-1">Restore Standard 82 Employees Roster?</div>
                  <div className="text-amber-800/90 leading-relaxed">
                    This will synchronize and reset all departments with the factory's official 82 staff members and clear any temporary tombstones.
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResetRoster}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Confirm & Sync Roster
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: Clear All Modal */}
      {/* ========================================================================= */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                <XCircle className="w-5 h-5" /> Warning: Remove All Employees
              </h3>
              <button onClick={() => setShowClearAllModal(false)} className="text-rose-200 hover:text-white transition-colors p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold mb-1">Are you sure you want to empty the roster?</div>
                  <div className="text-rose-800/90 leading-relaxed">
                    This will remove <b>all {floorWorkers.length} employees</b> from the master directory. You can reload them anytime via CSV or the Sync Roster button.
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowClearAllModal(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearAll}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Yes, Clear All Employees
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
