import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
  Plus,
  Trash2,
  Send,
  Download,
  Filter,
  Search,
  RefreshCw,
  Phone,
  User,
  ShieldAlert,
  Play,
  Share2,
  Calendar,
  ClipboardList,
  Check,
  ExternalLink
} from 'lucide-react';
import {
  FactoryState,
  MaintenanceIncident,
  SparePartItem,
  MachineReadyAlert,
  MaintenanceContact,
  MaterialRequisition,
  LogEntry
} from '../../types';
import {
  ALL_MACHINES_LIST,
  COMMON_SPARE_PARTS,
  DEFAULT_MAINTENANCE_CONTACTS
} from '../../lib/constants';

interface MaintenanceViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  onOpenRequisitionModal?: (department?: string) => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onOpenRequisitionModal
}) => {
  const incidents = state.maintenanceIncidents || [];
  const requisitions = state.materialRequisitions || [];
  const maintenanceRequisitions = requisitions.filter(
    (r) => r.department === 'Maintenance'
  );
  const maintenanceArrivedCount = maintenanceRequisitions.filter(
    (r) => r.status === 'RECEIVED' && !r.acknowledgedByRequester
  ).length;

  const contacts = state.maintenanceContacts && state.maintenanceContacts.length > 0
    ? state.maintenanceContacts
    : DEFAULT_MAINTENANCE_CONTACTS;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'LOGS' | 'NEW' | 'CONTACTS' | 'REQUISITIONS'>('ACTIVE');

  // Timer tick for live downtime display
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000); // update every 30s
    return () => clearInterval(timer);
  }, []);

  // Filter & Search states for Logs tab
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMachine, setFilterMachine] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Currently selected incident for repair completion in Active tab
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Repair Resolution Form State
  const [repairTechName, setRepairTechName] = useState(contacts[0]?.name || 'Ramesh Sharma');
  const [actionTaken, setActionTaken] = useState('');
  const [sparePartsList, setSparePartsList] = useState<SparePartItem[]>([
    { name: COMMON_SPARE_PARTS[0], qty: 1, unit: 'Nos', notes: '' }
  ]);
  const [newPartName, setNewPartName] = useState(COMMON_SPARE_PARTS[0]);
  const [newPartQty, setNewPartQty] = useState('1');
  const [newPartUnit, setNewPartUnit] = useState('Nos');
  const [newPartNotes, setNewPartNotes] = useState('');

  // Manual New Incident form states
  const [manualMachine, setManualMachine] = useState(ALL_MACHINES_LIST[0]);
  const [manualReason, setManualReason] = useState('Mechanical Heater / Tooling Issue');
  const [manualDesc, setManualDesc] = useState('');
  const [manualReporter, setManualReporter] = useState('Maintenance Tech');
  const [manualPriority, setManualPriority] = useState<'Normal' | 'Urgent' | 'Critical'>('Urgent');
  const [manualPhone, setManualPhone] = useState(contacts[0]?.phone || '');

  // Calculate live downtime metrics
  const activeIncidents = incidents.filter(
    (inc) => inc.status === 'OPEN' || inc.status === 'IN_PROGRESS'
  );
  const repairedIncidents = incidents.filter(
    (inc) => inc.status === 'REPAIRED_READY' || inc.status === 'ACKNOWLEDGED'
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const todayIncidents = incidents.filter((inc) => inc.breakdownDate === todayStr);

  const totalDowntimeMinutesToday = todayIncidents.reduce(
    (sum, inc) => sum + (inc.totalDowntimeMinutes || 0),
    0
  );

  // Helper to format minutes into HH:MM or Xm
  const formatDowntime = (mins?: number) => {
    if (mins === undefined || mins === null) return '0 min';
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  // Helper to compute live elapsed minutes from start time
  const getElapsedMinutes = (startTimeIso: string) => {
    try {
      const start = new Date(startTimeIso).getTime();
      const now = Date.now();
      return Math.max(1, Math.round((now - start) / 60000));
    } catch {
      return 0;
    }
  };

  // Add a spare part to the active resolution form
  const handleAddSparePart = () => {
    if (!newPartName.trim()) return;
    const qty = parseInt(newPartQty) || 1;
    setSparePartsList([
      ...sparePartsList,
      {
        name: newPartName.trim(),
        qty,
        unit: newPartUnit,
        notes: newPartNotes.trim()
      }
    ]);
    setNewPartNotes('');
    setNewPartQty('1');
  };

  const handleRemoveSparePart = (index: number) => {
    setSparePartsList(sparePartsList.filter((_, idx) => idx !== index));
  };

  // Start repair / attend
  const handleStartRepair = (incident: MaintenanceIncident) => {
    const updated = incidents.map((inc) => {
      if (inc.id === incident.id) {
        return {
          ...inc,
          status: 'IN_PROGRESS' as const,
          repairStartTime: new Date().toISOString(),
          technicianName: repairTechName
        };
      }
      return inc;
    });

    onSaveState({
      ...state,
      maintenanceIncidents: updated
    });
    setSelectedIncidentId(incident.id);
  };

  // Complete Repair & Mark "Ready for Run / मेरी साइड से ओके है"
  const handleCompleteRepair = (incident: MaintenanceIncident, sendWhatsApp: boolean = false) => {
    const nowIso = new Date().toISOString();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const elapsedMins = getElapsedMinutes(incident.breakdownStartTime);

    const partsSummary = sparePartsList.length > 0
      ? sparePartsList.map((p) => `${p.name} (Qty: ${p.qty} ${p.unit || ''})`).join(', ')
      : 'No spare parts replaced (Adjustment & Tuning)';

    // 1. Update incident ticket
    const updatedIncidents = incidents.map((inc) => {
      if (inc.id === incident.id) {
        return {
          ...inc,
          status: 'REPAIRED_READY' as const,
          repairedAt: nowIso,
          totalDowntimeMinutes: elapsedMins,
          technicianName: repairTechName,
          actionTaken: actionTaken || 'Repaired, tested, and certified ready for production.',
          spareParts: sparePartsList
        };
      }
      return inc;
    });

    // 2. Push a MachineReadyAlert for the production operator display
    const newReadyAlert: MachineReadyAlert = {
      incidentId: incident.id,
      machine: incident.machine,
      technician: repairTechName,
      repairedAt: nowIso,
      actionTaken: actionTaken || 'Machine tested and cleared by maintenance team.',
      sparePartsSummary: partsSummary,
      downtimeMinutes: elapsedMins,
      active: true
    };

    // 3. Automatically un-hold the machine batches in state.jobs and state.packJobs
    const updatedJobs = state.jobs.map((j) => {
      let hasChange = false;
      const batches = (j.runningBatches || []).map((b) => {
        if (b.machine === incident.machine && b.status === 'Held') {
          hasChange = true;
          return {
            ...b,
            status: 'Running' as const,
            holdReason: undefined
          };
        }
        return b;
      });
      return hasChange ? { ...j, runningBatches: batches } : j;
    });

    const updatedPackJobs = state.packJobs.map((pj) => {
      if (pj.machine === incident.machine && pj.status === 'Held') {
        return {
          ...pj,
          status: 'Running' as const,
          holdReason: undefined
        };
      }
      return pj;
    });

    // 4. Audit Log
    const newLog = {
      jobId: incident.machine,
      product: 'Workstation',
      stage: 'Maintenance Clearance',
      machine: incident.machine,
      action: `✅ Machine Repaired & Handover OK by Tech ${repairTechName} (Downtime: ${elapsedMins}m, Spares: ${partsSummary})`,
      user: repairTechName,
      startTime: nowTime,
      rawDate: todayStr,
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      packJobs: updatedPackJobs,
      maintenanceIncidents: updatedIncidents,
      machineReadyAlerts: [newReadyAlert, ...(state.machineReadyAlerts || [])],
      logs: [...state.logs, newLog]
    });

    // 5. WhatsApp notification to operator / production head if enabled
    if (sendWhatsApp && incident.maintenancePhone) {
      const cleanPhone = incident.maintenancePhone.replace(/[^\d]/g, '');
      const waText = encodeURIComponent(
        `✅ *WÜNDERKRAF ERP - MACHINE REPAIR COMPLETED* ✅\n\n` +
        `🛠️ *Machine:* ${incident.machine}\n` +
        `⏱️ *Total Downtime:* ${elapsedMins} Minutes\n` +
        `👨‍🔧 *Technician:* ${repairTechName}\n` +
        `📋 *Work Done:* ${actionTaken || 'Repair complete, calibrated & certified OK'}\n` +
        `🔩 *Spare Parts:* ${partsSummary}\n` +
        `⏰ *Handover Time:* ${nowTime}\n\n` +
        `📢 *Status:* "मेरी साइड से मशीन ओके है - रेडी टू रन!" Production team can resume running.`
      );
      window.open(`https://wa.me/${cleanPhone}?text=${waText}`, '_blank');
    }

    setSelectedIncidentId(null);
    setActionTaken('');
    setSparePartsList([{ name: COMMON_SPARE_PARTS[0], qty: 1, unit: 'Nos', notes: '' }]);
    alert(`✅ Machine ${incident.machine} is marked READY! Notification popup dispatched to production screen.`);
  };

  // Create manual incident from Maintenance Desk
  const handleCreateManualIncident = (e: React.FormEvent) => {
    e.preventDefault();
    const nowIso = new Date().toISOString();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let detectedStage = 'Production';
    if (manualMachine.startsWith('Cutting-')) detectedStage = 'Cutting';
    else if (manualMachine.startsWith('Forming-')) detectedStage = 'Forming';
    else if (manualMachine.startsWith('Packing-') || manualMachine.startsWith('Manual-')) detectedStage = 'Packing';
    else if (manualMachine.startsWith('Slitting-')) detectedStage = 'Slitting';
    else if (manualMachine.startsWith('QC-')) detectedStage = 'QC';

    const incidentSeq = incidents.length + 1;
    const newInc: MaintenanceIncident = {
      id: `MNT-${String(incidentSeq).padStart(3, '0')}`,
      machine: manualMachine,
      stage: detectedStage,
      reason: manualReason,
      description: manualDesc || 'Scheduled maintenance / breakdown reported by technician',
      reportedBy: manualReporter,
      maintenancePhone: manualPhone,
      priority: manualPriority,
      status: 'OPEN',
      breakdownStartTime: nowIso,
      breakdownDate: todayStr,
      whatsAppAlertSent: false
    };

    // Also hold any active batch on this machine
    const updatedJobs = state.jobs.map((j) => {
      let hasChange = false;
      const batches = (j.runningBatches || []).map((b) => {
        if (b.machine === manualMachine && b.status === 'Running') {
          hasChange = true;
          return {
            ...b,
            status: 'Held' as const,
            holdReason: manualReason
          };
        }
        return b;
      });
      return hasChange ? { ...j, runningBatches: batches } : j;
    });

    const newLog = {
      jobId: manualMachine,
      product: 'Workstation',
      stage: 'Station Hold',
      machine: manualMachine,
      action: `🛑 Maintenance Breakdown Logged [Ticket: ${newInc.id}] (${manualReason})`,
      user: manualReporter,
      startTime: nowTime,
      rawDate: todayStr,
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      maintenanceIncidents: [newInc, ...incidents],
      logs: [...state.logs, newLog]
    });

    setManualDesc('');
    setActiveTab('ACTIVE');
    alert(`✅ Maintenance ticket ${newInc.id} logged for ${manualMachine}!`);
  };

  // Export Downtime Log to CSV
  const handleExportCsv = () => {
    const headers = [
      'Ticket ID',
      'Machine',
      'Stage',
      'Status',
      'Breakdown Date',
      'Start Time',
      'Repaired Time',
      'Downtime (Minutes)',
      'Reason',
      'Remarks',
      'Action Taken',
      'Spare Parts',
      'Technician',
      'Reported By'
    ];

    const rows = incidents.map((inc) => {
      const parts = (inc.spareParts || []).map((p) => `${p.name} (${p.qty})`).join('; ');
      return [
        inc.id,
        inc.machine,
        inc.stage,
        inc.status,
        inc.breakdownDate,
        new Date(inc.breakdownStartTime).toLocaleTimeString(),
        inc.repairedAt ? new Date(inc.repairedAt).toLocaleTimeString() : 'N/A',
        inc.totalDowntimeMinutes || (inc.status === 'OPEN' ? getElapsedMinutes(inc.breakdownStartTime) : 0),
        `"${(inc.reason || '').replace(/"/g, '""')}"`,
        `"${(inc.description || '').replace(/"/g, '""')}"`,
        `"${(inc.actionTaken || '').replace(/"/g, '""')}"`,
        `"${parts.replace(/"/g, '""')}"`,
        inc.technicianName || '',
        inc.reportedBy || ''
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Wunderkraf_Maintenance_Downtime_Log_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Acknowledge Receipt of Arrived Material / Spares
  const handleAcknowledgeReceipt = (reqId: string) => {
    const updatedReqs = requisitions.map((r) => {
      if (r.id === reqId) {
        return {
          ...r,
          status: 'ACKNOWLEDGED' as const,
          acknowledgedByRequester: true,
          acknowledgedAt: new Date().toISOString()
        };
      }
      return r;
    });

    const targetReq = requisitions.find((r) => r.id === reqId);
    const newLog: LogEntry = {
      stage: 'Maintenance',
      machine: 'Maintenance Desk',
      action: `Spare Part / Material ${reqId} (${targetReq?.itemName}) acknowledged and received from store by Maintenance`,
      user: 'Maintenance',
      shift: 'General',
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      rawDate: todayStr,
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      materialRequisitions: updatedReqs,
      logs: [...state.logs, newLog]
    });
    alert(`✅ Material "${targetReq?.itemName}" acknowledged and taken into maintenance stock!`);
  };

  // Filtered list for Logs tab
  const filteredIncidents = incidents.filter((inc) => {
    if (filterMachine !== 'ALL' && inc.machine !== filterMachine) return false;
    if (filterStatus !== 'ALL' && inc.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = `${inc.id} ${inc.machine} ${inc.reason} ${inc.description} ${inc.actionTaken} ${inc.technicianName} ${(inc.spareParts || []).map((p) => p.name).join(' ')}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHub}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Hub</span>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-slate-900 m-0">
                    Maintenance Desk (मेंटेनेंस डेस्क)
                  </h1>
                  {activeIncidents.length > 0 ? (
                    <span className="bg-red-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full animate-pulse">
                      {activeIncidents.length} Machine Stopped
                    </span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                      All Machines Operational
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 m-0">
                  Real-time Breakdown Tracking, Spare Parts Recording, Downtime Logs & Ready-to-Run Handover
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenRequisitionModal && (
              <button
                onClick={() => onOpenRequisitionModal('Maintenance')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Raise Spare Parts / Material Indent to Purchase Department"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>मटेरियल / स्पेयर इंडेन्ट</span>
                {maintenanceArrivedCount > 0 && (
                  <span className="bg-amber-300 text-slate-900 font-extrabold text-[10px] px-1.5 py-0.2 rounded-full">
                    {maintenanceArrivedCount} Arrived
                  </span>
                )}
              </button>
            )}
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => setActiveTab('NEW')}
              className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Log Breakdown</span>
            </button>
          </div>
        </div>

        {/* 4 Top KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-5">
          <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-800 uppercase tracking-wider">
                Active Stopped
              </span>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-2xl font-black text-red-950 mt-1">
              {activeIncidents.length}
            </div>
            <span className="text-[11px] text-red-700 font-medium">
              Machines waiting for repair
            </span>
          </div>

          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                Today Downtime
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-950 mt-1">
              {formatDowntime(totalDowntimeMinutesToday)}
            </div>
            <span className="text-[11px] text-amber-700 font-medium">
              Across {todayIncidents.length} incidents today
            </span>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Machines Repaired
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-950 mt-1">
              {repairedIncidents.length}
            </div>
            <span className="text-[11px] text-emerald-700 font-medium">
              Handed over to production
            </span>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
                Spare Parts Used
              </span>
              <Package className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-indigo-950 mt-1">
              {incidents.reduce(
                (acc, i) => acc + (i.spareParts?.reduce((s, p) => s + (p.qty || 1), 0) || 0),
                0
              )}
            </div>
            <span className="text-[11px] text-indigo-700 font-medium">
              Total items consumed
            </span>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 mt-5 pt-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ACTIVE'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Active Breakdowns & Repairs (चालू ब्रेकडाउन)</span>
            {activeIncidents.length > 0 && (
              <span className="ml-1 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {activeIncidents.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('LOGS')}
            className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'LOGS'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Downtime & Maintenance Log (मेंटेनेंस रिकॉर्ड व लॉग)</span>
            <span className="ml-1 bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {incidents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('NEW')}
            className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'NEW'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manual Breakdown Entry (नया ब्रेकडाउन दर्ज करें)</span>
          </button>

          <button
            onClick={() => setActiveTab('CONTACTS')}
            className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'CONTACTS'
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Contacts & Spare Catalog (संपर्क व स्पेयर पार्ट्स)</span>
          </button>

          <button
            onClick={() => setActiveTab('REQUISITIONS')}
            className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'REQUISITIONS'
                ? 'border-orange-600 text-orange-600 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Spares Indent Status (स्पेयर पार्ट्स इंडेन्ट)</span>
            {maintenanceArrivedCount > 0 ? (
              <span className="ml-1 bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-bounce">
                🎉 {maintenanceArrivedCount} Arrived
              </span>
            ) : (
              <span className="ml-1 bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {maintenanceRequisitions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: ACTIVE BREAKDOWNS & REPAIR RESOLUTION */}
      {activeTab === 'ACTIVE' && (
        <div className="space-y-4">
          {activeIncidents.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 m-0">
                कोई मशीन बंद नहीं है — All Machines Running!
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                जब भी कोई ऑपरेटर मशीन होल्ड/स्टॉप करेगा, तो वह यहाँ लाइव टाइमर और रिपेयर ऑप्शन के साथ दिखेगी।
              </p>
              <button
                onClick={() => setActiveTab('NEW')}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                + Log Routine Maintenance or Stop
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeIncidents.map((incident) => {
                const elapsedMins = getElapsedMinutes(incident.breakdownStartTime);
                const isSelected = selectedIncidentId === incident.id;

                return (
                  <div
                    key={incident.id}
                    className={`bg-white border-2 rounded-2xl p-5 shadow-sm transition relative ${
                      isSelected
                        ? 'border-orange-500 ring-2 ring-orange-200'
                        : 'border-red-200 hover:border-red-300'
                    }`}
                  >
                    {/* Header Tag */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-900 text-white">
                          {incident.id}
                        </span>
                        <span className="text-base font-black text-slate-900">
                          {incident.machine}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {incident.stage}
                        </span>
                      </div>

                      {/* Live Downtime Elapsed Counter */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 text-xs font-black">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>Down for: {formatDowntime(elapsedMins)}</span>
                      </div>
                    </div>

                    {/* Breakdown Reason & Operator Info */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-red-700 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                          <span>{incident.reason}</span>
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            incident.priority === 'Critical'
                              ? 'bg-red-200 text-red-800 font-black'
                              : 'bg-amber-200 text-amber-800'
                          }`}
                        >
                          {incident.priority}
                        </span>
                      </div>

                      <p className="text-slate-800 m-0 font-medium leading-relaxed">
                        {incident.description || 'No detailed remarks provided.'}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-slate-500 text-[11px]">
                        <span>Reported by: <strong>{incident.reportedBy}</strong></span>
                        <span>Start: {new Date(incident.breakdownStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* State: OPEN vs IN_PROGRESS vs COMPLETION FORM */}
                    {incident.status === 'OPEN' && !isSelected && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartRepair(incident)}
                          className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Wrench className="w-4 h-4" />
                          <span>Attend / Start Repair (अटेंड करें)</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedIncidentId(incident.id);
                          }}
                          className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          Fill Resolution
                        </button>
                      </div>
                    )}

                    {(incident.status === 'IN_PROGRESS' || isSelected) && (
                      <div className="border-t-2 border-orange-100 pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-orange-950 flex items-center gap-1">
                            <Wrench className="w-3.5 h-3.5 text-orange-600" />
                            <span>Repair Resolution & Spare Parts Handover</span>
                          </span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                            Technician Working
                          </span>
                        </div>

                        {/* Technician Name Selection */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Technician / Engineer:
                          </label>
                          <select
                            value={repairTechName}
                            onChange={(e) => setRepairTechName(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
                          >
                            {contacts.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name} ({c.role})
                              </option>
                            ))}
                            <option value="Specialist Tech">External Vendor / Specialist Tech</option>
                            <option value="Operator Tech">Self-Fixed by Floor Operator</option>
                          </select>
                        </div>

                        {/* Work Done / Action Taken */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Action Taken / Work Done (क्या काम किया):
                          </label>
                          <textarea
                            rows={2}
                            value={actionTaken}
                            onChange={(e) => setActionTaken(e.target.value)}
                            placeholder="e.g. Cleaned cutter head, replaced burnt thermocouple sensor wire, calibrated PID temperature at 210°C."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:bg-white focus:border-orange-500 resize-none"
                          />
                        </div>

                        {/* Spare Parts Replaced (User request: "कौन से स्पेयर पार्ट किया") */}
                        <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                              <Package className="w-3.5 h-3.5 text-amber-700" />
                              <span>Spare Parts Replaced (स्पेयर पार्ट्स का विवरण):</span>
                            </span>
                            <span className="text-[10px] text-amber-700 font-semibold">
                              {sparePartsList.length} Item(s)
                            </span>
                          </div>

                          {/* List of current spares */}
                          {sparePartsList.length > 0 ? (
                            <div className="space-y-1.5">
                              {sparePartsList.map((part, pIdx) => (
                                <div
                                  key={pIdx}
                                  className="flex items-center justify-between bg-white border border-amber-200 px-2.5 py-1.5 rounded-lg text-xs"
                                >
                                  <div className="flex items-center gap-1.5 overflow-hidden">
                                    <span className="font-bold text-slate-800 truncate">
                                      {part.name}
                                    </span>
                                    <span className="text-amber-800 font-bold bg-amber-100 px-1.5 py-0.2 rounded text-[10px]">
                                      Qty: {part.qty} {part.unit || ''}
                                    </span>
                                    {part.notes && (
                                      <span className="text-slate-400 text-[10px] italic truncate">
                                        ({part.notes})
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSparePart(pIdx)}
                                    className="text-slate-400 hover:text-red-600 p-1 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500 italic">
                              No spare parts added. (Adjustments/lubrication only)
                            </p>
                          )}

                          {/* Add Spare Part Inputs */}
                          <div className="pt-2 border-t border-amber-200/80 grid grid-cols-12 gap-1.5">
                            <div className="col-span-6">
                              <select
                                value={newPartName}
                                onChange={(e) => setNewPartName(e.target.value)}
                                className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded text-xs text-slate-800 outline-none"
                              >
                                {COMMON_SPARE_PARTS.map((sp) => (
                                  <option key={sp} value={sp}>
                                    {sp}
                                  </option>
                                ))}
                                <option value="Custom Part">-- Other Custom Part --</option>
                              </select>
                            </div>
                            <div className="col-span-3">
                              <input
                                type="number"
                                min="1"
                                value={newPartQty}
                                onChange={(e) => setNewPartQty(e.target.value)}
                                placeholder="Qty"
                                className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded text-xs text-slate-800 outline-none"
                              />
                            </div>
                            <div className="col-span-3">
                              <button
                                type="button"
                                onClick={handleAddSparePart}
                                className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Handover & Ready Button (User request: "वो रेडी करके रन वो दबाएगा, उधर से मेरी साइड से ओके है") */}
                        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleCompleteRepair(incident, false)}
                            className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>मशीन रेडी / मेरी साइड से ओके है</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCompleteRepair(incident, true)}
                            className="py-2.5 bg-[#25D366] hover:bg-[#1ebc59] text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <Send className="w-4 h-4" />
                            <span>Ready & Alert Production via WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DOWNTIME & MAINTENANCE HISTORY LOG */}
      {activeTab === 'LOGS' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          {/* Filters Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search machine, issue, tech, spare parts..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:bg-white focus:border-orange-500"
                />
              </div>

              {/* Machine Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterMachine}
                  onChange={(e) => setFilterMachine(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none text-slate-700"
                >
                  <option value="ALL">All Machines</option>
                  {ALL_MACHINES_LIST.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">🔴 Open / Stopped</option>
                <option value="IN_PROGRESS">🟡 In Progress</option>
                <option value="REPAIRED_READY">🟢 Repaired / Handed Over</option>
                <option value="ACKNOWLEDGED">✅ Acknowledged by Production</option>
              </select>
            </div>

            <span className="text-xs text-slate-500 font-medium">
              Showing <strong>{filteredIncidents.length}</strong> of {incidents.length} Records
            </span>
          </div>

          {/* Downtime Records Table (User request: "कितने टाइम कौन सा मशीन बंद हुआ, उसके रिकॉर्ड मेंटेनेंस लॉग से मिलना चाहिए") */}
          {filteredIncidents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No maintenance records match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-800 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Ticket / Machine</th>
                    <th className="py-2.5 px-3">Breakdown Start</th>
                    <th className="py-2.5 px-3">Ready / Handover</th>
                    <th className="py-2.5 px-3">Total Downtime</th>
                    <th className="py-2.5 px-3">Root Cause / Issue</th>
                    <th className="py-2.5 px-3">Action Taken</th>
                    <th className="py-2.5 px-3">Spare Parts Replaced</th>
                    <th className="py-2.5 px-3">Technician / Reporter</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIncidents.map((inc) => {
                    const durationMins = inc.totalDowntimeMinutes || (inc.status === 'OPEN' ? getElapsedMinutes(inc.breakdownStartTime) : 0);
                    const startTimeFormatted = new Date(inc.breakdownStartTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    const readyTimeFormatted = inc.repairedAt
                      ? new Date(inc.repairedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '—';

                    return (
                      <tr key={inc.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{inc.machine}</div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {inc.id} | {inc.stage}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-medium text-slate-800">{startTimeFormatted}</div>
                          <span className="text-[10px] text-slate-500">{inc.breakdownDate}</span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-medium text-slate-800">{readyTimeFormatted}</div>
                        </td>

                        {/* Downtime duration pill */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-black px-2 py-0.5 rounded-md text-[11px] ${
                              durationMins > 60
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : durationMins > 30
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>{formatDowntime(durationMins)}</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 max-w-xs">
                          <div className="font-bold text-slate-800">{inc.reason}</div>
                          {inc.description && (
                            <p className="text-[11px] text-slate-500 m-0 truncate">
                              {inc.description}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-3 max-w-xs">
                          <p className="text-slate-800 m-0 font-medium line-clamp-2">
                            {inc.actionTaken || '—'}
                          </p>
                        </td>

                        <td className="py-3 px-3 max-w-xs">
                          {inc.spareParts && inc.spareParts.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {inc.spareParts.map((sp, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded"
                                >
                                  {sp.name} ({sp.qty})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-bold text-slate-800">
                            {inc.technicianName || '—'}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            By: {inc.reportedBy}
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          {inc.status === 'OPEN' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200">
                              🔴 Stopped
                            </span>
                          )}
                          {inc.status === 'IN_PROGRESS' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">
                              🟡 In Repair
                            </span>
                          )}
                          {inc.status === 'REPAIRED_READY' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                              🟢 Ready to Run
                            </span>
                          )}
                          {inc.status === 'ACKNOWLEDGED' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                              ✅ Production Resumed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MANUAL BREAKDOWN / PM ENTRY */}
      {activeTab === 'NEW' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-2xl mx-auto">
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <ShieldAlert className="w-5 h-5" />
            <h2 className="text-base font-bold text-slate-900 m-0">
              Log Maintenance Breakdown / Machine Stop (नया मेंटेनेंस ब्रेकडाउन)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Record a scheduled preventive maintenance check, emergency tooling jam, or electrical fault.
          </p>

          <form onSubmit={handleCreateManualIncident} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Machine / Workstation:
                </label>
                <select
                  value={manualMachine}
                  onChange={(e) => setManualMachine(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
                >
                  {ALL_MACHINES_LIST.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Priority (प्राथमिकता):
                </label>
                <select
                  value={manualPriority}
                  onChange={(e) => setManualPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
                >
                  <option value="Normal">🟢 Normal (साधारण)</option>
                  <option value="Urgent">🟠 Urgent (अति आवश्यक)</option>
                  <option value="Critical">🔴 Critical (लाइन बंद)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Reason / Breakdown Category:
              </label>
              <select
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-orange-500"
              >
                <option value="Mechanical Heater / Tooling Issue">Mechanical Heater / Tooling Issue</option>
                <option value="Electrical / Sensor Fault">Electrical / Sensor / Temp Controller Fault</option>
                <option value="Pneumatic / Air Pressure Drop">Pneumatic / Air Pressure / Cylinder Seal</option>
                <option value="Die Alignment & Sharpness Check">Die Alignment & Sharpness Check</option>
                <option value="Routine Cleaning & Maintenance">Routine Cleaning & Preventative Check</option>
                <option value="Raw Paper Roll Change / Setup">Raw Paper Roll Change / Setup Jam</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Problem Description & Symptoms (समस्या का विवरण):
              </label>
              <textarea
                rows={3}
                required
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                placeholder="Explain the technical problem, sound, error code or heat variation..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-orange-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Reported By (तकनीशियन या ऑपरेटर):
                </label>
                <input
                  type="text"
                  value={manualReporter}
                  onChange={(e) => setManualReporter(e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Alert Contact Number:
                </label>
                <input
                  type="text"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="+91 98250 12345"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Submit Breakdown & Pause Machine (स्टॉप करें)</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: MAINTENANCE CONTACTS & SPARES CATALOG */}
      {activeTab === 'CONTACTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Maintenance Team Phone Directory */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Phone className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold m-0">
                  Maintenance Team Directory (मेंटेनेंस संपर्क)
                </h3>
              </div>
              <span className="text-xs text-slate-500">Quick-dial & WhatsApp</span>
            </div>

            <div className="space-y-2.5">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>{c.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {c.role} ({c.dept || 'Floor'})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {c.phone}
                    </span>
                    <a
                      href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebc59] transition"
                      title="Chat on WhatsApp"
                    >
                      <Send className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Standard Spares List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Package className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold m-0">
                  Frequent Spare Parts Catalog (स्टॉक स्पेयर पार्ट्स)
                </h3>
              </div>
              <span className="text-xs text-slate-500">Fast Auto-fill</span>
            </div>

            <div className="space-y-1.5">
              {COMMON_SPARE_PARTS.map((sp, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <span className="font-medium text-slate-800">{sp}</span>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                    Standard Spare
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SPARE PARTS & MATERIAL REQUISITION STATUS (मटेरियल इंडेन्ट ट्रैकिंग) */}
      {activeTab === 'REQUISITIONS' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-emerald-600" />
                  <span>Maintenance Spares & Indents (स्पेयर पार्ट मांग व स्थिति)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track material requests sent to Purchase Department and acknowledge received store deliveries
                </p>
              </div>

              {onOpenRequisitionModal && (
                <button
                  onClick={() => onOpenRequisitionModal('Maintenance')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>नया स्पेयर इंडेन्ट भरें (New Requisition)</span>
                </button>
              )}
            </div>

            {/* List of Requisitions */}
            {maintenanceRequisitions.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <ClipboardList className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-700 m-0">
                  कोई मटेरियल मांग नहीं है (No Spares Requisition)
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  यदि किसी मशीन के लिए कटर ब्लेड, हीटर, बेल्ट, ऑयल या कोई अन्य सामान चाहिए तो ऊपर बटन दबाकर परचेस डिपार्टमेंट को इंडेन्ट भेजें।
                </p>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {maintenanceRequisitions.map((req) => {
                  const isReceivedUnacknowledged =
                    req.status === 'RECEIVED' && !req.acknowledgedByRequester;

                  return (
                    <div
                      key={req.id}
                      className={`p-4 rounded-xl border transition ${
                        isReceivedUnacknowledged
                          ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-400/30'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {req.id}
                            </span>
                            <span className="font-extrabold text-slate-900 text-sm">
                              {req.itemName}
                            </span>
                            <span className="text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                              Qty: {req.quantity} {req.unit}
                            </span>
                            {(req.machineOrPurpose || req.machine) && (
                              <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                                Machine: {req.machineOrPurpose || req.machine}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                req.urgency === 'CRITICAL_BREAKDOWN' || req.urgency === 'URGENT'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {req.urgency} Priority
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 m-0">
                            <strong>Purpose:</strong> {req.remarks || req.purpose || req.machineOrPurpose || 'Spares indent for maintenance'}
                          </p>

                          <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap pt-0.5">
                            <span>
                              Requested by: <strong>{req.requestedBy}</strong> ({req.requestedDate || 'Recent'})
                            </span>
                            {req.poNumber && (
                              <span className="text-indigo-700 font-semibold">
                                PO Issued: <strong>{req.poNumber}</strong> ({req.vendorName || 'Vendor'})
                              </span>
                            )}
                            {(req.expectedDeliveryDate || req.expectedDate) && (
                              <span>Exp Delivery: {req.expectedDeliveryDate || req.expectedDate}</span>
                            )}
                          </div>
                        </div>

                        {/* Status badge & action */}
                        <div className="flex flex-col sm:items-end gap-2">
                          <div className="flex items-center gap-2">
                            {req.status === 'PENDING' && (
                              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Pending at Purchase Dept</span>
                              </span>
                            )}
                            {req.status === 'PO_ISSUED' && (
                              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>PO Placed — In Transit</span>
                              </span>
                            )}
                            {req.status === 'RECEIVED' && (
                              <span className="bg-emerald-600 text-white text-xs font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 animate-pulse">
                                <Check className="w-3 h-3" />
                                <span>Material Arrived at Store!</span>
                              </span>
                            )}
                            {req.status === 'ACKNOWLEDGED' && (
                              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Collected & In Stock</span>
                              </span>
                            )}
                          </div>

                          {/* Requester acknowledgment action */}
                          {req.status === 'RECEIVED' && !req.acknowledgedByRequester && (
                            <button
                              onClick={() => handleAcknowledgeReceipt(req.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>स्टोर से सामान मिल गया (Confirm Receipt)</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceView;
