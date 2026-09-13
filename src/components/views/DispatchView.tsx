import React, { useState } from 'react';
import { ArrowLeft, Truck, FileText, CheckCircle2 } from 'lucide-react';
import { FactoryState } from '../../types';

interface DispatchViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  onOpenChallanModal: (data: any) => void;
}

export const DispatchView: React.FC<DispatchViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onOpenChallanModal
}) => {
  const { packJobs } = state;
  const [selectedCust, setSelectedCust] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [gtNo, setGtNo] = useState('');
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, number>>({});

  // Collect customers who have ready boxes
  const readyCustomers = Array.from(
    new Set(
      packJobs
        .filter((pj) => (pj.packedBoxes || 0) - (pj.dispatchedBoxes || 0) > 0)
        .map((pj) => pj.customer)
    )
  );

  const matchedOrders = packJobs.filter(
    (pj) => pj.customer === selectedCust && (pj.packedBoxes || 0) - (pj.dispatchedBoxes || 0) > 0
  );

  const handleCustChange = (cust: string) => {
    setSelectedCust(cust);
    const initialQty: Record<string, number> = {};
    packJobs
      .filter((pj) => pj.customer === cust && (pj.packedBoxes || 0) - (pj.dispatchedBoxes || 0) > 0)
      .forEach((pj) => {
        initialQty[pj.id] = (pj.packedBoxes || 0) - (pj.dispatchedBoxes || 0);
      });
    setDispatchQuantities(initialQty);
  };

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCust || !invoiceNo.trim() || !gtNo.trim()) {
      alert('Please fill Party Name, Invoice Number, and GT/Vehicle number!');
      return;
    }

    const dispatchedItems: Array<{ orderId: string; item: string; boxes: number; pcs: number }> = [];
    let totalBoxes = 0;

    const updatedPackJobs = packJobs.map((pj) => {
      if (pj.customer !== selectedCust) return pj;
      const sendQty = dispatchQuantities[pj.id] || 0;
      const ready = (pj.packedBoxes || 0) - (pj.dispatchedBoxes || 0);

      if (sendQty > 0 && sendQty <= ready) {
        const newDispatched = (pj.dispatchedBoxes || 0) + sendQty;
        const totalPcs = sendQty * pj.pcsPerBox;

        dispatchedItems.push({
          orderId: pj.id,
          item: pj.kitType,
          boxes: sendQty,
          pcs: totalPcs
        });
        totalBoxes += sendQty;

        const newLogEntry = {
          invoiceNo: invoiceNo.trim().toUpperCase(),
          gtNo: gtNo.trim().toUpperCase(),
          boxes: sendQty,
          pcs: totalPcs,
          date: dispatchDate,
          user: 'DISPATCH'
        };

        const isFullyDone = newDispatched * pj.pcsPerBox >= pj.orderQty;

        return {
          ...pj,
          dispatchedBoxes: newDispatched,
          status: isFullyDone ? '100% Dispatched & Closed' : 'Partially Dispatched',
          dispatchLogs: [...(pj.dispatchLogs || []), newLogEntry]
        };
      }
      return pj;
    });

    if (dispatchedItems.length === 0) {
      alert('Please specify at least 1 valid box count to dispatch!');
      return;
    }

    const newAuditLog = {
      jobId: dispatchedItems.map((i) => i.orderId).join(', '),
      product: dispatchedItems.map((i) => i.item).join(', '),
      stage: 'Dispatch',
      machine: 'WAREHOUSE',
      action: `🚚 Dispatched ${totalBoxes} Boxes to ${selectedCust} | Bill: ${invoiceNo.toUpperCase()} | GT: ${gtNo.toUpperCase()}`,
      worker: 'DISPATCH',
      user: 'disp_user',
      rawDate: dispatchDate,
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      packJobs: updatedPackJobs,
      logs: [...state.logs, newAuditLog]
    });

    onOpenChallanModal({
      customer: selectedCust,
      invoiceNo: invoiceNo.trim().toUpperCase(),
      gtNo: gtNo.trim().toUpperCase(),
      date: dispatchDate,
      items: dispatchedItems,
      totalBoxes: totalBoxes,
      userName: 'DISPATCH DESK'
    });

    setInvoiceNo('');
    setGtNo('');
    setSelectedCust('');
    setDispatchQuantities({});
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5 flex-wrap gap-2">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Main Menu</span>
        </button>
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-teal-600" />
          <h3 className="text-base font-bold text-[#1a365d] uppercase tracking-wide m-0">
            Multi-Item Dispatch Desk & Invoicing
          </h3>
        </div>
      </div>

      <form onSubmit={handleDispatch} className="space-y-4">
        <div className="bg-teal-50/40 border border-teal-200 p-5 rounded-xl space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-teal-900 uppercase mb-1">
              1. Select Customer / Party Name with Ready Stock:
            </label>
            <select
              value={selectedCust}
              onChange={(e) => handleCustChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-teal-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              required
            >
              <option value="">-- SELECT CUSTOMER PARTY --</option>
              {readyCustomers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {selectedCust && (
            <div>
              <span className="text-xs font-bold text-teal-900 uppercase block mb-2">
                2. Ready Packing Orders for {selectedCust}:
              </span>
              <div className="space-y-2">
                {matchedOrders.map((pj) => {
                  const readyBoxes = (pj.packedBoxes || 0) - (pj.dispatchedBoxes || 0);
                  const curVal = dispatchQuantities[pj.id] !== undefined ? dispatchQuantities[pj.id] : readyBoxes;

                  return (
                    <div
                      key={pj.id}
                      className="bg-white border border-slate-200 p-3 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs"
                    >
                      <div>
                        <div className="font-extrabold text-slate-900">
                          {pj.id} — <span className="text-teal-700">{pj.kitType}</span>
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          Ready in WH: <b className="text-blue-700">{readyBoxes} Boxes</b> (
                          {(readyBoxes * pj.pcsPerBox).toLocaleString()} Pcs)
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-slate-600 font-bold">Dispatch Boxes:</label>
                        <input
                          type="number"
                          min={1}
                          max={readyBoxes}
                          value={curVal}
                          onChange={(e) =>
                            setDispatchQuantities({
                              ...dispatchQuantities,
                              [pj.id]: parseInt(e.target.value, 10) || 0
                            })
                          }
                          className="w-24 px-2 py-1 border border-slate-300 rounded text-center font-bold text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Invoice / Bill Number:
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="e.g. INV-2026-089"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                GT / LR / Transporter Vehicle No:
              </label>
              <input
                type="text"
                value={gtNo}
                onChange={(e) => setGtNo(e.target.value)}
                placeholder="e.g. GT-7788 / GJ-03-XX-1122"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Actual Dispatch Date:
            </label>
            <input
              type="date"
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={!selectedCust}
            className="w-full py-3 bg-[#2f855a] hover:bg-[#276749] disabled:opacity-50 text-white font-extrabold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Truck className="w-5 h-5" />
            <span>Confirm Multi-Item Dispatch & Print Challan</span>
          </button>
        </div>
      </form>
    </div>
  );
};
