import React, { useState } from 'react';
import { X, RotateCw, Plus, Minus, Check } from 'lucide-react';
import { InventoryItem } from '../types/mrp';

interface AdjustStockModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmAdjust: (sku: string, newOnHand: number, note?: string) => void;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  item,
  isOpen,
  onClose,
  onConfirmAdjust,
}) => {
  if (!isOpen || !item) return null;

  const [mode, setMode] = useState<'add' | 'subtract' | 'set'>('add');
  const [deltaQty, setDeltaQty] = useState<number>(10);
  const [note, setNote] = useState('');

  let computedOnHand = item.onHand;
  if (mode === 'add') computedOnHand = item.onHand + deltaQty;
  if (mode === 'subtract') computedOnHand = Math.max(0, item.onHand - deltaQty);
  if (mode === 'set') computedOnHand = Math.max(0, deltaQty);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmAdjust(item.sku, computedOnHand, note);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <RotateCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-100 text-sm">
                Adjust Warehouse Inventory
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">
                {item.sku}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-mono">
          <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800">
            <div className="text-neutral-300 font-bold text-sm line-clamp-1">
              {item.name}
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400">
              <span>Location: <span className="text-neutral-200">{item.location}</span></span>
              <span>Current On Hand: <span className="text-amber-400 font-bold">{item.onHand} {item.unit}</span></span>
            </div>
          </div>

          {/* Operation Mode */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                mode === 'add'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-neutral-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" /> Receive / Add
            </button>
            <button
              type="button"
              onClick={() => setMode('subtract')}
              className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                mode === 'subtract'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-neutral-200'
              }`}
            >
              <Minus className="w-3.5 h-3.5" /> Scrap / Defect
            </button>
            <button
              type="button"
              onClick={() => { setMode('set'); setDeltaQty(item.onHand); }}
              className={`py-2 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                mode === 'set'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-neutral-200'
              }`}
            >
              Count Audit
            </button>
          </div>

          {/* Quantity Input */}
          <div>
            <label className="text-neutral-400 block mb-1">
              {mode === 'add' ? 'Quantity to Add' : mode === 'subtract' ? 'Quantity to Deduct' : 'Exact Count Value'} ({item.unit})
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={deltaQty}
              onChange={(e) => setDeltaQty(parseFloat(e.target.value) || 0)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-100 text-sm font-bold focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* New Resulting Stock */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-950/80 border border-neutral-800">
            <span className="text-neutral-400">Resulting Physical Stock:</span>
            <span className="text-base font-bold text-amber-400 font-mono">
              {computedOnHand} {item.unit}
            </span>
          </div>

          <div>
            <label className="text-neutral-400 block mb-1">
              Audit Reason / Reference
            </label>
            <input
              type="text"
              placeholder="e.g., Supplier shipment delivery or shop scrap"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs tracking-wide shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Apply Inventory Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
