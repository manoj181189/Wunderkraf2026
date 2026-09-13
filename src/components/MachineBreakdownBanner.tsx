import React from 'react';
import { Wrench, AlertTriangle, Clock, CheckCircle2, User, Play, Radio, ShieldAlert } from 'lucide-react';
import { FactoryState } from '../types';

interface MachineBreakdownBannerProps {
  machineName: string;
  state: FactoryState;
  onOpenAttendModal: (machine: string) => void;
  onOpenHoldModal?: (machine: string) => void;
}

export const MachineBreakdownBanner: React.FC<MachineBreakdownBannerProps> = ({
  machineName,
  state,
  onOpenAttendModal,
  onOpenHoldModal
}) => {
  const incidents = state.maintenanceIncidents || [];
  const activeIncident = incidents.find(
    (inc) =>
      inc.machine === machineName &&
      (inc.status === 'OPEN' || inc.status === 'IN_PROGRESS')
  );

  // Check if any job or packJob has a batch held on this machine
  let isHeldOnFloor = false;
  let floorHoldReason = '';
  (state.jobs || []).forEach((j) => {
    (j.runningBatches || []).forEach((b) => {
      if (b.machine === machineName && b.status === 'Held') {
        isHeldOnFloor = true;
        if (b.holdReason) floorHoldReason = b.holdReason;
      }
    });
  });
  (state.packJobs || []).forEach((pj) => {
    if (pj.machine === machineName && pj.status === 'Held') {
      isHeldOnFloor = true;
      if (pj.holdReason) floorHoldReason = pj.holdReason;
    }
  });

  if (!activeIncident && !isHeldOnFloor) {
    return null;
  }

  // Calculate elapsed minutes
  const getElapsed = (iso?: string) => {
    if (!iso) return 1;
    try {
      const start = new Date(iso).getTime();
      return Math.max(1, Math.round((Date.now() - start) / 60000));
    } catch {
      return 1;
    }
  };

  const isUnderRepair = activeIncident?.status === 'IN_PROGRESS';
  const isOpenWaiting = activeIncident?.status === 'OPEN' || (!activeIncident && isHeldOnFloor);

  const breakdownTime = activeIncident?.breakdownStartTime;
  const repairTime = activeIncident?.repairStartTime || activeIncident?.attendingStartedAt;

  const totalDownMins = getElapsed(breakdownTime);
  const currentRepairMins = getElapsed(repairTime);

  const displayReason = activeIncident?.reason || floorHoldReason || 'Technical Breakdown / Tooling Pause';
  const displayTech = activeIncident?.technicianName || activeIncident?.attendedBy || 'Technician';

  if (isUnderRepair) {
    return (
      <div className="bg-gradient-to-r from-amber-500/15 via-amber-50 to-orange-50 border-2 border-amber-400 rounded-2xl p-4 shadow-sm animate-in fade-in space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm animate-pulse">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-xs uppercase px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                  🟡 REPAIR IN PROGRESS
                </span>
                <span className="text-xs font-bold text-amber-950 font-mono">
                  {machineName}
                </span>
              </div>
              <div className="text-sm font-black text-slate-900 mt-1 flex items-center gap-1.5 flex-wrap">
                <span>Working Technician:</span>
                <span className="text-amber-900 font-extrabold bg-white px-2 py-0.5 rounded border border-amber-300">
                  👨‍🔧 {displayTech}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  (⏱️ Work in progress for {currentRepairMins} minutes)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-right hidden sm:block text-xs">
              <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Down Time:</span>
              <span className="font-mono font-black text-rose-700">⏱️ {totalDownMins} Mins</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenAttendModal(machineName)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wide rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Repair Completed - Mark Machine OK</span>
            </button>
          </div>
        </div>

        <div className="bg-white/80 border border-amber-200 rounded-xl px-3 py-2 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold uppercase text-[11px]">Issue (Reason):</span>
            <span className="font-bold text-slate-800">{displayReason}</span>
          </div>
          <span className="text-[11px] text-amber-800 font-medium italic">
            As soon as the machine is fixed, click "Repair Completed" above.
          </span>
        </div>
      </div>
    );
  }

  // If OPEN / Waiting
  return (
    <div className="bg-gradient-to-r from-red-500/15 via-rose-50 to-red-50 border-2 border-red-400 rounded-2xl p-4 shadow-sm animate-in fade-in space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shadow-sm animate-pulse">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-xs uppercase px-2.5 py-0.5 rounded-full bg-red-200 text-red-900 border border-red-300">
                🔴 BREAKDOWN
              </span>
              <span className="text-xs font-bold text-red-950 font-mono">
                {machineName}
              </span>
              <span className="text-[11px] font-bold text-red-700">
                (Waiting for Technician • Down for {totalDownMins} minutes)
              </span>
            </div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">
              Reason: <span className="text-red-900">{displayReason}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onOpenAttendModal(machineName)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs uppercase tracking-wide rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Wrench className="w-4 h-4" />
            <span>👨‍🔧 I am Attending </span>
          </button>
        </div>
      </div>

      <div className="bg-white/80 border border-red-200 rounded-xl px-3 py-2 flex items-center justify-between flex-wrap gap-2 text-xs">
        <span className="text-slate-600 text-[11px]">
          📢 The Maintenance Technician who came to work on this machine should press the <b>"I am Attending"</b> button to log the start of work immediately.
        </span>
        {onOpenHoldModal && (
          <button
            type="button"
            onClick={() => onOpenHoldModal(machineName)}
            className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
          >
            Change Breakdown Details
          </button>
        )}
      </div>
    </div>
  );
};
