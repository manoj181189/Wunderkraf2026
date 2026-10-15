import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Users,
  UserCheck,
  Shield,
  Activity,
  Award,
  Layers,
  Calendar,
  Clock,
  Briefcase,
  TrendingUp,
  Wrench,
  SearchCheck,
  CheckCircle2,
  AlertCircle,
  Scissors,
  Cog,
  Package,
  Droplets,
  ArrowRight,
  MessageSquare,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  UserPlus,
  X,
  Check,
  Copy,
  Star,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  FileCheck
} from 'lucide-react';
import {
  FactoryState,
  FloorWorker,
  WorkforceRole,
  Job,
  RunningBatch,
  ShiftHandoverRecord,
  CurrentView
} from '../../types';
import { DEFAULT_FLOOR_WORKERS } from '../../lib/constants';
import { LiveFloorManpowerTracker } from '../LiveFloorManpowerTracker';
import {
  calculateOperatorPerformanceCards,
  OperatorPerformanceItem,
  autoRegisterWorker
} from '../../lib/workerUtils';

interface ExecutiveManpowerViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (nextState: FactoryState) => void;
  onNavigateToView?: (view: CurrentView) => void;
  currentUser?: { username: string; perms: string[] } | null;
}

type ManpowerTab = 'FLOOR_CREW' | 'PERFORMANCE' | 'ATTENDANCE_HANDOVER' | 'STAFF_MASTER';

