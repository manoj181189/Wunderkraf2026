import React from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  DollarSign, 
  ArrowRight, 
  Boxes, 
  Hammer, 
  Truck, 
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { 
  InventoryItem, 
  ProductionOrder, 
  PurchaseOrder, 
  MrpRequirement, 
  MrpRunSummary,
  WorkCenter,
  BomDefinition
} from '../types/mrp';

interface DashboardViewProps {
  inventory: InventoryItem[];
  productionOrders: ProductionOrder[];
  purchaseOrders: PurchaseOrder[];
  mrpRequirements: MrpRequirement[];
  mrpSummary: MrpRunSummary;
  workCenters: WorkCenter[];
  boms: BomDefinition[];
  onNavigateTab: (tab: 'mrp' | 'bom' | 'inventory' | 'production' | 'procurement' | 'capacity') => void;
  onRunMrp: () => void;
  onSimulateSurge: () => void;
  onCreatePOsFromMrp: () => void;
  onOpenNewOrder: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  inventory,
  productionOrders,
  purchaseOrders,
  mrpRequirements,
  mrpSummary,
  workCenters,
  boms,
  onNavigateTab,
  onRunMrp,
  onSimulateSurge,
  onCreatePOsFromMrp,
  onOpenNewOrder,
}) => {
  const activeOrders = productionOrders.filter((o) => o.status !== 'completed');
  const criticalDeficits = mrpRequirements.filter((r) => r.netDeficit > 0);
  const urgentOrders = activeOrders.filter((o) => o.priority === 'urgent' || o.priority === 'high');

  // Calculate total inventory value on hand
  const totalStockValue = inventory.reduce((sum, item) => sum + item.onHand * item.unitCost, 0);

  // Calculate total open PO value
  const totalOpenPoValue = purchaseOrders
    .filter((p) => p.status === 'issued' || p.status === 'in_transit')
    .reduce((sum, p) => sum + p.totalAmount, 0);

  // Shop floor total capacity vs booked hours
  const totalCapacityHours = workCenters.reduce((sum, wc) => sum + wc.weeklyCapacityHours, 0);
  
  // Calculate total remaining routing hours from active orders
  const totalBookedHours = activeOrders.reduce((sum, ord) => {
    return sum + ord.routing.reduce((rSum, step) => {
      return step.status !== 'completed' ? rSum + step.estimatedHours : rSum;
    }, 0);
  }, 0);

  const shopLoadPercent = Math.min(100, Math.round((totalBookedHours / (totalCapacityHours || 1)) * 100));

  return (
    <div className="space-y-6">
      {/* Top Banner: Manufacturing Mission & Quick Actions */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-xl p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                Plant 01 · Wünderkraf Manufacturing Unit
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                Cycle: Week 37 / Schedule Active
              </span>
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-neutral-100 tracking-tight">
              Wunderkraf Material & Production Cockpit
            </h1>
            <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
              Live multi-level material planning, real-time BOM netting, and shop floor capacity synchronization for biodegradable paperware cutlery and tableware manufacturing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onSimulateSurge}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer"
              title="Add demand burst to demonstrate automated MRP deficit explosion"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Surge Demand</span>
            </button>
            <button
              onClick={onRunMrp}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs tracking-wide shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 fill-current" />
              <span>Recalculate MRP Engine</span>
            </button>
          </div>
        </div>
      </div>

      {/* Critical Deficit Alert Bar (if shortages exist) */}
      {criticalDeficits.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 lg:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-rose-950/20">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-rose-200 text-sm">
                  {criticalDeficits.length} Material Shortages Detected on Master Schedule
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/30 text-rose-300 border border-rose-500/40 uppercase">
                  Action Required
                </span>
              </div>
              <p className="text-xs text-rose-300/80 mt-1 max-w-2xl leading-relaxed">
                Gross component requirements exceed current stock and scheduled deliveries by{' '}
                <span className="font-semibold text-rose-200 font-mono">
                  ${mrpSummary.totalProcurementCost.toLocaleString()}
                </span>
                . Without prompt purchase orders or sub-assembly work releases, downstream assembly may stall.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onCreatePOsFromMrp}
              className="px-3.5 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
            >
              Auto-Generate Purchase Orders
            </button>
            <button
              onClick={() => onNavigateTab('mrp')}
              className="px-3 py-2 bg-neutral-900/80 hover:bg-neutral-800 text-rose-200 border border-rose-800/60 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Inspect Netting
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Production Orders */}
        <div 
          onClick={() => onNavigateTab('production')}
          className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active Batch Orders</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Hammer className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-neutral-100 font-mono">
              {activeOrders.length}
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              ({mrpSummary.totalFinishedGoodsDemand} units total)
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-neutral-500 border-t border-neutral-800/80 pt-2.5">
            <span>{urgentOrders.length} high priority</span>
            <span className="text-sky-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              View jobs <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* MRP Deficit State */}
        <div 
          onClick={() => onNavigateTab('mrp')}
          className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">MRP Net Deficits</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
              criticalDeficits.length > 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-neutral-100 font-mono">
              {criticalDeficits.length}
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              of {mrpSummary.totalComponentsEvaluated} parts
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-neutral-500 border-t border-neutral-800/80 pt-2.5">
            <span className="font-mono text-neutral-400">
              Est. buy: ₹{mrpSummary.totalProcurementCost.toLocaleString()}
            </span>
            <span className="text-amber-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Review <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Warehouse Physical Value */}
        <div 
          onClick={() => onNavigateTab('inventory')}
          className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Physical Stock Value</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-neutral-100 font-mono">
              ₹{Math.round(totalStockValue).toLocaleString()}
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              {inventory.length} SKUs
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-neutral-500 border-t border-neutral-800/80 pt-2.5">
            <span>Raw + Sub-Assy + FG</span>
            <span className="text-emerald-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Inventory <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Shop Floor Capacity Load */}
        <div 
          onClick={() => onNavigateTab('capacity')}
          className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Shop Floor Utilization</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-neutral-100 font-mono">
              {shopLoadPercent}%
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              {totalBookedHours}h / {totalCapacityHours}h
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-neutral-500 border-t border-neutral-800/80 pt-2.5">
            <span>5 Work Centers</span>
            <span className="text-amber-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Stations <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Main Split: Active Production Orders & Critical Shortages Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Master Production Orders in Flight */}
        <div className="lg:col-span-2 bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hammer className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wide">
                Master Production Schedule (Active Jobs)
              </h2>
            </div>
            <button
              onClick={onOpenNewOrder}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              + Add Production Run
            </button>
          </div>

          <div className="space-y-3">
            {activeOrders.map((ord) => {
              const bom = boms.find((b) => b.productSku === ord.productSku);
              const activeStep = ord.routing.find((r) => r.status === 'active') || ord.routing.find((r) => r.status === 'pending');
              const completedStepsCount = ord.routing.filter((r) => r.status === 'completed').length;

              return (
                <div
                  key={ord.id}
                  className="bg-neutral-950/70 border border-neutral-800/90 rounded-lg p-4 hover:border-neutral-700 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {ord.code}
                        </span>
                        <h4 className="text-sm font-bold text-neutral-200">
                          {bom?.name.replace('BOM: ', '') || ord.productSku}
                        </h4>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                          ord.priority === 'urgent'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : ord.priority === 'high'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                        }`}>
                          {ord.priority}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1 font-mono">
                        Client: <span className="text-neutral-300">{ord.customerName || 'Stock Build'}</span> · Batch Size:{' '}
                        <span className="text-neutral-200 font-bold">{ord.quantity} units</span>
                      </p>
                    </div>

                    <div className="text-right font-mono text-xs">
                      <div className="text-neutral-400">Target Due Date:</div>
                      <div className="text-amber-300 font-bold">{ord.dueDate}</div>
                    </div>
                  </div>

                  {/* Progress & Routing Tracker */}
                  <div className="mt-3 pt-3 border-t border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-neutral-400 mb-1">
                        <span>
                          Current Stage:{' '}
                          <span className="text-neutral-200 font-medium">
                            {activeStep?.name || 'All stages finished'}
                          </span>
                        </span>
                        <span className="font-mono font-bold text-neutral-300">{ord.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full transition-all"
                          style={{ width: `${ord.progressPercent}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 font-mono text-[11px] text-neutral-400">
                      <span>Routing:</span>
                      <span className="text-emerald-400 font-bold">{completedStepsCount}</span>
                      <span>/</span>
                      <span>{ord.routing.length} steps</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Urgent Shortages & Open Inbound Shipments */}
        <div className="space-y-6">
          {/* Top Shortage List */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wide">
                  High-Deficit Materials
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('mrp')}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium"
              >
                All Deficits →
              </button>
            </div>

            {criticalDeficits.length === 0 ? (
              <div className="text-center py-6 text-neutral-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-neutral-200">No Net Deficits Found</p>
                <p className="text-neutral-500 mt-0.5">All active production BOM requirements are covered by stock or open POs.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {criticalDeficits.slice(0, 4).map((def) => (
                  <div
                    key={def.itemSku}
                    className="p-3 bg-neutral-950/70 border border-neutral-800/90 rounded-lg text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono font-bold text-rose-400 text-[11px]">
                          {def.itemSku}
                        </span>
                        <div className="text-neutral-200 font-medium line-clamp-1">
                          {def.itemName}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 shrink-0">
                        -{def.netDeficit} {def.unit}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500 pt-1.5 border-t border-neutral-800/60 font-mono">
                      <span>Order by: <span className="text-amber-300">{def.orderReleaseDate}</span></span>
                      <span>Lead: {def.leadTimeDays}d</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Incoming PO Shipments */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wide">
                  Inbound Vendor Deliveries
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('procurement')}
                className="text-xs text-sky-400 hover:text-sky-300 font-medium"
              >
                Manage POs →
              </button>
            </div>

            <div className="space-y-2.5">
              {purchaseOrders
                .filter((p) => p.status === 'issued' || p.status === 'in_transit')
                .slice(0, 3)
                .map((po) => (
                  <div
                    key={po.id}
                    className="p-3 bg-neutral-950/70 border border-neutral-800/90 rounded-lg text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-400">
                        {po.poNumber}
                      </span>
                      <span className="font-mono text-neutral-300 font-semibold">
                        ₹{po.totalAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-neutral-300 mt-1 font-medium line-clamp-1">
                      {po.supplierName}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500 font-mono pt-1.5 border-t border-neutral-800/60">
                      <span>ETA: <span className="text-sky-300">{po.expectedDeliveryDate}</span></span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/20 uppercase">
                        {po.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
