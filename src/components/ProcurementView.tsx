import React, { useState } from 'react';
import { 
  Truck, 
  Plus, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  ArrowRight, 
  Search, 
  Check, 
  PackageCheck,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { PurchaseOrder, InventoryItem } from '../types/mrp';

interface ProcurementViewProps {
  purchaseOrders: PurchaseOrder[];
  onReceivePO: (poId: string) => void;
  onOpenNewPO?: () => void;
}

export const ProcurementView: React.FC<ProcurementViewProps> = ({
  purchaseOrders,
  onReceivePO,
  onOpenNewPO,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'received'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const openPOs = purchaseOrders.filter((po) => po.status === 'issued' || po.status === 'in_transit');
  const receivedPOs = purchaseOrders.filter((po) => po.status === 'received');

  const totalOpenValue = openPOs.reduce((sum, po) => sum + po.totalAmount, 0);

  const filteredOrders = purchaseOrders.filter((po) => {
    if (statusFilter === 'open' && (po.status !== 'issued' && po.status !== 'in_transit')) return false;
    if (statusFilter === 'received' && po.status !== 'received') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        po.poNumber.toLowerCase().includes(q) ||
        po.supplierName.toLowerCase().includes(q) ||
        po.items.some((i) => i.itemSku.toLowerCase().includes(q) || i.itemName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Truck className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">
              Vendor Procurement & Inbound Deliveries
            </span>
          </div>
          <h2 className="text-xl font-bold text-neutral-100">
            Supplier Purchase Orders & Goods Receiving
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Receiving goods automatically updates physical warehouse inventory and clears net MRP deficits across all assemblies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right font-mono text-xs">
            <div className="text-neutral-400">Open Inbound Value:</div>
            <div className="text-base font-bold text-amber-400">
              ₹{Math.round(totalOpenValue).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded font-medium cursor-pointer ₹{
              statusFilter === 'all'
                ? 'bg-neutral-800 text-neutral-100 font-bold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            All Orders ({purchaseOrders.length})
          </button>
          <button
            onClick={() => setStatusFilter('open')}
            className={`px-3 py-1 rounded font-medium cursor-pointer ₹{
              statusFilter === 'open'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Inbound Active ({openPOs.length})
          </button>
          <button
            onClick={() => setStatusFilter('received')}
            className={`px-3 py-1 rounded font-medium cursor-pointer ₹{
              statusFilter === 'received'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Received ({receivedPOs.length})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search PO#, supplier, or part SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>
      </div>

      {/* PO Cards */}
      <div className="space-y-4">
        {filteredOrders.map((po) => {
          const isOpen = po.status === 'issued' || po.status === 'in_transit';
          const isReceived = po.status === 'received';

          return (
            <div
              key={po.id}
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {po.poNumber}
                    </span>
                    <h3 className="text-base font-bold text-neutral-100">
                      {po.supplierName}
                    </h3>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ₹{
                      isReceived
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    }`}>
                      {po.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 mt-1 font-mono">
                    Issued: {po.orderDate} · Expected Delivery: <span className="text-amber-300 font-semibold">{po.expectedDeliveryDate}</span>
                  </p>
                </div>

                <div className="flex items-center gap-4 font-mono text-xs">
                  <div className="text-right">
                    <div className="text-neutral-500 text-[11px]">PO Total:</div>
                    <div className="text-base font-bold text-neutral-100">
                      ₹{po.totalAmount.toLocaleString()}
                    </div>
                  </div>

                  {isOpen && (
                    <button
                      onClick={() => onReceivePO(po.id)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs tracking-wide shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>Receive Shipment</span>
                    </button>
                  )}
                  {isReceived && (
                    <div className="flex items-center gap-1 text-emerald-400 font-semibold text-xs bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-800/40">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Inventory Updated</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <div className="mt-4 pt-3 border-t border-neutral-800/80">
                <div className="text-xs font-mono text-neutral-400 mb-2">Order Line Items:</div>
                <div className="bg-neutral-950 rounded-lg border border-neutral-800/80 overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-500 font-mono text-[10px] uppercase">
                        <th className="py-2 px-3">Item SKU</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Cost</th>
                        <th className="py-2 px-4 text-right">Extended</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                      {po.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-neutral-900/30">
                          <td className="py-2 px-3 font-bold text-amber-400">
                            {item.itemSku}
                          </td>
                          <td className="py-2 px-3 font-sans text-neutral-300">
                            {item.itemName}
                          </td>
                          <td className="py-2 px-3 text-right text-neutral-100 font-bold">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-2 px-3 text-right text-neutral-400">
                            ₹{item.unitCost.toFixed(2)}
                          </td>
                          <td className="py-2 px-4 text-right font-bold text-neutral-200">
                            ₹{(item.quantity * item.unitCost).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