export const ExecutiveManpowerView: React.FC<ExecutiveManpowerViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onNavigateToView,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<ManpowerTab>('FLOOR_CREW');

  // Performance Filters
  const [perfDeptFilter, setPerfDeptFilter] = useState<string>('ALL');
  const [perfShiftFilter, setPerfShiftFilter] = useState<string>('ALL');
  const [perfSearch, setPerfSearch] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Staff Master State
  const [staffSearch, setStaffSearch] = useState<string>('');
  const [staffDeptFilter, setStaffDeptFilter] = useState<string>('ALL');
  const [isAddStaffOpen, setIsAddStaffOpen] = useState<boolean>(false);
  const [editingStaff, setEditingStaff] = useState<FloorWorker | null>(null);

  // Form states for Add/Edit Staff
  const [staffFormName, setStaffFormName] = useState('');
  const [staffFormRole, setStaffFormRole] = useState<WorkforceRole>('OPERATOR');
  const [staffFormDept, setStaffFormDept] = useState('Cutting');
  const [staffFormMachine, setStaffFormMachine] = useState('');
  const [staffFormShift, setStaffFormShift] = useState<'DAY' | 'NIGHT'>('DAY');
  const [staffFormId, setStaffFormId] = useState('');
  const [staffFormNotes, setStaffFormNotes] = useState('');

  // Extract all workers
  const rawWorkers: FloorWorker[] = (state.floorWorkers !== undefined
    ? state.floorWorkers
    : DEFAULT_FLOOR_WORKERS).filter((w) => w.status !== 'INACTIVE');

  // Calculate real performance cards
  const performanceList = useMemo(() => {
    return calculateOperatorPerformanceCards(state);
  }, [state]);

  // Dynamically extract currently working operator and helper names across all running operations
  const activeWorkerNames = useMemo(() => {
    const set = new Set<string>();
    (state.jobs || []).forEach((job) => {
      (job.runningBatches || []).forEach((b) => {
        if (b.status === 'Running' || b.status === 'Held') {
          if (b.worker) set.add(b.worker.toUpperCase());
          if (b.operator) set.add(b.operator.toUpperCase());
          if (b.helpers) {
            b.helpers.forEach((h) => set.add(h.toUpperCase()));
          }
        }
      });
    });

    (state.packJobs || []).forEach((pj) => {
      if (pj.status === 'Running' || pj.status === 'Active') {
        if (pj.packer) set.add(pj.packer.toUpperCase());
        if (pj.helper) set.add(pj.helper.toUpperCase());
      }
    });
    return set;
  }, [state.jobs, state.packJobs]);

  // Aggregate high-level stats
  const totalRoster = rawWorkers.length;
  // Physical Attendance: marked as Present or shiftStatus !== 'ABSENT'/'ON_LEAVE'
  const physicallyPresent = rawWorkers.filter(
    (w) => w.shiftStatus === 'PRESENT' || (w.shiftStatus === undefined && w.isPresent)
  ).length;
  // Machine Active: currently executing a batch on machine
  const activeOnMachine = rawWorkers.filter((w) => activeWorkerNames.has(w.name.toUpperCase())).length;
  // Standby: physically present but machine is currently not running a batch
  const standbyAvailable = Math.max(0, physicallyPresent - activeOnMachine);
  const dayShiftWorkers = rawWorkers.filter((w) => w.shift === 'DAY').length;
  const nightShiftWorkers = rawWorkers.filter((w) => w.shift === 'NIGHT').length;
  const operatorsCount = rawWorkers.filter((w) => w.role === 'OPERATOR').length;
  const helpersCount = rawWorkers.filter((w) => w.role === 'HELPER').length;
  const supervisorsCount = rawWorkers.filter((w) => w.role === 'SUPERVISOR').length;
  const qcCount = rawWorkers.filter((w) => w.role === 'QC_INSPECTOR').length;

  // Machine Allocations summary
  const machineAllocations = useMemo(() => {
    const list: Array<{
      machine: string;
      operator: string;
      helpers: string[];
      jobId: string;
      batchId: string;
      stage: string;
      shift: string;
    }> = [];

    (state.jobs || []).forEach((j) => {
      (j.runningBatches || []).forEach((b) => {
        if (b.status === 'Running' || b.status === 'Held') {
          list.push({
            machine: b.machine,
            operator: b.worker || b.operator || 'OPERATOR',
            helpers: b.helpers || [],
            jobId: j.id,
            batchId: b.batchId,
            stage: b.stage,
            shift: b.shift || 'DAY'
          });
        }
      });
    });
    return list;
  }, [state.jobs]);

  // Filtered Performance List
  const filteredPerfList = useMemo(() => {
    return performanceList.filter((item) => {
      if (perfDeptFilter !== 'ALL' && item.department.toLowerCase() !== perfDeptFilter.toLowerCase()) {
        return false;
      }
      if (perfShiftFilter !== 'ALL' && item.shift.toUpperCase() !== perfShiftFilter.toUpperCase()) {
        return false;
      }
      if (perfSearch.trim()) {
        const q = perfSearch.toLowerCase();
        const mName = item.name.toLowerCase().includes(q);
        const mStation = item.assignedMachine.toLowerCase().includes(q);
        if (!mName && !mStation) return false;
      }
      return true;
    });
  }, [performanceList, perfDeptFilter, perfShiftFilter, perfSearch]);

  // Filtered Staff Master List
  const filteredStaffList = useMemo(() => {
    return rawWorkers.filter((w) => {
      if (staffDeptFilter !== 'ALL' && w.department.toLowerCase() !== staffDeptFilter.toLowerCase()) {
        return false;
      }
      if (staffSearch.trim()) {
        const q = staffSearch.toLowerCase();
        const mName = w.name.toLowerCase().includes(q);
        const mRole = (w.role || '').toLowerCase().includes(q);
        const mMachine = (w.assignedMachine || '').toLowerCase().includes(q);
        const mId = (w.staffId || '').toLowerCase().includes(q);
        if (!mName && !mRole && !mMachine && !mId) return false;
      }
      return true;
    });
  }, [rawWorkers, staffDeptFilter, staffSearch]);

  // Top performer in output
  const topPerformer = useMemo(() => {
    if (performanceList.length === 0) return null;
    return [...performanceList].sort((a, b) => b.totalPieces - a.totalPieces)[0];
  }, [performanceList]);

  // Best Quality Performer (lowest scrap with meaningful output)
  const qualityStar = useMemo(() => {
    const producing = performanceList.filter((p) => p.totalPieces > 1000);
    if (producing.length === 0) return null;
    return [...producing].sort((a, b) => a.scrapPercent - b.scrapPercent)[0];
  }, [performanceList]);

  // Quick Attendance Status Toggle
  const handleToggleAttendance = (workerId: string) => {
    const currentWorkers = state.floorWorkers || DEFAULT_FLOOR_WORKERS;
    const updated = currentWorkers.map((w) => {
      if (w.id === workerId) {
        const nextStatus = w.shiftStatus === 'PRESENT' ? 'ON_LEAVE' : 'PRESENT';
        return {
          ...w,
          shiftStatus: nextStatus as any,
          isPresent: nextStatus === 'PRESENT'
        };
      }
      return w;
    });

    onSaveState({
      ...state,
      floorWorkers: updated
    });
  };

  // Add new staff handler
  const handleSaveNewStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffFormName.trim()) return;

    const cleanName = staffFormName.trim().toUpperCase();
    const newWorker: FloorWorker = {
      id: `EMP-${Date.now()}`,
      name: cleanName,
      staffId: staffFormId.trim().toUpperCase() || undefined,
      role: staffFormRole,
      department: staffFormDept,
      assignedMachine: staffFormMachine.trim() || undefined,
      shift: staffFormShift,
      isPresent: true,
      shiftStatus: 'PRESENT',
      inTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      notes: staffFormNotes.trim() || undefined,
      status: 'ACTIVE'
    };

    const currentList = state.floorWorkers || DEFAULT_FLOOR_WORKERS;
    const updatedFloor = [newWorker, ...currentList];

    // Also sync to deptWorkers
    const updatedDept = { ...(state.deptWorkers || {}) };
    const curDeptArr = updatedDept[staffFormDept] || [];
    if (!curDeptArr.includes(cleanName)) {
      updatedDept[staffFormDept] = [...curDeptArr, cleanName];
    }

    onSaveState({
      ...state,
      floorWorkers: updatedFloor,
      deptWorkers: updatedDept
    });

    setIsAddStaffOpen(false);
    setStaffFormName('');
    setStaffFormId('');
    setStaffFormMachine('');
    setStaffFormNotes('');
  };

  // Edit staff handler
  const handleSaveEditStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    const currentList = state.floorWorkers || DEFAULT_FLOOR_WORKERS;
    const updated = currentList.map((w) => {
      if (w.id === editingStaff.id) {
        return editingStaff;
      }
      return w;
    });

    onSaveState({
      ...state,
      floorWorkers: updated
    });

    setEditingStaff(null);
  };

  // WhatsApp Comprehensive Report text
  const generateFullManpowerWhatsAppReport = () => {
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    let msg = `🏭 *WUNDERKRAF ERP: मेन पावर व ऑपरेटर शिफ्ट रिपोर्ट* 🏭\n`;
    msg += `📅 तारीख: ${dateStr} | ⏰ समय: ${timeStr}\n`;
    msg += `-------------------------------------------\n`;
    msg += `👥 *कुल स्टाफ (Roster):* ${totalRoster} कर्मचारी\n`;
    msg += `🟢 *हाजिरी में उपस्थित:* ${physicallyPresent} | 🔴 *छुट्टी पर:* ${totalRoster - physicallyPresent}\n`;
    msg += `⚡ *मशीन पर कार्यरत (Active):* ${activeOnMachine} | 🟡 *उपलब्ध / स्टैंडबाय:* ${standbyAvailable}\n`;
    msg += `☀️ डे शिफ्ट: ${dayShiftWorkers} | 🌙 नाइट शिफ्ट: ${nightShiftWorkers}\n`;
    msg += `-------------------------------------------\n`;
    msg += `⚙️ *लाइव मशीन तैनाती (Station Crew Pairing):*\n`;

    if (machineAllocations.length === 0) {
      msg += `(अभी कोई मशीन रनिंग बैच में नहीं है)\n`;
    } else {
      machineAllocations.forEach((alloc) => {
        msg += `• *${alloc.machine}* [${alloc.stage} - ${alloc.shift}]:\n`;
        msg += `  👨‍🔧 ऑपरेटर: ${alloc.operator}\n`;
        msg += `  🤝 हेल्पर्स: ${alloc.helpers.length > 0 ? alloc.helpers.join(', ') : 'कोई नहीं'}\n`;
        if (alloc.jobId) msg += `  📦 जॉब: ${alloc.jobId} (${alloc.batchId})\n`;
      });
    }

    msg += `-------------------------------------------\n`;
    msg += `📊 *ऑपरेटर फेस-टू-फेस परफॉर्मेंस (Top Active Outputs):*\n`;

    const activePerf = performanceList.filter((p) => p.totalPieces > 0 || p.totalRolls > 0 || p.totalBoxes > 0);
    if (activePerf.length === 0) {
      msg += `(अभी कोई प्रोडक्शन बैच का आउटपुट दर्ज नहीं है)\n`;
    } else {
      activePerf.slice(0, 8).forEach((p) => {
        msg += `• *${p.name}* (${p.assignedMachine} - ${p.shift}):\n`;
        msg += `  उत्पादन: ${p.totalPieces.toLocaleString()} Pcs (${p.totalCrates} Crates) | वेस्टेज: ${p.totalScrapKg} KG\n`;
        msg += `  OEE स्कोर: ${p.efficiencyScore}% [${p.ratingBadge}]\n`;
      });
    }

    msg += `-------------------------------------------\n`;
    msg += `✓ *यह रिपोर्ट सिस्टम के वास्तविक बैच और लाइव मशीन डेटा से प्रमाणित है।*`;

    return msg;
  };

  const handleSendWhatsApp = () => {
    const text = generateFullManpowerWhatsAppReport();
    const encoded = encodeURIComponent(text);
    const waUrl = `https://wa.me/?text=${encoded}`;

    // Try opening popup, if blocked fallback to clipboard
    try {
      window.open(waUrl, '_blank');
    } catch (e) {
      navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  const handleCopyReport = () => {
    const text = generateFullManpowerWhatsAppReport();
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-16 font-sans">
      {/* Top Navigation & App Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHub}
              className="flex items-center gap-1.5 text-xs font-black text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>मेन मेनू (Back)</span>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white flex items-center justify-center font-extrabold shadow-sm">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 m-0">
                    मैन पावर डेस्क (Manpower & Workforce Desk)
                  </h1>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    ● लाइव ऑडिट
                  </span>
                </div>
                <p className="text-xs text-slate-500 m-0">
                  ऑपरेटर-हेल्पर मशीन पेयरिंग, फेस-टू-फेस प्रोडक्शन स्कोरकार्ड व शिफ्ट कस्टडी हैंडओवर
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyReport}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="Copy Manpower Report Text"
            >
              {copySuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copySuccess ? 'कॉपी हो गया!' : 'रिपोर्ट कॉपी'}</span>
            </button>

            <button
              onClick={handleSendWhatsApp}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp शिफ्ट रिपोर्ट</span>
            </button>

            <button
              onClick={() => setIsAddStaffOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ नया ऑपरेटर / हेल्पर</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 border-t border-slate-100 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('FLOOR_CREW')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'FLOOR_CREW'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>1. लाइव फ्लोर तैनाती (Floor Crew & Pairing)</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'FLOOR_CREW' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {activeOnMachine} Active
            </span>
          </button>

          <button
            onClick={() => setActiveTab('PERFORMANCE')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'PERFORMANCE'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>2. ऑपरेटर फेस-टू-फेस परफॉर्मेंस (Performance Scorecard)</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'PERFORMANCE' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {performanceList.length} Roster
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ATTENDANCE_HANDOVER')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'ATTENDANCE_HANDOVER'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>3. हाजिरी व शिफ्ट हैंडओवर (Attendance & Handover)</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'ATTENDANCE_HANDOVER' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {(state.shiftHandovers || []).length} Logs
            </span>
          </button>

          <button
            onClick={() => setActiveTab('STAFF_MASTER')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'STAFF_MASTER'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>4. कर्मचारी डायरेक्टरी (Staff Master & Roles)</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'STAFF_MASTER' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {rawWorkers.length} Staff
            </span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* ========================================================================= */}
        {/* TOP LEVEL 6 DISTINCT KPI COUNTER CARDS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Staff */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              कुल स्टाफ (Roster)
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-slate-900 font-mono">{totalRoster}</span>
              <span className="text-[11px] text-slate-500 font-bold">स्टाफ</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-semibold">
              {operatorsCount} ऑपरेटर • {helpersCount} हेल्पर
            </div>
          </div>

          {/* Physically Present */}
          <div className="bg-white border border-blue-200 rounded-2xl p-3.5 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-blue-700 block tracking-wider">
              हाजिरी (Punch Present)
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-blue-900 font-mono">{physicallyPresent}</span>
              <span className="text-[11px] text-blue-600 font-bold">उपस्थित</span>
            </div>
            <div className="text-[10px] text-rose-600 mt-1 font-bold">
              {totalRoster - physicallyPresent} अनुपस्थित / छुट्टी पर
            </div>
          </div>

          {/* Active on Machine */}
          <div className="bg-emerald-50/70 border-2 border-emerald-400 rounded-2xl p-3.5 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-emerald-800 block tracking-wider">
              🟢 मशीन पर कार्यरत
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-emerald-950 font-mono">{activeOnMachine}</span>
              <span className="text-[11px] text-emerald-700 font-bold">मशीन चालू</span>
            </div>
            <div className="text-[10px] text-emerald-700 mt-1 font-bold">
              {machineAllocations.length} स्टेशन एक्टिव
            </div>
          </div>

          {/* Standby / Free */}
          <div className="bg-amber-50/70 border-2 border-amber-300 rounded-2xl p-3.5 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-amber-800 block tracking-wider">
              🟡 स्टैंडबाय / फ्री
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-amber-950 font-mono">{standbyAvailable}</span>
              <span className="text-[11px] text-amber-700 font-bold">उपलब्ध</span>
            </div>
            <div className="text-[10px] text-amber-800 mt-1 font-semibold">
              रोल चेंज / सहायता हेतु
            </div>
          </div>

          {/* Shifts */}
          <div className="bg-white border border-purple-200 rounded-2xl p-3.5 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-purple-700 block tracking-wider">
              शिफ्ट रोटेशन
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-purple-950 font-mono">{dayShiftWorkers}</span>
              <span className="text-[11px] text-purple-600 font-bold">Day</span>
              <span className="text-slate-300 mx-0.5">/</span>
              <span className="text-xl font-black text-purple-950 font-mono">{nightShiftWorkers}</span>
              <span className="text-[11px] text-purple-600 font-bold">Night</span>
            </div>
            <div className="text-[10px] text-purple-700 mt-1 font-semibold">
              2-शिफ्ट शेड्यूलिंग
            </div>
          </div>

          {/* Supervisors & QC */}
          <div className="bg-white border border-indigo-200 rounded-2xl p-3.5 shadow-2xs">
            <span className="text-[10px] font-black uppercase text-indigo-700 block tracking-wider">
              सुपरवाइजर व QC
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-indigo-950 font-mono">
                {supervisorsCount + qcCount}
              </span>
              <span className="text-[11px] text-indigo-600 font-bold">प्रभारी</span>
            </div>
            <div className="text-[10px] text-indigo-700 mt-1 font-semibold">
              {supervisorsCount} सुप • {qcCount} QC निरीक्षक
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: FLOOR CREW & MACHINE PAIRING */}
        {/* ========================================================================= */}
        {activeTab === 'FLOOR_CREW' && (
          <div className="space-y-6">
            {/* Live Running Station Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide m-0 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>लाइव मशीन पर ऑपरेटर व हेल्पर तैनाती (Current Running Stations)</span>
                  </h3>
                  <p className="text-xs text-slate-500 m-0">
                    Slitting, Cutting, Forming और Packing लाइनों पर कार्यरत मुख्य ऑपरेटर व उनके साथ जुड़े हेल्पर्स
                  </p>
                </div>
                <span className="text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl">
                  {machineAllocations.length} स्टेशन चालू हैं
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-black text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-3.5">स्टेशन / मशीन</th>
                      <th className="py-3 px-3">डिपार्टमेंट</th>
                      <th className="py-3 px-3">लीड ऑपरेटर (Operator)</th>
                      <th className="py-3 px-3">असाइंड हेल्पर्स (Helpers)</th>
                      <th className="py-3 px-3">सक्रिय जॉब ID</th>
                      <th className="py-3 px-3 text-right">शिफ्ट</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {machineAllocations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                          अभी कोई भी मशीन चालू नहीं है। मशीनें या तो वेटिंग में हैं या मेंटेनेंस पर हैं।
                        </td>
                      </tr>
                    ) : (
                      machineAllocations.map((alloc, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3.5 font-black text-slate-900 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                            <span className="font-mono text-sm">{alloc.machine}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-indigo-100">
                              {alloc.stage}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-black text-blue-950 text-xs flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                                OP
                              </span>
                              <span>{alloc.operator}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {alloc.helpers.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {alloc.helpers.map((h, hIdx) => (
                                  <span
                                    key={hIdx}
                                    className="bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1"
                                  >
                                    <span>🤝</span>
                                    <span>{h}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">कोई हेल्पर नहीं जुड़ा</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-700 font-bold">
                            {alloc.jobId}{' '}
                            <span className="text-[10px] text-slate-400 font-normal">({alloc.batchId})</span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                                alloc.shift === 'DAY'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              }`}
                            >
                              {alloc.shift} SHIFT
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Embedded Live Floor Manpower Tracker Component for Station Assignment */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
              <LiveFloorManpowerTracker
                state={state}
                onSaveState={onSaveState}
                currentUser={currentUser}
              />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: OPERATOR FACE-TO-FACE PERFORMANCE SCORECARD */}
        {/* ========================================================================= */}
        {activeTab === 'PERFORMANCE' && (
          <div className="space-y-6">
            {/* Highlights Bar: Top Producer & Top Quality */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Star Producer */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-4 shadow-md flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-black uppercase tracking-wider mb-1">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>शीर्ष उत्पादक ऑपरेटर (Top Output Champion)</span>
                  </div>
                  <div className="text-xl font-black">{topPerformer ? topPerformer.name : 'डेटा प्रतीक्षित'}</div>
                  <div className="text-xs text-blue-200 mt-1">
                    मशीन: <b>{topPerformer?.assignedMachine || '-'}</b> • कुल उत्पादन:{' '}
                    <b>{topPerformer ? topPerformer.totalPieces.toLocaleString() : 0} Pcs</b> (
                    {topPerformer?.totalCrates || 0} क्रेट्स)
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-amber-400 text-xl font-black">
                  🏆
                </div>
              </div>

              {/* Quality Champion */}
              <div className="bg-gradient-to-r from-emerald-900 to-teal-950 text-white rounded-2xl p-4 shadow-md flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-black uppercase tracking-wider mb-1">
                    <Award className="w-4 h-4 text-emerald-400" />
                    <span>गुणवत्ता व न्यूनतम वेस्टेज स्टार (Zero Wastage Hero)</span>
                  </div>
                  <div className="text-xl font-black">{qualityStar ? qualityStar.name : 'डेटा प्रतीक्षित'}</div>
                  <div className="text-xs text-emerald-200 mt-1">
                    वेस्टेज प्रतिशत: <b>{qualityStar ? qualityStar.scrapPercent : 0}%</b> • OEE स्कोर:{' '}
                    <b>{qualityStar?.efficiencyScore || 95}%</b>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-300 text-xl font-black">
                  ⭐
                </div>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={perfSearch}
                    onChange={(e) => setPerfSearch(e.target.value)}
                    placeholder="ऑपरेटर नाम या मशीन खोजें..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-indigo-500 font-medium"
                  />
                </div>

                {/* Dept Filter */}
                <select
                  value={perfDeptFilter}
                  onChange={(e) => setPerfDeptFilter(e.target.value)}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 cursor-pointer"
                >
                  <option value="ALL">सभी विभाग (All Depts)</option>
                  <option value="Slitting">Slitting</option>
                  <option value="Cutting">Cutting</option>
                  <option value="Forming">Forming</option>
                  <option value="QC">QC</option>
                  <option value="Packing">Packing</option>
                </select>

                {/* Shift Filter */}
                <select
                  value={perfShiftFilter}
                  onChange={(e) => setPerfShiftFilter(e.target.value)}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 cursor-pointer"
                >
                  <option value="ALL">सभी शिफ्ट (All Shifts)</option>
                  <option value="DAY">डे शिफ्ट (DAY)</option>
                  <option value="NIGHT">नाइट शिफ्ट (NIGHT)</option>
                </select>
              </div>

              <div className="text-xs font-bold text-slate-500">
                कुल प्रदर्शित: <span className="text-slate-900 font-black">{filteredPerfList.length}</span> कर्मचारी
              </div>
            </div>

            {/* Performance Detailed Scorecard Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide m-0">
                    फेस-टू-फेस ऑपरेटर परफॉर्मेंस व यील्ड रजिस्टर (Production & Quality Accountability)
                  </h3>
                  <p className="text-xs text-slate-500 m-0">
                    प्रत्येक ऑपरेटर का वास्तविक उत्पादन, क्रेट्स, कुल स्क्रैप (KG), QC रिजेक्शन व OEE रेटिंग
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-black text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-3.5">ऑपरेटर का नाम</th>
                      <th className="py-3 px-3">विभाग व रोल</th>
                      <th className="py-3 px-3">मशीन व शिफ्ट</th>
                      <th className="py-3 px-3">ड्यूटी स्थिति</th>
                      <th className="py-3 px-3 text-right">कुल पीस (Pieces)</th>
                      <th className="py-3 px-3 text-right">क्रेट्स / रोल्स / बॉक्स</th>
                      <th className="py-3 px-3 text-right">स्क्रैप (KG व %)</th>
                      <th className="py-3 px-3 text-center">QC डिफेक्ट्स</th>
                      <th className="py-3 px-3 text-right">OEE यील्ड स्कोर</th>
                      <th className="py-3 px-3 text-center">रेटिंग</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPerfList.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                          कोई ऑपरेटर रिकॉर्ड नहीं मिला।
                        </td>
                      </tr>
                    ) : (
                      filteredPerfList.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition">
                          {/* Name */}
                          <td className="py-3 px-3.5">
                            <div className="font-black text-slate-900 text-xs">{item.name}</div>
                            {item.helpers.length > 0 && (
                              <div className="text-[10px] text-amber-800 font-bold mt-0.5">
                                हेल्पर्स: {item.helpers.join(', ')}
                              </div>
                            )}
                          </td>

                          {/* Dept & Role */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-700">{item.department}</div>
                            <span
                              className={`inline-block text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                                item.role === 'OPERATOR'
                                  ? 'bg-blue-100 text-blue-800'
                                  : item.role === 'HELPER'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {item.role}
                            </span>
                          </td>

                          {/* Machine & Shift */}
                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-slate-800">{item.assignedMachine}</div>
                            <span className="text-[10px] text-slate-500 font-semibold">{item.shift} Shift</span>
                          </td>

                          {/* Duty Status */}
                          <td className="py-3 px-3">
                            {item.isDutyActive ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-black">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                <span>मशीन पर कार्यरत</span>
                              </span>
                            ) : item.attendanceStatus === 'PRESENT' ? (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                <span>🟡 स्टैंडबाय</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                <span>🔴 अनुपस्थित</span>
                              </span>
                            )}
                          </td>

                          {/* Pieces Produced */}
                          <td className="py-3 px-3 text-right font-mono font-black text-indigo-950 text-xs">
                            {item.totalPieces > 0 ? item.totalPieces.toLocaleString() : '-'}
                          </td>

                          {/* Crates / Rolls / Boxes */}
                          <td className="py-3 px-3 text-right font-mono text-slate-700 font-bold">
                            {item.totalCrates > 0
                              ? `${item.totalCrates} Crates`
                              : item.totalRolls > 0
                              ? `${item.totalRolls} Rolls`
                              : item.totalBoxes > 0
                              ? `${item.totalBoxes} Boxes`
                              : '-'}
                          </td>

                          {/* Scrap Kg & % */}
                          <td className="py-3 px-3 text-right">
                            {item.totalScrapKg > 0 ? (
                              <div>
                                <span className="font-mono font-bold text-rose-700 text-xs">
                                  {item.totalScrapKg} KG
                                </span>
                                <span className="text-[10px] text-slate-400 block font-semibold">
                                  ({item.scrapPercent}%)
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">0.0 KG</span>
                            )}
                          </td>

                          {/* QC Defects */}
                          <td className="py-3 px-3 text-center">
                            {item.qcDefectCount > 0 ? (
                              <span className="font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-[10px]">
                                {item.qcDefectCount} डिफेक्ट्स
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-black text-[10px]">0 पास ✓</span>
                            )}
                          </td>

                          {/* Efficiency / Yield Score */}
                          <td className="py-3 px-3 text-right">
                            <div className="font-mono font-black text-slate-900 text-xs">
                              {item.efficiencyScore}%
                            </div>
                            <div className="w-16 ml-auto bg-slate-200 rounded-full h-1 mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.efficiencyScore >= 95
                                    ? 'bg-emerald-500'
                                    : item.efficiencyScore >= 90
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(100, item.efficiencyScore)}%` }}
                              />
                            </div>
                          </td>

                          {/* Rating Badge */}
                          <td className="py-3 px-3 text-center">
                            {item.ratingBadge === 'EXCELLENT' ? (
                              <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center justify-center gap-1">
                                <span>⭐</span> <span>उत्कृष्ट</span>
                              </span>
                            ) : item.ratingBadge === 'GOOD' ? (
                              <span className="bg-blue-100 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                सामान्य
                              </span>
                            ) : (
                              <span className="bg-rose-100 text-rose-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                समीक्षा चाहिए
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ATTENDANCE & SHIFT HANDOVER */}
        {/* ========================================================================= */}
        {activeTab === 'ATTENDANCE_HANDOVER' && (
          <div className="space-y-6">
            {/* Quick Attendance Punching Roster */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide m-0 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <span>दैनिक हाजिरी व फ्लोर उपस्थिति रजिस्टर (Daily Attendance Roster)</span>
                  </h3>
                  <p className="text-xs text-slate-500 m-0">
                    कर्मचारियों की हाजिरी सीधे यहीं से टॉगल करें (Present / On Leave)
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                    🟢 उपस्थित: {physicallyPresent}
                  </span>
                  <span className="text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200">
                    🔴 छुट्टी/अनुपस्थित: {totalRoster - physicallyPresent}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {rawWorkers.map((w) => {
                  const isPres = w.shiftStatus === 'PRESENT' || (w.shiftStatus === undefined && w.isPresent);
                  return (
                    <div
                      key={w.id}
                      className={`p-3 rounded-xl border transition flex items-center justify-between gap-2 ${
                        isPres ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50/70 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-extrabold text-xs text-slate-900 truncate">{w.name}</div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {w.department} • {w.role} ({w.shift})
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleAttendance(w.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition whitespace-nowrap ${
                          isPres
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                        }`}
                      >
                        {isPres ? '✓ उपस्थित' : 'छुट्टी पर'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shift Handover Records Ledger */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide m-0 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>शिफ्ट कस्टडी व मशीन हैंडओवर लॉगबुक (Shift Custody Handover Logbook)</span>
                  </h3>
                  <p className="text-xs text-slate-500 m-0">
                    डे-शिफ्ट से नाइट-शिफ्ट में किस ऑपरेटर ने किस रिलीवर को मशीन सौंपी और क्या टिप्पणी दी
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  कुल हैंडओवर: {(state.shiftHandovers || []).length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-black text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-3.5">तारीख व समय</th>
                      <th className="py-3 px-3">मशीन व विभाग</th>
                      <th className="py-3 px-3">सौंपने वाला ऑपरेटर (Outgoing)</th>
                      <th className="py-3 px-3">लेने वाला रिलीवर (Relieved By)</th>
                      <th className="py-3 px-3 text-right">हैंडओवर स्क्रैप</th>
                      <th className="py-3 px-3">टिप्पणी / स्थिति (Notes)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(state.shiftHandovers || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                          अभी कोई शिफ्ट हैंडओवर रिकॉर्ड दर्ज नहीं है। शिफ्ट समाप्ति पर हैंडओवर अपने आप यहाँ रिकॉर्ड होगा।
                        </td>
                      </tr>
                    ) : (
                      (state.shiftHandovers || []).slice(0, 15).map((h, hIdx) => (
                        <tr key={hIdx} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3.5 font-mono text-slate-600">
                            {h.timestamp || (h as any).date || 'आज'}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900">
                            {h.machine || 'General'} ({h.department})
                          </td>
                          <td className="py-3 px-3 font-extrabold text-blue-900">
                            {h.outgoingOperator || '-'}
                          </td>
                          <td className="py-3 px-3 font-extrabold text-emerald-900">
                            {h.relievedByOperator || '-'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-rose-700 font-bold">
                            {h.scrapQty ? `${h.scrapQty} KG` : '-'}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {h.notes || 'मशीन सफाई व रनिंग जॉब संतुष्टिपूर्ण।'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: STAFF MASTER & DIRECTORY */}
        {/* ========================================================================= */}
        {activeTab === 'STAFF_MASTER' && (
          <div className="space-y-6">
            {/* Filter and Add Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    placeholder="कर्मचारी का नाम, रोल या मशीन खोजें..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-indigo-500 font-medium"
                  />
                </div>

                <select
                  value={staffDeptFilter}
                  onChange={(e) => setStaffDeptFilter(e.target.value)}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 cursor-pointer"
                >
                  <option value="ALL">सभी विभाग (All Departments)</option>
                  <option value="Slitting">Slitting</option>
                  <option value="Cutting">Cutting</option>
                  <option value="Forming">Forming</option>
                  <option value="QC">QC</option>
                  <option value="Packing">Packing</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>

              <button
                onClick={() => setIsAddStaffOpen(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ नया कर्मचारी जोड़ें</span>
              </button>
            </div>

            {/* Staff Directory Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide m-0">
                    केंद्रीय कर्मचारी डायरेक्टरी (Master Staff Roster)
                  </h3>
                  <p className="text-xs text-slate-500 m-0">
                    सभी डेस्कों के लिए अधिकृत कर्मचारियों का मास्टर डेटा
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  कुल कर्मचारी: {filteredStaffList.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-black text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-3.5">कर्मचारी नाम</th>
                      <th className="py-3 px-3">स्टाफ ID</th>
                      <th className="py-3 px-3">विभाग (Dept)</th>
                      <th className="py-3 px-3">पद / रोल</th>
                      <th className="py-3 px-3">डिफ़ॉल्ट मशीन</th>
                      <th className="py-3 px-3">शिफ्ट</th>
                      <th className="py-3 px-3">हाजिरी स्थिति</th>
                      <th className="py-3 px-3 text-right">कार्रवाई</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaffList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                          कोई कर्मचारी नहीं मिला।
                        </td>
                      </tr>
                    ) : (
                      filteredStaffList.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3.5 font-black text-slate-900">{w.name}</td>
                          <td className="py-3 px-3 font-mono text-slate-500">{w.staffId || '-'}</td>
                          <td className="py-3 px-3 font-bold text-slate-700">{w.department}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                w.role === 'OPERATOR'
                                  ? 'bg-blue-100 text-blue-800'
                                  : w.role === 'HELPER'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {w.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-700 font-bold">
                            {w.assignedMachine || 'Floor'}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-600">{w.shift}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                w.shiftStatus === 'PRESENT' || (w.shiftStatus === undefined && w.isPresent)
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {w.shiftStatus === 'PRESENT' || (w.shiftStatus === undefined && w.isPresent)
                                ? '✓ उपस्थित'
                                : 'छुट्टी पर'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setEditingStaff(w)}
                              className="text-indigo-600 hover:text-indigo-900 font-bold text-xs bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition cursor-pointer"
                            >
                              एडिट ✏️
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW STAFF MEMBER */}
      {/* ========================================================================= */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-black uppercase">नया ऑपरेटर / हेल्पर जोड़ें</span>
              </div>
              <button
                onClick={() => setIsAddStaffOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewStaff} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                  कर्मचारी का पूरा नाम *
                </label>
                <input
                  type="text"
                  required
                  value={staffFormName}
                  onChange={(e) => setStaffFormName(e.target.value)}
                  placeholder="उदा. RAMESH PATEL"
                  className="w-full text-xs font-bold uppercase p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                    रोल / पद *
                  </label>
                  <select
                    value={staffFormRole}
                    onChange={(e) => setStaffFormRole(e.target.value as WorkforceRole)}
                    className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl cursor-pointer"
                  >
                    <option value="OPERATOR">OPERATOR (ऑपरेटर)</option>
                    <option value="HELPER">HELPER (हेल्पर)</option>
                    <option value="SUPERVISOR">SUPERVISOR (सुपरवाइजर)</option>
                    <option value="QC_INSPECTOR">QC_INSPECTOR (QC)</option>
                    <option value="MAINTENANCE">MAINTENANCE (मेंटेनेंस)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                    विभाग (Dept) *
                  </label>
                  <select
                    value={staffFormDept}
                    onChange={(e) => setStaffFormDept(e.target.value)}
                    className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl cursor-pointer"
                  >
                    <option value="Cutting">Cutting</option>
                    <option value="Forming">Forming</option>
                    <option value="Slitting">Slitting</option>
                    <option value="Packing">Packing</option>
                    <option value="QC">QC</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                    डिफ़ॉल्ट मशीन (वैकल्पिक)
                  </label>
                  <input
                    type="text"
                    value={staffFormMachine}
                    onChange={(e) => setStaffFormMachine(e.target.value)}
                    placeholder="उदा. Cutting-1"
                    className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                    शिफ्ट *
                  </label>
                  <select
                    value={staffFormShift}
                    onChange={(e) => setStaffFormShift(e.target.value as any)}
                    className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl cursor-pointer"
                  >
                    <option value="DAY">DAY (दिन की शिफ्ट)</option>
                    <option value="NIGHT">NIGHT (रात की शिफ्ट)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                  कर्मचारी ID / कोड (वैकल्पिक)
                </label>
                <input
                  type="text"
                  value={staffFormId}
                  onChange={(e) => setStaffFormId(e.target.value)}
                  placeholder="उदा. EMP-101"
                  className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-200"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl cursor-pointer hover:bg-indigo-700 shadow-xs"
                >
                  सुरक्षित करें (Save)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT EXISTING STAFF MEMBER */}
      {/* ========================================================================= */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-indigo-950 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                <span className="text-sm font-black uppercase">कर्मचारी विवरण संपादित करें</span>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStaff} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                  कर्मचारी नाम
                </label>
                <input
                  type="text"
                  required
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value.toUpperCase() })}
                  className="w-full text-xs font-bold uppercase p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                    रोल / पद
                  </label>
                  <select
                    value={editingStaff.role}
                    onChange={(e) =>
                      setEditingStaff({ ...editingStaff, role: e.target.value as WorkforceRole })
                    }
                    className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl cursor-pointer"
                  >
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="HELPER">HELPER</option>
                    <option value="SUPERVISOR">SUPERVISOR</option>
                    <option value="QC_INSPECTOR">QC_INSPECTOR</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                    विभाग
                  </label>
                  <select
                    value={editingStaff.department}
                    onChange={(e) => setEditingStaff({ ...editingStaff, department: e.target.value })}
                    className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl cursor-pointer"
                  >
                    <option value="Cutting">Cutting</option>
                    <option value="Forming">Forming</option>
                    <option value="Slitting">Slitting</option>
                    <option value="Packing">Packing</option>
                    <option value="QC">QC</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                    मशीन
                  </label>
                  <input
                    type="text"
                    value={editingStaff.assignedMachine || ''}
                    onChange={(e) =>
                      setEditingStaff({ ...editingStaff, assignedMachine: e.target.value })
                    }
                    className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase block mb-1">
                    शिफ्ट
                  </label>
                  <select
                    value={editingStaff.shift}
                    onChange={(e) => setEditingStaff({ ...editingStaff, shift: e.target.value })}
                    className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 rounded-xl cursor-pointer"
                  >
                    <option value="DAY">DAY</option>
                    <option value="NIGHT">NIGHT</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-200"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl cursor-pointer hover:bg-indigo-700 shadow-xs"
                >
                  अपडेट करें (Save Changes)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
