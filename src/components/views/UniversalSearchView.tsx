import React, { useState } from 'react';
import { ArrowLeft, Search, Layers, ShoppingBag, Truck, History, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { FactoryState } from '../../types';

interface UniversalSearchViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onOpenOrderSpecModal: (orderId: string) => void;
  onOpenBatchReportModal?: (id: string) => void;
  onNavigateToTraceability?: (query: string) => void;
}

export const UniversalSearchView: React.FC<UniversalSearchViewProps> = ({
  state,
  onBackToHub,
  onOpenOrderSpecModal,
  onOpenBatchReportModal,
  onNavigateToTraceability
}) => {
  const { jobs, packJobs, logs } = state;
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  // Search Jobs
  const matchedJobs = q
    ? jobs.filter(
        (j) =>
          j.id.toLowerCase().includes(q) ||
          j.product.toLowerCase().includes(q) ||
          (j.paperBrand && j.paperBrand.toLowerCase().includes(q)) ||
          (j.customRemark && j.customRemark.toLowerCase().includes(q))
      )
    : [];

  // Search Orders
  const matchedOrders = q
    ? packJobs.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.customer.toLowerCase().includes(q) ||
          p.kitType.toLowerCase().includes(q) ||
          (p.remarks && p.remarks.toLowerCase().includes(q))
      )
    : [];

  // Search Dispatches
  const matchedDispatches: Array<{ customer: string; log: any }> = [];
  if (q) {
    packJobs.forEach((pj) => {
      (pj.dispatchLogs || []).forEach((dl) => {
        if (
          dl.invoiceNo.toLowerCase().includes(q) ||
          dl.gtNo.toLowerCase().includes(q) ||
          pj.customer.toLowerCase().includes(q)
        ) {
          matchedDispatches.push({ customer: pj.customer, log: dl });
        }
      });
    });
  }

  // Search Logs
  const matchedLogs = q
    ? logs
        .filter(
          (l) =>
            (l.jobId && l.jobId.toLowerCase().includes(q)) ||
            (l.action && l.action.toLowerCase().includes(q)) ||
            (l.worker && l.worker.toLowerCase().includes(q)) ||
            (l.machine && l.machine.toLowerCase().includes(q))
        )
        .slice(0, 20)
    : [];

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
          <Search className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-bold text-[#1a365d] uppercase tracking-wide m-0">
            Universal Factory Search Engine
          </h3>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Job ID (SPN-001), Customer, Invoice No, Machine, Worker..."
          className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-600 transition"
        />
      </div>

      {q ? (
        <div className="space-y-6">
          {/* Matched Jobs */}
          {matchedJobs.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 mb-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Production Jobs ({matchedJobs.length})</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchedJobs.map((j) => (
                  <div key={j.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="font-extrabold text-blue-900 flex justify-between">
                      <span>{j.id}</span>
                      <span className="text-slate-600">{j.product}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Brand: {j.paperBrand || 'ITC'} | Stage: {j.stage || 'Production'}
                    </div>
                    <div className="text-[11px] font-bold text-slate-700 mt-1">
                      Avail: {j.availableRolls || 0} Rolls, {j.availableCuttingCrates || 0} Cut,{' '}
                      {j.availableFormingCrates || 0} Formed, {j.availableQcCrates || 0} QC OK
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/60">
                      {onOpenBatchReportModal && (
                        <button
                          onClick={() => onOpenBatchReportModal(j.id)}
                          className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold px-2 py-0.5 rounded cursor-pointer transition"
                        >
                          <FileSpreadsheet className="w-3 h-3" />
                          <span>Batch Report</span>
                        </button>
                      )}
                      {onNavigateToTraceability && (
                        <button
                          onClick={() => onNavigateToTraceability(j.id)}
                          className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold px-2 py-0.5 rounded cursor-pointer transition"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Trace Geneology</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Orders */}
          {matchedOrders.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 mb-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <span>Customer Packing Orders ({matchedOrders.length})</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {matchedOrders.map((pj) => (
                  <div key={pj.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="font-extrabold text-slate-900 flex justify-between items-center">
                      <span>
                        {pj.id} — <b className="text-emerald-800">{pj.customer}</b>
                      </span>
                      <button
                        onClick={() => onOpenOrderSpecModal(pj.id)}
                        className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold cursor-pointer"
                      >
                        Specs
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1">{pj.kitType}</div>
                    <div className="text-[11px] font-semibold text-slate-700 mt-1">
                      Target: {pj.orderQty.toLocaleString()} Pcs | Done: {pj.packedBoxes || 0} Boxes |
                      Dispatched: {pj.dispatchedBoxes || 0} Boxes
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/60">
                      {onOpenBatchReportModal && (
                        <button
                          onClick={() => onOpenBatchReportModal(pj.id)}
                          className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold px-2 py-0.5 rounded cursor-pointer transition"
                        >
                          <FileSpreadsheet className="w-3 h-3" />
                          <span>Order Report</span>
                        </button>
                      )}
                      {onNavigateToTraceability && (
                        <button
                          onClick={() => onNavigateToTraceability(pj.customer)}
                          className="flex items-center gap-1 text-[10px] bg-teal-50 text-teal-800 hover:bg-teal-100 font-bold px-2 py-0.5 rounded cursor-pointer transition"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Trace Customer Boxes</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Dispatches */}
          {matchedDispatches.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 mb-2">
                <Truck className="w-4 h-4 text-teal-600" />
                <span>Dispatches & Invoices ({matchedDispatches.length})</span>
              </h4>
              <div className="space-y-2">
                {matchedDispatches.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-teal-50/50 border border-teal-200 rounded-lg text-xs flex items-center justify-between flex-wrap gap-2"
                  >
                    <div>
                      <div className="font-extrabold text-teal-950">
                        {item.customer} | Invoice: <b>{item.log.invoiceNo}</b>
                      </div>
                      <div className="text-[11px] text-teal-700">
                        GT No: {item.log.gtNo} | Date: {item.log.date}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right font-extrabold text-teal-900">
                        {item.log.boxes} Boxes ({item.log.pcs?.toLocaleString()} Pcs)
                      </div>
                      {onNavigateToTraceability && (
                        <button
                          onClick={() => onNavigateToTraceability(item.log.invoiceNo)}
                          className="flex items-center gap-1 text-[11px] bg-teal-700 hover:bg-teal-800 text-white font-bold px-2.5 py-1 rounded cursor-pointer transition"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Investigate Box Traceability</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Audit Logs */}
          {matchedLogs.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 mb-2">
                <History className="w-4 h-4 text-slate-600" />
                <span>Audit Trail Events ({matchedLogs.length})</span>
              </h4>
              <div className="space-y-1.5">
                {matchedLogs.map((l, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="font-bold text-slate-800">{l.action}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>{l.timestamp}</span>
                      <span>• Stage: {l.stage}</span>
                      {l.worker && <span>• Worker: {l.worker}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchedJobs.length === 0 &&
            matchedOrders.length === 0 &&
            matchedDispatches.length === 0 &&
            matchedLogs.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
                No matching records found for "{query}".
              </div>
            )}
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
          Type a query above to instantly search all plant production jobs, customer orders, dispatches, and logs.
        </div>
      )}
    </div>
  );
};
