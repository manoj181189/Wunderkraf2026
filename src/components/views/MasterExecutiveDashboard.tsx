import React from 'react';
import { ArrowLeft, Activity, Layers, Package, Trash2, Scroll, Play, Pause, Circle, Wrench, AlertTriangle, Clock, SearchCheck, Box, ShieldCheck, CheckCircle2, FileText, Scissors, Cog, Truck } from 'lucide-react';
import { FactoryState } from '../../types';
import { calculateAvailableScrapKg } from '../../lib/utils';
import { ALL_MACHINES_LIST } from '../../lib/constants';
import { LiveMaintenanceTracker } from '../LiveMaintenanceTracker';

interface MasterExecutiveDashboardProps {
  state: FactoryState;
  onBackToHub: () => void;
  onOpenStationModal: (machineName: string) => void;
  onOpenAttendModal?: (machineName: string, incidentId?: string) => void;
  onNavigateAnalytics?: () => void;
  onNavigateToTraceability?: (query: string) => void;
  onSaveState?: (newState: FactoryState) => void;
}

export const MasterExecutiveDashboard: React.FC<MasterExecutiveDashboardProps> = ({
  state,
  onBackToHub,
  onOpenStationModal,
  onOpenAttendModal,
  onNavigateAnalytics,
  onNavigateToTraceability,
  onSaveState
}) => {
  const { jobs, packJobs, logs, scrapSales, maintenanceIncidents = [] } = state;

  let totalSlitPaperKg = 0;
  let totalPackedBoxes = 0;

  logs.forEach((l) => {
    if (l.action && l.action.includes('Finished') && l.stage === 'Slitting') {
      const matchKg = l.action.match(/(\d+)\s*KG/i);
      if (matchKg) totalSlitPaperKg += parseInt(matchKg[1], 10) || 0;
    }
    if (l.action && l.action.includes('Packed')) {
      const matchBox = l.action.match(/(\d+)\s*Boxes/i);
      if (matchBox) totalPackedBoxes += parseInt(matchBox[1], 10) || 0;
    }
  });

  const availableScrap = calculateAvailableScrapKg(logs, scrapSales);

  // Real-time QC Pipeline & Inspector Status
  const activeQcBatches: Array<{ job: any; batch: any }> = [];
  jobs.forEach((j) => {
    (j.runningBatches || []).forEach((b) => {
      if ((b.stage === 'QC' || b.machine === 'QC-Desk') && (b.status === 'Running' || b.status === 'Held')) {
        activeQcBatches.push({ job: j, batch: b });
      }
    });
  });

  const pendingQcJobs = jobs.filter((j) => (j.availableFormingCrates || 0) > 0);
  const totalPendingQcCrates = pendingQcJobs.reduce((sum, j) => sum + (j.availableFormingCrates || 0), 0);
  const totalActiveQcCrates = activeQcBatches.reduce((sum, item) => sum + (item.batch.issuedQty || 0), 0);
  const totalQcInspectors = Array.from(new Set(activeQcBatches.map((item) => item.batch.worker).filter(Boolean)));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5 flex-wrap gap-2">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Main Menu</span>
        </button>
        <div className="flex items-center gap-2">
          {onNavigateAnalytics && (
            <button
              onClick={onNavigateAnalytics}
              className="flex items-center gap-1.5 bg-gradient-to-r from-violet-700 to-indigo-800 hover:from-violet-800 hover:to-indigo-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-violet-200" />
              <span>Machine & Operator Audit (8-day/5-day report) ➔</span>
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
            <h3 className="text-base font-bold text-[#1a365d] uppercase tracking-wide m-0">
              Executive Control Center
            </h3>
          </div>
        </div>
      </div>

      {/* Quick Floor KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <Scroll className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">Total Paper Slit</span>
            <div className="text-xl font-extrabold text-blue-950">{totalSlitPaperKg.toLocaleString()} KG</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
            <SearchCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wide">QC Crates Pipeline</span>
            <div className="text-xl font-extrabold text-purple-950">
              {(totalActiveQcCrates + totalPendingQcCrates).toLocaleString()} Crates
            </div>
            <div className="text-[10px] text-purple-700 font-semibold">
              {totalActiveQcCrates} In Inspection • {totalPendingQcCrates} Pending QC
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Packed Output</span>
            <div className="text-xl font-extrabold text-emerald-950">{totalPackedBoxes.toLocaleString()} Boxes</div>
          </div>
        </div>

        <div 
          onClick={() => {
            if (onNavigateToTraceability) {
              onNavigateToTraceability('Scrap');
            } else if (onNavigateAnalytics) {
              onNavigateAnalytics();
            }
          }}
          className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 p-4 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:border-rose-400 hover:shadow-md transition group"
          title="Click to trace all scrap events by Batch, Machine, and Operator"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center group-hover:scale-105 transition">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">Available Scrap</span>
                <span className="text-[10px] text-rose-600 font-extrabold bg-rose-100 px-1.5 py-0.2 rounded border border-rose-200 group-hover:bg-rose-600 group-hover:text-white transition">
                  🔍 Trace
                </span>
              </div>
              <div className="text-xl font-extrabold text-rose-950">{availableScrap} KG</div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-rose-600 font-semibold block group-hover:underline">View Traceability ➔</span>
            <span className="text-[9px] text-rose-400">Slit Trim • Punch • QC Rejects</span>
          </div>
        </div>
      </div>

      {/* ACTIVE PRODUCTION FLOWCHART & PROGRESS TRACK */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs mb-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold uppercase tracking-wide m-0 text-slate-900 flex items-center gap-2">
                <span>Active Production Flowchart & Progress Track</span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">
                  {jobs.length} Active {jobs.length === 1 ? 'Job' : 'Jobs'} in Pipeline
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 m-0">
                Live 6-Station Pipeline Progression: Planning ➔ Slitting ➔ Cutting ➔ Forming ➔ QC ➔ Dispatch
              </p>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-400 font-mono">
            Executive Pipeline Visibility
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50 border border-slate-200 rounded-xl">
            No active production jobs in the pipeline. Please schedule a new job in the Planning Desk.
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.slice(0, 3).map((job) => {
              const slitBatches = job.runningBatches?.filter((b) => b.stage === 'Slitting') || [];
              const cutBatches = job.runningBatches?.filter((b) => b.stage === 'Cutting') || [];
              const formBatches = job.runningBatches?.filter((b) => b.stage === 'Forming') || [];
              const isSlitRunning = slitBatches.some((b) => b.status === 'Running');
              const isCutRunning = cutBatches.some((b) => b.status === 'Running');
              const isFormRunning = formBatches.some((b) => b.status === 'Running');

              const hasSlitOutput = (job.availableRolls || 0) > 0 || cutBatches.length > 0;
              const hasCutOutput = (job.availableCuttingCrates || 0) > 0 || (job.totalCutPieces || 0) > 0 || formBatches.length > 0;
              const hasFormOutput = (job.availableFormingCrates || 0) > 0 || (job.totalFormedPieces || 0) > 0;
              const hasQcOutput = (job.availableQcCrates || 0) > 0 || (job.totalQcPieces || 0) > 0;

              // Dispatch calculations
              const dispatchReadyPj = packJobs?.filter(pj => pj.kitType === job.product && (pj.packedBoxes || 0) > (pj.dispatchedBoxes || 0)) || [];
              const totalDispatched = packJobs?.filter(pj => pj.kitType === job.product).reduce((sum, pj) => sum + (pj.dispatchedBoxes || 0), 0) || 0;
              const isDispatchActive = dispatchReadyPj.length > 0;
              const isDispatchDone = totalDispatched > 0;

              let progressPct = 10;
              if (hasSlitOutput) progressPct = 30;
              if (isCutRunning) progressPct = 45;
              if (hasCutOutput) progressPct = 60;
              if (isFormRunning) progressPct = 75;
              if (hasFormOutput) progressPct = 85;
              if (hasQcOutput) progressPct = 95;
              if (isDispatchDone) progressPct = 100;

              const stages = [
                {
                  name: 'Planning',
                  hindi: 'Planning',
                  icon: <FileText className="w-3.5 h-3.5" />,
                  isActive: false,
                  isDone: true,
                  qtyText: `Plan ID: ${job.planId || 'PPC-OK'}`,
                  worker: 'PPC Desk'
                },
                {
                  name: 'Slitting',
                  hindi: 'Slitting',
                  icon: <Scroll className="w-3.5 h-3.5" />,
                  isActive: isSlitRunning,
                  isDone: hasSlitOutput,
                  qtyText: `${job.availableRolls || 0} Rolls Ready`,
                  worker: slitBatches.find((b) => b.status === 'Running')?.worker
                },
                {
                  name: 'Cutting',
                  hindi: 'Cutting',
                  icon: <Scissors className="w-3.5 h-3.5" />,
                  isActive: isCutRunning,
                  isDone: hasCutOutput,
                  qtyText: `${job.availableCuttingCrates || 0} Crates`,
                  worker: cutBatches.find((b) => b.status === 'Running')?.worker
                },
                {
                  name: 'Forming',
                  hindi: 'Forming',
                  icon: <Cog className="w-3.5 h-3.5" />,
                  isActive: isFormRunning,
                  isDone: hasFormOutput,
                  qtyText: `${job.availableFormingCrates || 0} Crates`,
                  worker: formBatches.find((b) => b.status === 'Running')?.worker
                },
                {
                  name: 'Quality QC',
                  hindi: 'Quality Check',
                  icon: <SearchCheck className="w-3.5 h-3.5" />,
                  isActive: (job.availableFormingCrates || 0) > 0,
                  isDone: hasQcOutput,
                  qtyText: `${job.availableQcCrates || 0} OK Crates`,
                  worker: undefined
                },
                {
                  name: 'Dispatch',
                  hindi: 'Dispatch',
                  icon: <Truck className="w-3.5 h-3.5" />,
                  isActive: isDispatchActive,
                  isDone: isDispatchDone,
                  qtyText: `${totalDispatched} Boxes Sent`,
                  worker: undefined
                }
              ];

              return (
                <div
                  key={job.id}
                  className="bg-white border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 transition"
                >
                  {/* Job Header info & Progress Bar */}
                  <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-slate-800 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded text-xs">
                        {job.id}
                      </span>
                      <span className="font-extrabold text-sm text-slate-950">{job.product}</span>
                      <span className="text-xs text-slate-600 font-medium">
                        ({job.paperBrand || 'ITC'} • {job.gsm || (job.plannedGsms && job.plannedGsms.join(', ')) || job.targetGsm || 'N/A'})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-bold">
                        Pipeline Progress:
                      </span>
                      <div className="w-28 sm:w-36 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-black text-emerald-600 w-9 text-right">
                        {progressPct}%
                      </span>
                    </div>
                  </div>

                  {/* Flowchart 6-Node Stepper */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {stages.map((stg, sIdx) => {
                      let bgClass = 'bg-white border-slate-200 text-slate-500 hover:border-slate-300';
                      let textClass = 'text-slate-500';
                      let qtyClass = 'text-slate-400';
                      let opClass = 'text-slate-500';
                      let statusBadge = (
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">Pending</span>
                      );

                      if (stg.isActive) {
                        bgClass = 'bg-emerald-50/50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs';
                        textClass = 'text-emerald-800';
                        qtyClass = 'text-emerald-700';
                        opClass = 'text-emerald-800';
                        statusBadge = (
                          <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded animate-pulse">
                            ⚡ ACTIVE
                          </span>
                        );
                      } else if (stg.isDone) {
                        bgClass = 'bg-slate-100/70 border-slate-300 text-slate-700 hover:bg-slate-100';
                        textClass = 'text-slate-800';
                        qtyClass = 'text-slate-600';
                        opClass = 'text-slate-600';
                        statusBadge = (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> DONE
                          </span>
                        );
                      }

                      return (
                        <div
                          key={stg.name}
                          className={`p-2.5 rounded-xl border text-left flex flex-col justify-between group relative ${bgClass}`}
                        >
                          <div className="flex items-center justify-between mb-1 w-full">
                            <div className={`flex items-center gap-1 font-bold text-xs ${textClass}`}>
                              {stg.icon}
                              <span>{stg.name}</span>
                            </div>
                            {statusBadge}
                          </div>

                          <div className={`text-[10px] font-medium truncate ${qtyClass}`}>
                            {stg.qtyText}
                          </div>

                          {stg.worker && (
                            <div className={`text-[9px] font-mono mt-1 font-semibold truncate ${opClass}`}>
                              Op: {stg.worker}
                            </div>
                          )}

                          {sIdx < stages.length - 1 && (
                            <span className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-slate-400 text-xs font-bold">
                              ➔
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Floor Maintenance & Breakdown Tracking Banner */}
      <div className="mb-6">
        <LiveMaintenanceTracker
          state={state}
          onOpenAttendModal={onOpenAttendModal || ((m) => onOpenStationModal(m))}
        />
      </div>

      {/* ======================================================== */}
      {/* LIVE QC DISPATCH & INSPECTOR DETAILS (REAL-TIME PIPELINE) */}
      {/* ======================================================== */}
      <div className="mb-6 p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-600 text-white rounded-lg">
              <SearchCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-purple-950 uppercase tracking-wide m-0">
                Live QC Dispatch & Inspector Pipeline (Real-Time QC Dispatch & Inspector Pipeline)
              </h4>
              <p className="text-[11px] text-purple-700 m-0">
                Crates dispatched from Forming, Assigned Inspector & Stage Status
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold bg-purple-200/80 text-purple-900 px-2.5 py-1 rounded-full border border-purple-300">
              Active Inspectors: {totalQcInspectors.length > 0 ? totalQcInspectors.join(', ') : 'None Active'}
            </span>
            <span className="text-[11px] font-extrabold bg-indigo-100 text-indigo-900 px-2.5 py-1 rounded-full border border-indigo-200">
              Allocated Crates: {totalActiveQcCrates}
            </span>
          </div>
        </div>

        {/* List of active QC batches & pending dispatches */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Active Inspections */}
          {activeQcBatches.map(({ job: j, batch: b }) => (
            <div
              key={b.batchId}
              onClick={() => onOpenStationModal('QC-Desk')}
              className="bg-white border-2 border-emerald-400 rounded-xl p-3 shadow-xs hover:shadow-md transition cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-indigo-900">{j.id}</span>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  ● In Inspection
                </span>
              </div>
              <div className="font-bold text-xs text-slate-800">{j.product}</div>
              <div className="text-xs pt-1 border-t border-slate-100 space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-semibold">Assigned Inspector:</span>
                  <span className="font-black text-purple-950">👨‍🔬 {b.worker || 'Inspector'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-semibold">QC Crates Count:</span>
                  <span className="font-extrabold text-blue-900">{b.issuedQty || 0} Crates</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-semibold">Stage Status:</span>
                  <span className="font-extrabold text-emerald-700">In Inspection (Desk Active)</span>
                </div>
              </div>
            </div>
          ))}

          {/* Pending Dispatches */}
          {pendingQcJobs.map((j) => (
            <div
              key={j.id}
              onClick={() => onOpenStationModal('QC-Desk')}
              className="bg-white border-2 border-amber-300 rounded-xl p-3 shadow-xs hover:shadow-md transition cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-indigo-900">{j.id}</span>
                <span className="text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  Pending QC
                </span>
              </div>
              <div className="font-bold text-xs text-slate-800">{j.product}</div>
              <div className="text-xs pt-1 border-t border-slate-100 space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-semibold">Assigned Inspector:</span>
                  <span className="font-bold text-amber-800">Awaiting Assignment</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-semibold">QC Crates Count:</span>
                  <span className="font-extrabold text-amber-900">{j.availableFormingCrates || 0} Crates Queued</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-semibold">Stage Status:</span>
                  <span className="font-extrabold text-amber-700">Pending QC (Dispatched from Forming)</span>
                </div>
              </div>
            </div>
          ))}

          {activeQcBatches.length === 0 && pendingQcJobs.length === 0 && (
            <div className="col-span-full py-3 text-center text-xs text-slate-500 italic bg-white/60 rounded-xl border border-purple-100">
              QC Pipeline is clear. No crates currently pending or in inspection.
            </div>
          )}
        </div>
      </div>

      {/* Live Floor Workstation Grid */}
      <div>
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 mb-3">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Live Workstations Status (Click Card for Station History & Breakdown Resolution)</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {ALL_MACHINES_LIST.map((m) => {
            let isRunning = false;
            let isHeld = false;
            let activeBatches: Array<{ job: string; op: string; reason?: string }> = [];

            if (m.startsWith('Packing-') || m.startsWith('Manual-')) {
              packJobs.forEach((pj) => {
                if (pj.machine === m && (pj.status === 'Running' || pj.status === 'Held')) {
                  if (pj.status === 'Running') isRunning = true;
                  if (pj.status === 'Held') isHeld = true;
                  activeBatches.push({
                    job: `${pj.id} (${pj.customer})`,
                    op: pj.worker || 'Packing Team',
                    reason: pj.holdReason
                  });
                }
              });
            } else {
              jobs.forEach((j) => {
                if (j.runningBatches) {
                  j.runningBatches.forEach((b) => {
                    if (b.machine === m && (b.status === 'Running' || b.status === 'Held')) {
                      if (b.status === 'Running') isRunning = true;
                      if (b.status === 'Held') isHeld = true;
                      activeBatches.push({
                        job: `${j.id} (${j.product})`,
                        op: b.worker || 'Operator',
                        reason: b.holdReason
                      });
                    }
                  });
                }
              });
            }

            // Cross reference active maintenance incident
            const activeInc = maintenanceIncidents.find(
              (inc) => inc.machine === m && (inc.status === 'OPEN' || inc.status === 'IN_PROGRESS')
            );
            const isUnderRepair = activeInc?.status === 'IN_PROGRESS';
            const isOpenDown = activeInc?.status === 'OPEN';

            const getElapsedMins = (iso?: string) => {
              if (!iso) return 1;
              try {
                return Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
              } catch {
                return 1;
              }
            };

            const repairMins = getElapsedMins(activeInc?.repairStartTime || activeInc?.attendingStartedAt);
            const downMins = getElapsedMins(activeInc?.breakdownStartTime);

            const borderStatus = isUnderRepair
              ? 'border-t-4 border-amber-500 bg-amber-50/40'
              : isOpenDown || isHeld
              ? 'border-t-4 border-red-500 bg-red-50/40'
              : isRunning
              ? 'border-t-4 border-blue-600 bg-blue-50/40'
              : 'border-t-4 border-slate-300 bg-white';

            return (
              <div
                key={m}
                onClick={() => onOpenStationModal(m)}
                className={`border border-slate-200 rounded-xl p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5 ${borderStatus}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-slate-800 uppercase">{m}</span>
                  {isUnderRepair ? (
                    <span className="flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full animate-pulse">
                      <Wrench className="w-2.5 h-2.5" /> REPAIRING
                    </span>
                  ) : isOpenDown || isHeld ? (
                    <span className="flex items-center gap-1 text-[10px] font-extrabold text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full animate-pulse">
                      <Pause className="w-2.5 h-2.5 fill-red-700" /> DOWN ({downMins}m)
                    </span>
                  ) : isRunning ? (
                    <span className="flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      <Play className="w-2.5 h-2.5 fill-blue-700" /> RUNNING
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      <Circle className="w-2 h-2" /> IDLE
                    </span>
                  )}
                </div>

                {/* Maintenance Technician Attendance Badge */}
                {isUnderRepair && (
                  <div className="mb-2 p-2 bg-amber-100/80 border border-amber-300 rounded-lg text-xs">
                    <div className="text-[10px] font-bold text-amber-800 uppercase">Working Technician:</div>
                    <div className="font-black text-amber-950 flex items-center justify-between">
                      <span>👨‍🔧 {activeInc?.technicianName || 'Technician'}</span>
                      <span className="font-mono text-[11px]">⏱️ {repairMins}m</span>
                    </div>
                    {onOpenAttendModal && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAttendModal(m, activeInc?.id);
                        }}
                        className="mt-1.5 w-full py-1 text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer transition text-center shadow-2xs"
                      >
                        ✅ Mark Ready
                      </button>
                    )}
                  </div>
                )}

                {isOpenDown && !isUnderRepair && (
                  <div className="mb-2 p-2 bg-red-100/80 border border-red-300 rounded-lg text-xs">
                    <div className="text-[10px] font-bold text-red-800 uppercase">Breakdown (Waiting):</div>
                    <div className="font-bold text-red-950 truncate">{activeInc?.reason || 'Machine Stopped'}</div>
                    {onOpenAttendModal && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAttendModal(m, activeInc?.id);
                        }}
                        className="mt-1.5 w-full py-1 text-[10px] font-extrabold bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded cursor-pointer transition text-center shadow-2xs"
                      >
                        👨‍🔧 I am Attending (Start Repair)
                      </button>
                    )}
                  </div>
                )}

                {m === 'QC-Desk' ? (
                  <div className="space-y-1.5 text-xs">
                    {activeBatches.length > 0 ? (
                      activeBatches.map((b, idx) => (
                        <div key={idx} className="bg-purple-50/80 p-2 rounded-lg border border-purple-200">
                          <div className="font-mono font-bold text-indigo-900 truncate">{b.job}</div>
                          <div className="text-[11px] text-purple-950 font-bold mt-0.5 flex items-center justify-between">
                            <span>Assigned Inspector:</span>
                            <span className="text-purple-700">👨‍🔬 {b.op}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-semibold flex items-center justify-between">
                            <span>Stage Status:</span>
                            <span className="font-extrabold text-emerald-700">In Inspection</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
                        {totalPendingQcCrates > 0 ? (
                          <div className="space-y-1">
                            <div className="font-extrabold text-amber-800 flex items-center gap-1">
                              <span>⏳ Stage Status:</span>
                              <span className="bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">Pending QC</span>
                            </div>
                            <div className="font-bold text-slate-700">
                              QC Crates Count: <span className="text-indigo-900 font-extrabold">{totalPendingQcCrates} Crates Queued</span>
                            </div>
                            <div className="text-[10px] text-slate-500">Inspector: Awaiting assignment on Desk</div>
                          </div>
                        ) : (
                          <div className="italic text-slate-400 py-1">
                            QC Desk Ready • No pending crates
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : activeBatches.length > 0 ? (
                  <div className="space-y-1 text-xs">
                    {activeBatches.map((b: any, idx) => (
                      <div key={idx} className="bg-white/80 p-2 rounded-lg border border-slate-200">
                        <div className="font-bold text-slate-900 truncate">{b.job}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Op: <b>{b.op}</b></div>
                        {b.helpers && b.helpers.length > 0 && (
                          <div className="text-[10px] text-slate-400 mt-0.5 italic">
                            + {b.helpers.length} Helpers ({b.helpers.join(', ')})
                          </div>
                        )}
                        {b.reason && !activeInc && (
                          <div className="text-[10px] text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded mt-1 font-semibold">
                            ⚠️ {b.reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : !isUnderRepair && !isOpenDown ? (
                  <div className="text-[11px] text-slate-400 italic py-2">
                    Station ready for next work assignment
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
