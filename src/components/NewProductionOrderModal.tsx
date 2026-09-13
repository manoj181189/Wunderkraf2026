import React, { useState } from 'react';
import { X, Hammer, Calendar, Hash, User, ShieldAlert } from 'lucide-react';
import { BomDefinition, ProductionOrder, RoutingStep } from '../types/mrp';

interface NewProductionOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  boms: BomDefinition[];
  onCreateOrder: (order: ProductionOrder) => void;
}

export const NewProductionOrderModal: React.FC<NewProductionOrderModalProps> = ({
  isOpen,
  onClose,
  boms,
  onCreateOrder,
}) => {
  const [productSku, setProductSku] = useState(boms[0]?.productSku || '');
  const [quantity, setQuantity] = useState(10);
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('high');
  const [customerName, setCustomerName] = useState('');
  
  // Default due date: 3 weeks from today
  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 21);
  const [dueDate, setDueDate] = useState(defaultDue.toISOString().split('T')[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productSku || quantity <= 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const orderIndex = Math.floor(Math.random() * 800) + 100;
    const orderCode = `WK-ORD-${orderIndex}`;

    // Standard routing steps
    const defaultRouting: RoutingStep[] = [
      { id: `r-${Date.now()}-1`, workCenterId: 'wc-cnc-01', name: 'Chassis & Structural Machining', estimatedHours: Math.round(quantity * 1.8), status: 'active' },
      { id: `r-${Date.now()}-2`, workCenterId: 'wc-wood-01', name: 'Precision Woodcraft & Sanding', estimatedHours: Math.round(quantity * 1.5), status: 'pending' },
      { id: `r-${Date.now()}-3`, workCenterId: 'wc-elec-01', name: 'Component Loom & Hand Solder', estimatedHours: Math.round(quantity * 2.2), status: 'pending' },
      { id: `r-${Date.now()}-4`, workCenterId: 'wc-qa-01', name: 'Acoustic Bench Verification & QA', estimatedHours: Math.round(quantity * 0.8), status: 'pending' },
      { id: `r-${Date.now()}-5`, workCenterId: 'wc-pack-01', name: 'Bench Assembly & Presentation Box', estimatedHours: Math.round(quantity * 0.9), status: 'pending' },
    ];

    const newOrder: ProductionOrder = {
      id: `po-${Date.now()}`,
      code: orderCode,
      productSku,
      quantity,
      status: 'released',
      priority,
      startDate: todayStr,
      dueDate,
      customerName: customerName.trim() || 'Internal Stock Replenishment',
      progressPercent: 5,
      routing: defaultRouting,
    };

    onCreateOrder(newOrder);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Hammer className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-neutral-100 text-sm">
              Schedule Production Batch Order
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-mono">
          <div>
            <label className="text-neutral-400 block mb-1">
              Select Finished Good / Assembly
            </label>
            <select
              value={productSku}
              onChange={(e) => setProductSku(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {boms.map((bom) => (
                <option key={bom.productSku} value={bom.productSku}>
                  {bom.productSku} — {bom.name.replace('BOM: ', '')}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-neutral-400 block mb-1">
                Batch Run Quantity
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-neutral-400 block mb-1">
                Priority Ranking
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-neutral-400 block mb-1">
                Target Completion Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-neutral-400 block mb-1">
                Customer / Contract Ref
              </label>
              <input
                type="text"
                placeholder="e.g. Studio Acoustics Ltd"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-300 font-sans leading-relaxed">
            <strong>MRP Automation Note:</strong> Releasing this production batch will automatically calculate required raw materials and sub-assemblies via multi-level BOM explosion. Deficits will immediately appear in the MRP engine.
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
              Issue Batch Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
