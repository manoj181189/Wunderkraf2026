import React, { useState } from 'react';
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  Download, 
  Filter, 
  Play, 
  Search, 
  ShoppingCart, 
  ArrowUpDown,
  Building,
  Check,
  Calendar
} from 'lucide-react';
import { MrpRequirement, MrpRunSummary, ItemCategory } from '../types/mrp';

interface MrpRunViewProps {
  requirements: MrpRequirement[];
  summary: MrpRunSummary;
  onRunMrp: () => void;
  onCreateAllPOs: () => void;
  onCreateSinglePO: (requirement: MrpRequirement) => void;
}

export const MrpRunView: React.FC<MrpRunViewProps> = ({
  requirements,
  summary,
  onRunMrp,
  onCreateAllPOs,
  onCreateSinglePO,
}) => {
  const [filterAction, setFilterAction] = useState<'all' | 'shortage' | 'buy' | 'build' | 'ok'>('shortage');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter logic
  const filteredRequirements = requirements.filter((item) => {
    // Action filter
    if (filterAction === 'shortage' && item.netDeficit <= 0) return false;
    if (filterAction === 'buy' && item.recommendedAction !== 'BUY') return false;
    if (filterAction === 'build' && item.recommendedAction !== 'BUILD') return false;
    if (filterAction === 'ok' && item.netDeficit > 0) return false;

    // Category filter
    if (filterCategory !== 'all' && item.category !== filterCategory) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.itemSku.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        item.supplier.toLowerCase().includes(q)
      );
    }

    return true;
  });

  const totalDeficitCost = requirements
    .filter((r) => r.netDeficit > 0)
    .reduce((sum, r) => sum + r.estimatedCost, 0);

  const buyShortages = requirements.filter((r) => r.recommendedAction === 'BUY' && r.netDeficit > 0);

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'SKU',
      'Name',
      'Category',
      'Gross Demand',
      'On Hand',
      'Allocated',
      'Available',
      'On Order',
      'Safety Stock',
      'Net Deficit',
      'Unit',
      'Action',
      'Release Date',
      'Need By Date',
      'Supplier',
      'Est Cost',
    ];
    const rows = filteredRequirements.map((r) => [
      r.itemSku,
      `"${r.itemName}"`,
      r.category,
      r.grossRequirement,
      r.currentOnHand,
      r.allocated,
      r.availableStock,
      r.onOrder,
      r.safetyStock,
      r.netDeficit,
      r.unit,
      r.recommendedAction,
      r.orderReleaseDate,
      r.needByDate,
      `"${r.supplier}"`,
      r.estimatedCost,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wunderkraf_mrp_netting_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Engine Status & Execution Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Run ID: {summary.runId}
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                Calculated at {summary.timestamp}
              </span>
            </div>
            <h2 className="text-xl font-bold text-neutral-100 tracking-tight">
              MRP Net Requirements & Exploded Demand Schedule
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-3xl">
              Mathematical netting formula: <code className="text-amber-300 font-mono text-[11px] bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">Net Deficit = Gross Demand - (On Hand - Allocated) - Inbound POs + Safety Stock</code>. Backward-scheduled by vendor and shop lead times.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            {buyShortages.length > 0 && (
              <button
                onClick={onCreateAllPOs}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg text-xs shadow-md shadow-rose-500/20 transition-all cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Create All {buyShortages.length} Vendor POs</span>
              </button>
            )}

            <button
              onClick={onRunMrp}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Re-Explode BOMs</span>
            </button>
          </div>
        </div>

        {/* Quick Metric Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-neutral-800 text-xs font-mono">
          <div className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800/80">
            <div className="text-neutral-500 text-[11px] uppercase">Finished Goods Demand</div>
            <div className="text-lg font-bold text-neutral-100 mt-0.5">
              {summary.totalFinishedGoodsDemand} units
            </div>
          </div>
          <div className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800/80">
            <div className="text-neutral-500 text-[11px] uppercase">Exploded BOM Components</div>
            <div className="text-lg font-bold text-neutral-100 mt-0.5">
              {summary.totalComponentsEvaluated} SKUs
            </div>
          </div>
          <div className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800/80">
            <div className="text-neutral-500 text-[11px] uppercase">Net Shortages Detected</div>
            <div className={`text-lg font-bold mt-0.5 ${summary.itemsWithDeficit > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {summary.itemsWithDeficit} items
            </div>
          </div>
          <div className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800/80">
            <div className="text-neutral-500 text-[11px] uppercase">Total Shortage Procurement Cost</div>
            <div className="text-lg font-bold text-amber-400 mt-0.5">
              ₹{summary.totalProcurementCost.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Action Filter Pills */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => setFilterAction('shortage')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                filterAction === 'shortage'
                  ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Shortages Only ({requirements.filter((r) => r.netDeficit > 0).length})
            </button>
            <button
              onClick={() => setFilterAction('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                filterAction === 'all'
                  ? 'bg-neutral-800 text-neutral-200 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All Parts ({requirements.length})
            </button>
            <button
              onClick={() => setFilterAction('buy')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                filterAction === 'buy'
                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              BUY ({requirements.filter((r) => r.recommendedAction === 'BUY' && r.netDeficit > 0).length})
            </button>
            <button
              onClick={() => setFilterAction('build')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                filterAction === 'build'
                  ? 'bg-sky-500/20 text-sky-300 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              BUILD ({requirements.filter((r) => r.recommendedAction === 'BUILD' && r.netDeficit > 0).length})
            </button>
          </div>

          {/* Category Dropdown */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-amber-500/60 font-mono cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="raw_material">Raw Materials</option>
            <option value="sub_assembly">Sub-Assemblies</option>
            <option value="electronic">Electronics</option>
            <option value="hardware">Hardware</option>
            <option value="finished_good">Finished Goods</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Filter by SKU or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 font-mono"
          />
        </div>
      </div>

      {/* MRP Requirements Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950/80 text-neutral-400 font-mono uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Part / Component SKU</th>
                <th className="py-3 px-3 text-right">Gross Demand</th>
                <th className="py-3 px-3 text-right">On Hand</th>
                <th className="py-3 px-3 text-right">Allocated</th>
                <th className="py-3 px-3 text-right">On Order</th>
                <th className="py-3 px-3 text-right">Safety Stk</th>
                <th className="py-3 px-4 text-right">Net Deficit</th>
                <th className="py-3 px-3 text-center">Action</th>
                <th className="py-3 px-3">Order Release Date</th>
                <th className="py-3 px-3">Need By Date</th>
                <th className="py-3 px-4 text-right">Action / PO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono">
              {filteredRequirements.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-neutral-500 font-sans">
                    No components match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRequirements.map((item) => {
                  const isCritical = item.netDeficit > 0;
                  const isReleaseUrgent = item.orderReleaseDate <= today && isCritical;

                  return (
                    <tr
                      key={item.itemSku}
                      className={`hover:bg-neutral-800/40 transition-colors ${
                        isCritical ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* SKU & Name */}
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400 text-xs">
                            {item.itemSku}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/60">
                            {item.category.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-neutral-300 text-xs mt-0.5 font-medium line-clamp-1 max-w-xs">
                          {item.itemName}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                          Supplier: {item.supplier}
                        </div>
                      </td>

                      {/* Gross Demand */}
                      <td className="py-3 px-3 text-right font-bold text-neutral-200">
                        {item.grossRequirement} <span className="text-[10px] text-neutral-500 font-normal">{item.unit}</span>
                      </td>

                      {/* On Hand */}
                      <td className="py-3 px-3 text-right text-neutral-300">
                        {item.currentOnHand}
                      </td>

                      {/* Allocated */}
                      <td className="py-3 px-3 text-right text-amber-400/80">
                        {item.allocated > 0 ? `-${item.allocated}` : '0'}
                      </td>

                      {/* On Order */}
                      <td className="py-3 px-3 text-right text-sky-400 font-semibold">
                        {item.onOrder > 0 ? `+${item.onOrder}` : '0'}
                      </td>

                      {/* Safety Stock */}
                      <td className="py-3 px-3 text-right text-neutral-400">
                        {item.safetyStock}
                      </td>

                      {/* Net Deficit */}
                      <td className="py-3 px-4 text-right">
                        {item.netDeficit > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30 text-xs">
                            <AlertTriangle className="w-3 h-3" />
                            -{item.netDeficit} {item.unit}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                            <Check className="w-3 h-3" />
                            Covered
                          </span>
                        )}
                      </td>

                      {/* Recommended Action */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.recommendedAction === 'BUY'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : item.recommendedAction === 'BUILD'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                        }`}>
                          {item.recommendedAction}
                        </span>
                      </td>

                      {/* Order Release Date */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`${isReleaseUrgent ? 'text-rose-400 font-bold' : 'text-neutral-300'}`}>
                            {item.orderReleaseDate}
                          </span>
                          {isReleaseUrgent && (
                            <span className="text-[9px] px-1 bg-rose-500/30 text-rose-300 rounded font-bold uppercase">
                              Past Due
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          Lead time: {item.leadTimeDays}d
                        </div>
                      </td>

                      {/* Need By Date */}
                      <td className="py-3 px-3">
                        <span className="text-neutral-300">{item.needByDate}</span>
                        <div className="text-[10px] text-neutral-500 truncate max-w-[120px]" title={item.sourceOrders.join(', ')}>
                          For: {item.sourceOrders.join(', ')}
                        </div>
                      </td>

                      {/* Action / Trigger PO */}
                      <td className="py-3 px-4 text-right font-sans">
                        {item.recommendedAction === 'BUY' && item.netDeficit > 0 ? (
                          <button
                            onClick={() => onCreateSinglePO(item)}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-amber-500/30 rounded text-[11px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                            title={`Generate PO for ${item.recommendedOrderQty} ${item.unit} (₹${item.estimatedCost})`}
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>Issue PO</span>
                          </button>
                        ) : item.recommendedAction === 'BUILD' && item.netDeficit > 0 ? (
                          <span className="text-[11px] text-sky-400 font-mono">
                            Plan Shop Order
                          </span>
                        ) : (
                          <span className="text-neutral-600 text-[11px] font-mono">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
