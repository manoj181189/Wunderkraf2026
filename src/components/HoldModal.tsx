import React, { useState } from 'react';
import { PauseCircle, AlertTriangle, Send, X, RefreshCw, Phone, User, Wrench, ShieldAlert } from 'lucide-react';
import { FactoryState, MaintenanceIncident } from '../types';
import { MACHINES, DEFAULT_MAINTENANCE_CONTACTS } from '../lib/constants';

interface HoldModalProps {
  isOpen: boolean;
  stationName: string;
  state: FactoryState;
  onClose: () => void;
  onSaveState: (state: FactoryState) => void;
}

export const HoldModal: React.FC<HoldModalProps> = ({
  isOpen,
  stationName,
  state,
  onClose,
  onSaveState
}) => {
  const contacts = state.maintenanceContacts && state.maintenanceContacts.length > 0 
    ? state.maintenanceContacts 
    : DEFAULT_MAINTENANCE_CONTACTS;

  const [reason, setReason] = useState('Mechanical Heater / Tooling Issue');
  const [remarks, setRemarks] = useState('');
  const [operatorName, setOperatorName] = useState('Operator');
  const [priority, setPriority] = useState<'Normal' | 'Urgent' | 'Critical'>('Urgent');
  const [maintenancePhone, setMaintenancePhone] = useState(contacts[0]?.phone || '+91 98250 12345');
  const [rerouteMachine, setRerouteMachine] = useState('');

  if (!isOpen) return null;

  // Determine stage based on machine prefix
  let detectedStage = 'Production';
  if (stationName.startsWith('Cutting-')) detectedStage = 'Cutting';
  else if (stationName.startsWith('Forming-')) detectedStage = 'Forming';
  else if (stationName.startsWith('Packing-') || stationName.startsWith('Manual-')) detectedStage = 'Packing';
  else if (stationName.startsWith('Slitting-')) detectedStage = 'Slitting';
  else if (stationName.startsWith('QC-')) detectedStage = 'QC';

  // Candidate alternate machines for rerouting
  let candidateMachines: string[] = [];
  if (stationName.startsWith('Cutting-')) candidateMachines = MACHINES['Cutting'];
  else if (stationName.startsWith('Forming-')) candidateMachines = MACHINES['Forming'];
  else if (stationName.startsWith('Packing-') || stationName.startsWith('Manual-')) candidateMachines = MACHINES['Packing'];
  else if (stationName.startsWith('Slitting-')) candidateMachines = MACHINES['Slitting'];

  const otherMachines = candidateMachines.filter((m) => m !== stationName);

  const handleConfirmHold = (sendWhatsApp: boolean = false) => {
    const holdDesc = remarks ? `${reason}: ${remarks}` : reason;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Update jobs or packJobs to mark running batches on this machine as Held
    let updatedJobs = state.jobs;
    let updatedPackJobs = state.packJobs;
    let affectedJobId = '';

    if (stationName.startsWith('Packing-') || stationName.startsWith('Manual-')) {
      updatedPackJobs = state.packJobs.map((pj) => {
        if (pj.machine === stationName && pj.status === 'Running') {
          affectedJobId = pj.id;
          return {
            ...pj,
            status: 'Held' as const,
            holdReason: holdDesc
          };
        }
        return pj;
      });
    } else {
      updatedJobs = state.jobs.map((j) => {
        let hasActive = false;
        const batches = (j.runningBatches || []).map((b) => {
          if (b.machine === stationName && b.status === 'Running') {
            hasActive = true;
            affectedJobId = j.id;
            return {
              ...b,
              status: 'Held' as const,
              holdReason: holdDesc
            };
          }
          return b;
        });
        if (hasActive) {
          return { ...j, runningBatches: batches };
        }
        return j;
      });
    }

    // 2. Create Maintenance Incident Ticket
    const incidentSeq = (state.maintenanceIncidents?.length || 0) + 1;
    const newIncident: MaintenanceIncident = {
      id: `MNT-${String(incidentSeq).padStart(3, '0')}`,
      machine: stationName,
      stage: detectedStage,
      reason: reason,
      description: remarks || 'Machine paused for technical assistance',
      reportedBy: operatorName || 'Operator',
      maintenancePhone: maintenancePhone.trim(),
      priority: priority,
      status: 'OPEN',
      breakdownStartTime: nowIso,
      breakdownDate: todayStr,
      whatsAppAlertSent: sendWhatsApp
    };

    const newLog = {
      jobId: affectedJobId || stationName,
      product: 'Workstation',
      stage: 'Station Hold',
      machine: stationName,
      action: `🛑 Machine Paused & Maintenance Alerted [Ticket: ${newIncident.id}] (${holdDesc}) - Phone: ${maintenancePhone}`,
      user: operatorName,
      startTime: nowTime,
      rawDate: todayStr,
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      packJobs: updatedPackJobs,
      logs: [...state.logs, newLog],
      maintenanceIncidents: [newIncident, ...(state.maintenanceIncidents || [])]
    });

    // 3. Dispatch WhatsApp Notification if requested
    if (sendWhatsApp) {
      const cleanPhone = maintenancePhone.replace(/[^\d]/g, '');
      const msg = encodeURIComponent(
        `🚨 *WÜNDERKRAF ERP - MACHINE BREAKDOWN ALERT* 🚨\n\n` +
        `⚠️ *Machine:* ${stationName} (${detectedStage})\n` +
        `🛑 *Breakdown Reason:* ${reason}\n` +
        `📝 *Remarks:* ${remarks || 'Immediate breakdown assistance requested.'}\n` +
        `⚡ *Priority:* ${priority.toUpperCase()}\n` +
        `👤 *Reported By:* ${operatorName}\n` +
        `⏱️ *Time:* ${nowTime} (${todayStr})\n` +
        `🎫 *Ticket ID:* ${newIncident.id}\n\n` +
        `🛠️ *Action Required:* Please visit workstation ${stationName}, complete repair, and mark "Ready for Run" on the *Maintenance Desk* to clear the floor.`
      );

      const waUrl = cleanPhone 
        ? `https://wa.me/${cleanPhone}?text=${msg}` 
        : `https://api.whatsapp.com/send?text=${msg}`;

      window.open(waUrl, '_blank');
    }

    onClose();
  };

  const handleConfirmReroute = () => {
    if (!rerouteMachine) return;
    const holdDesc = remarks ? `${reason}: ${remarks}` : reason;

    let updatedJobs = state.jobs.map((j) => {
      const batches = (j.runningBatches || []).map((b) => {
        if (b.machine === stationName && (b.status === 'Running' || b.status === 'Held')) {
          return {
            ...b,
            machine: rerouteMachine,
            status: 'Running' as const,
            holdReason: undefined
          };
        }
        return b;
      });
      return { ...j, runningBatches: batches };
    });

    const newLog = {
      jobId: stationName,
      product: 'Workstation',
      stage: 'Crate Re-route',
      machine: rerouteMachine,
      action: `🔄 Transferred batch from ${stationName} to ${rerouteMachine} (${holdDesc})`,
      user: operatorName,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    alert(`✅ Batch transferred from ${stationName} to ${rerouteMachine}!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border-t-6 border-red-500 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-red-600 mb-1">
          <PauseCircle className="w-6 h-6 shrink-0" />
          <h3 className="text-base font-bold m-0 text-slate-800">
            Machine Stop & Maintenance Alert (मशीन स्टॉप व मेंटेनेंस अलर्ट)
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4 ml-8">
          मशीन बंद करने पर मेंटेनेंस टीम को तत्काल अलर्ट चला जाएगा और मेंटेनेंस डेस्क पर टिकट दर्ज होगा।
        </p>

        <div className="space-y-3.5">
          {/* Machine & Priority Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Target Workstation:
              </label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>{stationName}</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                  {detectedStage}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Priority Level (प्राथमिकता):
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-red-500"
              >
                <option value="Normal">🟢 Normal (साधारण)</option>
                <option value="Urgent">🟠 Urgent (जरूरी)</option>
                <option value="Critical">🔴 Critical (अति आवश्यक / लाइन जाम)</option>
              </select>
            </div>
          </div>

          {/* Reason for Breakdown */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Reason for Hold / Breakdown (स्टॉप का कारण):
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-red-500"
            >
              <option value="Mechanical Heater / Tooling Issue">Mechanical Heater / Tooling Issue</option>
              <option value="Electrical / Sensor Fault">Electrical / Sensor / Temp Controller Fault</option>
              <option value="Pneumatic / Hydraulic Pressure Drop">Pneumatic / Air Pressure / Hydraulic Drop</option>
              <option value="Die Alignment & Sharpness Check">Die Alignment & Blade Sharpness Check</option>
              <option value="Raw Paper Roll Change / Setup">Raw Paper Roll Change / Setup Jam</option>
              <option value="Routine Cleaning & Maintenance">Routine Cleaning & Preventative Check</option>
              <option value="Operator Lunch / Tea Break">Operator Lunch / Tea Break</option>
              <option value="Other Emergency Technical Fault">Other Emergency Technical Fault</option>
            </select>
          </div>

          {/* Remarks input */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Custom Description / Technical Details (विस्तृत जानकारी):
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Upper heater coil temperature error, sensor wire loose, need urgent repair"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:bg-white focus:border-red-500 resize-none"
            />
          </div>

          {/* Operator Name input */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Reporting Operator Name (ऑपरेटर का नाम):</span>
            </label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="e.g. Ramesh / Operator"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:bg-white focus:border-red-500"
            />
          </div>

          {/* Maintenance Phone Number Input & Quick Contacts (User requirement: "नंबर एक डालने की सुविधा चाहिए") */}
          <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-amber-900 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-amber-700" />
                <span>Maintenance Phone Number (मेंटेनेंस नंबर):</span>
              </label>
              <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-medium">
                WhatsApp / Call Alert
              </span>
            </div>

            {/* Quick Contact Chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setMaintenancePhone(c.phone)}
                  className={`text-[11px] px-2 py-1 rounded-md border font-medium transition cursor-pointer flex items-center gap-1 ${
                    maintenancePhone === c.phone
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <span>{c.name}</span>
                </button>
              ))}
            </div>

            {/* Direct Number Input */}
            <div className="relative">
              <input
                type="text"
                value={maintenancePhone}
                onChange={(e) => setMaintenancePhone(e.target.value)}
                placeholder="+91 98250 12345 or 10-digit number"
                className="w-full pl-8 pr-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-500"
              />
              <Phone className="w-4 h-4 text-amber-600 absolute left-2.5 top-2.5" />
            </div>
            <p className="text-[10px] text-amber-700 mt-1">
              * आप ऊपर से संपर्क चुन सकते हैं या नया फोन नंबर सीधे टाइप कर सकते हैं।
            </p>
          </div>

          {/* Alternate Crate Re-Routing Option */}
          {otherMachines.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
              <span className="text-xs font-bold text-blue-900 block mb-1">
                🔄 Crate Re-Routing (Shift Running Batch to Another Machine):
              </span>
              <select
                value={rerouteMachine}
                onChange={(e) => setRerouteMachine(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs text-slate-800 outline-none"
              >
                <option value="">-- DO NOT RE-ROUTE (HOLD IN PLACE) --</option>
                {otherMachines.map((m) => (
                  <option key={m} value={m}>
                    Shift running batch to {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button
            onClick={() => handleConfirmHold(false)}
            className="py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <PauseCircle className="w-4 h-4 text-amber-400" />
            <span>Stop Silently (केवल स्टॉप)</span>
          </button>
          
          <button
            onClick={() => handleConfirmHold(true)}
            className="py-2.5 bg-[#25D366] hover:bg-[#1ebc59] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
          >
            <Send className="w-4 h-4" />
            <span>Alert Maintenance via WhatsApp</span>
          </button>
        </div>

        {rerouteMachine && (
          <button
            onClick={handleConfirmReroute}
            className="w-full mt-2 py-2.5 bg-[#319795] hover:bg-[#285e61] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Confirm Re-route to {rerouteMachine}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default HoldModal;
