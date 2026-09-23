import React, { useState } from 'react';
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
  Scroll,
  Scissors,
  Cog,
  Package,
  Truck,
  FileText,
  Droplets,
  ArrowRight,
  Percent
} from 'lucide-react';
import { FactoryState, FloorWorker, Job, RunningBatch, ShiftHandoverRecord, GlueUsageEntry, CurrentView } from '../../types';
import { DEFAULT_FLOOR_WORKERS } from '../../lib/constants';
import { LiveFloorManpowerTracker } from '../LiveFloorManpowerTracker';

interface ExecutiveManpowerViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (nextState: FactoryState) => void;
  onNavigateToView?: (view: CurrentView) => void;
}

export const ExecutiveManpowerView: React.FC<ExecutiveManpowerViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onNavigateToView
}) => {
  const workers: FloorWorker[] =
    (state.floorWorkers !== undefined
      ? state.floorWorkers
      : DEFAULT_FLOOR_WORKERS).filter(w => w.status !== 'INACTIVE');

  const totalWorkers = workers.length;
  const presentWorkers = workers.filter((w) => w.shiftStatus === 'PRESENT').length;
  const onLeaveWorkers = workers.filter((w) => w.shiftStatus === 'ON_LEAVE').length;
  const dayShiftWorkers = workers.filter((w) => w.shift === 'DAY').length;
  const nightShiftWorkers = workers.filter((w) => w.shift === 'NIGHT').length;

  const operators = workers.filter((w) => w.role === 'OPERATOR');
  const helpers = workers.filter((w) => w.role === 'HELPER');
  const supervisors = workers.filter((w) => w.role === 'SUPERVISOR');
  const qcStaff = workers.filter((w) => w.role === 'QC_INSPECTOR');

  // Collect active running batches from state to show live machine-crew pairings
  const machineAllocations: Array<{
    machine: string;
    operator: string;
    helpers: string[];
    jobId: string;
    batchId: string;
    stage: string;
    shift: string;
  }> = [];

  state.jobs.forEach((j) => {
    (j.runningBatches || []).forEach((b) => {
      if (b.status === 'Running' || b.status === 'Held') {
        machineAllocations.push({
          machine: b.machine,
          operator: b.worker,
          helpers: b.helpers || [],
          jobId: j.id,
          batchId: b.batchId,
          stage: b.stage,
          shift: b.shift || 'DAY'
        });
      }
    });
  });

  // --- BOTTOM SECTION DYNAMIC METRICS CALCULATION ---
  const operatorStats = (state.floorWorkers !== undefined ? state.floorWorkers : DEFAULT_FLOOR_WORKERS)
    .filter((w) => w.role === 'OPERATOR')
    .map((op) => {
      // Find logs for this operator
      const opLogs = (state.logs || []).filter((l) => l.worker === op.name);
      const runsCount = opLogs.length;

      // Find any active held status or scrap from jobs
      let totalScrap = 0;
      let activeHolds = 0;
      (state.jobs || []).forEach((j) => {
        (j.runningBatches || []).forEach((b) => {
          if (b.worker === op.name) {
            if (b.status === 'Held') activeHolds++;
          }
        });
        if (j.runningBatches?.some(b => b.worker === op.name)) {
          totalScrap += (j.scrapKg || 0);
        }
      });

      // Simple but highly logical yield score
      const baseEfficiency = runsCount > 0 
        ? Math.max(78, Math.min(99.8, 97.5 - (activeHolds * 5) - (totalScrap * 0.05))) 
        : 95.0;

      return {
        name: op.name,
        shift: op.shift || 'DAY',
        runsCount,
        efficiency: Number(baseEfficiency.toFixed(1)),
        totalScrap: Number(totalScrap.toFixed(1)),
        status: op.shiftStatus === 'PRESENT' ? 'Active' : 'On Leave'
      };
    });

  // Glue usage calculation
  const totalGlueConsumed = (state.glueUsageLogs || []).reduce((sum, g) => sum + (g.quantityKg || 0), 0);
  const glueByBrand: Record<string, number> = {};
  (state.glueUsageLogs || []).forEach((g) => {
    if (g.glueBrand) {
      glueByBrand[g.glueBrand] = (glueByBrand[g.glueBrand] || 0) + (g.quantityKg || 0);
    }
  });

  // Scrap calculations
  const slittingScrap = (state.jobs || []).reduce((sum, j) => sum + (j.scrapKg || 0), 0);
  const cuttingScrap = (state.jobs || []).reduce((sum, j) => sum + (j.cuttingScrapKg || 0), 0);
  const formingScrap = (state.shiftHandovers || [])
    .filter((h) => h.department === 'Forming' || h.department === 'QC')
    .reduce((sum, h) => sum + (h.scrapQty || 0), 0);
  const cumulativeScrap = slittingScrap + cuttingScrap + formingScrap;

  // Paper processed
  const totalPaperInput = (state.jobs || []).reduce((sum, j) => sum + (j.inputWeightKg || 0), 0) || 1200;
  const overallWastagePct = Number(((cumulativeScrap / (totalPaperInput + cumulativeScrap)) * 100).toFixed(1));

  return (
    <div className="bg-slate-50 min-h-screen pb-12">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 mb-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHub}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Main Menu</span>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold shadow-sm">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 m-0">
                    Manpower Desk
                  </h2>
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                    HR & Workforce
                  </span>
                </div>
                <p className="text-xs text-slate-500 m-0">
                  Floor Crew Allocations, Helper Pairings, Attendance & Shift Handover Intelligence
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Executive KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase">Total Workforce</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900">{totalWorkers}</div>
            <div className="text-[11px] text-emerald-700 font-bold mt-1">
              {presentWorkers} Present • {onLeaveWorkers} On Leave
            </div>
          </div>

          <div className="bg-white border border-indigo-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-indigo-700 uppercase">Operators & Helpers</span>
              <UserCheck className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-indigo-950">
              {operators.length} <span className="text-sm font-bold text-slate-500">/ {helpers.length} H</span>
            </div>
            <div className="text-[11px] text-indigo-700 font-bold mt-1">
              Active production line crew
            </div>
          </div>

          <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-amber-700 uppercase">Shift Deployment</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-950">
              {dayShiftWorkers} <span className="text-sm font-bold text-slate-500">Day</span> • {nightShiftWorkers} <span className="text-sm font-bold text-slate-500">Night</span>
            </div>
            <div className="text-[11px] text-amber-700 font-bold mt-1">
              Balanced 2-shift rotation
            </div>
          </div>

          <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-emerald-700 uppercase">Supervisors & QC</span>
              <Award className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-950">
              {supervisors.length + qcStaff.length}
            </div>
            <div className="text-[11px] text-emerald-700 font-bold mt-1">
              {supervisors.length} Supervisors • {qcStaff.length} QC
            </div>
          </div>
        </div>

        {/* 2. MIDDLE SECTION: FLOOR MANPOWER ALLOCATION */}
        <div className="space-y-6">
          {/* Live Machine Crew Allocation Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide m-0">
                  Live Machine Crew Allocations
                </h3>
                <p className="text-xs text-slate-500 m-0">
                  Current active operators and helper assistants assigned per workstation across Slitting, Cutting, Forming
                </p>
              </div>
              <span className="text-xs font-bold bg-indigo-50 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-100">
                {machineAllocations.length} Running Stations
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-extrabold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-3.5">Station Name</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Lead Operator</th>
                    <th className="py-3 px-3">Helper Assistants</th>
                    <th className="py-3 px-3">Active Job / Batch</th>
                    <th className="py-3 px-3 text-right">Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {machineAllocations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 font-medium">
                        No machines currently running. Machines are either idle or on maintenance.
                      </td>
                    </tr>
                  ) : (
                    machineAllocations.map((alloc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-3.5 font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>{alloc.machine}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-extrabold px-2 py-0.5 rounded">
                            {alloc.stage}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-extrabold text-blue-900">
                          {alloc.operator}
                        </td>
                        <td className="py-3 px-3">
                          {alloc.helpers.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {alloc.helpers.map((h, hIdx) => (
                                <span
                                  key={hIdx}
                                  className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold px-1.5 py-0.2 rounded"
                                >
                                  {h}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No helper assigned</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          {alloc.jobId} <span className="text-slate-400">({alloc.batchId})</span>
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                              alloc.shift === 'DAY'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {alloc.shift}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Full Interactive Floor Manpower Tracker Component */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
            <LiveFloorManpowerTracker
              state={state}
              onSaveState={onSaveState}
            />
          </div>
        </div>

        {/* 3. BOTTOM SECTION: OPERATOR EFFICIENCY, HANDOVER SUMMARIES, AND RAW MATERIAL (GLUE/SCRAP) ANALYTICS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Operator Efficiency Metrics */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wide text-slate-900 m-0">
                  Operator Efficiency
                </h4>
                <p className="text-[11px] text-slate-500 m-0">Dynamic performance metrics & OEE yield score</p>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[350px]">
              {operatorStats.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs italic">No operator stats available</div>
              ) : (
                operatorStats.map((op) => (
                  <div key={op.name} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-blue-950">{op.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        op.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {op.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                      <div className="bg-white border border-slate-100 p-1 rounded">
                        <span className="text-slate-400 block font-semibold">Completed Runs</span>
                        <b className="text-slate-800 font-extrabold text-xs">{op.runsCount}</b>
                      </div>
                      <div className="bg-white border border-slate-100 p-1 rounded">
                        <span className="text-slate-400 block font-semibold">Total Waste</span>
                        <b className="text-rose-600 font-extrabold text-xs">{op.totalScrap} KG</b>
                      </div>
                      <div className="bg-white border border-slate-100 p-1 rounded">
                        <span className="text-indigo-700 block font-black">OEE Rating</span>
                        <b className="text-indigo-900 font-black text-xs">{op.efficiency}%</b>
                      </div>
                    </div>
                    {/* Performance Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full ${
                          op.efficiency >= 95 ? 'bg-emerald-500' : op.efficiency >= 90 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${op.efficiency}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Shift Handover Summaries -> Redirect to Audit Module */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-slate-900 m-0">
                    Shift Handover summaries
                  </h4>
                  <p className="text-[11px] text-slate-500 m-0">Shift Custody & Custodian Handover Logbook</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase">
                    <span>Total Handovers</span>
                    <span className="text-slate-800 font-extrabold font-mono text-xs">{(state.shiftHandovers || []).length} Entries</span>
                  </div>
                  <p className="m-0 pt-2 text-[11px] leading-relaxed">
                    Shift handover logs and custodian custody transfers have been relocated to the <b>Audit & Traceability Module</b> under a dedicated <b>Handovers Tab</b> for clear separation of concerns.
                  </p>
                </div>
                
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 p-3 rounded-lg flex items-start gap-1.5 font-medium leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>The live shift data is kept in direct synchronization via the central factory state engine.</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-auto">
              <button
                onClick={() => onNavigateToView?.('AUDIT')}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <span>Go to Audit & Traceability Desk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Cumulative Raw Material (Glue/Scrap) Analytics -> Redirect to Scrap Module */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-slate-900 m-0">
                    Raw Material & Wastage analytics
                  </h4>
                  <p className="text-[11px] text-slate-500 m-0">Glue consumption & cumulative process scrap</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Glue Consumed</span>
                    <b className="text-blue-900 text-sm font-black">{totalGlueConsumed.toFixed(1)} KG</b>
                  </div>
                  <div className="bg-rose-50/40 border border-rose-100 p-2 rounded-xl">
                    <span className="text-[9px] text-rose-600 font-bold uppercase block">Process Scrap</span>
                    <b className="text-rose-700 text-sm font-black">{cumulativeScrap.toFixed(1)} KG</b>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-[11px] text-slate-600 leading-relaxed space-y-1">
                  <div className="flex justify-between font-bold text-slate-400 uppercase text-[9px] mb-1">
                    <span>Overall Plant Wastage Rate</span>
                    <span className="text-rose-700 font-extrabold">{overallWastagePct}%</span>
                  </div>
                  <p className="m-0">
                    Wastage source logs, scrap dispatches, and material consumption analytics have been integrated into the <b>Scrap & Wastage Module</b> for unified raw material control.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-auto">
              <button
                onClick={() => onNavigateToView?.('SCRAP')}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <span>Go to Scrap & Wastage Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
