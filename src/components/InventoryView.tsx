import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Boxes, 
  DollarSign, 
  ArrowUpDown, 
  SlidersHorizontal,
  MapPin,
  Clock,
  RotateCw
} from 'lucide-react';
import { InventoryItem, ItemCategory } from '../types/mrp';

interface InventoryViewProps {
  inventory: InventoryItem[];
  onOpenAdjustStock: (item: InventoryItem) => void;
  onOpenNewItem: () => void;
  onQuickOrder: (item: InventoryItem) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory,
  onOpenAdjustStock,
  onOpenNewItem,
  onQuickOrder,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'healthy'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Total valuation
  const totalValuation = inventory.reduce((sum, item) => sum + item.onHand * item.unitCost, 0);
  const lowStockCount = inventory.filter((item) => item.onHand <= item.reorderPoint).length;
  const criticalDeficitCount = inventory.filter((item) => item.onHand - item.allocated < 0).length;

  const filteredItems = inventory.filter((item) => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

    const available = item.onHand - item.allocated;
    if (stockStatusFilter === 'low' && available > item.reorderPoint) return false;
    if (stockStatusFilter === 'healthy' && available <= item.reorderPoint) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.defaultSupplier.toLowerCase().includes(q)
      );
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Inventory Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-neutral-500 text-xs font-mono uppercase">Warehouse Catalog</div>
          <div className="text-2xl font-bold font-mono text-neutral-100 mt-1">
            {inventory.length} SKUs
          </div>
          <div className="text-[11px] text-neutral-400 mt-2 font-mono">
            Active billable parts
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-neutral-500 text-xs font-mono uppercase">Total On-Hand Valuation</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            ${Math.round(totalValuation).toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2 font-mono">
            Standard unit cost basis
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-neutral-500 text-xs font-mono uppercase">Below Reorder Point</div>
          <div className={`text-2xl font-bold font-mono mt-1 ${lowStockCount > 0 ? 'text-amber-400' : 'text-neutral-200'}`}>
            {lowStockCount} items
          </div>
          <div className="text-[11px] text-amber-400/80 mt-2 font-mono">
            Requires replenishment review
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-neutral-500 text-xs font-mono uppercase">Over-Allocated / Deficit</div>
          <div className={`text-2xl font-bold font-mono mt-1 ${criticalDeficitCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {criticalDeficitCount} items
          </div>
          <div className="text-[11px] text-neutral-400 mt-2 font-mono">
            On-hand exceeds committed jobs
          </div>
        </div>
      </div>

      {/* Action and Filter Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">All Categories ({inventory.length})</option>
            <option value="raw_material">Raw Materials</option>
            <option value="sub_assembly">Sub-Assemblies</option>
            <option value="electronic">Adhesive & Consumables</option>
            <option value="hardware">Hardware & Tooling</option>
            <option value="finished_good">Finished Goods</option>
          </select>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => setStockStatusFilter('all')}
              className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                stockStatusFilter === 'all'
                  ? 'bg-neutral-800 text-neutral-100 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStockStatusFilter('low')}
              className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                stockStatusFilter === 'low'
                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Low / Reorder ({lowStockCount})
            </button>
            <button
              onClick={() => setStockStatusFilter('healthy')}
              className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                stockStatusFilter === 'healthy'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Healthy
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search SKU, name, location, supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950/80 text-neutral-400 font-mono uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Item SKU & Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3 text-right">Physical On Hand</th>
                <th className="py-3 px-3 text-right">Allocated</th>
                <th className="py-3 px-3 text-right">Available</th>
                <th className="py-3 px-3 text-right">On Order</th>
                <th className="py-3 px-3 text-right">Reorder Pt</th>
                <th className="py-3 px-3 text-right">Unit Cost</th>
                <th className="py-3 px-3 text-right">Total Value</th>
                <th className="py-3 px-4 text-right">Quick Stock Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono">
              {filteredItems.map((item) => {
                const available = item.onHand - item.allocated;
                const isDeficit = available < 0;
                const isReorder = available <= item.reorderPoint;

                return (
                  <tr key={item.sku} className="hover:bg-neutral-800/40 transition-colors">
                    {/* SKU & Name */}
                    <td className="py-3 px-4 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 text-xs">
                          {item.sku}
                        </span>
                        {isDeficit ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                            DEFICIT
                          </span>
                        ) : isReorder ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                            LOW
                          </span>
                        ) : null}
                      </div>
                      <div className="text-neutral-200 text-xs mt-0.5 font-medium line-clamp-1 max-w-xs">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                        Supplier: {item.defaultSupplier} · Lead: {item.leadTimeDays}d
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3">
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                        {item.category.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="py-3 px-3 text-neutral-400 text-[11px] font-mono">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
                        <span>{item.location}</span>
                      </div>
                    </td>

                    {/* On Hand */}
                    <td className="py-3 px-3 text-right font-bold text-neutral-100">
                      {item.onHand} <span className="text-[10px] text-neutral-500 font-normal">{item.unit}</span>
                    </td>

                    {/* Allocated */}
                    <td className="py-3 px-3 text-right text-amber-400/90 font-semibold">
                      {item.allocated > 0 ? `-${item.allocated}` : '0'}
                    </td>

                    {/* Available */}
                    <td className={`py-3 px-3 text-right font-bold ${
                      isDeficit ? 'text-rose-400' : isReorder ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {available}
                    </td>

                    {/* On Order */}
                    <td className="py-3 px-3 text-right text-sky-400">
                      {item.onOrder > 0 ? `+${item.onOrder}` : '0'}
                    </td>

                    {/* Reorder Point */}
                    <td className="py-3 px-3 text-right text-neutral-400">
                      {item.reorderPoint}
                    </td>

                    {/* Unit Cost */}
                    <td className="py-3 px-3 text-right text-neutral-300">
                      ₹{item.unitCost.toFixed(2)}
                    </td>

                    {/* Total Value */}
                    <td className="py-3 px-3 text-right font-bold text-neutral-200">
                      ₹{(item.onHand * item.unitCost).toFixed(0)}
                    </td>

                    {/* Quick Adjust Button */}
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        onClick={() => onOpenAdjustStock(item)}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-amber-400 border border-neutral-700 rounded text-[11px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                        title="Adjust inventory quantity or log physical receipt"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Adjust</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
