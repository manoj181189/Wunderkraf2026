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
  Edit,
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
  ExternalLink,
  Bell,
  BellRing,
  Users,
  Radio,
  Megaphone,
  Save,
  X
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
  DEFAULT_MAINTENANCE_CONTACTS,
  DEFAULT_DEPARTMENT_HEADS
} from '../../lib/constants';
import { LiveMaintenanceTracker } from '../LiveMaintenanceTracker';
import { CustomSparePartModal } from '../CustomSparePartModal';
import { AttendingTechnicianModal } from '../AttendingTechnicianModal';

interface MaintenanceViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  onOpenRequisitionModal?: (department?: string) => void;
  onOpenAttendModal?: (machine: string, incidentId?: string) => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onOpenRequisitionModal,
  onOpenAttendModal
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
  const availablePartsMaster = state.maintenanceSparePartsMaster && state.maintenanceSparePartsMaster.length > 0
    ? state.maintenanceSparePartsMaster
    : COMMON_SPARE_PARTS;

  const [sparePartsList, setSparePartsList] = useState<SparePartItem[]>([
    { name: availablePartsMaster[0] || 'Band Heater Element 1500W', qty: 1, unit: 'Nos', notes: '' }
  ]);
  const [newPartName, setNewPartName] = useState(availablePartsMaster[0] || 'Band Heater Element 1500W');
  const [newPartQty, setNewPartQty] = useState('1');
  const [newPartUnit, setNewPartUnit] = useState('Nos');
  const [newPartNotes, setNewPartNotes] = useState('');
  const [availableSpareParts, setAvailableSpareParts] = useState<string[]>(availablePartsMaster);
  const [isCustomPartModalOpen, setIsCustomPartModalOpen] = useState(false);
  const [isDirectPartInput, setIsDirectPartInput] = useState(false);
  const [directPartNameInput, setDirectPartNameInput] = useState('');
  const [attendingModalIncident, setAttendingModalIncident] = useState<MaintenanceIncident | null>(null);

  // Department Heads list for cross-department coordination
  const deptHeads: MaintenanceContact[] = state.departmentHeads && state.departmentHeads.length > 0
    ? state.departmentHeads
    : DEFAULT_DEPARTMENT_HEADS;

  // Master Toggle: Automatically notify all department heads when a machine status is updated to 'Critical' or 'Down'
  const [autoNotifyEnabled, setAutoNotifyEnabled] = useState<boolean>(
    state.autoNotifyDeptHeadsOnCritical !== undefined ? state.autoNotifyDeptHeadsOnCritical : true
  );

  // Cross-Department Broadcast Alert State
  const [activeBroadcastAlert, setActiveBroadcastAlert] = useState<{
    machine: string;
    status: 'Critical' | 'Down';
    reason: string;
    reportedBy: string;
    time: string;
    stage: string;
    heads: MaintenanceContact[];
    waText: string;
  } | null>(null);

  const [showDeptHeadsRosterModal, setShowDeptHeadsRosterModal] = useState<boolean>(false);
  const [fleetFilter, setFleetFilter] = useState<'ALL' | 'ISSUES' | 'SLITTING' | 'CUTTING' | 'FORMING' | 'PACKING'>('ALL');
  const [isFleetExpanded, setIsFleetExpanded] = useState<boolean>(true);

  // Manual New Incident form states
  const [manualMachine, setManualMachine] = useState(ALL_MACHINES_LIST[0]);
  const [manualMachineStatus, setManualMachineStatus] = useState<'Critical' | 'Down' | 'Operational'>('Critical');
  const [manualReason, setManualReason] = useState('Mechanical Heater / Tooling Issue');
  const [manualDesc, setManualDesc] = useState('');
  const [manualReporter, setManualReporter] = useState('Maintenance Tech');
  const [manualPriority, setManualPriority] = useState<'Normal' | 'Urgent' | 'Critical'>('Critical');
  const [manualPhone, setManualPhone] = useState(contacts[0]?.phone || '');
  const [manualAutoNotify, setManualAutoNotify] = useState<boolean>(true);
  const [manualStartDate, setManualStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualStartTime, setManualStartTime] = useState(
    new Date().toTimeString().slice(0, 5) // "HH:mm"
  );

  // Breakdown Stop Time inputs for repair completion & downtime difference
  const [repairStopDate, setRepairStopDate] = useState(new Date().toISOString().split('T')[0]);
  const [repairStopTime, setRepairStopTime] = useState(
    new Date().toTimeString().slice(0, 5) // "HH:mm"
  );

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
    const finalPartName = isDirectPartInput ? directPartNameInput.trim() : newPartName.trim();
    if (!finalPartName) {
      alert('⚠️ Please enter the spare part name!');
      return;
    }
    const qty = parseInt(newPartQty) || 1;
    setSparePartsList([
      ...sparePartsList,
      {
        name: finalPartName,
        qty,
        unit: newPartUnit,
        notes: newPartNotes.trim()
      }
    ]);
    if (!availableSpareParts.includes(finalPartName)) {
      setAvailableSpareParts((prev) => [finalPartName, ...prev]);
    }
    setDirectPartNameInput('');
    setNewPartNotes('');
    setNewPartQty('1');
  };

  const handleAddCustomPart = (part: SparePartItem) => {
    setSparePartsList((prev) => [...prev, part]);
    if (!availableSpareParts.includes(part.name)) {
      setAvailableSpareParts((prev) => [part.name, ...prev]);
    }
    setNewPartName(part.name);
  };

  const handleRemoveSparePart = (index: number) => {
    setSparePartsList(sparePartsList.filter((_, idx) => idx !== index));
  };

  // Start repair / attend (Opens Attend Confirmation Dialog)
  const handleStartRepair = (incident: MaintenanceIncident) => {
    setAttendingModalIncident(incident);
  };

  // Confirm Attend: strictly records the technician/manager who is attending
  const handleConfirmAttend = (technicianName: string, notes?: string) => {
    if (!attendingModalIncident) return;
    const nowIso = new Date().toISOString();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayStr = new Date().toISOString().split('T')[0];
    const responseMins = Math.max(1, Math.round((Date.now() - new Date(attendingModalIncident.breakdownStartTime).getTime()) / 60000));

    const updated = incidents.map((inc) => {
      if (inc.id === attendingModalIncident.id) {
        return {
          ...inc,
          status: 'IN_PROGRESS' as const,
          repairStartTime: nowIso,
          attendingStartedAt: nowIso,
          technicianName,
          attendedBy: technicianName,
          responseTimeMinutes: responseMins,
          technicianRemarks: notes ? (inc.technicianRemarks ? `${inc.technicianRemarks} | ${notes}` : notes) : inc.technicianRemarks
        };
      }
      return inc;
    });

    const newLog: LogEntry = {
      jobId: attendingModalIncident.machine,
      product: 'Maintenance',
      stage: 'Breakdown Attended',
      machine: attendingModalIncident.machine,
      action: `👨‍🔧 Technician/Manager ${technicianName} started attending breakdown on ${attendingModalIncident.machine} (${attendingModalIncident.reason || 'General'}). Response: ${responseMins} mins.`,
      user: technicianName,
      startTime: nowTime,
      rawDate: todayStr,
      timestamp: new Date().toLocaleString()
    };

    setRepairTechName(technicianName);
    setSelectedIncidentId(attendingModalIncident.id);

    onSaveState({
      ...state,
      maintenanceIncidents: updated,
      logs: [newLog, ...(state.logs || [])]
    });

    alert(`✅ ${technicianName} has started working on ${attendingModalIncident.machine}.
Status: "This person is working here" has been activated.`);
    setAttendingModalIncident(null);
  };

  // Edit & Delete Incident states and handlers
  const [editingIncident, setEditingIncident] = useState<MaintenanceIncident | null>(null);
  const [editSparePartName, setEditSparePartName] = useState('');
  const [editSparePartQty, setEditSparePartQty] = useState<number>(1);
  const [editSparePartUnit, setEditSparePartUnit] = useState('Nos');

  const handleStartEditIncident = (incident: MaintenanceIncident) => {
    setEditingIncident(JSON.parse(JSON.stringify(incident)));
    setEditSparePartName(availableSpareParts[0] || '');
    setEditSparePartQty(1);
    setEditSparePartUnit('Nos');
  };

  const handleAddSparePartToEdit = () => {
    if (!editingIncident || !editSparePartName) return;
    const currentSpares = editingIncident.spareParts || [];
    const newSpare: SparePartItem = {
      name: editSparePartName,
      qty: editSparePartQty > 0 ? editSparePartQty : 1,
      unit: editSparePartUnit || 'Nos'
    };
    setEditingIncident({
      ...editingIncident,
      spareParts: [...currentSpares, newSpare]
    });
  };

  const handleRemoveSparePartFromEdit = (indexToRemove: number) => {
    if (!editingIncident) return;
    setEditingIncident({
      ...editingIncident,
      spareParts: (editingIncident.spareParts || []).filter((_, idx) => idx !== indexToRemove)
    });
  };

  const handleAutoCalcEditDowntime = () => {
    if (!editingIncident || !editingIncident.breakdownStartTime) return;
    const stopTime = editingIncident.breakdownStopTime || editingIncident.repairedAt;
    if (!stopTime) {
      const elapsed = Math.max(0, Math.round((Date.now() - new Date(editingIncident.breakdownStartTime).getTime()) / 60000));
      setEditingIncident({ ...editingIncident, totalDowntimeMinutes: elapsed });
    } else {
      const diff = Math.max(0, Math.round((new Date(stopTime).getTime() - new Date(editingIncident.breakdownStartTime).getTime()) / 60000));
      setEditingIncident({ ...editingIncident, totalDowntimeMinutes: diff });
    }
  };

  const handleSaveEditedIncident = () => {
    if (!editingIncident) return;
    if (!editingIncident.machine?.trim()) {
      alert('⚠️ Machine name is required!');
      return;
    }

    const updated = incidents.map((inc) => {
      if (inc.id === editingIncident.id) {
        return editingIncident;
      }
      return inc;
    });

    const editLog: LogEntry = {
      jobId: editingIncident.machine,
      product: 'Maintenance',
      stage: 'Maintenance Log Edited',
      machine: editingIncident.machine,
      action: `✏️ Maintenance Ticket [${editingIncident.id}] edited: Status=${editingIncident.status}, Tech=${editingIncident.technicianName || 'N/A'}, Downtime=${editingIncident.totalDowntimeMinutes || 0}m.`,
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      maintenanceIncidents: updated,
      logs: [editLog, ...(state.logs || [])]
    });

    alert(`✅ Maintenance Ticket ${editingIncident.id} updated successfully!`);
    setEditingIncident(null);
  };

  const handleDeleteIncident = (incidentId: string) => {
    const inc = incidents.find((i) => i.id === incidentId);
    if (!window.confirm(`⚠️ Are you sure you want to permanently delete Maintenance Incident Ticket "${incidentId}" (${inc?.machine || ''})?\n\nThis will permanently purge this breakdown record from the logs.`)) {
      return;
    }

    const updated = incidents.filter((i) => i.id !== incidentId);
    const deleteLog: LogEntry = {
      jobId: inc?.machine || 'Maintenance',
      product: 'Maintenance',
      stage: 'Maintenance Log Expunged',
      machine: inc?.machine || 'N/A',
      action: `🗑️ Maintenance Ticket [${incidentId}] permanently expunged by Super-Admin.`,
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      maintenanceIncidents: updated,
      logs: [deleteLog, ...(state.logs || [])]
    });

    alert(`🗑️ Maintenance Ticket ${incidentId} was permanently deleted.`);
  };

  // Complete Repair & Mark "Ready for Run / Certified OK"
  const handleCompleteRepair = (incident: MaintenanceIncident, sendWhatsApp: boolean = false) => {
    const nowIso = new Date().toISOString();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Effective Breakdown Stop Time (user entered or current)
    const effectiveStopIso = repairStopDate && repairStopTime
      ? new Date(`${repairStopDate}T${repairStopTime}:00`).toISOString()
      : nowIso;

    // Calculate exact downtime difference: Breakdown Stop Time - Breakdown Start Time
    const startMs = new Date(incident.breakdownStartTime).getTime();
    const stopMs = new Date(effectiveStopIso).getTime();
    const elapsedMins = Math.max(1, Math.round((stopMs - startMs) / 60000));

    const repairStartIso = incident.repairStartTime || incident.attendingStartedAt || incident.breakdownStartTime;
    const repairDurationMins = Math.max(1, Math.round((stopMs - new Date(repairStartIso).getTime()) / 60000));

    const partsSummary = sparePartsList.length > 0
      ? sparePartsList.map((p) => `${p.name} (Qty: ${p.qty} ${p.unit || ''})`).join(', ')
      : 'No spare parts replaced (Adjustment & Tuning)';

    // 1. Update incident ticket
    const updatedIncidents = incidents.map((inc) => {
      if (inc.id === incident.id) {
        return {
          ...inc,
          status: 'REPAIRED_READY' as const,
          repairedAt: effectiveStopIso,
          breakdownStopTime: effectiveStopIso,
          totalDowntimeMinutes: elapsedMins,
          repairDurationMinutes: repairDurationMins,
          technicianName: repairTechName,
          attendedBy: repairTechName,
          technicianRemarks: actionTaken || 'Repaired and certified ready for production.',
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

    // 3. Keep machine batches Held with [REPAIRED_READY] so operator retains sole authority to Resume
    const updatedJobs = state.jobs.map((j) => {
      let hasChange = false;
      const batches = (j.runningBatches || []).map((b) => {
        if (b.machine === incident.machine && b.status === 'Held') {
          hasChange = true;
          return {
            ...b,
            status: 'Held' as const,
            holdReason: `[REPAIRED_READY] Repaired by ${repairTechName} (${actionTaken || 'Ready for operator handover'})`
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
          status: 'Held' as const,
          holdReason: `[REPAIRED_READY] Repaired by ${repairTechName} (${actionTaken || 'Ready for operator handover'})`
        };
      }
      return pj;
    });

    // 4. Audit Log
    const newLog = {
      jobId: incident.machine,
      product: 'Workstation',
      stage: 'Maintenance Handover',
      machine: incident.machine,
      action: `✅ Machine Repaired & Handed Over by Tech ${repairTechName}. Awaiting operator verification to resume. (Downtime: ${elapsedMins}m, Spares: ${partsSummary})`,
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
        `📢 *Status:* "Repaired & Handed Over!" Production Operator will verify tooling/material and click "▶️ Accept Handover & Resume" on their screen.`
      );
      window.open(`https://wa.me/${cleanPhone}?text=${waText}`, '_blank');
    }

    setSelectedIncidentId(null);
    setActionTaken('');
    setSparePartsList([{ name: COMMON_SPARE_PARTS[0], qty: 1, unit: 'Nos', notes: '' }]);
    alert(`✅ Machine ${incident.machine} is marked REPAIRED & READY FOR HANDOVER!\n\nAs requested, the machine is not auto-running; production operator will verify tooling and click "▶️ Verify & Resume" on their screen.`);
  };

  // Toggle master Auto-Notify switch and persist in state
  const handleToggleAutoNotify = () => {
    const nextVal = !autoNotifyEnabled;
    setAutoNotifyEnabled(nextVal);
    onSaveState({
      ...state,
      autoNotifyDeptHeadsOnCritical: nextVal
    });
  };

  // Helper to trigger cross-department notifications to all department heads
  const triggerCrossDeptNotification = (
    machine: string,
    status: 'Critical' | 'Down',
    reason: string,
    reportedBy: string,
    detectedStage: string
  ) => {
    const nowIso = new Date().toISOString();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Integrate Coordination Matrix routing & fallbacks
    const matrix = state.coordinationMatrix || [];
    const activeMatrix = matrix.length > 0 ? matrix.filter((item) => item.isActive) : [];
    
    let filteredMatrix = [];
    const isElectrical = reason.toLowerCase().includes('electrical') || reason.toLowerCase().includes('sensor') || reason.toLowerCase().includes('fault') || reason.toLowerCase().includes('heater');
    
    if (isElectrical) {
      filteredMatrix = activeMatrix.filter((item) => item.alertCategories.electricalAlert);
    } else {
      filteredMatrix = activeMatrix.filter((item) => item.alertCategories.machineBreakdown);
    }

    let recipients: MaintenanceContact[] = [];
    if (filteredMatrix.length > 0) {
      recipients = filteredMatrix.map((item) => ({
        id: item.id,
        name: item.contactName,
        phone: item.phone,
        role: item.roleName,
        dept: item.roleName.toLowerCase().includes('electrical') ? 'Electrical' : 'Maintenance'
      }));
    } else {
      // Fallback matching rules if no custom matrix list is matched
      if (isElectrical) {
        recipients = deptHeads
          .filter((h) => h.role.toLowerCase().includes('electrical') || h.dept?.toLowerCase().includes('electrical'))
          .map((h) => ({
            id: h.id,
            name: h.name,
            phone: h.phone,
            role: h.role,
            dept: h.dept || 'Electrical'
          }));
        // If still empty fallback to the first default contact
        if (recipients.length === 0 && deptHeads.length > 0) {
          recipients = [deptHeads[0]];
        }
      } else {
        recipients = deptHeads.map((h) => ({
          id: h.id,
          name: h.name,
          phone: h.phone,
          role: h.role,
          dept: h.dept || 'Maintenance'
        }));
      }
    }

    const headsListNames = recipients.map((h) => `${h.name} (${h.dept || h.role})`);

    const broadcastLog: LogEntry = {
      jobId: machine,
      product: 'Workstation',
      stage: 'Cross-Dept Alert',
      machine,
      action: `🚨 [CROSS-DEPT BROADCAST] Machine ${machine} status set to ${status.toUpperCase()}! Auto-notified ${recipients.length} contact(s) (${headsListNames.join(', ')}) for immediate floor re-alignment.`,
      user: reportedBy || 'Maintenance Lead',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    const waBroadcastText = encodeURIComponent(
      `🚨 *WÜNDERKRAF ERP - URGENT MACHINE BREAKDOWN ALERT* 🚨\n\n` +
      `🛑 *Machine:* ${machine}\n` +
      `⚠️ *Status:* ${status.toUpperCase()} (LINE STOPPED)\n` +
      `⚡ *Stage / Department:* ${detectedStage}\n` +
      `📋 *Reason:* ${reason}\n` +
      `👨‍🔧 *Reported By:* ${reportedBy}\n` +
      `⏰ *Time:* ${nowTime}\n\n` +
      `📢 *ATTENTION SUBSCRIBED CONTACTS:*\n` +
      `• *Slitting & Cutting:* Re-route job queues & hold matching reels feeding this line.\n` +
      `• *Forming & QC:* Check buffer stock and re-balance sister machine lines.\n` +
      `• *Packing & Dispatch:* Adjust shift dispatch targets.\n` +
      `• *Maintenance:* Emergency response team is actively deployed.\n\n` +
      `Please coordinate on factory floor intercom/walkie.`
    );

    const payload = {
      machine,
      status,
      reason,
      reportedBy,
      time: nowTime,
      stage: detectedStage,
      heads: recipients,
      waText: waBroadcastText
    };

    return { broadcastLog, payload, nowIso, headsListNames };
  };

  // Helper to determine current machine operational status across factory
  const getMachineCurrentStatus = (machine: string): {
    status: 'Critical' | 'Down' | 'In Repair' | 'Held' | 'Operational';
    incident?: MaintenanceIncident;
    heldReason?: string;
  } => {
    const activeInc = incidents.find(
      (inc) => inc.machine === machine && (inc.status === 'OPEN' || inc.status === 'IN_PROGRESS')
    );
    if (activeInc) {
      if (activeInc.priority === 'Critical' || activeInc.machineStatus === 'Critical') {
        return { status: 'Critical', incident: activeInc };
      }
      if (activeInc.status === 'OPEN' || activeInc.machineStatus === 'Down') {
        return { status: 'Down', incident: activeInc };
      }
      return { status: 'In Repair', incident: activeInc };
    }

    let isHeld = false;
    let heldReason = '';
    state.jobs.forEach((j) => {
      j.runningBatches?.forEach((b) => {
        if (b.machine === machine && b.status === 'Held') {
          isHeld = true;
          heldReason = b.holdReason || 'Station Held';
        }
      });
    });
    state.packJobs.forEach((pj) => {
      if (pj.machine === machine && pj.status === 'Held') {
        isHeld = true;
        heldReason = pj.holdReason || 'Station Held';
      }
    });

    if (isHeld) {
      return { status: 'Held', heldReason };
    }

    return { status: 'Operational' };
  };

  // Update Machine Status directly from Fleet Board or Active card
  const handleQuickUpdateMachineStatus = (
    machine: string,
    newStatus: 'Critical' | 'Down' | 'Operational',
    quickReason?: string
  ) => {
    const nowIso = new Date().toISOString();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const reasonText = quickReason || (newStatus === 'Critical' ? 'Critical Emergency Breakdown (Line Stopped)' : newStatus === 'Down' ? 'Machine Down / Emergency Stoppage' : 'Machine Restored Operational');

    let detectedStage = 'Production';
    if (machine.startsWith('Cutting-')) detectedStage = 'Cutting';
    else if (machine.startsWith('Forming-')) detectedStage = 'Forming';
    else if (machine.startsWith('Packing-') || machine.startsWith('Manual-')) detectedStage = 'Packing';
    else if (machine.startsWith('Slitting-')) detectedStage = 'Slitting';
    else if (machine.startsWith('QC-')) detectedStage = 'QC';

    if (newStatus === 'Critical' || newStatus === 'Down') {
      const existingInc = incidents.find(
        (inc) => inc.machine === machine && (inc.status === 'OPEN' || inc.status === 'IN_PROGRESS')
      );

      let updatedIncidents: MaintenanceIncident[];
      let targetInc: MaintenanceIncident;

      const willNotify = autoNotifyEnabled;
      const notifResult = willNotify
        ? triggerCrossDeptNotification(machine, newStatus, reasonText, 'Maintenance In-Charge', detectedStage)
        : null;

      if (existingInc) {
        targetInc = {
          ...existingInc,
          machineStatus: newStatus,
          priority: newStatus === 'Critical' ? 'Critical' : existingInc.priority || 'Urgent',
          reason: existingInc.reason || reasonText,
          deptHeadsNotified: willNotify ? true : existingInc.deptHeadsNotified,
          deptHeadsNotifiedAt: willNotify ? notifResult?.nowIso : existingInc.deptHeadsNotifiedAt,
          notifiedHeadsList: willNotify ? notifResult?.headsListNames : existingInc.notifiedHeadsList
        };
        updatedIncidents = incidents.map((inc) => (inc.id === existingInc.id ? targetInc : inc));
      } else {
        const incidentSeq = incidents.length + 1;
        targetInc = {
          id: `MNT-${String(incidentSeq).padStart(3, '0')}`,
          machine,
          stage: detectedStage,
          reason: reasonText,
          description: `Machine status set to ${newStatus} from Maintenance Desk.`,
          reportedBy: 'Maintenance In-Charge',
          maintenancePhone: contacts[0]?.phone || '+91 98250 12345',
          priority: newStatus === 'Critical' ? 'Critical' : 'Urgent',
          machineStatus: newStatus,
          status: 'OPEN',
          breakdownStartTime: nowIso,
          breakdownDate: todayStr,
          deptHeadsNotified: willNotify,
          deptHeadsNotifiedAt: willNotify ? notifResult?.nowIso : undefined,
          notifiedHeadsList: willNotify ? notifResult?.headsListNames : undefined,
          whatsAppAlertSent: false
        };
        updatedIncidents = [targetInc, ...incidents];
      }

      // Hold active batches across jobs and packJobs
      const updatedJobs = state.jobs.map((j) => {
        let hasChange = false;
        const batches = (j.runningBatches || []).map((b) => {
          if (b.machine === machine && b.status === 'Running') {
            hasChange = true;
            return {
              ...b,
              status: 'Held' as const,
              holdReason: reasonText
            };
          }
          return b;
        });
        return hasChange ? { ...j, runningBatches: batches } : j;
      });

      const updatedPackJobs = state.packJobs.map((pj) => {
        if (pj.machine === machine && pj.status === 'Running') {
          return {
            ...pj,
            status: 'Held' as const,
            holdReason: reasonText
          };
        }
        return pj;
      });

      const newLog: LogEntry = {
        jobId: machine,
        product: 'Workstation',
        stage: 'Station Hold',
        machine,
        action: `🛑 Machine status set to ${newStatus.toUpperCase()} [Ticket: ${targetInc.id}] (${reasonText})`,
        user: 'Maintenance In-Charge',
        startTime: nowTime,
        rawDate: todayStr,
        timestamp: new Date().toLocaleString()
      };

      const newLogs = notifResult ? [...state.logs, newLog, notifResult.broadcastLog] : [...state.logs, newLog];

      onSaveState({
        ...state,
        jobs: updatedJobs,
        packJobs: updatedPackJobs,
        maintenanceIncidents: updatedIncidents,
        logs: newLogs
      });

      if (notifResult) {
        setActiveBroadcastAlert(notifResult.payload);
      }
    } else {
      // Restore to Operational
      const updatedIncidents = incidents.map((inc) => {
        if (inc.machine === machine && (inc.status === 'OPEN' || inc.status === 'IN_PROGRESS')) {
          const breakdownStart = new Date(inc.breakdownStartTime).getTime();
          const repairEnd = new Date(nowIso).getTime();
          const downtimeMins = Math.max(1, Math.round((repairEnd - breakdownStart) / 60000));
          return {
            ...inc,
            status: 'REPAIRED_READY' as const,
            repairedAt: nowIso,
            totalDowntimeMinutes: downtimeMins,
            actionTaken: 'Restored to Operational status from Maintenance Fleet Board.',
            machineStatus: 'Operational' as const
          };
        }
        return inc;
      });

      const updatedJobs = state.jobs.map((j) => {
        let hasChange = false;
        const batches = (j.runningBatches || []).map((b) => {
          if (b.machine === machine && b.status === 'Held') {
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
        if (pj.machine === machine && pj.status === 'Held') {
          return {
            ...pj,
            status: 'Running' as const,
            holdReason: undefined
          };
        }
        return pj;
      });

      const recoveryLog: LogEntry = {
        jobId: machine,
        product: 'Workstation',
        stage: 'Station Ready',
        machine,
        action: `🟢 Machine status restored to OPERATIONAL by Maintenance. Ready for line run.`,
        user: 'Maintenance In-Charge',
        startTime: nowTime,
        rawDate: todayStr,
        timestamp: new Date().toLocaleString()
      };

      onSaveState({
        ...state,
        jobs: updatedJobs,
        packJobs: updatedPackJobs,
        maintenanceIncidents: updatedIncidents,
        logs: [...state.logs, recoveryLog]
      });
    }
  };

  // Escalate active incident to Critical or Down with auto-notification
  const handleEscalateIncident = (incidentId: string, targetStatus: 'Critical' | 'Down') => {
    const inc = incidents.find((i) => i.id === incidentId);
    if (!inc) return;

    const detectedStage = inc.stage || 'Production';
    const willNotify = autoNotifyEnabled;
    const notifResult = willNotify
      ? triggerCrossDeptNotification(inc.machine, targetStatus, inc.reason, 'Maintenance In-Charge', detectedStage)
      : null;

    const updatedIncidents = incidents.map((i) => {
      if (i.id === incidentId) {
        return {
          ...i,
          priority: targetStatus === 'Critical' ? 'Critical' : i.priority || 'Urgent',
          machineStatus: targetStatus,
          deptHeadsNotified: willNotify ? true : i.deptHeadsNotified,
          deptHeadsNotifiedAt: willNotify ? notifResult?.nowIso : i.deptHeadsNotifiedAt,
          notifiedHeadsList: willNotify ? notifResult?.headsListNames : i.notifiedHeadsList
        };
      }
      return i;
    });

    const newLogs = notifResult ? [...state.logs, notifResult.broadcastLog] : state.logs;

    onSaveState({
      ...state,
      maintenanceIncidents: updatedIncidents,
      logs: newLogs
    });

    if (notifResult) {
      setActiveBroadcastAlert(notifResult.payload);
    }
  };

  // Create manual incident from Maintenance Desk
  const handleCreateManualIncident = (e: React.FormEvent) => {
    e.preventDefault();
    const nowIso = new Date().toISOString();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Use custom breakdown start time if entered, or default to current
    const effectiveStartIso = manualStartDate && manualStartTime
      ? new Date(`${manualStartDate}T${manualStartTime}:00`).toISOString()
      : nowIso;

    let detectedStage = 'Production';
    if (manualMachine.startsWith('Cutting-')) detectedStage = 'Cutting';
    else if (manualMachine.startsWith('Forming-')) detectedStage = 'Forming';
    else if (manualMachine.startsWith('Packing-') || manualMachine.startsWith('Manual-')) detectedStage = 'Packing';
    else if (manualMachine.startsWith('Slitting-')) detectedStage = 'Slitting';
    else if (manualMachine.startsWith('QC-')) detectedStage = 'QC';

    const incidentSeq = incidents.length + 1;
    const willNotify = manualAutoNotify && (manualMachineStatus === 'Critical' || manualMachineStatus === 'Down' || manualPriority === 'Critical');
    const notifResult = willNotify
      ? triggerCrossDeptNotification(
          manualMachine,
          manualMachineStatus === 'Down' ? 'Down' : 'Critical',
          manualReason,
          manualReporter,
          detectedStage
        )
      : null;

    const newInc: MaintenanceIncident = {
      id: `MNT-${String(incidentSeq).padStart(3, '0')}`,
      machine: manualMachine,
      stage: detectedStage,
      reason: manualReason,
      description: manualDesc || 'Scheduled maintenance / breakdown reported by technician',
      reportedBy: manualReporter,
      maintenancePhone: manualPhone,
      priority: manualPriority,
      machineStatus: manualMachineStatus,
      deptHeadsNotified: willNotify,
      deptHeadsNotifiedAt: willNotify ? notifResult?.nowIso : undefined,
      notifiedHeadsList: willNotify ? notifResult?.headsListNames : undefined,
      status: 'OPEN',
      breakdownStartTime: effectiveStartIso,
      breakdownDate: manualStartDate || todayStr,
      whatsAppAlertSent: false
    };

    // Also hold any active batch on this machine across jobs and packJobs
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

    const updatedPackJobs = state.packJobs.map((pj) => {
      if (pj.machine === manualMachine && pj.status === 'Running') {
        return {
          ...pj,
          status: 'Held' as const,
          holdReason: manualReason
        };
      }
      return pj;
    });

    const newLog = {
      jobId: manualMachine,
      product: 'Workstation',
      stage: 'Station Hold',
      machine: manualMachine,
      action: `🛑 Maintenance Breakdown Logged [Ticket: ${newInc.id}] (${manualReason}) - Status: ${manualMachineStatus.toUpperCase()}`,
      user: manualReporter,
      startTime: nowTime,
      rawDate: todayStr,
      timestamp: new Date().toLocaleString()
    };

    const newLogs = notifResult ? [...state.logs, newLog, notifResult.broadcastLog] : [...state.logs, newLog];

    onSaveState({
      ...state,
      jobs: updatedJobs,
      packJobs: updatedPackJobs,
      maintenanceIncidents: [newInc, ...incidents],
      logs: newLogs
    });

    setManualDesc('');
    setActiveTab('ACTIVE');

    if (notifResult) {
      setActiveBroadcastAlert(notifResult.payload);
    } else {
      alert(`✅ Maintenance ticket ${newInc.id} logged for ${manualMachine}!`);
    }
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
              <span>Back to Home</span>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-slate-900 m-0">
                    Maintenance Desk
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

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Auto-Notify Department Heads Toggle */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">
              <button
                type="button"
                onClick={handleToggleAutoNotify}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  autoNotifyEnabled ? 'bg-orange-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={autoNotifyEnabled}
                title="Toggle automatic notification to all department heads when machine status is Critical or Down"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    autoNotifyEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1">
                  <BellRing className={`w-3.5 h-3.5 ${autoNotifyEnabled ? 'text-orange-600 animate-pulse' : 'text-slate-400'}`} />
                  <span className="text-[11px] font-bold text-slate-800">Auto-Notify Dept Heads</span>
                  <span
                    className={`text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-full ${
                      autoNotifyEnabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {autoNotifyEnabled ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
                <span className="text-[9.5px] text-slate-500">
                  On Critical / Down status •{' '}
                  <button
                    type="button"
                    onClick={() => setShowDeptHeadsRosterModal(true)}
                    className="text-orange-600 hover:text-orange-800 font-bold underline cursor-pointer"
                  >
                    {deptHeads.length} Dept Heads
                  </button>
                </span>
              </div>
            </div>

            {onOpenRequisitionModal && (
              <button
                onClick={() => onOpenRequisitionModal('Maintenance')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Raise Spare Parts / Material Indent to Purchase Department"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Material / Spares Indent</span>
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

        {/* Machine Fleet Live Status & Cross-Department Coordination Board */}
        <div className="mt-5 bg-slate-50/80 border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                <Radio className="w-4 h-4 text-orange-600 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-900 m-0 flex items-center gap-1.5 flex-wrap">
                  <span>Machine Fleet Status & Coordination</span>
                  <span className="text-[10px] font-normal text-slate-500">
                    • Set status to 'Critical' or 'Down' to trigger instant cross-department notification
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-bold">
                {(['ALL', 'ISSUES', 'SLITTING', 'CUTTING', 'FORMING', 'PACKING'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setFleetFilter(filter)}
                    className={`px-2 py-0.5 rounded cursor-pointer transition ${
                      fleetFilter === filter
                        ? 'bg-orange-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {filter === 'ALL' ? 'All Machines' : filter === 'ISSUES' ? 'Down / Critical' : filter}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsFleetExpanded(!isFleetExpanded)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
              >
                {isFleetExpanded ? 'Collapse' : 'Expand Fleet'}
              </button>
            </div>
          </div>

          {isFleetExpanded && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
              {ALL_MACHINES_LIST.filter((m) => {
                if (fleetFilter === 'ISSUES') {
                  const s = getMachineCurrentStatus(m).status;
                  return s === 'Critical' || s === 'Down' || s === 'In Repair' || s === 'Held';
                }
                if (fleetFilter === 'SLITTING') return m.startsWith('Slitting');
                if (fleetFilter === 'CUTTING') return m.startsWith('Cutting');
                if (fleetFilter === 'FORMING') return m.startsWith('Forming');
                if (fleetFilter === 'PACKING') return m.startsWith('Packing') || m.startsWith('Manual') || m.startsWith('QC');
                return true;
              }).map((m) => {
                const info = getMachineCurrentStatus(m);
                const isCritical = info.status === 'Critical';
                const isDown = info.status === 'Down';
                const isInRepair = info.status === 'In Repair';
                const isHeld = info.status === 'Held';
                const isOperational = info.status === 'Operational';

                const statusColor = isCritical
                  ? 'border-red-500 bg-red-50/80 text-red-900'
                  : isDown
                  ? 'border-amber-500 bg-amber-50/80 text-amber-900'
                  : isInRepair
                  ? 'border-blue-400 bg-blue-50/80 text-blue-900'
                  : isHeld
                  ? 'border-orange-400 bg-orange-50/80 text-orange-900'
                  : 'border-slate-200 bg-white text-slate-800';

                return (
                  <div
                    key={m}
                    className={`border rounded-xl p-2.5 shadow-2xs transition flex flex-col justify-between ${statusColor}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-extrabold text-xs tracking-tight">{m}</span>
                        {isCritical && (
                          <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                            CRITICAL
                          </span>
                        )}
                        {isDown && (
                          <span className="bg-amber-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                            DOWN
                          </span>
                        )}
                        {isInRepair && (
                          <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                            REPAIR
                          </span>
                        )}
                        {isHeld && !isCritical && !isDown && (
                          <span className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                            HELD
                          </span>
                        )}
                        {isOperational && (
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                            OK
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-500 truncate mb-2">
                        {info.incident?.reason || info.heldReason || 'Ready for Run'}
                      </div>
                    </div>

                    {/* Quick status toggle actions */}
                    <div className="pt-1.5 border-t border-slate-200/60 flex items-center gap-1">
                      {isOperational ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleQuickUpdateMachineStatus(m, 'Down', 'Machine Down (Stoppage)')}
                            className="flex-1 py-1 text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded cursor-pointer transition text-center"
                            title="Set to Down and auto-notify department heads"
                          >
                            Set Down
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickUpdateMachineStatus(m, 'Critical', 'Critical Breakdown (Line Stopped)')}
                            className="flex-1 py-1 text-[10px] font-bold bg-red-100 hover:bg-red-200 text-red-900 rounded cursor-pointer transition text-center"
                            title="Set to Critical and auto-notify department heads"
                          >
                            Set Critical
                          </button>
                        </>
                      ) : (
                        <div className="w-full flex items-center gap-1">
                          {!isCritical && (
                            <button
                              type="button"
                              onClick={() => handleQuickUpdateMachineStatus(m, 'Critical', 'Escalated to Critical')}
                              className="flex-1 py-1 text-[10px] font-bold bg-red-100 hover:bg-red-200 text-red-900 rounded cursor-pointer transition text-center"
                              title="Escalate to Critical and notify all department heads"
                            >
                              🔴 Critical
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleQuickUpdateMachineStatus(m, 'Operational')}
                            className="flex-1 py-1 text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded cursor-pointer transition text-center"
                            title="Restore machine to Operational"
                          >
                            🟢 Clear / OK
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
            <span>Active Breakdowns & Repairs</span>
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
            <span>Downtime & Maintenance Log</span>
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
            <span>Manual Breakdown Entry</span>
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
            <span>Maintenance Team Directory</span>
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
            <span>Spares Indent Status</span>
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
          {/* Real-time Fleet Breakdown & Attendance Overview */}
          <LiveMaintenanceTracker
            state={state}
            onOpenAttendModal={onOpenAttendModal || ((m, incId) => setSelectedIncidentId(incId || null))}
          />

          {activeIncidents.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 m-0">
                All Machines Running Smoothly!
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Whenever an operator holds or stops a machine, it appears here with real-time downtime tracking and resolution actions.
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

                      {/* Department Heads Notification & Status Pill */}
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-1 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-600">Machine Status:</span>
                            <span
                              className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                incident.priority === 'Critical' || incident.machineStatus === 'Critical'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-amber-600 text-white'
                              }`}
                            >
                              {incident.priority === 'Critical' || incident.machineStatus === 'Critical'
                                ? 'CRITICAL (Line Stopped)'
                                : 'DOWN (Machine Stopped)'}
                            </span>
                          </div>

                          {/* Quick Escalation to Critical if not already */}
                          {incident.priority !== 'Critical' && incident.machineStatus !== 'Critical' && (
                            <button
                              type="button"
                              onClick={() => handleEscalateIncident(incident.id, 'Critical')}
                              className="text-[10px] bg-red-100 hover:bg-red-200 text-red-800 font-bold px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition"
                              title="Escalate priority to Critical and auto-notify all department heads"
                            >
                              <BellRing className="w-3 h-3 text-red-600" />
                              <span>Escalate to Critical & Notify Heads</span>
                            </button>
                          )}
                        </div>

                        {/* Dept Heads Notified Banner */}
                        {incident.deptHeadsNotified ? (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 flex items-center justify-between flex-wrap gap-1 text-[11px] text-orange-950">
                            <div className="flex items-center gap-1.5 font-bold">
                              <BellRing className="w-3.5 h-3.5 text-orange-600 animate-pulse" />
                              <span>All {deptHeads.length} Dept Heads Notified</span>
                              <span className="text-[10px] text-slate-500 font-normal">
                                ({incident.deptHeadsNotifiedAt ? new Date(incident.deptHeadsNotifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Dispatched'})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const { payload } = triggerCrossDeptNotification(
                                  incident.machine,
                                  incident.machineStatus === 'Down' ? 'Down' : 'Critical',
                                  incident.reason,
                                  incident.reportedBy,
                                  incident.stage
                                );
                                setActiveBroadcastAlert(payload);
                              }}
                              className="text-[10px] text-orange-700 hover:text-orange-900 font-bold underline cursor-pointer"
                            >
                              View / Dispatch Broadcast
                            </button>
                          </div>
                        ) : (
                          <div className="bg-slate-100 border border-slate-200 rounded-lg p-2 flex items-center justify-between flex-wrap gap-1 text-[11px] text-slate-700">
                            <span className="text-slate-500">Dept heads not yet alerted</span>
                            <button
                              type="button"
                              onClick={() => handleEscalateIncident(incident.id, 'Down')}
                              className="text-[10px] bg-orange-600 hover:bg-orange-700 text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer shadow-2xs"
                            >
                              <BellRing className="w-3 h-3 text-white" />
                              <span>Notify All Dept Heads Now</span>
                            </button>
                          </div>
                        )}
                      </div>

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
                          className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Wrench className="w-4 h-4" />
                          <span>Attend / Start Repair</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedIncidentId(incident.id);
                            if (incident.technicianName) {
                              setRepairTechName(incident.technicianName);
                            }
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

                        {/* PROMINENT ATTENDING TECHNICIAN BANNER: This person is working here */}
                        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-500 rounded-xl p-3 shadow-xs">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="relative">
                                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                                  <User className="w-5 h-5" />
                                </div>
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
                              </div>
                              <div>
                                <div className="text-[10px] font-black uppercase text-emerald-800 tracking-wider flex items-center gap-1">
                                  <span>👨‍🔧 This person is working here (Active Attending):</span>
                                </div>
                                <div className="text-sm font-black text-slate-900">
                                  {incident.technicianName || incident.attendedBy || repairTechName}
                                </div>
                                <div className="text-[10px] text-emerald-700 font-semibold flex items-center gap-2">
                                  <span>Work Started: {incident.attendingStartedAt ? new Date(incident.attendingStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                                  {incident.attendingStartedAt && (
                                    <span>• Working for {Math.max(1, Math.round((Date.now() - new Date(incident.attendingStartedAt).getTime()) / 60000))} minutes</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAttendingModalIncident(incident)}
                              className="text-xs font-bold text-emerald-900 bg-white hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1.5 rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Change Person</span>
                            </button>
                          </div>
                        </div>

                        {/* Technician Name Selection */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Technician / Engineer Assigned:
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
                            Action Taken / Work Done:
                          </label>
                          <textarea
                            rows={2}
                            value={actionTaken}
                            onChange={(e) => setActionTaken(e.target.value)}
                            placeholder="e.g. Cleaned cutter head, replaced burnt thermocouple sensor wire, calibrated PID temperature at 210°C."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:bg-white focus:border-orange-500 resize-none"
                          />
                        </div>

                        {/* Spare Parts Replaced */}
                        <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-xl space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                              <Package className="w-3.5 h-3.5 text-amber-700" />
                              <span>Spare Parts Replaced:</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setIsCustomPartModalOpen(true)}
                                className="text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded transition flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ Enter New Custom Part</span>
                              </button>
                              <span className="text-[10px] text-amber-700 font-semibold">
                                {sparePartsList.length} Item(s)
                              </span>
                            </div>
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

                          {/* Add Spare Part Inputs & Custom Part Buttons */}
                          <div className="pt-2 border-t border-amber-200/80 space-y-1.5">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className="text-[11px] font-bold text-amber-950">Add New Spare:</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setIsCustomPartModalOpen(true)}
                                  className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                  title="Open popup to enter new spare part"
                                >
                                  <Plus className="w-3 h-3 text-amber-700" />
                                  <span>Custom Part Popup</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsDirectPartInput(!isDirectPartInput)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                                    isDirectPartInput
                                      ? 'bg-amber-600 text-white border-amber-700'
                                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  {isDirectPartInput ? '📋 Choose from List' : '✍️ Type Name Directly'}
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-12 gap-1.5">
                              <div className="col-span-6">
                                {isDirectPartInput ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={directPartNameInput}
                                    onChange={(e) => setDirectPartNameInput(e.target.value)}
                                    placeholder="Type part name..."
                                    className="w-full px-2 py-1.5 bg-white border-2 border-amber-400 rounded text-xs font-bold text-slate-900 outline-none"
                                  />
                                ) : (
                                  <select
                                    value={newPartName}
                                    onChange={(e) => {
                                      if (e.target.value === 'CUSTOM_PART_POPUP') {
                                        setIsCustomPartModalOpen(true);
                                      } else {
                                        setNewPartName(e.target.value);
                                      }
                                    }}
                                    className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded text-xs text-slate-800 outline-none font-medium"
                                  >
                                    <option value="CUSTOM_PART_POPUP">➕ Enter New Custom Part (Popup)...</option>
                                    {availableSpareParts.map((sp) => (
                                      <option key={sp} value={sp}>
                                        {sp}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                              <div className="col-span-3">
                                <input
                                  type="number"
                                  min="1"
                                  value={newPartQty}
                                  onChange={(e) => setNewPartQty(e.target.value)}
                                  placeholder="Qty"
                                  className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded text-xs text-slate-800 outline-none font-bold"
                                />
                              </div>
                              <div className="col-span-3">
                                <button
                                  type="button"
                                  onClick={handleAddSparePart}
                                  className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Breakdown Start / Stop Timing & Downtime Difference */}
                        {(() => {
                          const startMs = new Date(incident.breakdownStartTime).getTime();
                          const stopMs = repairStopDate && repairStopTime
                            ? new Date(`${repairStopDate}T${repairStopTime}:00`).getTime()
                            : Date.now();
                          const diffMinutes = Math.max(1, Math.round((stopMs - startMs) / 60000));
                          const formattedDiff = formatDowntime(diffMinutes);

                          return (
                            <div className="bg-slate-100/90 border border-slate-300 p-3 rounded-xl space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                  <Clock className="w-4 h-4 text-orange-600" />
                                  <span>Breakdown Timing & Duration Tracking (Start / Stop Time):</span>
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">
                                  Live Difference Calculation
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {/* Breakdown Start Time Display */}
                                <div className="bg-white border border-slate-200 p-2 rounded-lg">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                    Breakdown Start Time:
                                  </span>
                                  <div className="text-xs font-black text-slate-900 mt-0.5">
                                    {new Date(incident.breakdownStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    <span className="text-[10px] font-medium text-slate-500 ml-1.5">
                                      ({incident.breakdownDate || new Date(incident.breakdownStartTime).toLocaleDateString()})
                                    </span>
                                  </div>
                                </div>

                                {/* Breakdown Stop Time Entry */}
                                <div className="bg-white border border-slate-200 p-2 rounded-lg">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                                      Breakdown Stop Time:
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRepairStopDate(new Date().toISOString().split('T')[0]);
                                        setRepairStopTime(new Date().toTimeString().slice(0, 5));
                                      }}
                                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                                    >
                                      Set Now
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <input
                                      type="date"
                                      value={repairStopDate}
                                      onChange={(e) => setRepairStopDate(e.target.value)}
                                      className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-800 outline-none"
                                    />
                                    <input
                                      type="time"
                                      value={repairStopTime}
                                      onChange={(e) => setRepairStopTime(e.target.value)}
                                      className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-800 outline-none"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Calculated Downtime Difference */}
                              <div className="bg-orange-50 border border-orange-300 px-3 py-2 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs">
                                <div className="font-bold text-orange-950 flex items-center gap-1.5">
                                  <Clock className="w-4 h-4 text-orange-700" />
                                  <span>Downtime Difference:</span>
                                </div>
                                <div className="text-orange-900 font-black text-xs bg-orange-200/90 px-2.5 py-1 rounded-md border border-orange-300">
                                  {formattedDiff} ({diffMinutes} Minutes)
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Handover & Ready Button */}
                        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleCompleteRepair(incident, false)}
                            className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Machine Ready / Certified OK</span>
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

          {/* Downtime Records Table */}
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
                    <th className="py-2.5 px-3">Breakdown Stop</th>
                    <th className="py-2.5 px-3">Difference / Total</th>
                    <th className="py-2.5 px-3">Root Cause / Issue</th>
                    <th className="py-2.5 px-3">Action Taken</th>
                    <th className="py-2.5 px-3">Spare Parts Replaced</th>
                    <th className="py-2.5 px-3">Technician / Reporter</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIncidents.map((inc) => {
                    const durationMins = inc.totalDowntimeMinutes || (inc.status === 'OPEN' ? getElapsedMinutes(inc.breakdownStartTime) : 0);
                    const startTimeFormatted = new Date(inc.breakdownStartTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    const stopTimestamp = inc.breakdownStopTime || inc.repairedAt;
                    const readyTimeFormatted = stopTimestamp
                      ? new Date(stopTimestamp).toLocaleTimeString([], {
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
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>{startTimeFormatted}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">{inc.breakdownDate}</span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          {stopTimestamp ? (
                            <div>
                              <div className="font-bold text-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{readyTimeFormatted}</span>
                              </div>
                              <span className="text-[10px] text-emerald-600 font-medium">
                                {new Date(stopTimestamp).toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 animate-pulse">
                              🔴 Breakdown Active
                            </span>
                          )}
                        </td>

                        {/* Downtime duration difference pill */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-black px-2.5 py-1 rounded-lg text-xs ${
                              durationMins > 60
                                ? 'bg-red-100 text-red-900 border border-red-300'
                                : durationMins > 30
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatDowntime(durationMins)} ({durationMins}m)</span>
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

                        <td className="py-3 px-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditIncident(inc)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Edit Incident Record / Actions"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteIncident(inc.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Incident Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
              Log Maintenance Breakdown / Machine Stop
            </h2>
          </div>
          <p className="text-xs text-slate-500 mb-5">
            Record a scheduled preventive maintenance check, emergency tooling jam, or electrical fault.
          </p>

          <form onSubmit={handleCreateManualIncident} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  Machine Status:
                </label>
                <select
                  value={manualMachineStatus}
                  onChange={(e) => {
                    const val = e.target.value as 'Critical' | 'Down';
                    setManualMachineStatus(val);
                    if (val === 'Critical') setManualPriority('Critical');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
                >
                  <option value="Critical">🔴 Critical (Line Stopped)</option>
                  <option value="Down">🛑 Down (Machine Stopped)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Priority:
                </label>
                <select
                  value={manualPriority}
                  onChange={(e) => setManualPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-orange-500"
                >
                  <option value="Critical">🔴 Critical (Line Stopped)</option>
                  <option value="Urgent">🟠 Urgent</option>
                  <option value="Normal">🟢 Normal</option>
                </select>
              </div>
            </div>

            {/* Cross-Department Notification Option */}
            <div className="p-3 bg-orange-50/80 border border-orange-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BellRing className={`w-4 h-4 ${manualAutoNotify ? 'text-orange-600 animate-pulse' : 'text-slate-400'}`} />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Auto-Notify All Department Heads
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Sends emergency line stoppage broadcast to {deptHeads.length} heads (Slitting, Cutting, Forming, QC, Packing, Dispatch, Stores, Plant Head)
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={manualAutoNotify}
                  onChange={(e) => setManualAutoNotify(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
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
                Problem Description & Symptoms:
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 p-3 rounded-xl border border-amber-200">
              <div>
                <label className="block text-xs font-bold text-amber-950 uppercase mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Breakdown Start Date:</span>
                </label>
                <input
                  type="date"
                  value={manualStartDate}
                  onChange={(e) => setManualStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-amber-950 uppercase flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Breakdown Start Time:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setManualStartTime(new Date().toTimeString().slice(0, 5))}
                    className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                  >
                    Current Time
                  </button>
                </div>
                <input
                  type="time"
                  value={manualStartTime}
                  onChange={(e) => setManualStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Reported By:
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
                <span>Submit Breakdown & Pause Machine</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: MAINTENANCE TEAM DIRECTORY & DEPT HEADS */}
      {activeTab === 'CONTACTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Maintenance Team Phone Directory (Full Width & Admin Synced) */}
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-slate-900">
                <Phone className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-sm font-bold m-0 flex items-center gap-2">
                    <span>Maintenance Team Directory</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      Admin Master Synced
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 m-0">
                    Direct contacts for quick-dial, SMS & WhatsApp notifications
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">
                  {contacts.length} Technicians Active
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>{c.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium block">
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

          {/* Department Heads Coordination Roster */}
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-slate-900">
                <BellRing className="w-5 h-5 text-orange-600" />
                <div>
                  <h3 className="text-sm font-bold m-0 flex items-center gap-2">
                    <span>Department Heads Coordination Matrix</span>
                    <span className="bg-orange-100 text-orange-800 text-[10px] font-black px-2 py-0.2 rounded-full">
                      Auto-Alert Subscribed
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 m-0">
                    These department heads receive automatic instant alerts when any machine status changes to 'Critical' or 'Down'
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  Total {deptHeads.length} Heads Active
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {deptHeads.map((head) => (
                <div
                  key={head.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between"
                >
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.2 rounded">
                        {head.dept}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active on alert channel" />
                    </div>
                    <div className="font-bold text-xs text-slate-900">{head.name}</div>
                    <div className="text-[11px] text-slate-500">{head.role}</div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-slate-700">
                      {head.phone}
                    </span>
                    <a
                      href={`https://wa.me/${head.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                        `*WÜNDERKRAF ERP* - Testing Department Head emergency maintenance channel for ${head.dept}.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebc59] transition"
                      title="Send WhatsApp Direct Message"
                    >
                      <Send className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SPARE PARTS & MATERIAL REQUISITION STATUS */}
      {activeTab === 'REQUISITIONS' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-emerald-600" />
                  <span>Maintenance Spares & Indents</span>
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
                  <span>New Spares Requisition</span>
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
                  No Spares Requisition Found
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  If cutter blades, heaters, belts, oil or spares are needed for any machine, click above to raise an indent to the Purchase Department.
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
                              <span>Acknowledge Delivery (Store Received)</span>
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

      {/* MODAL 1: Cross-Department Heads Emergency Broadcast Modal */}
      {activeBroadcastAlert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-red-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-linear-to-r from-red-600 via-red-700 to-orange-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                  <Megaphone className="w-5 h-5 text-white animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black m-0 tracking-tight">
                      CROSS-DEPARTMENT ALERT DISPATCHED
                    </h2>
                    <span className="bg-white text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                      {activeBroadcastAlert.status}
                    </span>
                  </div>
                  <p className="text-xs text-red-100 m-0">
                    All {activeBroadcastAlert.heads.length} Department Heads Notified for Urgent Floor Alignment
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveBroadcastAlert(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Breakdown Summary Box */}
            <div className="p-5 space-y-4">
              <div className="bg-red-50/70 border border-red-200 rounded-xl p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Machine</span>
                    <span className="font-black text-slate-900 text-sm">{activeBroadcastAlert.machine}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Status</span>
                    <span className="font-extrabold text-red-700 text-sm">
                      {activeBroadcastAlert.status.toUpperCase()} (Line Stopped)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Department / Stage</span>
                    <span className="font-bold text-slate-800">{activeBroadcastAlert.stage}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Reported At</span>
                    <span className="font-bold text-slate-800">{activeBroadcastAlert.time}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-red-200/80 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Problem / Reason:</span>
                  <p className="text-red-950 font-bold m-0">{activeBroadcastAlert.reason}</p>
                </div>
              </div>

              {/* Department Coordination Actions */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <BellRing className="w-4 h-4 text-orange-600" />
                  <span>Immediate Cross-Department Action Checklist:</span>
                </div>
                <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4 m-0">
                  <li><strong>Slitting & Cutting Heads:</strong> Pause slit reels feeding {activeBroadcastAlert.machine}, re-route active queues to sister machines.</li>
                  <li><strong>Forming & QC Heads:</strong> Inspect buffer stock and re-balance cup batch allocations.</li>
                  <li><strong>Packing & Dispatch Heads:</strong> Recalculate packing schedule and notify transport if dispatch ETA shifts.</li>
                  <li><strong>Maintenance Lead:</strong> Emergency spares and mechanical crew actively deployed on-station.</li>
                </ul>
              </div>

              {/* Contact Dispatch List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Notified Department Heads ({activeBroadcastAlert.heads.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const decoded = decodeURIComponent(activeBroadcastAlert.waText);
                      navigator.clipboard.writeText(decoded);
                      alert('📋 Broadcast message copied to clipboard! You can paste in company WhatsApp group or floor intercom.');
                    }}
                    className="text-xs text-orange-600 hover:text-orange-800 font-bold underline cursor-pointer"
                  >
                    Copy Broadcast Text
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                  {activeBroadcastAlert.heads.map((head) => (
                    <div
                      key={head.id}
                      className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black uppercase text-orange-700 bg-orange-100 px-1.5 py-0.2 rounded">
                            {head.dept}
                          </span>
                          <span className="font-bold text-slate-800">{head.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{head.role} • {head.phone}</span>
                      </div>
                      <a
                        href={`https://wa.me/${head.phone.replace(/[^\d]/g, '')}?text=${activeBroadcastAlert.waText}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-[#25D366] hover:bg-[#1ebc59] text-white font-bold text-[10px] rounded-lg transition flex items-center gap-1 shrink-0"
                        title="Dispatch individual WhatsApp alert"
                      >
                        <Send className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveBroadcastAlert(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md"
                >
                  Confirm & Close Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Department Heads Roster Modal */}
      {showDeptHeadsRosterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 m-0">
                    Department Heads Coordination Roster
                  </h3>
                  <p className="text-xs text-slate-500 m-0">
                    Auto-alert broadcast recipients for Critical / Down machines
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeptHeadsRosterModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Auto-Notify Status: {autoNotifyEnabled ? 'ENABLED' : 'DISABLED'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    All {deptHeads.length} heads receive instant notifications when machine status is Critical or Down.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAutoNotify}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition cursor-pointer ${
                    autoNotifyEnabled ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-500 hover:bg-slate-600'
                  }`}
                >
                  {autoNotifyEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>

              <div className="space-y-2">
                {deptHeads.map((head) => (
                  <div
                    key={head.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-orange-700 bg-orange-100 px-2 py-0.2 rounded">
                          {head.dept}
                        </span>
                        <span className="font-bold text-xs text-slate-900">{head.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {head.role} • <span className="font-mono">{head.phone}</span>
                      </div>
                    </div>

                    <a
                      href={`https://wa.me/${head.phone.replace(/[^\d]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebc59] transition"
                      title="Direct Chat"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeptHeadsRosterModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Spare Part Modal */}
      <CustomSparePartModal
        isOpen={isCustomPartModalOpen}
        onClose={() => setIsCustomPartModalOpen(false)}
        onAddPart={handleAddCustomPart}
      />

      {/* Attending Technician / Maintenance Manager Confirmation Modal */}
      {attendingModalIncident && (
        <AttendingTechnicianModal
          isOpen={!!attendingModalIncident}
          onClose={() => setAttendingModalIncident(null)}
          machineName={attendingModalIncident.machine}
          incidentId={attendingModalIncident.id}
          reason={attendingModalIncident.reason}
          currentAttendant={attendingModalIncident.technicianName || attendingModalIncident.attendedBy}
          availableTechnicians={contacts.map(c => c.name)}
          onConfirmAttend={handleConfirmAttend}
        />
      )}

      {/* Edit Maintenance Incident Modal */}
      {editingIncident && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-4 text-white flex items-center justify-between border-b border-indigo-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-white m-0">
                    Edit Maintenance Incident: {editingIncident.id}
                  </h3>
                  <p className="text-[11px] text-indigo-200/80 m-0">
                    Modify machine, breakdown duration, action taken, and spare parts.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingIncident(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Machine:
                  </label>
                  <select
                    value={editingIncident.machine}
                    onChange={(e) => setEditingIncident({ ...editingIncident, machine: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  >
                    {ALL_MACHINES_LIST.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Manufacturing Stage:
                  </label>
                  <select
                    value={editingIncident.stage}
                    onChange={(e) => setEditingIncident({ ...editingIncident, stage: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="Slitting">Slitting</option>
                    <option value="Cutting">Cutting</option>
                    <option value="Forming">Forming</option>
                    <option value="QC">QC</option>
                    <option value="Packing">Packing</option>
                    <option value="Facility">Facility / General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Status:
                  </label>
                  <select
                    value={editingIncident.status}
                    onChange={(e) => setEditingIncident({ ...editingIncident, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="OPEN">🔴 OPEN (Stopped)</option>
                    <option value="IN_PROGRESS">🟡 IN PROGRESS (In Repair)</option>
                    <option value="REPAIRED_READY">🟢 REPAIRED READY (Ready to Run)</option>
                    <option value="ACKNOWLEDGED">✅ ACKNOWLEDGED (Resumed)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Breakdown Start Time:
                  </label>
                  <input
                    type="datetime-local"
                    value={editingIncident.breakdownStartTime ? editingIncident.breakdownStartTime.slice(0, 16) : ''}
                    onChange={(e) => setEditingIncident({ ...editingIncident, breakdownStartTime: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Breakdown Stop Time / Ready:
                  </label>
                  <input
                    type="datetime-local"
                    value={editingIncident.breakdownStopTime ? editingIncident.breakdownStopTime.slice(0, 16) : (editingIncident.repairedAt ? editingIncident.repairedAt.slice(0, 16) : '')}
                    onChange={(e) => setEditingIncident({ ...editingIncident, breakdownStopTime: e.target.value, repairedAt: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Total Downtime (Minutes):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingIncident.totalDowntimeMinutes || 0}
                    onChange={(e) => setEditingIncident({ ...editingIncident, totalDowntimeMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAutoCalcEditDowntime}
                  className="mt-4 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Auto-Calculate Duration
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Root Cause / Issue Summary:
                </label>
                <input
                  type="text"
                  value={editingIncident.reason || ''}
                  onChange={(e) => setEditingIncident({ ...editingIncident, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  placeholder="e.g. Upper Heating Element Failure"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Detailed Description & Observations:
                </label>
                <textarea
                  rows={2}
                  value={editingIncident.description || ''}
                  onChange={(e) => setEditingIncident({ ...editingIncident, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 outline-none resize-none"
                  placeholder="Describe electrical readings, mechanical wear, operator notes..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Corrective Action Taken & Prevention:
                </label>
                <textarea
                  rows={2}
                  value={editingIncident.actionTaken || ''}
                  onChange={(e) => setEditingIncident({ ...editingIncident, actionTaken: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 outline-none resize-none"
                  placeholder="Replaced 50mm heater band, calibrated PID controller to 185°C..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Attending Technician / Manager:
                  </label>
                  <input
                    type="text"
                    value={editingIncident.technicianName || ''}
                    onChange={(e) => setEditingIncident({ ...editingIncident, technicianName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    placeholder="e.g. Ramesh K (Sr. Mechanical Tech)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Reported By (Operator):
                  </label>
                  <input
                    type="text"
                    value={editingIncident.reportedBy || ''}
                    onChange={(e) => setEditingIncident({ ...editingIncident, reportedBy: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    placeholder="e.g. Suresh V"
                  />
                </div>
              </div>

              {/* Spare Parts Section */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5 m-0">
                    <Package className="w-3.5 h-3.5 text-indigo-600" />
                    Spare Parts Replaced
                  </h4>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {editingIncident.spareParts?.length || 0} Parts Recorded
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={editSparePartName}
                    onChange={(e) => setEditSparePartName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  >
                    {availableSpareParts.map((sp) => (
                      <option key={sp} value={sp}>{sp}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={editSparePartQty}
                    onChange={(e) => setEditSparePartQty(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-800 text-center"
                    placeholder="Qty"
                  />
                  <select
                    value={editSparePartUnit}
                    onChange={(e) => setEditSparePartUnit(e.target.value)}
                    className="w-20 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="Nos">Nos</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Sets">Sets</option>
                    <option value="Mtrs">Mtrs</option>
                    <option value="Ltrs">Ltrs</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddSparePartToEdit}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(editingIncident.spareParts || []).map((sp, sIdx) => (
                    <div key={sIdx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
                      <span className="font-bold text-slate-800">
                        {sp.name} <span className="text-indigo-600 font-extrabold ml-1">× {sp.qty} {sp.unit || 'Nos'}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSparePartFromEdit(sIdx)}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        title="Remove part"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {(!editingIncident.spareParts || editingIncident.spareParts.length === 0) && (
                    <div className="text-[11px] text-slate-400 italic text-center py-1">
                      No spare parts attached
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteIncident(editingIncident.id)}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Delete Incident
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingIncident(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedIncident}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Ticket Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceView;
