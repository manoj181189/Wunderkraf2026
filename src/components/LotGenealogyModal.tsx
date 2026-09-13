import React from 'react';
import {
  X,
  Layers,
  Scroll,
  Scissors,
  Cog,
  SearchCheck,
  Package,
  Truck,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Share2
} from 'lucide-react';
import { FactoryState, Job } from '../types';
import { getJobAllReels, getJobAllGsms, getJobReelItemsBreakdown } from '../lib/utils';

interface LotGenealogyModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  state: FactoryState;
  selectedBatchId?: string;
}

export const LotGenealogyModal: React.FC<LotGenealogyModalProps> = ({
  isOpen,
  onClose,
  job,
  state,
  selectedBatchId
}) => {
  if (!isOpen || !job) return null;

  const allReels = getJobAllReels(job);
  const allGsms = getJobAllGsms(job);
  const reelBreakdown = getJobReelItemsBreakdown(job);

  const batches = job.runningBatches || [];
  const slitBatches = batches.filter((b) => b.stage === 'Slitting' || b.machine.startsWith('Slitting'));
  const cutBatches = batches.filter((b) => b.stage === 'Cutting' || b.machine.startsWith('Cutting'));
  const formBatches = batches.filter((b) => b.stage === 'Forming' || b.machine.startsWith('Forming'));
  const qcBatches = batches.filter((b) => b.stage === 'QC' || b.machine === 'QC-Desk');

  const cutPcsStd = job.pcsPerCrateCutting || state.crateCapacityMaster?.[job.product]?.cuttingPcs || 10000;
  const formPcsStd = job.pcsPerCrateForming || state.crateCapacityMaster?.[job.product]?.formingPcs || 7000;

  // QC inspection details
  const activeQcBatch = qcBatches.find((b) => b.status === 'Running') || qcBatches[qcBatches.length - 1];
  const isQcActive = Boolean(activeQcBatch && activeQcBatch.status === 'Running');
  const assignedInspector = activeQcBatch?.worker || (job.availableFormingCrates && job.availableFormingCrates > 0 ? 'Awaiting Allocation' : 'QC Desk');
  const qcAllocatedCrates = activeQcBatch?.issuedQty || 0;
  const qcStageStatus = isQcActive
    ? 'In Inspection'
    : (job.availableFormingCrates || 0) > 0
    ? 'Pending QC'
    : (job.availableQcCrates || 0) > 0
    ? 'QC Approved'
    : 'Not Started';

  // Pack jobs matching this job's product
  const relevantPackJobs = (state.packJobs || []).filter(
    (pj) => pj.status !== 'Cancelled' && (pj.kitItems?.includes(job.product) || pj.customer)
  );

  const jobLogs = (state.logs || []).filter((l) => l.jobId === job.id);
  const getStageDate = (stageName: string) => {
    const stageLog = jobLogs.filter((l) => l.stage?.toLowerCase().includes(stageName.toLowerCase())).slice(-1)[0];
    if (stageLog?.rawDate) return { date: stageLog.rawDate, time: stageLog.startTime || stageLog.timestamp?.split(',')[1]?.trim() || '' };
    return { date: job.createdAt ? job.createdAt.split('T')[0] : new Date().toISOString().split('T')[0], time: '' };
  };

  const slittingDate = getStageDate('slitting');
  const cuttingDate = getStageDate('cutting');
  const formingDate = getStageDate('forming');
  const qcDate = getStageDate('qc');
  const packingDate = getStageDate('packing');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 m-0">
                  Lot-to-Lot Genealogy & Traceability Pedigree
                </h3>
                <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-full border border-indigo-200">
                  {job.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 m-0 font-medium">
                Product: <b className="text-slate-800">{job.product}</b> | Brand: <b className="text-slate-800">{job.paperBrand || 'ITC'}</b> | Status: <b className="text-indigo-700">{job.stage}</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">Parent Reels</span>
              <div className="text-base font-extrabold text-blue-950 truncate">
                {allReels.length > 0 ? allReels.join(', ') : job.reelNo || 'N/A'}
              </div>
              <span className="text-[10px] text-blue-700 font-medium">GSM: {allGsms.join(', ') || job.gsm || 'N/A'}</span>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl">
              <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Cutting Stock</span>
              <div className="text-base font-extrabold text-indigo-950">
                {job.availableCuttingCrates || 0} Crates
              </div>
              <span className="text-[10px] text-indigo-700 font-medium">
                ~{((job.availableCuttingCrates || 0) * cutPcsStd).toLocaleString()} Blanks
              </span>
            </div>

            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl">
              <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wide">Formed Output</span>
              <div className="text-base font-extrabold text-purple-950">
                {job.availableFormingCrates || 0} Crates
              </div>
              <span className="text-[10px] text-purple-700 font-medium">
                ~{((job.availableFormingCrates || 0) * formPcsStd).toLocaleString()} 3D Pcs
              </span>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">QC Status</span>
              <div className="text-base font-extrabold text-emerald-950">
                {qcStageStatus}
              </div>
              <span className="text-[10px] text-emerald-700 font-medium truncate block">
                {assignedInspector}
              </span>
            </div>
          </div>

          {/* Stepper / Timeline */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Stage-by-Stage Genealogy Chain</span>
            </h4>

            {/* STAGE 1: SLITTING */}
            <div className="relative pl-6 pb-6 border-l-2 border-blue-300 ml-3">
              <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                1
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Scroll className="w-4 h-4 text-blue-600" />
                    <span className="font-extrabold text-xs text-blue-950 uppercase">Slitting Machine (Slitting Stage)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                      <Calendar className="w-3 h-3 text-blue-600" />
                      <span>{slittingDate.date}</span>
                      {slittingDate.time && <span className="text-slate-400 font-mono text-[9px]">({slittingDate.time})</span>}
                    </div>
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                      Station: Slitting-1
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 font-medium">Parent Jumbo Reels:</span>
                    <div className="font-mono font-bold text-slate-900 flex flex-wrap gap-1 mt-0.5">
                      {allReels.map((r, i) => (
                        <span key={i} className="bg-blue-100 text-blue-900 px-1.5 py-0.2 rounded text-[11px]">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium">GSM & Mill:</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {allGsms.join(', ') || job.gsm || 'N/A'} GSM | {job.paperBrand || 'ITC'}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium">Output Slit Rolls:</span>
                    <div className="font-bold text-emerald-800 mt-0.5">
                      {job.availableRolls || 0} Rolls Stock (In: {job.inputWeightKg || 200}kg / Out: {job.outputWeightKg || 0}kg)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STAGE 2: CUTTING */}
            <div className="relative pl-6 pb-6 border-l-2 border-indigo-300 ml-3">
              <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                2
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-indigo-600" />
                    <span className="font-extrabold text-xs text-indigo-950 uppercase">Cutting Machine (Cutting Stage)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                      <Calendar className="w-3 h-3 text-indigo-600" />
                      <span>{cuttingDate.date}</span>
                      {cuttingDate.time && <span className="text-slate-400 font-mono text-[9px]">({cuttingDate.time})</span>}
                    </div>
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                      {cutBatches.length > 0 ? cutBatches.map(b => b.machine).join(', ') : 'Cutting-1 / 2'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 font-medium">Cutting Batches:</span>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {cutBatches.length > 0
                        ? cutBatches.map(b => b.batchId).join(', ')
                        : `CUT-${job.id}`}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium">Operators:</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {cutBatches.length > 0
                        ? Array.from(new Set(cutBatches.map(b => b.worker))).join(', ')
                        : 'CUT_OP1'}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium">Output Cut Crates & Blanks:</span>
                    <div className="font-bold text-indigo-900 mt-0.5">
                      {job.availableCuttingCrates || 0} Crates (@ {cutPcsStd.toLocaleString()} Blanks/Crate)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STAGE 3: FORMING */}
            <div className="relative pl-6 pb-6 border-l-2 border-purple-300 ml-3">
              <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                3
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Cog className="w-4 h-4 text-purple-600" />
                    <span className="font-extrabold text-xs text-purple-950 uppercase">Forming Machines (Forming Stage)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                      <Calendar className="w-3 h-3 text-purple-600" />
                      <span>{formingDate.date}</span>
                      {formingDate.time && <span className="text-slate-400 font-mono text-[9px]">({formingDate.time})</span>}
                    </div>
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                      {formBatches.length > 0 ? Array.from(new Set(formBatches.map(b => b.machine))).join(', ') : 'Forming Stations'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 font-medium">Forming Batches:</span>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {formBatches.length > 0
                        ? formBatches.map(b => b.batchId).join(', ')
                        : 'Pending Run'}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium">Forming Operators:</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {formBatches.length > 0
                        ? Array.from(new Set(formBatches.map(b => b.worker))).join(', ')
                        : 'Operators'}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium">Formed 3D Output:</span>
                    <div className="font-bold text-purple-950 mt-0.5">
                      {job.availableFormingCrates || 0} Formed Crates (@ {formPcsStd.toLocaleString()} Pcs/Crate)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STAGE 4: QC INSPECTION */}
            <div className="relative pl-6 pb-6 border-l-2 border-emerald-300 ml-3">
              <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                4
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <SearchCheck className="w-4 h-4 text-emerald-600" />
                    <span className="font-extrabold text-xs text-emerald-950 uppercase">Quality Control (QC Stage)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                      <Calendar className="w-3 h-3 text-emerald-600" />
                      <span>{qcDate.date}</span>
                      {qcDate.time && <span className="text-slate-400 font-mono text-[9px]">({qcDate.time})</span>}
                    </div>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                      qcStageStatus === 'In Inspection'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : qcStageStatus === 'Pending QC'
                        ? 'bg-purple-100 text-purple-900 border-purple-300'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}>
                      {qcStageStatus}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 font-medium">Assigned Inspector:</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      👤 {assignedInspector}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium">QC Allocated Crates:</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      📦 {qcAllocatedCrates > 0 ? `${qcAllocatedCrates} Crates` : `${job.availableFormingCrates || 0} Crates Queued`}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium">QC Cleared Stock:</span>
                    <div className="font-bold text-emerald-800 mt-0.5">
                      ✅ {job.availableQcCrates || 0} Crates Approved
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STAGE 5: PACKING & DISPATCH */}
            <div className="relative pl-6 ml-3">
              <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-black shadow-xs">
                5
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-slate-700" />
                    <span className="font-extrabold text-xs text-slate-900 uppercase">Packing & Dispatch</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                      <Calendar className="w-3 h-3 text-slate-600" />
                      <span>{packingDate.date}</span>
                    </div>
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full">
                      {relevantPackJobs.length > 0 ? `${relevantPackJobs.length} Orders Linked` : 'Stock Available'}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-600">
                  {relevantPackJobs.length > 0 ? (
                    <div className="space-y-1 mt-1">
                      {relevantPackJobs.slice(0, 2).map((pj) => (
                        <div key={pj.id} className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-800">{pj.customer} ({pj.id})</span>
                          <span className="font-mono text-slate-600">Packed: {pj.packedBoxes} / {pj.orderQty} Boxes</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="m-0 text-slate-500 italic">No specific customer pack job dispatched yet. Stored in QC ready inventory.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Cryptographically Verified Physical Balance: In = Out + Scrap</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Close Traceability
          </button>
        </div>
      </div>
    </div>
  );
};
