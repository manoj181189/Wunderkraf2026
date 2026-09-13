import React, { useState } from 'react';
import {
  ArrowLeft,
  Database,
  Download,
  Eye,
  Layers,
  Scissors,
  Cog,
  SearchCheck,
  PackageCheck,
  Search,
  Sparkles,
  Info,
  CheckCircle2,
  Boxes,
  Plus
} from 'lucide-react';
import { FactoryState, ProductType } from '../../types';
import { PRODUCTS } from '../../lib/constants';
import { exportToCSV, exportToJSON } from '../../lib/utils';
import { OpeningStockModal } from '../OpeningStockModal';

interface StockMatrixViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onOpenStockDetailModal: (title: string, product: ProductType, stageKey: string) => void;
  onSaveState?: (nextState: FactoryState) => void;
}

export const StockMatrixView: React.FC<StockMatrixViewProps> = ({
  state,
  onBackToHub,
  onOpenStockDetailModal,
  onSaveState
}) => {
  const { jobs, packJobs = [] } = state;
  const productList = state.products && state.products.length > 0 ? state.products : PRODUCTS;
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpeningStockModalOpen, setIsOpeningStockModalOpen] = useState(false);

  // Filter products by search term
  const filteredProducts = productList.filter((prod) =>
    prod.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  // Overall factory stage totals
  const overallTotals = {
    rolls: jobs.reduce((s, j) => s + (Number(j.availableRolls) || 0), 0),
    cutCrates: jobs.reduce((s, j) => s + (Number(j.availableCuttingCrates) || 0), 0),
    formCrates: jobs.reduce((s, j) => s + (Number(j.availableFormingCrates) || 0), 0),
    qcCrates: jobs.reduce((s, j) => s + (Number(j.availableQcCrates) || 0), 0),
    packedBoxes: packJobs.reduce(
      (s, pj) => s + Math.max(0, (Number(pj.packedBoxes) || 0) - (Number(pj.dispatchedBoxes) || 0)),
      0
    )
  };

  const handleExportCSV = () => {
    const data = productList.map((prod) => {
      const pJobs = jobs.filter((j) => j.product === prod);
      const slitRolls = pJobs.reduce((s, j) => s + (Number(j.availableRolls) || 0), 0);
      const cutCrates = pJobs.reduce((s, j) => s + (Number(j.availableCuttingCrates) || 0), 0);
      const formCrates = pJobs.reduce((s, j) => s + (Number(j.availableFormingCrates) || 0), 0);
      const qcCrates = pJobs.reduce((s, j) => s + (Number(j.availableQcCrates) || 0), 0);

      const pPacks = packJobs.filter(
        (pj) => pj.kitType === prod || (pj.kitItems && pj.kitItems.includes(prod))
      );
      const packedBoxes = pPacks.reduce(
        (s, pj) => s + Math.max(0, (Number(pj.packedBoxes) || 0) - (Number(pj.dispatchedBoxes) || 0)),
        0
      );

      return {
        Product: prod,
        'Stage 1: Slit Rolls': slitRolls,
        'Stage 2: Cut Crates': cutCrates,
        'Stage 3: Formed Crates': formCrates,
        'Stage 4: QC Approved Crates': qcCrates,
        'Stage 5: Ready Packed Boxes': packedBoxes
      };
    });
    exportToCSV('Wunderkraf_Live_Stock_Matrix.csv', data);
  };

  const handleExportJSON = () => {
    exportToJSON('Wunderkraf_Factory_State.json', state);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-xs mb-6 max-w-6xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5 flex-wrap gap-3">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Main Menu (Back to Menu)</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-[#1a365d] tracking-tight m-0">
                Live Factory Stock Matrix
              </h1>
              <p className="text-xs text-slate-500 m-0">
                Exact list of available goods stage-wise and job-wise
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onSaveState && (
            <button
              onClick={() => setIsOpeningStockModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>⚡ Quick Opening Stock</span>
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition cursor-pointer border border-slate-200"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition cursor-pointer border border-indigo-200"
          >
            <Download className="w-3.5 h-3.5" /> Backup JSON
          </button>
        </div>
      </div>

      {/* Top Factory Floor Quick Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5">
        <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-indigo-800">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>1. Slit Rolls</span>
          </div>
          <div className="text-xl font-black text-indigo-950 mt-1">
            {overallTotals.rolls} <span className="text-xs font-bold">Rolls</span>
          </div>
          <span className="text-[10px] text-indigo-700 font-medium">Slitting Roll Stock</span>
        </div>

        <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-purple-800">
            <Scissors className="w-3.5 h-3.5 text-purple-600" />
            <span>2. Cut Crates</span>
          </div>
          <div className="text-xl font-black text-purple-950 mt-1">
            {overallTotals.cutCrates} <span className="text-xs font-bold">Crates</span>
          </div>
          <span className="text-[10px] text-purple-700 font-medium">Cutting Blank Crates</span>
        </div>

        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-amber-800">
            <Cog className="w-3.5 h-3.5 text-amber-600" />
            <span>3. Formed Crates</span>
          </div>
          <div className="text-xl font-black text-amber-950 mt-1">
            {overallTotals.formCrates} <span className="text-xs font-bold">Crates</span>
          </div>
          <span className="text-[10px] text-amber-700 font-medium">Forming Press Crates</span>
        </div>

        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-emerald-800">
            <SearchCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>4. QC Pass Stock</span>
          </div>
          <div className="text-xl font-black text-emerald-950 mt-1">
            {overallTotals.qcCrates} <span className="text-xs font-bold">Crates</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">Crates Ready for Packing</span>
        </div>

        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-blue-800">
            <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>5. Packed Boxes</span>
          </div>
          <div className="text-xl font-black text-blue-950 mt-1">
            {overallTotals.packedBoxes} <span className="text-xs font-bold">Boxes</span>
          </div>
          <span className="text-[10px] text-blue-700 font-medium">Dispatch Ready Goods</span>
        </div>
      </div>

      {/* Helpful Interactive Guide Banner */}
      <div className="mb-4 p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs text-amber-950 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-medium leading-relaxed">
            <b>Instructions:</b> Click on any number/button — based on that product\'s <b>Job ID</b>,{' '}
            <b>Mother Reel Number</b>, <b>GSM</b> and <b>Paper Mill</b>, how much quantity is in stock
            will open the full history and specification table.
          </span>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <span className="text-xs font-bold text-slate-500">
          Showing {filteredProducts.length} Cutlery Products
        </span>
      </div>

      {/* Main Stock Matrix Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-black uppercase text-[11px]">
              <th className="p-3.5">Cutlery Product Item</th>
              <th className="p-3.5 text-center">Stage 1: Slit Rolls</th>
              <th className="p-3.5 text-center">Stage 2: Cut Crates</th>
              <th className="p-3.5 text-center">Stage 3: Formed Crates</th>
              <th className="p-3.5 text-center">Stage 4: QC Approved Crates</th>
              <th className="p-3.5 text-center">Stage 5: Packed Boxes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.map((prod) => {
              const pJobs = jobs.filter((j) => j.product === prod);

              // Stage 1: Rolls
              const slitRolls = pJobs.reduce((s, j) => s + (Number(j.availableRolls) || 0), 0);
              const rollsLotsCount = pJobs.filter((j) => (Number(j.availableRolls) || 0) > 0).length;

              // Stage 2: Cut Crates
              const cutCrates = pJobs.reduce((s, j) => s + (Number(j.availableCuttingCrates) || 0), 0);
              const cutLotsCount = pJobs.filter(
                (j) => (Number(j.availableCuttingCrates) || 0) > 0
              ).length;

              // Stage 3: Formed Crates
              const formCrates = pJobs.reduce(
                (s, j) => s + (Number(j.availableFormingCrates) || 0),
                0
              );
              const formLotsCount = pJobs.filter(
                (j) => (Number(j.availableFormingCrates) || 0) > 0
              ).length;

              // Stage 4: QC Approved Crates
              const qcCrates = pJobs.reduce((s, j) => s + (Number(j.availableQcCrates) || 0), 0);
              const qcLotsCount = pJobs.filter((j) => (Number(j.availableQcCrates) || 0) > 0).length;

              // Stage 5: Packed Boxes
              const pPacks = packJobs.filter(
                (pj) => pj.kitType === prod || (pj.kitItems && pj.kitItems.includes(prod))
              );
              const packedBoxes = pPacks.reduce(
                (s, pj) => s + Math.max(0, (Number(pj.packedBoxes) || 0) - (Number(pj.dispatchedBoxes) || 0)),
                0
              );
              const packedOrdersCount = pPacks.filter(
                (pj) => Math.max(0, (Number(pj.packedBoxes) || 0) - (Number(pj.dispatchedBoxes) || 0)) > 0
              ).length;

              return (
                <tr key={prod} className="hover:bg-blue-50/30 transition">
                  {/* Product Title */}
                  <td className="p-3.5 font-black text-slate-900 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-sm font-extrabold text-slate-900 block">{prod}</span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {pJobs.length} Total Jobs Registered
                      </span>
                    </div>
                  </td>

                  {/* Stage 1: Slit Rolls */}
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() =>
                        onOpenStockDetailModal(`Slit Rolls Stock — ${prod}`, prod, 'Rolls')
                      }
                      className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border font-black transition cursor-pointer shadow-2xs hover:scale-102 ${
                        slitRolls > 0
                          ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border-indigo-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={`Click to view job-wise breakdown for ${prod} Slit Rolls`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{slitRolls} Rolls</span>
                        <Eye className="w-3 h-3 text-indigo-600" />
                      </div>
                      <span className="text-[9px] font-bold text-indigo-700">
                        {rollsLotsCount > 0 ? `${rollsLotsCount} Job Lot${rollsLotsCount > 1 ? 's' : ''}` : '0 Lots'}
                      </span>
                    </button>
                  </td>

                  {/* Stage 2: Cut Crates */}
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() =>
                        onOpenStockDetailModal(`Cut Crates Stock — ${prod}`, prod, 'Cutting')
                      }
                      className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border font-black transition cursor-pointer shadow-2xs hover:scale-102 ${
                        cutCrates > 0
                          ? 'bg-purple-50 hover:bg-purple-100 text-purple-950 border-purple-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={`Click to view job-wise breakdown for ${prod} Cut Crates`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{cutCrates} Crates</span>
                        <Eye className="w-3 h-3 text-purple-600" />
                      </div>
                      <span className="text-[9px] font-bold text-purple-700">
                        {cutLotsCount > 0 ? `${cutLotsCount} Job Lot${cutLotsCount > 1 ? 's' : ''}` : '0 Lots'}
                      </span>
                    </button>
                  </td>

                  {/* Stage 3: Formed Crates */}
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() =>
                        onOpenStockDetailModal(`Formed Crates Stock — ${prod}`, prod, 'Forming')
                      }
                      className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border font-black transition cursor-pointer shadow-2xs hover:scale-102 ${
                        formCrates > 0
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={`Click to view job-wise breakdown for ${prod} Formed Crates`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{formCrates} Crates</span>
                        <Eye className="w-3 h-3 text-amber-600" />
                      </div>
                      <span className="text-[9px] font-bold text-amber-700">
                        {formLotsCount > 0 ? `${formLotsCount} Job Lot${formLotsCount > 1 ? 's' : ''}` : '0 Lots'}
                      </span>
                    </button>
                  </td>

                  {/* Stage 4: QC Approved Crates */}
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() =>
                        onOpenStockDetailModal(`QC Approved Crates Stock — ${prod}`, prod, 'QC')
                      }
                      className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border font-black transition cursor-pointer shadow-2xs hover:scale-102 ${
                        qcCrates > 0
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-300'
                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={`Click to view job-wise breakdown for ${prod} QC Approved Crates`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{qcCrates} Crates</span>
                        <Eye className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span className="text-[9px] font-bold text-emerald-700">
                        {qcLotsCount > 0 ? `${qcLotsCount} Job Lot${qcLotsCount > 1 ? 's' : ''}` : '0 Lots'}
                      </span>
                    </button>
                  </td>

                  {/* Stage 5: Packed Boxes */}
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() =>
                        onOpenStockDetailModal(`Packed Boxes Stock — ${prod}`, prod, 'Packed')
                      }
                      className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border font-black transition cursor-pointer shadow-2xs hover:scale-102 ${
                        packedBoxes > 0
                          ? 'bg-blue-50 hover:bg-blue-100 text-blue-950 border-blue-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={`Click to view packed finished goods ready for dispatch`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{packedBoxes} Boxes</span>
                        <Eye className="w-3 h-3 text-blue-600" />
                      </div>
                      <span className="text-[9px] font-bold text-blue-700">
                        {packedOrdersCount > 0 ? `${packedOrdersCount} Order${packedOrdersCount > 1 ? 's' : ''}` : '0 Orders'}
                      </span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Table Totals Row */}
          <tfoot className="bg-slate-100 font-black text-xs text-slate-900 border-t-2 border-slate-300">
            <tr>
              <td className="p-3.5 font-black uppercase text-slate-700">
                Total Factory Inventory:
              </td>
              <td className="p-3.5 text-center font-mono font-black text-indigo-900 text-sm">
                {overallTotals.rolls} Rolls
              </td>
              <td className="p-3.5 text-center font-mono font-black text-purple-900 text-sm">
                {overallTotals.cutCrates} Crates
              </td>
              <td className="p-3.5 text-center font-mono font-black text-amber-900 text-sm">
                {overallTotals.formCrates} Crates
              </td>
              <td className="p-3.5 text-center font-mono font-black text-emerald-900 text-sm">
                {overallTotals.qcCrates} Crates
              </td>
              <td className="p-3.5 text-center font-mono font-black text-blue-900 text-sm">
                {overallTotals.packedBoxes} Boxes
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Bottom Information Footer */}
      <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <b>Real-time Material Balance:</b> The account of crates and rolls at every stage in different job lots
            is secure and traceable.
          </span>
        </div>
        <span className="font-extrabold text-slate-800">
          Wunderkraf ERP Inventory Matrix v2.4
        </span>
      </div>

      {/* Quick Opening Stock Entry Modal */}
      {onSaveState && (
        <OpeningStockModal
          isOpen={isOpeningStockModalOpen}
          onClose={() => setIsOpeningStockModalOpen(false)}
          state={state}
          onSaveState={onSaveState}
        />
      )}
    </div>
  );
};
