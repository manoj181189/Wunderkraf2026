import React, { useState } from 'react';
import {
  Layers,
  X,
  Boxes,
  Scissors,
  Cog,
  SearchCheck,
  PackageCheck,
  Download,
  FileSpreadsheet,
  Search,
  ExternalLink,
  Info,
  CheckCircle2,
  Calendar,
  Building2
} from 'lucide-react';
import { Job, PackJob, ProductType } from '../types';
import { exportToCSV, getJobAllReels, getJobReelsSummary } from '../lib/utils';

export type StageKey = 'Rolls' | 'Cutting' | 'Forming' | 'QC' | 'Packed' | string;

interface StockDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  product: ProductType;
  stage: StageKey;
  jobs: Job[];
  packJobs?: PackJob[];
  onOpenBatchReport?: (jobId: string) => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  product,
  stage,
  jobs,
  packJobs = [],
  onOpenBatchReport
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Normalize stage string from various formats (e.g. 'availableRolls', 'Rolls', 'slitting', 'QC')
  const rawStage = (stage || '').toLowerCase();
  let normalizedStage: 'Rolls' | 'Cutting' | 'Forming' | 'QC' | 'Packed' = 'Rolls';

  if (rawStage.includes('roll') || rawStage.includes('slit')) {
    normalizedStage = 'Rolls';
  } else if (rawStage.includes('cut')) {
    normalizedStage = 'Cutting';
  } else if (rawStage.includes('form')) {
    normalizedStage = 'Forming';
  } else if (rawStage.includes('qc')) {
    normalizedStage = 'QC';
  } else if (rawStage.includes('pack') || rawStage.includes('box') || rawStage.includes('disp')) {
    normalizedStage = 'Packed';
  }

  // Stage metadata & theme styling
  const stageConfig = {
    Rolls: {
      name: 'Slit Rolls Stock',
      badge: 'Stage 1 • Slit Rolls',
      color: 'indigo',
      unit: 'Rolls',
      unitHindi: 'Rolls',
      estPcsPerUnit: 4500,
      icon: Layers,
      bgLight: 'bg-indigo-50',
      borderLight: 'border-indigo-200',
      textDark: 'text-indigo-900',
      accentColor: '#4338ca'
    },
    Cutting: {
      name: 'Cut Crates Stock',
      badge: 'Stage 2 • Cut Crates',
      color: 'purple',
      unit: 'Crates',
      unitHindi: 'Crates',
      estPcsPerUnit: 5000,
      icon: Scissors,
      bgLight: 'bg-purple-50',
      borderLight: 'border-purple-200',
      textDark: 'text-purple-900',
      accentColor: '#7e22ce'
    },
    Forming: {
      name: 'Formed Crates Stock',
      badge: 'Stage 3 • Formed Crates',
      color: 'amber',
      unit: 'Crates',
      unitHindi: 'Crates',
      estPcsPerUnit: 4500,
      icon: Cog,
      bgLight: 'bg-amber-50',
      borderLight: 'border-amber-200',
      textDark: 'text-amber-900',
      accentColor: '#b45309'
    },
    QC: {
      name: 'QC Approved Stock',
      badge: 'Stage 4 • QC Approved',
      color: 'emerald',
      unit: 'Crates',
      unitHindi: 'Crates',
      estPcsPerUnit: 4500,
      icon: SearchCheck,
      bgLight: 'bg-emerald-50',
      borderLight: 'border-emerald-200',
      textDark: 'text-emerald-900',
      accentColor: '#047857'
    },
    Packed: {
      name: 'Ready Packed Goods',
      badge: 'Stage 5 • Packed Boxes',
      color: 'blue',
      unit: 'Boxes',
      unitHindi: 'Boxes',
      estPcsPerUnit: 1000,
      icon: PackageCheck,
      bgLight: 'bg-blue-50',
      borderLight: 'border-blue-200',
      textDark: 'text-blue-900',
      accentColor: '#1d4ed8'
    }
  }[normalizedStage];

  const StageIcon = stageConfig.icon;

  // Helper to extract stock quantity for a job
  const getJobQty = (j: Job): number => {
    if (normalizedStage === 'Rolls') return Number(j.availableRolls) || 0;
    if (normalizedStage === 'Cutting') return Number(j.availableCuttingCrates) || 0;
    if (normalizedStage === 'Forming') return Number(j.availableFormingCrates) || 0;
    if (normalizedStage === 'QC') return Number(j.availableQcCrates) || 0;
    return 0;
  };

  // Matched manufacturing jobs
  const matchedJobs = jobs.filter((j) => {
    if (j.product !== product) return false;
    const qty = getJobQty(j);
    return qty > 0;
  });

  // Matched packed jobs (if Packed stage)
  const matchedPackJobs = packJobs.filter((pj) => {
    const isProductKit =
      pj.kitType === product ||
      (pj.kitItems && pj.kitItems.includes(product));
    if (!isProductKit) return false;
    const availBoxes = (pj.packedBoxes || 0) - (pj.dispatchedBoxes || 0);
    return availBoxes > 0;
  });

  // Filtered jobs by search query
  const filteredJobs = matchedJobs.filter((j) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    const reels = getJobAllReels(j);
    return (
      j.id.toLowerCase().includes(s) ||
      reels.some((r) => r.toLowerCase().includes(s)) ||
      (j.reelNo && j.reelNo.toLowerCase().includes(s)) ||
      (j.paperBrand && j.paperBrand.toLowerCase().includes(s)) ||
      (j.gsm && String(j.gsm).toLowerCase().includes(s)) ||
      (j.customRemark && j.customRemark.toLowerCase().includes(s))
    );
  });

  const filteredPackJobs = matchedPackJobs.filter((pj) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return (
      pj.id.toLowerCase().includes(s) ||
      pj.customer.toLowerCase().includes(s) ||
      pj.kitType.toLowerCase().includes(s) ||
      (pj.remarks && pj.remarks.toLowerCase().includes(s))
    );
  });

  // Aggregate totals
  const totalQty =
    normalizedStage === 'Packed'
      ? matchedPackJobs.reduce(
          (sum, pj) => sum + Math.max(0, (pj.packedBoxes || 0) - (pj.dispatchedBoxes || 0)),
          0
        )
      : matchedJobs.reduce((sum, j) => sum + getJobQty(j), 0);

  const totalLotsCount = normalizedStage === 'Packed' ? matchedPackJobs.length : matchedJobs.length;

  const totalEstPieces =
    normalizedStage === 'Packed'
      ? matchedPackJobs.reduce(
          (sum, pj) =>
            sum +
            Math.max(0, (pj.packedBoxes || 0) - (pj.dispatchedBoxes || 0)) * (pj.pcsPerBox || 1000),
          0
        )
      : totalQty * stageConfig.estPcsPerUnit;

  // Export to CSV
  const handleExportCSV = () => {
    if (normalizedStage === 'Packed') {
      const exportData = filteredPackJobs.map((pj) => {
        const avail = Math.max(0, (pj.packedBoxes || 0) - (pj.dispatchedBoxes || 0));
        return {
          'Order ID': pj.id,
          Customer: pj.customer,
          Product: pj.kitType,
          'Available Stock (Boxes)': avail,
          'Pcs Per Box': pj.pcsPerBox || 1000,
          'Total Pcs': avail * (pj.pcsPerBox || 1000),
          'Dispatch Target': pj.dispatchDate,
          Status: pj.status
        };
      });
      exportToCSV(`${product}_Packed_Boxes_Stock.csv`, exportData);
    } else {
      const exportData = filteredJobs.map((j) => {
        const qty = getJobQty(j);
        return {
          'Job ID': j.id,
          Product: j.product,
          'Reel No(s)': getJobReelsSummary(j),
          'Paper Brand': j.paperBrand || 'ITC',
          GSM: j.gsm || j.targetGsm || '-',
          [`Stock Qty (${stageConfig.unit})`]: qty,
          'Estimated Pcs': qty * stageConfig.estPcsPerUnit,
          Specifications: j.customRemark || 'Standard Food Grade',
          Stage: j.stage || 'In Production'
        };
      });
      exportToCSV(`${product}_${stageConfig.unit}_Stock_Breakdown.csv`, exportData);
    }
  };

  // Other stages inventory overview for this product (to answer "where is the stock?")
  const allProductJobs = jobs.filter((j) => j.product === product);
  const otherStagesSummary = {
    rolls: allProductJobs.reduce((s, j) => s + (j.availableRolls || 0), 0),
    cutting: allProductJobs.reduce((s, j) => s + (j.availableCuttingCrates || 0), 0),
    forming: allProductJobs.reduce((s, j) => s + (j.availableFormingCrates || 0), 0),
    qc: allProductJobs.reduce((s, j) => s + (j.availableQcCrates || 0), 0)
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          title="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3 border-b border-slate-100 pb-4 mb-4 pr-10">
          <div
            className={`w-11 h-11 rounded-xl ${stageConfig.bgLight} border ${stageConfig.borderLight} flex items-center justify-center shrink-0`}
          >
            <StageIcon className="w-6 h-6" style={{ color: stageConfig.accentColor }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-slate-900 m-0 tracking-tight">
                {product.toUpperCase()} — {stageConfig.name}
              </h2>
              <span
                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${stageConfig.bgLight} ${stageConfig.textDark} border ${stageConfig.borderLight}`}
              >
                {stageConfig.badge}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 m-0">
              Accurate stock by each Job ID, Mother Reel No, GSM and Paper Mill
              Details
            </p>
          </div>
        </div>

        {/* Top KPI Metrics Overview Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4 shrink-0">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block">
              Total In-Stock
            </span>
            <div className="text-xl font-black text-slate-900 mt-0.5 flex items-baseline gap-1">
              <span>{totalQty}</span>
              <span className="text-xs font-bold text-slate-600">{stageConfig.unit}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
in               {totalLotsCount} different job lots
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block">
              Active Job Lots
            </span>
            <div className="text-xl font-black text-blue-900 mt-0.5 flex items-baseline gap-1">
              <span>{totalLotsCount}</span>
              <span className="text-xs font-bold text-slate-600">Lots</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Distinct trace IDs</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block">
              Estimated Pieces
            </span>
            <div className="text-xl font-black text-emerald-700 mt-0.5 flex items-baseline gap-1">
              <span>~{totalEstPieces.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-600">Pcs</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              @{stageConfig.estPcsPerUnit} pcs per {stageConfig.unit.slice(0, -1)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 block">
              Paper Mills in Stock
            </span>
            <div className="text-xs font-black text-slate-800 mt-1 truncate">
              {normalizedStage === 'Packed'
                ? `${matchedPackJobs.length} Orders Queued`
                : Array.from(new Set(matchedJobs.map((j) => j.paperBrand || 'ITC'))).join(', ') ||
                  'None'}
            </div>
            <span className="text-[10px] text-slate-500 font-medium truncate block mt-0.5">
              {normalizedStage === 'Packed'
                ? 'Ready for dispatch'
                : Array.from(new Set(matchedJobs.map((j) => j.gsm || j.targetGsm).filter(Boolean))).join(', ') || 'Standard'}
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex items-center justify-between gap-3 mb-3 shrink-0 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Job ID, Reel No, Brand, GSM..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition"
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

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={totalQty === 0}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none px-3 py-1.5 rounded-xl transition cursor-pointer border border-slate-200"
              title="Download detailed stock list as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Main Job Breakdown Table Area */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
          {normalizedStage === 'Packed' ? (
            /* Packed Goods Order-wise Table */
            filteredPackJobs.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Boxes className="w-12 h-12 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">
                  No active packed stock found for {product}
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  All packed boxes have been dispatched or no packaging orders are currently holding
                  inventory in factory warehouse.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200 z-10">
                  <tr>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Kit / Product</th>
                    <th className="p-3 text-center">Available Boxes</th>
                    <th className="p-3 text-right">Est. Pcs</th>
                    <th className="p-3 text-center">Target Date</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPackJobs.map((pj) => {
                    const availBoxes = Math.max(
                      0,
                      (pj.packedBoxes || 0) - (pj.dispatchedBoxes || 0)
                    );
                    const pcs = availBoxes * (pj.pcsPerBox || 1000);
                    return (
                      <tr key={pj.id} className="hover:bg-blue-50/40 transition">
                        <td className="p-3 font-mono font-black text-blue-900">{pj.id}</td>
                        <td className="p-3 font-extrabold text-slate-900">{pj.customer}</td>
                        <td className="p-3 font-medium text-slate-700">{pj.kitType}</td>
                        <td className="p-3 text-center">
                          <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 border border-blue-200">
                            {availBoxes} Boxes
                          </span>
                        </td>
                        <td className="p-3 text-right font-black text-emerald-700">
                          {pcs.toLocaleString()} Pcs
                        </td>
                        <td className="p-3 text-center text-slate-600 font-medium">
                          {pj.dispatchDate}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            {pj.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            /* Manufacturing Stages (Rolls, Cutting, Forming, QC) Detailed Jobs Table */
            filteredJobs.length === 0 ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <StageIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 m-0">
                    No Active Inventory in {stageConfig.name} for {product}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto leading-relaxed">
                    There is no active open stock available for {product} in this stage. Material produced
                    previously has already been processed in the next stage.
                  </p>
                </div>

                {/* Helpful Pipeline Status Indicator */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl max-w-xl mx-auto text-left text-xs space-y-2">
                  <div className="font-extrabold text-slate-700 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>Current Pipeline Stock for {product} across all stages:</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Slit Rolls:</span>
                      <b className="text-indigo-900 font-black">{otherStagesSummary.rolls} Rolls</b>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Cut Crates:</span>
                      <b className="text-purple-900 font-black">
                        {otherStagesSummary.cutting} Crates
                      </b>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Formed Crates:</span>
                      <b className="text-amber-900 font-black">
                        {otherStagesSummary.forming} Crates
                      </b>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">QC Approved:</span>
                      <b className="text-emerald-900 font-black">{otherStagesSummary.qc} Crates</b>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200 z-10">
                  <tr>
                    <th className="p-3">Job ID</th>
                    <th className="p-3">Mother Reel No.</th>
                    <th className="p-3">Paper Mill</th>
                    <th className="p-3">GSM</th>
                    <th className="p-3 text-center">
                      Available Stock ({stageConfig.unit})
                    </th>
                    <th className="p-3 text-right">Est. Pieces</th>
                    <th className="p-3">Specifications / Remark</th>
                    <th className="p-3 text-center">Batch Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredJobs.map((j) => {
                    const qty = getJobQty(j);
                    let cratePcs = stageConfig.estPcsPerUnit;
                    if (normalizedStage === 'Cutting') {
                      cratePcs = j.pcsPerCrateCutting || 10000;
                    } else if (normalizedStage === 'Forming' || normalizedStage === 'QC') {
                      cratePcs = j.pcsPerCrateForming || 7000;
                    }
                    const pieces = qty * cratePcs;

                    // Active running machine indicator if any
                    const runningBatch = j.runningBatches?.find((b) => b.status === 'Running');

                    return (
                      <tr key={j.id} className="hover:bg-blue-50/40 transition">
                        {/* Job ID */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-blue-900 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg text-xs">
                              {j.id}
                            </span>
                            {runningBatch && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title={`Running on ${runningBatch.machine}`} />
                            )}
                          </div>
                          {runningBatch && (
                            <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                              {runningBatch.machine} ({runningBatch.stage})
                            </div>
                          )}
                        </td>

                        {/* Mother Reel Number(s) */}
                        <td className="p-3">
                          {(() => {
                            const reels = getJobAllReels(j);
                            return (
                              <div className="flex flex-wrap gap-1 items-center">
                                {reels.map((r, idx) => (
                                  <span
                                    key={idx}
                                    className="font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-[10.5px]"
                                    title={`Jumbo Reel #${idx + 1}`}
                                  >
                                    {r}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </td>

                        {/* Paper Brand */}
                        <td className="p-3 font-extrabold text-slate-900">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{j.paperBrand || 'ITC'}</span>
                          </span>
                        </td>

                        {/* GSM */}
                        <td className="p-3">
                          <span className="font-extrabold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                            {j.gsm || j.targetGsm || '-'}
                          </span>
                        </td>

                        {/* Available Stock Qty */}
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl font-black text-xs shadow-2xs">
                            <span>{qty}</span>
                            <span className="font-bold text-[11px] text-emerald-700">
                              {stageConfig.unit}
                            </span>
                          </div>
                        </td>

                        {/* Estimated Pieces */}
                        <td className="p-3 text-right font-black text-slate-800">
                          ~{pieces.toLocaleString()} Pcs
                        </td>

                        {/* Specifications & Remarks */}
                        <td className="p-3 text-slate-600 text-[11px] max-w-[200px]">
                          <div className="font-medium truncate" title={j.customRemark || 'Standard food-grade production'}>
                            {j.customRemark || 'Standard Food Grade'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Stage: <b className="text-slate-700">{j.stage || 'In Process'}</b>
                          </div>
                        </td>

                        {/* Action / View Batch Report */}
                        <td className="p-3 text-center">
                          {onOpenBatchReport ? (
                            <button
                              onClick={() => onOpenBatchReport(j.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg transition cursor-pointer"
                              title={`View full traceability report for ${j.id}`}
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Report</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">{j.id}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer Total Row */}
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-black text-xs text-slate-900">
                  <tr>
                    <td className="p-3" colSpan={4}>
                      Total {product} in {stageConfig.name} ({filteredJobs.length} Job Lots):
                    </td>
                    <td className="p-3 text-center text-emerald-900 font-black text-sm">
                      {filteredJobs.reduce((sum, j) => sum + getJobQty(j), 0)} {stageConfig.unit}
                    </td>
                    <td className="p-3 text-right text-slate-900 font-black">
                      ~
                      {(
                        filteredJobs.reduce((sum, j) => sum + getJobQty(j), 0) *
                        stageConfig.estPcsPerUnit
                      ).toLocaleString()}{' '}
                      Pcs
                    </td>
                    <td className="p-3" colSpan={2}>
                      <span className="text-[11px] text-slate-500 font-medium">
                        100% Traceable on Factory Floor
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )
          )}
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              Real-time Factory Floor Inventory Audit • {new Date().toLocaleDateString('en-GB')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={totalQty === 0}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Download Excel/CSV</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#1a365d] hover:bg-[#2a4365] text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
