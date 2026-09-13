import React, { useState } from 'react';
import { 
  Hammer, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Play, 
  ArrowRight, 
  Check, 
  AlertCircle, 
  User,
  Layers
} from 'lucide-react';
import { ProductionOrder, WorkCenter, BomDefinition } from '../types/mrp';

interface ProductionViewProps {
  productionOrders: ProductionOrder[];
  workCenters: WorkCenter[];
  boms: BomDefinition[];
  onOpenNewOrder: () => void;
  onAdvanceOrderStage: (orderId: string) => void;
}

export const ProductionView: React.FC<ProductionViewProps> = ({
  productionOrders,
  workCenters,
  boms,
  onOpenNewOrder,
  onAdvanceOrderStage,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'planned' | 'completed'>('all');

  const wcMap = new Map<string, WorkCenter>();
  workCenters.forEach((wc) => wcMap.set(wc.id, wc));

  const filteredOrders = productionOrders.filter((ord) => {
    if (statusFilter === 'all') return true;
    return ord.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Hammer className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">
              Shop Floor Execution & Work Orders
            </span>
          </div>
          <h2 className="text-xl font-bold text-neutral-100">
            Master Production Schedule & Station Routing
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Track multi-stage fabrication jobs from initial lumber/billet roughing through anechoic QA and packaging.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenNewOrder}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs tracking-wide shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Launch Batch Run</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-neutral-900/60 p-2 rounded-xl border border-neutral-800">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-neutral-800 text-amber-400 border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          All Jobs ({productionOrders.length})
        </button>
        <button
          onClick={() => setStatusFilter('in_progress')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            statusFilter === 'in_progress'
              ? 'bg-neutral-800 text-amber-400 border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          In Progress ({productionOrders.filter((o) => o.status === 'in_progress').length})
        </button>
        <button
          onClick={() => setStatusFilter('planned')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            statusFilter === 'planned'
              ? 'bg-neutral-800 text-amber-400 border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Planned / Scheduled ({productionOrders.filter((o) => o.status === 'planned').length})
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            statusFilter === 'completed'
              ? 'bg-neutral-800 text-emerald-400 border border-neutral-700'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          Completed ({productionOrders.filter((o) => o.status === 'completed').length})
        </button>
      </div>

      {/* Production Orders Grid */}
      <div className="space-y-4">
        {filteredOrders.map((ord) => {
          const bom = boms.find((b) => b.productSku === ord.productSku);
          const activeStep = ord.routing.find((r) => r.status === 'active');
          const isFinished = ord.status === 'completed';

          return (
            <div
              key={ord.id}
              className={`bg-neutral-900 border rounded-xl p-5 transition-all ${
                isFinished ? 'border-neutral-800/60 opacity-80' : 'border-neutral-800 hover:border-neutral-700'
              }`}
            >
              {/* Order Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {ord.code}
                    </span>
                    <h3 className="text-base font-bold text-neutral-100">
                      {bom?.name.replace('BOM: ', '') || ord.productSku}
                    </h3>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      ord.priority === 'urgent'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : ord.priority === 'high'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                    }`}>
                      {ord.priority}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      isFinished
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : ord.status === 'in_progress'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                    }`}>
                      {ord.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 mt-1 font-mono">
                    Client: <span className="text-neutral-200">{ord.customerName || 'Stock Replenishment'}</span> · Batch Quantity:{' '}
                    <span className="text-amber-400 font-bold">{ord.quantity} units</span> · SKU:{' '}
                    <span className="text-neutral-300">{ord.productSku}</span>
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div>
                    <span className="text-neutral-500">Release: </span>
                    <span className="text-neutral-300">{ord.startDate}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Due Date: </span>
                    <span className="text-amber-300 font-bold">{ord.dueDate}</span>
                  </div>
                  {!isFinished && (
                    <button
                      onClick={() => onAdvanceOrderStage(ord.id)}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Advance Routing Step</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Routing Stepper Flow */}
              <div className="mt-5 pt-4 border-t border-neutral-800/80">
                <div className="flex items-center justify-between text-xs text-neutral-400 mb-2 font-mono">
                  <span>Routing Work Stations:</span>
                  <span className="text-amber-400 font-bold">{ord.progressPercent}% Completed</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  {ord.routing.map((step, idx) => {
                    const wc = wcMap.get(step.workCenterId);
                    const isDone = step.status === 'completed';
                    const isActive = step.status === 'active';

                    return (
                      <div
                        key={step.id}
                        className={`p-3 rounded-lg border text-xs transition-all ${
                          isDone
                            ? 'bg-emerald-950/20 border-emerald-800/50 text-neutral-300'
                            : isActive
                            ? 'bg-amber-950/30 border-amber-500/50 text-neutral-100 shadow-sm shadow-amber-500/10'
                            : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-500'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-[10px] mb-1">
                          <span className="text-neutral-400">Step {idx + 1}</span>
                          {isDone ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Done
                            </span>
                          ) : isActive ? (
                            <span className="text-amber-400 font-bold flex items-center gap-0.5 animate-pulse">
                              Active
                            </span>
                          ) : (
                            <span className="text-neutral-600">Pending</span>
                          )}
                        </div>

                        <div className="font-semibold text-xs line-clamp-1">
                          {step.name}
                        </div>

                        <div className="mt-1.5 text-[10px] font-mono text-neutral-400 flex items-center justify-between">
                          <span>{wc?.code || 'WC-??'}</span>
                          <span>{step.estimatedHours}h est.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
