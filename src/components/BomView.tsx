import React, { useState } from 'react';
import { 
  Network, 
  Layers, 
  DollarSign, 
  Clock, 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  Cpu, 
  FileText,
  Percent,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { BomDefinition, BomComponent, InventoryItem } from '../types/mrp';

interface BomViewProps {
  boms: BomDefinition[];
  inventory: InventoryItem[];
  onAddBomComponent: (bomId: string, component: BomComponent) => void;
  onSelectBomForMrp?: (sku: string) => void;
}

export const BomView: React.FC<BomViewProps> = ({
  boms,
  inventory,
  onAddBomComponent,
}) => {
  const [selectedBomId, setSelectedBomId] = useState<string>(boms[0]?.id || '');
  const [isAddingPart, setIsAddingPart] = useState(false);
  const [newComponentSku, setNewComponentSku] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newScrap, setNewScrap] = useState(0.02);
  const [newNotes, setNewNotes] = useState('');

  const selectedBom = boms.find((b) => b.id === selectedBomId) || boms[0];
  const invMap = new Map<string, InventoryItem>();
  inventory.forEach((i) => invMap.set(i.sku, i));

  // Compute BOM costs
  let totalDirectMaterialCost = 0;
  const enrichedComponents = (selectedBom?.components || []).map((comp) => {
    const item = invMap.get(comp.componentSku);
    const unitCost = item?.unitCost || 0;
    const effectiveQty = comp.quantityPerParent * (1 + comp.scrapFactor);
    const lineCost = effectiveQty * unitCost;
    totalDirectMaterialCost += lineCost;

    return {
      ...comp,
      item,
      effectiveQty,
      unitCost,
      lineCost,
    };
  });

  const laborCost = (selectedBom?.laborHoursEstimate || 0) * (selectedBom?.laborRatePerHour || 0);
  const totalCostOfGoods = totalDirectMaterialCost + laborCost;
  const targetMSRP = selectedBom?.targetMSRP || 1;
  const grossMarginDollars = Math.max(0, targetMSRP - totalCostOfGoods);
  const grossMarginPercent = Math.round((grossMarginDollars / targetMSRP) * 100);

  const handleAddComponent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComponentSku || newQuantity <= 0) return;

    onAddBomComponent(selectedBom.id, {
      componentSku: newComponentSku,
      quantityPerParent: Number(newQuantity),
      scrapFactor: Number(newScrap),
      level: 1,
      notes: newNotes,
    });

    setIsAddingPart(false);
    setNewComponentSku('');
    setNewQuantity(1);
    setNewNotes('');
  };

  return (
    <div className="space-y-6">
      {/* BOM Selector Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Network className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">
                Engineering Bill of Materials & Cost Rollup
              </span>
            </div>
            <h2 className="text-xl font-bold text-neutral-100">
              Wunderkraf Product Assembly Architectures
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedBomId}
              onChange={(e) => setSelectedBomId(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2 text-xs text-neutral-200 font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {boms.map((bom) => (
                <option key={bom.id} value={bom.id}>
                  {bom.productSku} — {bom.name.replace('BOM: ', '')} (v{bom.version})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected BOM Overview Banner */}
        {selectedBom && (
          <div className="mt-4 pt-4 border-t border-neutral-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-amber-400">
                  {selectedBom.productSku}
                </span>
                <span className="text-xs font-semibold text-neutral-300">
                  {selectedBom.name}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-bold">
                  {selectedBom.status}
                </span>
              </div>
              <p className="text-xs text-neutral-400 max-w-2xl">
                {selectedBom.description}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono shrink-0">
              <div className="bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800">
                <span className="text-neutral-500">Labor: </span>
                <span className="text-neutral-200 font-bold">{selectedBom.laborHoursEstimate}h</span>
                <span className="text-neutral-500"> @ ₹{selectedBom.laborRatePerHour}/h</span>
              </div>
              <div className="bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800">
                <span className="text-neutral-500">MSRP: </span>
                <span className="text-amber-400 font-bold">₹{selectedBom.targetMSRP.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Financial Cost Roll-Up Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-neutral-500 text-xs font-mono uppercase">Direct Material Cost (BOM)</div>
          <div className="text-2xl font-bold font-mono text-neutral-100 mt-1">
            ₹{totalDirectMaterialCost.toFixed(2)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2 font-mono">
            {enrichedComponents.length} components included
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-neutral-500 text-xs font-mono uppercase">Direct Shop Floor Labor</div>
          <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
            ₹{laborCost.toFixed(2)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2 font-mono">
            {selectedBom.laborHoursEstimate} hours fabrication & QA
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-neutral-500 text-xs font-mono uppercase">Total Manufacturing COGS</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            ₹{totalCostOfGoods.toFixed(2)}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2 font-mono">
            Direct Material + Handcraft Labor
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-neutral-500 text-xs font-mono uppercase">Gross Production Margin</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {grossMarginPercent}%
            </span>
            <span className="text-xs font-mono text-neutral-400">
              (+₹{grossMarginDollars.toFixed(2)})
            </span>
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-2 font-mono flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Healthy craft profit margin
          </div>
        </div>
      </div>

      {/* BOM Components Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wide">
              Component Hierarchy & Extended Costs
            </h3>
          </div>
          <button
            onClick={() => setIsAddingPart(!isAddingPart)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>{isAddingPart ? 'Cancel' : 'Add Component'}</span>
          </button>
        </div>

        {/* Inline Add Component Form */}
        {isAddingPart && (
          <form
            onSubmit={handleAddComponent}
            className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3"
          >
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide">
              Append Component to {selectedBom.productSku}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] text-neutral-400 font-mono block mb-1">
                  Select Inventory Component
                </label>
                <select
                  value={newComponentSku}
                  onChange={(e) => setNewComponentSku(e.target.value)}
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">-- Choose SKU --</option>
                  {inventory
                    .filter((i) => i.sku !== selectedBom.productSku)
                    .map((item) => (
                      <option key={item.sku} value={item.sku}>
                        {item.sku} - {item.name} (${item.unitCost}/{item.unit})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 font-mono block mb-1">
                  Qty per Assembly
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 font-mono block mb-1">
                  Scrap Factor (e.g. 0.05 = 5%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.5"
                  value={newScrap}
                  onChange={(e) => setNewScrap(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <input
                type="text"
                placeholder="Engineering or assembly notes..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-2/3 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-mono"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs cursor-pointer"
              >
                Save Component
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950/80 text-neutral-400 font-mono uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Lvl</th>
                <th className="py-2.5 px-3">Component SKU</th>
                <th className="py-2.5 px-3">Part Description</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Qty / Unit</th>
                <th className="py-2.5 px-3 text-right">Scrap Rate</th>
                <th className="py-2.5 px-3 text-right">Unit Cost</th>
                <th className="py-2.5 px-4 text-right">Extended Cost</th>
                <th className="py-2.5 px-3">Notes & Spec</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-mono">
              {enrichedComponents.map((comp, idx) => (
                <tr key={`${comp.componentSku}-${idx}`} className="hover:bg-neutral-800/40 transition-colors">
                  <td className="py-2.5 px-3 text-neutral-500">
                    <span className="w-5 h-5 rounded-full bg-neutral-800 inline-flex items-center justify-center text-[10px] text-neutral-300 font-bold">
                      .{comp.level}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-amber-400">
                    {comp.componentSku}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-neutral-200 font-medium max-w-xs truncate">
                    {comp.item?.name || 'Unmapped Component'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/60">
                      {comp.item?.category.replace('_', ' ') || 'Unknown'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-neutral-200 font-bold">
                    {comp.quantityPerParent} <span className="text-[10px] text-neutral-500 font-normal">{comp.item?.unit}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-400/80">
                    {(comp.scrapFactor * 100).toFixed(0)}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-neutral-400">
                    ₹{comp.unitCost.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-neutral-100">
                    ₹{comp.lineCost.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-neutral-400 text-[11px] truncate max-w-[200px]">
                    {comp.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
