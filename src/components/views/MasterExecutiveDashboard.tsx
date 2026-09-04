import React from 'react';
import { ArrowLeft, Activity, Layers, Package, Trash2, Scroll, Play, Pause, Circle } from 'lucide-react';
import { FactoryState } from '../../types';
import { calculateAvailableScrapKg } from '../../lib/utils';
import { ALL_MACHINES_LIST } from '../../lib/constants';

interface MasterExecutiveDashboardProps {
  state: FactoryState;
  onBackToHub: () => void;
  onOpenStationModal: (machineName: string) => void;
}

export const MasterExecutiveDashboard: React.FC<MasterExecutiveDashboardProps> = ({
  state,
  onBackToHub,
  onOpenStationModal
}) => {
  const { jobs, packJobs, logs, scrapSales } = state;

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
          <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
          <h3 className="text-base font-bold text-[#1a365d] uppercase tracking-wide m-0">
            Executive Control Center (Live Factory Pulse)
          </h3>
        </div>
      </div>

      {/* Quick Floor KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <Scroll className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">Total Paper Slit</span>
            <div className="text-xl font-extrabold text-blue-950">{totalSlitPaperKg.toLocaleString()} KG</div>
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

        <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">Available Scrap</span>
            <div className="text-xl font-extrabold text-rose-950">{availableScrap} KG</div>
          </div>
        </div>
      </div>

      {/* Live Floor Workstation Grid */}
      <div>
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 mb-3">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Live Workstations Status (Click Card for Run Analytics)</span>
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

            const borderStatus = isHeld
              ? 'border-t-4 border-orange-500 bg-orange-50/40'
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
                  {isHeld ? (
                    <span className="flex items-center gap-1 text-[10px] font-extrabold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                      <Pause className="w-2.5 h-2.5 fill-orange-700" /> HELD
                    </span>
                  ) : isRunning ? (
                    <span className="flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full animate-pulse">
                      <Play className="w-2.5 h-2.5 fill-blue-700" /> RUNNING
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      <Circle className="w-2 h-2" /> IDLE
                    </span>
                  )}
                </div>

                {activeBatches.length > 0 ? (
                  <div className="space-y-1 text-xs">
                    {activeBatches.map((b, idx) => (
                      <div key={idx} className="bg-white/80 p-2 rounded-lg border border-slate-200">
                        <div className="font-bold text-slate-900 truncate">{b.job}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Op: <b>{b.op}</b></div>
                        {b.reason && (
                          <div className="text-[10px] text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded mt-1 font-semibold">
                            ⚠️ {b.reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic py-2">
                    Station ready for next work assignment
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
