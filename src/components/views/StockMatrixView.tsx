import React from 'react';
import { ArrowLeft, Database, Download, Eye, Layers } from 'lucide-react';
import { FactoryState, ProductType } from '../../types';
import { PRODUCTS } from '../../lib/constants';
import { exportToCSV, exportToJSON } from '../../lib/utils';

interface StockMatrixViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onOpenStockDetailModal: (title: string, product: ProductType, stageKey: string) => void;
}

export const StockMatrixView: React.FC<StockMatrixViewProps> = ({
  state,
  onBackToHub,
  onOpenStockDetailModal
}) => {
  const { jobs } = state;

  const handleExportCSV = () => {
    const data = PRODUCTS.map((prod) => {
      const pJobs = jobs.filter((j) => j.product === prod);
      const slitRolls = pJobs.reduce((s, j) => s + (j.availableRolls || 0), 0);
      const cutCrates = pJobs.reduce((s, j) => s + (j.availableCuttingCrates || 0), 0);
      const formCrates = pJobs.reduce((s, j) => s + (j.availableFormingCrates || 0), 0);
      const qcCrates = pJobs.reduce((s, j) => s + (j.availableQcCrates || 0), 0);

      return {
        Product: prod,
        'Slit Rolls': slitRolls,
        'Cut Crates': cutCrates,
        'Formed Crates': formCrates,
        'QC Approved Crates': qcCrates
      };
    });
    exportToCSV('Wunderkraf_Live_Stock_Matrix.csv', data);
  };

  const handleExportJSON = () => {
    exportToJSON('Wunderkraf_Factory_State.json', state);
  };

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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Database className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-[#1a365d] uppercase tracking-wide m-0">
              Live Factory Stock Matrix
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> JSON
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold uppercase">
              <th className="p-3">Cutlery Product Item</th>
              <th className="p-3 text-center">Stage 1: Slit Rolls</th>
              <th className="p-3 text-center">Stage 2: Cut Crates</th>
              <th className="p-3 text-center">Stage 3: Formed Crates</th>
              <th className="p-3 text-center">Stage 4: QC Approved Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {PRODUCTS.map((prod) => {
              const pJobs = jobs.filter((j) => j.product === prod);
              const slitRolls = pJobs.reduce((s, j) => s + (j.availableRolls || 0), 0);
              const cutCrates = pJobs.reduce((s, j) => s + (j.availableCuttingCrates || 0), 0);
              const formCrates = pJobs.reduce((s, j) => s + (j.availableFormingCrates || 0), 0);
              const qcCrates = pJobs.reduce((s, j) => s + (j.availableQcCrates || 0), 0);

              return (
                <tr key={prod} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-extrabold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>{prod}</span>
                  </td>

                  <td className="p-3 text-center">
                    <button
                      onClick={() =>
                        onOpenStockDetailModal(`Slit Rolls Stock - ${prod}`, prod, 'availableRolls')
                      }
                      className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg font-extrabold cursor-pointer"
                    >
                      <span>{slitRolls} Rolls</span>
                      <Eye className="w-3 h-3 text-indigo-600" />
                    </button>
                  </td>

                  <td className="p-3 text-center">
                    <button
                      onClick={() =>
                        onOpenStockDetailModal(`Cut Crates Stock - ${prod}`, prod, 'availableCuttingCrates')
                      }
                      className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg font-extrabold cursor-pointer"
                    >
                      <span>{cutCrates} Crates</span>
                      <Eye className="w-3 h-3 text-purple-600" />
                    </button>
                  </td>

                  <td className="p-3 text-center">
                    <button
                      onClick={() =>
                        onOpenStockDetailModal(`Formed Crates Stock - ${prod}`, prod, 'availableFormingCrates')
                      }
                      className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-extrabold cursor-pointer"
                    >
                      <span>{formCrates} Crates</span>
                      <Eye className="w-3 h-3 text-amber-600" />
                    </button>
                  </td>

                  <td className="p-3 text-center">
                    <button
                      onClick={() =>
                        onOpenStockDetailModal(`QC Approved Crates Stock - ${prod}`, prod, 'availableQcCrates')
                      }
                      className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg font-extrabold cursor-pointer"
                    >
                      <span>{qcCrates} Crates</span>
                      <Eye className="w-3 h-3 text-emerald-600" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center justify-between flex-wrap gap-2">
        <span>💡 Click any cell pill to open full job-wise batches and brand audit breakdown.</span>
        <span className="font-bold text-slate-800">Real-time Stock Valuation Engine</span>
      </div>
    </div>
  );
};
