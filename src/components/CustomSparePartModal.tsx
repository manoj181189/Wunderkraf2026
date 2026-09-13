import React, { useState } from 'react';
import { X, Plus, Package, Wrench, Check, AlertCircle } from 'lucide-react';
import { SparePartItem } from '../types';

interface CustomSparePartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPart: (part: SparePartItem) => void;
  existingPartNames?: string[];
}

export const CustomSparePartModal: React.FC<CustomSparePartModalProps> = ({
  isOpen,
  onClose,
  onAddPart
}) => {
  const [partName, setPartName] = useState('');
  const [category, setCategory] = useState('Mechanical');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('Nos');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim()) {
      alert('⚠️ Please enter spare part name');
      return;
    }

    const parsedQty = parseInt(qty, 10) || 1;

    onAddPart({
      name: partName.trim(),
      qty: parsedQty,
      unit: unit.trim() || 'Nos',
      notes: notes.trim(),
      category
    });

    // Reset & close
    setPartName('');
    setNotes('');
    setQty('1');
    setUnit('Nos');
    onClose();
  };

  const quickCategories = [
    'Mechanical',
    'Electrical',
    'Pneumatic & Hydraulic',
    'Tooling & Die',
    'Heating & Sensor',
    'Hardware & Fasteners',
    'Other / General'
  ];

  const quickUnits = [
    'Nos',
    'Pcs',
    'Set',
    'Meters',
    'Rolls',
    'KG',
    'Litre',
    'Packet'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-wide uppercase m-0">
                ➕ Add Custom Spare Part
              </h3>
              <p className="text-[11px] text-amber-100 font-medium m-0">
                Type new spare part name, quantity, and description
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Spare Part Name */}
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase mb-1 flex items-center justify-between">
              <span>Spare Part Name: *</span>
              <span className="text-[10px] text-rose-600 font-bold">Required</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              placeholder="e.g. Brass Bush 32mm / Heater Coil 2000W / Cutter Blade 160mm"
              className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-amber-300 focus:border-amber-600 rounded-xl text-xs font-bold text-slate-900 outline-none transition"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Write the exact name of the part that is not in the list here
            </span>
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1">
              <Wrench className="w-3.5 h-3.5 text-amber-600" />
              <span>Category / Department:</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    category === cat
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity & Unit Row */}
          <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
            <div>
              <label className="block text-xs font-bold text-amber-950 uppercase mb-1">
                Quantity (Qty): *
              </label>
              <input
                type="number"
                min="1"
                required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-black text-slate-900 outline-none focus:border-amber-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-950 uppercase mb-1">
                Unit:
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-amber-600"
              >
                {quickUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes / Specifications */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Part No. / Specs - Optional:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Model: Festo 24V DC / Size: 160mm x 25mm / Bin #B-04"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:border-amber-600 focus:bg-white"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 shadow-md hover:shadow-lg cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>✅ Add this spare part (Add to List)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
