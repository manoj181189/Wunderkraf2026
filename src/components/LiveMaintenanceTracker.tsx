import React, { useState, useEffect } from 'react';
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  User,
  Radio,
  ExternalLink,
  ShieldAlert,
  Layers
} from 'lucide-react';
import { FactoryState } from '../types';
import { DEFAULT_MAINTENANCE_TECHNICIANS } from '../lib/constants';

interface LiveMaintenanceTrackerProps {
  state: FactoryState;
  onOpenAttendModal: (machineName: string, incidentId?: string) => void;
  compact?: boolean;
}

export const LiveMaintenanceTracker: React.FC<LiveMaintenanceTrackerProps> = ({
  state,
  onOpenAttendModal,
  compact = false
}) => {
  // Timer tick for live minute updates
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  const incidents = state.maintenanceIncidents || [];
  const activeIncidents = incidents.filter(
    (inc) => inc.status === 'OPEN' || inc.status === 'IN_PROGRESS'
  );

  // Helper to compute minutes
  const getElapsed = (iso?: string) => {
    if (!iso) return 1;
    try {
      const start = new Date(iso).getTime();
      return Math.max(1, Math.round((Date.now() - start) / 60000));
    } catch {
      return 1;
    }
  };

  const techniciansList =
    state.maintenanceTechniciansMaster && state.maintenanceTechniciansMaster.length > 0
      ? state.maintenanceTechniciansMaster
      : DEFAULT_MAINTENANCE_TECHNICIANS;

  // Build Technician Allocation Map
  const techAllocationMap: Record<
    string,
    { machine: string; reason: string; elapsedMins: number; incidentId: string } | null
  > = {};

  techniciansList.forEach((tech) => {
    techAllocationMap[tech] = null;
  });

  activeIncidents.forEach((inc) => {
    if (inc.status === 'IN_PROGRESS' && inc.technicianName) {
      const repairMins = getElapsed(inc.repairStartTime || inc.attendingStartedAt);
      techAllocationMap[inc.technicianName] = {
        machine: inc.machine,
        reason: inc.reason,
        elapsedMins: repairMins,
        incidentId: inc.id
      };
    }
  });

  const waitingCount = activeIncidents.filter((i) => i.status === 'OPEN').length;
  const repairingCount = activeIncidents.filter((i) => i.status === 'IN_PROGRESS').length;

  if (activeIncidents.length === 0) {
    if (compact) return null;
    return (
      <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide">
              All Machines Operational
            </div>
            <div className="text-[11px] text-emerald-800 font-medium">
              There are no active breakdowns in the plant currently. All maintenance technicians are available (Standby).
            </div>
          </div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
          0 Breakdowns Active
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide m-0">
              🔴 Live Machine Breakdown & Technician Tracker
            </h4>
            <p className="text-[11px] text-slate-500 m-0">
              Which technician is currently working on which machine (Floor Live Traceability)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {waitingCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full font-extrabold bg-red-100 text-red-800 border border-red-300 animate-pulse">
              🔴 {waitingCount} Waiting for Tech
            </span>
          )}
          {repairingCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
              🟡 {repairingCount} Under Repair
            </span>
          )}
        </div>
      </div>

      {/* Active Breakdown Machines Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {activeIncidents.map((inc) => {
          const isRepairing = inc.status === 'IN_PROGRESS';
          const totalDownMins = getElapsed(inc.breakdownStartTime);
          const repairMins = getElapsed(inc.repairStartTime || inc.attendingStartedAt);

          return (
            <div
              key={inc.id}
              className={`p-3.5 rounded-xl border-2 transition shadow-xs ${
                isRepairing
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-red-50/70 border-red-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xs text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {inc.machine}
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                      isRepairing
                        ? 'bg-amber-200 text-amber-900 border border-amber-300'
                        : 'bg-red-200 text-red-900 border border-red-300'
                    }`}
                  >
                    {isRepairing ? '🟡 Under Repair' : '🔴 Waiting'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 font-mono">
                  {inc.id}
                </span>
              </div>

              <div className="text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">{inc.reason}</span>
              </div>

              {/* Status details */}
              <div className="text-[11px] space-y-1 mt-2 pt-2 border-t border-slate-200/60">
                {isRepairing ? (
                  <div className="flex items-center justify-between">
                    <span className="text-amber-900 font-extrabold flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-amber-700" />
                      <span>Working: <b>{inc.technicianName}</b></span>
                    </span>
                    <span className="font-mono font-bold text-amber-950">
                      ⏱️ {repairMins}m in progress
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-red-800">
                    <span className="font-bold">⚠️ No Technician Arrived</span>
                    <span className="font-mono font-black text-rose-700">
                      ⏱️ {totalDownMins}m waiting
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => onOpenAttendModal(inc.machine, inc.id)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                    isRepairing
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white'
                  }`}
                >
                  {isRepairing ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Repair Completed - Machine OK</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-3.5 h-3.5" />
                      <span>👨‍🔧 I am Attending (Start Repair)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Technician Roster Status (Who is free, who is busy) */}
      {!compact && (
        <div className="pt-3 border-t border-slate-100">
          <div className="text-[11px] font-bold text-slate-600 uppercase mb-2 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span>Maintenance Team Live Status (Technician Availability Roster):</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {Object.entries(techAllocationMap).map(([techName, alloc]) => {
              const isBusy = Boolean(alloc);
              return (
                <div
                  key={techName}
                  className={`p-2 rounded-xl border text-xs transition ${
                    isBusy
                      ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold'
                      : 'bg-emerald-50/50 border-emerald-200 text-slate-700'
                  }`}
                >
                  <div className="font-extrabold truncate text-[11px]" title={techName}>
                    {techName.split(' ')[0]} {techName.includes('(') ? `(${techName.split('(')[1].split(')')[0]})` : ''}
                  </div>
                  {isBusy ? (
                    <div className="text-[10px] text-amber-800 mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="truncate">Busy on <b>{alloc?.machine}</b> ({alloc?.elapsedMins}m)</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Available</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
