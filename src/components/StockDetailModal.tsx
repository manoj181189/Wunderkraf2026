import React from 'react';
import { Layers, X } from 'lucide-react';
import { Job, ProductType } from '../types';

interface StockDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductType;
  stage: 'Rolls' | 'Cutting' | 'Forming' | 'QC' | 'Packed';
  jobs: Job[];
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  isOpen,
  onClose,
  product,
  stage,
  jobs
}) => {
  if (!isOpen) return null;

  let matchedJobs = jobs.filter((j) => {
    if (j.product !== product) return false;
    if (stage === 'Rolls') return j.availableRolls > 0;
    if (stage === 'Cutting') return j.availableCuttingCrates > 0;
    if (stage === 'Forming') return j.availableFormingCrates > 0;
    if (stage === 'QC') return j.availableQcCrates > 0;
    return false;
  });

  const getQtyText = (j: Job) => {
    if (stage === 'Rolls') return `${j.availableRolls} Rolls`;
    if (stage === 'Cutting') return `${j.availableCuttingCrates} Crates`;
    if (stage === 'Forming') return `${j.availableFormingCrates} Crates`;
    if (stage === 'QC') return `${j.availableQcCrates} Crates`;
    return '0';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1a365d] m-0">
              {product.toUpperCase()} — {stage} Stock Breakdown
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Exact traceable Job lot identifiers on factory floor</p>
          </div>
        </div>

        {matchedJobs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
            No active unassigned inventory in this stage for {product}.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5 text-left">Job ID</th>
                  <th className="p-2.5 text-left">Paper Brand</th>
                  <th className="p-2.5 text-left">Custom Label / GSM</th>
                  <th className="p-2.5 text-right">Available Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matchedJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-blue-50/50">
                    <td className="p-2.5 font-bold text-blue-800">{j.id}</td>
                    <td className="p-2.5 font-medium">{j.paperBrand || 'ITC'}</td>
                    <td className="p-2.5 text-slate-500">{j.customRemark || 'Standard'}</td>
                    <td className="p-2.5 text-right font-extrabold text-emerald-700">{getQtyText(j)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
