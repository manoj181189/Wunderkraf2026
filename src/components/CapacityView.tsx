import React from 'react';
import { 
  Gauge, 
  Clock, 
  Users, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Flame,
  Layers
} from 'lucide-react';
import { WorkCenter, ProductionOrder } from '../types/mrp';

interface CapacityViewProps {
  workCenters: WorkCenter[];
  productionOrders: ProductionOrder[];
}

export const CapacityView: React.FC<CapacityViewProps> = ({
  workCenters,
  productionOrders,
}) => {
  const activeOrders = productionOrders.filter((o) => o.status !== 'completed');

  // Calculate booked hours per work center
  const bookedHoursMap = new Map<string, number>();
  const activeStepsMap = new Map<string, { orderCode: string; stepName: string; hours: number }[]>();

  workCenters.forEach((wc) => {
    bookedHoursMap.set(wc.id, 0);
    activeStepsMap.set(wc.id, []);
  });

  activeOrders.forEach((ord) => {
    ord.routing.forEach((step) => {
      if (step.status !== 'completed') {
        const current = bookedHoursMap.get(step.workCenterId) || 0;
        bookedHoursMap.set(step.workCenterId, current + step.estimatedHours);

        const list = activeStepsMap.get(step.workCenterId) || [];
        list.push({
          orderCode: ord.code,
          stepName: step.name,
          hours: step.estimatedHours,
        });
        activeStepsMap.set(step.workCenterId, list);
      }
    });
  });

  const totalCap = workCenters.reduce((sum, w) => sum + w.weeklyCapacityHours, 0);
  const totalBooked = Array.from(bookedHoursMap.values()).reduce((sum, h) => sum + h, 0);
  const overallLoad = Math.round((totalBooked / (totalCap || 1)) * 100);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Gauge className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">
              Shop Floor Work Center Loading & Bottlenecks
            </span>
          </div>
          <h2 className="text-xl font-bold text-neutral-100">
            Manufacturing Capacity & Labor Hours
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time shop loading against finite weekly machine and bench labor constraints.
          </p>
        </div>

        <div className="bg-neutral-950 px-4 py-2.5 rounded-lg border border-neutral-800 text-right font-mono text-xs">
          <div className="text-neutral-500">Aggregate Plant Utilization:</div>
          <div className="text-xl font-bold text-amber-400">
            {overallLoad}% <span className="text-xs text-neutral-400 font-normal">({totalBooked}h / {totalCap}h)</span>
          </div>
        </div>
      </div>

      {/* Work Centers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {workCenters.map((wc) => {
          const booked = bookedHoursMap.get(wc.id) || 0;
          const loadPercent = Math.min(150, Math.round((booked / wc.weeklyCapacityHours) * 100));
          const isOverloaded = loadPercent > 100;
          const isNearCap = loadPercent >= 85 && !isOverloaded;
          const queuedSteps = activeStepsMap.get(wc.id) || [];

          return (
            <div
              key={wc.id}
              className={`bg-neutral-900 border rounded-xl p-5 space-y-4 transition-all ${
                isOverloaded
                  ? 'border-rose-800/80 shadow-lg shadow-rose-950/20'
                  : 'border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {wc.code}
                    </span>
                    <span className="text-[10px] uppercase font-mono text-neutral-400">
                      {wc.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-neutral-100 mt-1.5">
                    {wc.name}
                  </h3>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  isOverloaded
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : isNearCap
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {isOverloaded ? 'Overloaded' : isNearCap ? 'High Load' : 'Optimal'}
                </span>
              </div>

              {/* Progress Bar & Load Stats */}
              <div>
                <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                  <span className="text-neutral-400">Booked / Weekly Capacity:</span>
                  <span className="font-bold text-neutral-200">
                    {booked}h / {wc.weeklyCapacityHours}h ({loadPercent}%)
                  </span>
                </div>
                <div className="w-full bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOverloaded
                        ? 'bg-rose-500'
                        : isNearCap
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, loadPercent)}%` }}
                  ></div>
                </div>
              </div>

              {/* Work Center Metadata */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-neutral-800/80">
                <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                  <div className="text-neutral-500 text-[10px]">Bench Techs</div>
                  <div className="text-neutral-200 font-bold mt-0.5 flex items-center gap-1">
                    <Users className="w-3 h-3 text-neutral-400" />
                    {wc.assignedTechnicians} artisans
                  </div>
                </div>
                <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                  <div className="text-neutral-500 text-[10px]">Machine Cost</div>
                  <div className="text-amber-400 font-bold mt-0.5">
                    ${wc.hourlyMachineRate}/hr
                  </div>
                </div>
              </div>

              {/* Queued Work Order Steps */}
              <div className="pt-2 border-t border-neutral-800/80">
                <div className="text-[11px] font-mono text-neutral-400 mb-1.5 flex items-center justify-between">
                  <span>Queued Operations:</span>
                  <span className="text-neutral-300 font-bold">{queuedSteps.length} steps</span>
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {queuedSteps.length === 0 ? (
                    <div className="text-[11px] text-neutral-500 py-1 italic">
                      No active operations queued
                    </div>
                  ) : (
                    queuedSteps.map((step, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-center justify-between bg-neutral-950/70 p-1.5 rounded text-[11px] font-mono text-neutral-300 border border-neutral-800/60"
                      >
                        <span className="text-amber-400 font-bold">{step.orderCode}</span>
                        <span className="truncate max-w-[130px] text-neutral-400">{step.stepName}</span>
                        <span className="text-neutral-300">{step.hours}h</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
