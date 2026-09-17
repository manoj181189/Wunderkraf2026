import React, { useState } from 'react';
import { ArrowLeft, Users, UserPlus, Trash2, Search, RotateCcw, Building, CheckCircle2, Download, XCircle, Upload, Edit2, X } from 'lucide-react';
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

  const [activeDept, setActiveDept] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Add new employee state
  const [staffId, setStaffId] = useState('');
  const [newWorkerName, setNewWorkerName] = useState('');
  const [designation, setDesignation] = useState('Helper');
  const [newRole, setNewRole] = useState<WorkforceRole>('HELPER');
  const [targetDept, setTargetDept] = useState('Packing');
  const [editingWorker, setEditingWorker] = useState<FloorWorker | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };


  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;

    // Build the new floorWorkers array
    const updatedFloorWorkers = floorWorkers.map(w => w.id === editingWorker.id ? editingWorker : w);
    
    // Automatically rebuild deptWorkers to ensure perfect sync
    const updatedDeptWorkers: Record<string, string[]> = {};
    updatedFloorWorkers.forEach(w => {
      if (!updatedDeptWorkers[w.department]) updatedDeptWorkers[w.department] = [];
      if (!updatedDeptWorkers[w.department].includes(w.name)) {
        updatedDeptWorkers[w.department].push(w.name);
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
      inTime: '08:00 AM'
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
    showNotification(`Added ${cleanName} to ${targetDept}`);
  };

  const handleRemoveWorker = (workerId: string, workerName: string, dept: string) => {
    // 1. Remove from floor roster
    const updatedFloorWorkers = floorWorkers.filter(w => w.id !== workerId);
    setFloorWorkers(updatedFloorWorkers);

    // 2. Remove from deptWorkers mapping if no other worker has this name in dept
    const hasOtherSameName = updatedFloorWorkers.some(w => w.name === workerName && w.department === dept);
    let updatedDeptWorkers = deptWorkers;
    if (!hasOtherSameName && deptWorkers[dept]) {
      updatedDeptWorkers = {
        ...deptWorkers,
        [dept]: (deptWorkers[dept] || []).filter(w => w !== workerName)
      };
      setDeptWorkers(updatedDeptWorkers);
    }

    onSaveState({
      ...state,
      deptWorkers: updatedDeptWorkers,
      floorWorkers: updatedFloorWorkers
    });

    showNotification(`Removed ${workerName}`);
  };

  const handleResetToStandardRoster = () => {
    if (window.confirm('Reset all employee records to standard company roster (82 Employees)? This will clear old obsolete names.')) {
      setDeptWorkers(DEPT_WORKERS);
      setFloorWorkers(DEFAULT_FLOOR_WORKERS);
      onSaveState({
        ...state,
        deptWorkers: DEPT_WORKERS,
        floorWorkers: DEFAULT_FLOOR_WORKERS
      });
      showNotification('Successfully synced master employee directory with 82 company staff members.');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Staff ID', 'Name', 'Designation', 'Department', 'Shift'];
    const rows = filteredWorkers.map(w => [
      w.staffId || '',
      `"${w.name}"`,
      w.designation || w.role,
      w.department,
      w.shift
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'employee_roster_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Downloaded employee list as CSV');
  };

  

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      
      const newWorkers: FloorWorker[] = [];
      const newDeptMap: Record<string, string[]> = {};

      // Skip header row (index 0)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Handle CSV split (respecting quotes for Name)
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
          inTime: '08:00 AM'
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
        showNotification(`Successfully uploaded ${newWorkers.length} employees from CSV. Master list replaced.`);
      } else {
        alert("No valid employee rows found in CSV.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  const handleClearAll = () => {
    if (window.confirm('WARNING: Are you sure you want to REMOVE ALL employees? This will empty the directory.')) {
      setDeptWorkers({});
      setFloorWorkers([]);
      onSaveState({
        ...state,
        deptWorkers: {},
        floorWorkers: []
      });
      showNotification('Cleared all employee records.');
    }
  };

  // Filtered workers list
  const filteredWorkers = floorWorkers.filter(w => {
    const matchesDept = activeDept === 'All' || w.department === activeDept;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      w.name.toLowerCase().includes(q) || 
      (w.staffId && w.staffId.toLowerCase().includes(q)) || 
      (w.designation && w.designation.toLowerCase().includes(q)) ||
      (w.department && w.department.toLowerCase().includes(q));
    return matchesDept && matchesSearch;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBackToHub} 
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              Employee Master Directory
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Total Active Employees: <span className="font-bold text-indigo-600">{floorWorkers.length}</span> staff members
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          
          <div className="relative overflow-hidden inline-block">
            <button 
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-2 rounded-lg transition-colors shadow-xs"
              title="Upload CSV to replace the roster"
            >
              <Upload className="w-4 h-4 text-indigo-600" />
              Upload CSV
            </button>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
            />
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-lg transition-colors shadow-xs"
            title="Download full employee roster as CSV template"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Download
          </button>
          
          <button 
            onClick={handleClearAll}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-lg transition-colors shadow-xs"
            title="Remove all employees from the system"
          >
            <XCircle className="w-4 h-4 text-rose-600" />
            Clear All
          </button>

          <button 
            onClick={handleResetToStandardRoster}
            className="flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-2 rounded-lg transition-colors shadow-xs"
            title="Restore factory standard 82 staff roster"
          >
            <RotateCcw className="w-4 h-4 text-amber-600" />
            Sync Roster
          </button>
        </div>
      </div>

      {notification && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {notification}
        </div>
      )}

      {/* Add New Employee Form */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
          <UserPlus className="w-4 h-4 text-indigo-600" /> Add New Employee / Staff Member
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Staff ID</label>
            <input
              type="text"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="e.g. EMP00125"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Employee Full Name *</label>
            <input
              type="text"
              value={newWorkerName}
              onChange={(e) => setNewWorkerName(e.target.value)}
              placeholder="Enter full name"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Designation</label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Helper, Operator"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Department</label>
            <select
              value={targetDept}
              onChange={(e) => setTargetDept(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              {ALL_DEPARTMENTS.filter(d => d !== 'All').map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAddWorker}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Save Staff
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left: Department Selector */}
        <div className="md:col-span-1 border-r border-slate-100 pr-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-slate-400" /> Departments
          </h3>
          <div className="space-y-1">
            {ALL_DEPARTMENTS.map(dept => {
              const count = dept === 'All' 
                ? floorWorkers.length 
                : floorWorkers.filter(w => w.department === dept).length;
              const isSelected = activeDept === dept;
              return (
                <button
                  key={dept}
                  onClick={() => setActiveDept(dept)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${
                    isSelected 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{dept}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Workers List */}
        <div className="md:col-span-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by Name, Staff ID, Designation, or Dept..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-semibold self-center whitespace-nowrap">
              Showing <span className="font-bold text-slate-800">{filteredWorkers.length}</span> staff
            </div>
          </div>

          {/* Staff Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Staff ID</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Designation</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-center">Shift</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWorkers.map((worker, idx) => (
                  <tr key={worker.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-slate-400 font-medium text-[11px]">{idx + 1}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800 text-[11px]">
                      {worker.staffId || '-'}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900">
                      {worker.name}
                    </td>
                    <td className="py-2 px-3">
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
                    <td className="py-2 px-3 font-semibold text-slate-700">
                      {worker.department}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                        {worker.shift}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditingWorker(worker)}
                          className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded transition-colors"
                          title={`Edit ${worker.name}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveWorker(worker.id, worker.name, worker.department)}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded transition-colors"
                          title={`Remove ${worker.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredWorkers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium text-xs">
                      No staff members found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Worker Modal */}
      {editingWorker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-indigo-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                <Edit2 className="w-4 h-4" /> Edit Employee
              </h3>
              <button onClick={() => setEditingWorker(null)} className="text-indigo-200 hover:text-white transition-colors p-1">
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
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Employee Name</label>
                  <input
                    type="text"
                    required
                    value={editingWorker.name}
                    onChange={(e) => setEditingWorker({...editingWorker, name: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Department</label>
                  <select
                    value={editingWorker.department}
                    onChange={(e) => setEditingWorker({...editingWorker, department: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
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
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                >
                  <option value="DAY">Day Shift</option>
                  <option value="NIGHT">Night Shift</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingWorker(null)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-bold shadow-sm transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
