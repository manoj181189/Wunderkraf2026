import React from 'react';
import { CheckCircle2, Wrench, Clock, X, Play, ShieldCheck, AlertCircle, Package } from 'lucide-react';
import { MachineReadyAlert, FactoryState } from '../types';

interface MachineReadyNotificationModalProps {
  isOpen: boolean;
  alertData: MachineReadyAlert | null;
  state: FactoryState;
  onClose: () => void;
  onSaveState: (state: FactoryState) => void;
  onOpenMaintenanceDesk?: () => void;
}

export const MachineReadyNotificationModal: React.FC<MachineReadyNotificationModalProps> = ({
  isOpen,
  alertData,
  state,
  onClose,
  onSaveState,
  onOpenMaintenanceDesk
}) => {
  if (!isOpen || !alertData) return null;

  const handleResumeProduction = () => {
    const { machine, technician, incidentId, downtimeMinutes } = alertData;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Resume all batches on this machine from 'Held' to 'Running'
    let updatedJobs = state.jobs.map((j) => {
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

    let updatedPackJobs = state.packJobs.map((pj) => {
      if (pj.machine === machine && pj.status === 'Held') {
        return {
          ...pj,
          status: 'Running' as const,
          holdReason: undefined
        };
      }
      return pj;
    });

    // 2. Mark incident as ACKNOWLEDGED in maintenanceIncidents
    const updatedIncidents = (state.maintenanceIncidents || []).map((inc) => {
      if (inc.id === incidentId || (inc.machine === machine && inc.status === 'REPAIRED_READY')) {
        return {
          ...inc,
          status: 'ACKNOWLEDGED' as const,
          acknowledgedAt: new Date().toISOString()
        };
      }
      return inc;
    });

    // 3. Mark alert as inactive in machineReadyAlerts
    const updatedAlerts = (state.machineReadyAlerts || []).filter(
      (a) => a.incidentId !== incidentId && a.machine !== machine
    );

    // 4. Audit Log
    const newLog = {
      jobId: machine,
      product: 'Workstation',
      stage: 'Production Resume',
      machine: machine,
      action: `▶️ Machine Resumed by Production Operator after Maintenance Clearance (Downtime: ${downtimeMinutes}m, Tech: ${technician})`,
      user: 'operator',
      startTime: nowTime,
      rawDate: todayStr,
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      packJobs: updatedPackJobs,
      maintenanceIncidents: updatedIncidents,
      machineReadyAlerts: updatedAlerts,
      logs: [...state.logs, newLog]
    });

    onClose();
  };

  const handleDismissOnly = () => {
    // Dismiss alert banner without changing batch states
    const updatedAlerts = (state.machineReadyAlerts || []).filter(
      (a) => a.incidentId !== alertData.incidentId
    );
    onSaveState({
      ...state,
      machineReadyAlerts: updatedAlerts
    });
    onClose();
  };

  const timeDisplay = new Date(alertData.repairedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border-t-8 border-emerald-500 relative">
        <button
          onClick={handleDismissOnly}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Green Pulse */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-200 shadow-xs">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>MAINTENANCE HANDOVER NOTIFICATION</span>
            </div>
            <h3 className="text-lg font-black text-slate-800 m-0">
              मेंटेनेंस साइड से ओके है — मशीन रेडी!
            </h3>
            <p className="text-xs text-slate-500 m-0">
              Maintenance team has completed repairs and handed over machine to production.
            </p>
          </div>
        </div>

        {/* Machine & Downtime Highlight Card */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between border-b border-emerald-200/70 pb-2 mb-2.5">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-emerald-800 font-bold block">
                Workstation / Machine:
              </span>
              <span className="text-xl font-black text-emerald-950">
                {alertData.machine}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block">
                Total Downtime (बंद रहा):
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-black bg-white px-2.5 py-1 rounded-lg border border-emerald-300 text-emerald-700 shadow-2xs">
                <Clock className="w-3.5 h-3.5" />
                <span>{alertData.downtimeMinutes} Minutes</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 block font-medium">Technician:</span>
              <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                {alertData.technician || 'Maintenance Tech'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Ready At:</span>
              <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {timeDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Work Done & Spares Details */}
        <div className="space-y-2.5 mb-5 text-xs">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="font-bold text-slate-700 block mb-1">
              🛠️ Action Taken / Work Done (क्या काम किया):
            </span>
            <p className="text-slate-800 m-0 leading-relaxed font-medium bg-white p-2 rounded border border-slate-200">
              {alertData.actionTaken || 'Machine tested and certified ready for production.'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <span className="font-bold text-slate-700 flex items-center gap-1 mb-1">
              <Package className="w-3.5 h-3.5 text-indigo-600" />
              <span>Spare Parts Replaced (स्पेयर पार्ट्स):</span>
            </span>
            <p className="text-slate-800 m-0 leading-relaxed font-semibold bg-white p-2 rounded border border-slate-200">
              {alertData.sparePartsSummary || 'None (Adjustment & Calibration only)'}
            </p>
          </div>
        </div>

        {/* Status Message */}
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl mb-5 text-xs text-blue-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Technician Clearance Status:</span>
            <span>"मेरी साइड से मशीन ओके है। ऑपरेटर रन बटन दबाकर प्रोडक्शन चालू कर सकता है।"</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={handleDismissOnly}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer border border-slate-200"
          >
            Later / सिर्फ बंद करें
          </button>
          <button
            onClick={handleResumeProduction}
            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>मशीन चालू करें (Resume Run)</span>
          </button>
        </div>

        {onOpenMaintenanceDesk && (
          <button
            onClick={() => {
              onClose();
              onOpenMaintenanceDesk();
            }}
            className="w-full mt-2.5 py-1.5 text-slate-500 hover:text-indigo-600 text-[11px] font-medium text-center transition"
          >
            Open Maintenance Desk for full log →
          </button>
        )}
      </div>
    </div>
  );
};

export default MachineReadyNotificationModal;
