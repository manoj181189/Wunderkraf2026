import React, { useState } from 'react';
import { ArrowLeft, ShoppingBag, Search, Info, Package, Truck, CheckCircle2 } from 'lucide-react';
import { FactoryState } from '../../types';

interface CustomerOrdersViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onOpenOrderSpecModal: (orderId: string) => void;
}

export const CustomerOrdersView: React.FC<CustomerOrdersViewProps> = ({
  state,
  onBackToHub,
  onOpenOrderSpecModal
}) => {
  const { packJobs } = state;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredOrders = packJobs.filter((pj) => {
    const matchesSearch =
      pj.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pj.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pj.kitType.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'PENDING') {
      return (pj.packedBoxes || 0) * pj.pcsPerBox < pj.orderQty;
    }
    if (statusFilter === 'READY') {
      return (pj.packedBoxes || 0) - (pj.dispatchedBoxes || 0) > 0;
    }
    if (statusFilter === 'DISPATCHED') {
      return (pj.dispatchedBoxes || 0) > 0;
    }
    return true;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5 flex-wrap gap-2">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Main Menu</span>
        </button>
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-bold text-[#1a365d] uppercase tracking-wide m-0">
            Customer Packing Orders Master Registry
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Customer, Order ID (e.g. ORD-001) or Kit..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-2">
          {['ALL', 'PENDING', 'READY', 'DISPATCHED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((pj) => {
            const totalRequiredBoxes = Math.ceil(pj.orderQty / pj.pcsPerBox);
            const packedBoxes = pj.packedBoxes || 0;
            const dispatchedBoxes = pj.dispatchedBoxes || 0;
            const readyBoxes = packedBoxes - dispatchedBoxes;

            const packedPct = Math.min(100, Math.round((packedBoxes / totalRequiredBoxes) * 100));
            const dispPct = Math.min(100, Math.round((dispatchedBoxes / totalRequiredBoxes) * 100));

            return (
              <div
                key={pj.id}
                className="border border-slate-200 hover:border-slate-300 rounded-xl p-4 bg-slate-50/50 hover:bg-white transition shadow-xs"
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-blue-950">{pj.id}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {pj.customer}
                    </span>
                    <span className="text-xs font-bold text-slate-600">[{pj.kitType}]</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      Target:{' '}
                      <b className="text-rose-700">{pj.dispatchDate || 'Not specified'}</b>
                    </span>
                    <button
                      onClick={() => onOpenOrderSpecModal(pj.id)}
                      className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5" /> Specs
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-700 mb-3 bg-white p-2.5 rounded-lg border border-slate-200">
                  <div>
                    Order Target: <b>{pj.orderQty.toLocaleString()} Pcs</b> ({totalRequiredBoxes} Boxes)
                  </div>
                  <div>
                    Packed Output: <b className="text-emerald-700">{packedBoxes} Boxes</b> ({packedPct}%)
                  </div>
                  <div>
                    Ready in WH: <b className="text-blue-700">{readyBoxes} Boxes</b>
                  </div>
                  <div>
                    Dispatched: <b className="text-teal-700">{dispatchedBoxes} Boxes</b> ({dispPct}%)
                  </div>
                </div>

                {/* Progress Visualizer */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500">
                    <span>Packing Progress: {packedPct}%</span>
                    <span>Dispatch Progress: {dispPct}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${packedPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
            No customer orders matching the specified filter.
          </div>
        )}
      </div>
    </div>
  );
};
