import React, { useState } from 'react';
import { ArrowLeft, SearchCheck, Play, Pause, Square, Zap, Undo2, XCircle, Check, Layers, AlertCircle } from 'lucide-react';
import { FactoryState, Job, ProductType, RunningBatch } from '../../types';
import { PRODUCTS, DEPT_WORKERS } from '../../lib/constants';
import { getCurrentExpectedShift } from '../../lib/utils';

interface QCViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  onOpenHoldModal: (machineName: string) => void;
}

export const QCView: React.FC<QCViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onOpenHoldModal
}) => {
  const { jobs, shiftConfig } = state;
  const qcWorkers = state.deptWorkers?.['QC'] || DEPT_WORKERS['QC'] || ['QC_RAMESH', 'QC_DINESH', 'QC_ANIL'];

  const [filterProduct, setFilterProduct] = useState<string>('');
  const [shift, setShift] = useState<'DAY' | 'NIGHT'>(() => getCurrentExpectedShift(shiftConfig));
  const [inspectorName, setInspectorName] = useState(qcWorkers[0] || 'QC_RAMESH');
  const [selectedPendingJobId, setSelectedPendingJobId] = useState('');
  const [issueCratesQty, setIssueCratesQty] = useState('');

  const [outputApprovedCrates, setOutputApprovedCrates] = useState('');
  const [scrapKg, setScrapKg] = useState('0');
  const [selectedActiveBatchId, setSelectedActiveBatchId] = useState('');

  // Dialog states for Quick Actions (Replacing window.prompt to work 100% reliably in iframe)
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardQtyInput, setForwardQtyInput] = useState('');

  const [isUnissueModalOpen, setIsUnissueModalOpen] = useState(false);
  const [unissueQtyInput, setUnissueQtyInput] = useState('');

  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  // Formed crates queue
  let pendingFormedJobs = jobs.filter((j) => (j.availableFormingCrates || 0) > 0);
  if (filterProduct) {
    pendingFormedJobs = pendingFormedJobs.filter((j) => j.product === filterProduct);
  }

  const selectedPendingJob = jobs.find((j) => j.id === selectedPendingJobId);

  // Active QC batches
  const activeBatches: Array<{ job: Job; batch: RunningBatch }> = [];
  jobs.forEach((j) => {
    if (j.runningBatches) {
      j.runningBatches.forEach((b) => {
        if ((b.stage === 'QC' || b.machine === 'QC-Desk') && (b.status === 'Running' || b.status === 'Held')) {
          activeBatches.push({ job: j, batch: b });
        }
      });
    }
  });

  const activeBatchObj =
    activeBatches.find((item) => item.batch?.batchId === selectedActiveBatchId) || activeBatches[0];

  const handleStartInspection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectorName.trim()) {
      alert('⚠️ Mandatory: QC Inspector Name is required!');
      return;
    }
    if (!selectedPendingJobId) {
      alert('Please select a Formed Crates Job from queue!');
      return;
    }
    const cratesCount = parseInt(issueCratesQty, 10) || 0;
    if (cratesCount <= 0) {
      alert('Please enter valid crates quantity to inspect!');
      return;
    }

    const job = jobs.find((j) => j.id === selectedPendingJobId);
    if (!job || (job.availableFormingCrates || 0) < cratesCount) {
      alert(`Insufficient formed crates! Available: ${job?.availableFormingCrates || 0}`);
      return;
    }

    const batchId = 'B-' + Math.floor(1000 + Math.random() * 9000);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newBatch: RunningBatch = {
      batchId,
      stage: 'QC',
      machine: 'QC-Desk',
      shift,
      startTime: nowTime,
      status: 'Running',
      issuedQty: cratesCount,
      producedQty: 0,
      worker: inspectorName.trim().toUpperCase(),
      user: 'qc_user'
    };

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        availableFormingCrates: (j.availableFormingCrates || 0) - cratesCount,
        runningBatches: [...(j.runningBatches || []), newBatch]
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'QC',
      machine: 'QC-Desk',
      shift,
      action: `Started QC Inspection on QC-Desk (${cratesCount} Crates Issued) | Inspector: ${inspectorName.toUpperCase()}`,
      worker: inspectorName.toUpperCase(),
      user: 'qc_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    setIssueCratesQty('');
    setSelectedPendingJobId('');
    setSelectedActiveBatchId(batchId);
    alert(`✅ QC Inspection Started for Job ${job.id} (${cratesCount} Crates Issued)!`);
  };

  const handleConfirmForwardPartial = () => {
    if (!activeBatchObj) return;
    const qty = parseInt(forwardQtyInput, 10) || 0;
    if (qty <= 0) {
      alert('Please enter a valid crates quantity to forward!');
      return;
    }

    const { job, batch } = activeBatchObj;
    const curIssued = batch.issuedQty || 0;
    if (qty > curIssued) {
      alert(`Cannot forward more than currently inspected batch qty (${curIssued} Crates)!`);
      return;
    }

    const remainingQty = curIssued - qty;

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        availableQcCrates: (j.availableQcCrates || 0) + qty,
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return {
            ...b,
            issuedQty: remainingQty,
            producedQty: (b.producedQty || 0) + qty
          };
        })
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'QC Forward',
      machine: 'QC-Desk',
      shift: batch.shift,
      action: `⚡ Partial Forward: ${qty} QC Approved Crates passed to Stock (Remaining under check: ${remainingQty})`,
      worker: batch.worker,
      user: 'qc_user',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    setIsForwardModalOpen(false);
    setForwardQtyInput('');
    alert(`✅ Success! Passed ${qty} QC Approved Crates to Finished Stock. Remaining under inspection: ${remainingQty} Crates.`);
  };

  const handleConfirmQuickUnissue = () => {
    if (!activeBatchObj) return;
    const qty = parseInt(unissueQtyInput, 10) || 0;
    if (qty <= 0) {
      alert('Please enter a valid quantity of crates to return!');
      return;
    }

    const { job, batch } = activeBatchObj;
    const curIssued = batch.issuedQty || 0;
    if (qty > curIssued) {
      alert(`Cannot un-issue more than currently issued crates count (${curIssued})!`);
      return;
    }

    const remaining = curIssued - qty;

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      const updatedBatches = (j.runningBatches || [])
        .map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return { ...b, issuedQty: remaining };
        })
        .filter((b) => (b.issuedQty || 0) > 0 || (b.producedQty || 0) > 0);

      return {
        ...j,
        availableFormingCrates: (j.availableFormingCrates || 0) + qty,
        runningBatches: updatedBatches
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'QC Un-issue',
      machine: 'QC-Desk',
      shift: batch.shift,
      action: `↩️ Issue Return: ${qty} Formed Crates returned back to Forming Stock (Remaining in QC: ${remaining})`,
      worker: batch.worker,
      user: 'qc_user',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    setIsUnissueModalOpen(false);
    setUnissueQtyInput('');
    if (remaining === 0) {
      setSelectedActiveBatchId('');
    }
    alert(`✅ Issue Return Successful! Returned ${qty} Formed Crates back to Forming Stock.`);
  };

  const handleResume = () => {
    if (!activeBatchObj) return alert('Select batch to resume!');
    const { job, batch } = activeBatchObj;
    if (batch.status === 'Running') return alert('Batch is already running.');

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return { ...b, status: 'Running', endTime: undefined, holdReason: undefined };
        })
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'QC',
      machine: 'QC-Desk',
      shift: batch.shift,
      action: `▶️ QC Inspection Resumed to RUNNING | Inspector: ${batch.worker}`,
      worker: batch.worker,
      user: 'qc_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    alert(`▶️ Job [${job.id}] resumed to RUNNING on QC-Desk!`);
  };

  const handleFinish = () => {
    if (!activeBatchObj) return alert('Select batch to pass / finish!');
    const cratesDone = parseInt(outputApprovedCrates, 10) || 0;
    const scrap = parseFloat(scrapKg) || 0;

    const { job, batch } = activeBatchObj;
    const stopTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        availableQcCrates: (j.availableQcCrates || 0) + cratesDone,
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return {
            ...b,
            status: 'Completed',
            endTime: stopTime,
            producedQty: (b.producedQty || 0) + cratesDone,
            scrapKg: scrap
          };
        })
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'QC',
      machine: 'QC-Desk',
      shift: batch.shift,
      action: `⏹️ Completed QC Inspection (${cratesDone} Crates Approved, Scrap: ${scrap} KG)`,
      worker: batch.worker,
      user: 'qc_user',
      startTime: batch.startTime,
      endTime: stopTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    setOutputApprovedCrates('');
    setScrapKg('0');
    setSelectedActiveBatchId('');
    alert(`✅ QC Inspection Finished! Approved ${cratesDone} Crates into Finished Stock.`);
  };

  const handleConfirmCancelRun = () => {
    if (!activeBatchObj) return;
    const { job, batch } = activeBatchObj;
    const cratesToReturn = batch.issuedQty || 0;

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        availableFormingCrates: (j.availableFormingCrates || 0) + cratesToReturn,
        runningBatches: (j.runningBatches || []).filter((b) => b.batchId !== batch.batchId)
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'QC Cancelled',
      machine: 'QC-Desk',
      shift: batch.shift,
      action: `❌ QC Run Cancelled & Reverted: Batch ${batch.batchId} deleted, ${cratesToReturn} crates returned to forming stock.`,
      worker: batch.worker,
      user: 'qc_user',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    setIsCancelConfirmOpen(false);
    setSelectedActiveBatchId('');
    alert(`✅ QC Inspection Cancelled! Returned ${cratesToReturn} Formed Crates back to Stock.`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs mb-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Main Menu</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
            <SearchCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#1a365d] uppercase tracking-wide m-0">
              4. QC Desk (Inspection & Crate Approvals)
            </h3>
            <p className="text-[11px] text-slate-500 m-0">
              Formed Crates Inspection, Scrap Segregation & Approval to Finished Goods
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ACTIVE QC INSPECTION LOTS / STATIONS GRID */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <SearchCheck className="w-4 h-4 text-cyan-600" />
            Active QC Inspection Lots (निरीक्षण लॉट्स):
          </label>
          <span className="text-[11px] font-bold text-slate-500">
            {activeBatches.length} Active Inspection{activeBatches.length === 1 ? '' : 's'} Under Check
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {activeBatches.map(({ job, batch }) => {
            const isSelected = (selectedActiveBatchId || activeBatchObj?.batch.batchId) === batch.batchId;
            return (
              <button
                key={batch.batchId}
                type="button"
                onClick={() => setSelectedActiveBatchId(batch.batchId)}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-cyan-600 bg-cyan-50/70 ring-2 ring-cyan-500/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                    Batch #{batch.batchId}
                  </span>
                  {batch.status === 'Running' ? (
                    <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> INSPECTING
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold text-orange-800 bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Pause className="w-2.5 h-2.5 fill-orange-600" /> HELD
                    </span>
                  )}
                </div>

                <div className="space-y-0.5 text-xs">
                  <div className="font-extrabold text-blue-950 truncate">{job.id} - {job.product}</div>
                  <div className="text-slate-600 font-semibold">{batch.issuedQty} Crates Under Check</div>
                  <div className="text-cyan-700 font-bold">
                    Inspector: {batch.worker} ({batch.shift || 'DAY'})
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-2 pt-1 border-t border-cyan-200/80 flex items-center justify-between text-[10px] font-extrabold text-cyan-700">
                    <span>Active Selected Lot</span>
                    <Check className="w-3.5 h-3.5 text-cyan-700" />
                  </div>
                )}
              </button>
            );
          })}

          {activeBatches.length === 0 && (
            <div className="col-span-full p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 text-center">
              ⚪ No active QC inspections running. Issue formed crates below to start inspecting.
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* ACTIVE QC BATCH CONTROLS & DESK ACTIONS */}
      {/* ======================================================== */}
      {activeBatchObj && (
        <div className="border-t border-slate-200 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
              <Layers className="w-4 h-4 text-cyan-600" />
              Active Inspection Controls: [{activeBatchObj.job.id} - Batch {activeBatchObj.batch.batchId}]
            </h4>
            <span
              className={`text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1 ${
                activeBatchObj.batch.status === 'Held'
                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
              }`}
            >
              {activeBatchObj.batch.status === 'Held' ? (
                <>
                  <Pause className="w-3 h-3 fill-orange-700" /> HELD / PAUSED
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-emerald-700" /> ACTIVE INSPECTION
                </>
              )}
            </span>
          </div>

          <div className="p-4 bg-gradient-to-br from-slate-50 to-cyan-50/40 border border-slate-200 rounded-xl space-y-2.5 text-xs shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 flex-wrap gap-2">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Inspection Job:</span>
                <span className="font-extrabold text-sm text-blue-950">
                  {activeBatchObj.job.id} — <span className="text-slate-800">{activeBatchObj.job.product}</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Paper Brand:</span>
                <span className="font-bold text-slate-800">{activeBatchObj.job.paperBrand || 'ITC'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 bg-white/80 p-2.5 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Inspector:</span>
                <b>{activeBatchObj.batch.worker}</b> ({activeBatchObj.batch.shift || 'DAY'})
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Start Time:</span>
                <b>{activeBatchObj.batch.startTime || '-'}</b>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Currently Under Check:</span>
                <b className="text-cyan-700 text-sm">{activeBatchObj.batch.issuedQty} Crates</b>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status:</span>
                <b className={activeBatchObj.batch.status === 'Held' ? 'text-orange-700' : 'text-emerald-700'}>
                  {activeBatchObj.batch.status.toUpperCase()}
                </b>
              </div>
            </div>

            {activeBatchObj.batch.holdReason && (
              <div className="text-orange-800 font-bold bg-orange-100 border border-orange-300 p-2 rounded-lg flex items-center gap-2">
                <Pause className="w-4 h-4 text-orange-700 shrink-0" />
                <span>Hold Reason: {activeBatchObj.batch.holdReason}</span>
              </div>
            )}
          </div>

          {/* Output and scrap entries */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-emerald-800 uppercase mb-1">
                  Passed / Approved QC Crates Output (पास क्रेट्स):
                </label>
                <input
                  type="number"
                  value={outputApprovedCrates}
                  onChange={(e) => setOutputApprovedCrates(e.target.value)}
                  placeholder="e.g. 6 Crates"
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-rose-700 uppercase mb-1">
                  Rejected Scrap (KG) (रिजेक्ट स्क्रैप वजन):
                </label>
                <input
                  type="number"
                  value={scrapKg}
                  onChange={(e) => setScrapKg(e.target.value)}
                  placeholder="e.g. 1.5 KG"
                  className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setForwardQtyInput(String(activeBatchObj.batch.issuedQty || '1'));
                  setIsForwardModalOpen(true);
                }}
                className="py-2.5 bg-[#805ad5] hover:bg-[#6b46c1] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                title="Forward partial approved crates to stock"
              >
                <Zap className="w-3.5 h-3.5" /> Forward Partial
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnissueQtyInput(String(activeBatchObj.batch.issuedQty || '1'));
                  setIsUnissueModalOpen(true);
                }}
                className="py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                title="Return issued formed crates back to forming stock"
              >
                <Undo2 className="w-3.5 h-3.5" /> Issue Return
              </button>
              <button
                type="button"
                onClick={() => onOpenHoldModal('QC-Desk')}
                className="py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
              >
                <Pause className="w-3.5 h-3.5" /> Hold / Shift
              </button>
              <button
                type="button"
                onClick={handleResume}
                className="py-2.5 bg-[#319795] hover:bg-[#285e61] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
              >
                <Play className="w-3.5 h-3.5" /> Resume
              </button>
              <button
                type="button"
                onClick={handleFinish}
                className="py-2.5 bg-[#2f855a] hover:bg-[#276749] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
              >
                <Square className="w-3.5 h-3.5" /> Pass Crates
              </button>
              <button
                type="button"
                onClick={() => setIsCancelConfirmOpen(true)}
                className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel & Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* START QC INSPECTION FORM */}
      {/* ======================================================== */}
      <div className="border-t border-slate-200 pt-4">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Play className="w-4 h-4 text-cyan-600" />
          Issue Formed Crates & Start QC Inspection:
        </h4>

        <form onSubmit={handleStartInspection} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-cyan-800 uppercase mb-1">
                QC Inspector Name <span className="text-rose-600">*Mandatory</span>:
              </label>
              <input
                type="text"
                list="qcWorkerList"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                placeholder="Type Inspector Name..."
                className="w-full px-3 py-2 bg-white border border-cyan-300 rounded-lg text-xs font-bold uppercase text-slate-800 outline-none"
                required
              />
              <datalist id="qcWorkerList">
                {qcWorkers.map((w) => (
                  <option key={w} value={w} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Working Shift:</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                <option value="DAY">DAY SHIFT</option>
                <option value="NIGHT">NIGHT SHIFT</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-blue-700 uppercase mb-1">
                Filter Queue by Product:
              </label>
              <select
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                <option value="">-- ALL PRODUCTS --</option>
                {PRODUCTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select Formed Crates Queue to Inspect:
            </label>
            <select
              value={selectedPendingJobId}
              onChange={(e) => {
                setSelectedPendingJobId(e.target.value);
                const j = jobs.find((x) => x.id === e.target.value);
                if (j) setIssueCratesQty(String(j.availableFormingCrates || 1));
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
            >
              <option value="">-- SELECT FORMED CRATES QUEUE --</option>
              {pendingFormedJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.id} - {j.product} [{j.paperBrand || 'ITC'}] (Avail: {j.availableFormingCrates} Crates)
                </option>
              ))}
            </select>
          </div>

          {selectedPendingJob && (
            <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-xs font-bold text-cyan-900">
              Available Formed Stock: {selectedPendingJob.availableFormingCrates} Crates [Brand: {selectedPendingJob.paperBrand || 'ITC'}]
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Enter Formed Crates to Inspect (इश्यू क्रेट्स):
            </label>
            <input
              type="number"
              value={issueCratesQty}
              onChange={(e) => setIssueCratesQty(e.target.value)}
              placeholder="Enter Crates Quantity"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!selectedPendingJobId}
            className="w-full py-3 bg-[#2b6cb0] hover:bg-[#1a365d] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start QC Inspection on QC-Desk</span>
          </button>
        </form>
      </div>

      {/* ======================================================== */}
      {/* INLINE MODALS FOR DIALOGS (REPLACING BROWSER PROMPT) */}
      {/* ======================================================== */}

      {/* Forward Partial Modal */}
      {isForwardModalOpen && activeBatchObj && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Zap className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 m-0">Forward Partial QC Approved Crates</h3>
                <p className="text-[11px] text-slate-500 m-0">Pass inspected crates directly to Finished Goods Stock</p>
              </div>
            </div>

            <div className="bg-purple-50 p-3 rounded-xl text-xs space-y-1 text-purple-900">
              <div>Job: <b>{activeBatchObj.job.id}</b> ({activeBatchObj.job.product})</div>
              <div>Currently Under Inspection: <b>{activeBatchObj.batch.issuedQty} Crates</b></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Enter Approved Crates to Forward:
              </label>
              <input
                type="number"
                min="1"
                max={activeBatchObj.batch.issuedQty}
                value={forwardQtyInput}
                onChange={(e) => setForwardQtyInput(e.target.value)}
                className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm font-bold text-slate-800 outline-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsForwardModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmForwardPartial}
                className="px-4 py-2 text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 rounded-xl cursor-pointer shadow-xs flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> Confirm Forward
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Un-issue Modal */}
      {isUnissueModalOpen && activeBatchObj && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Undo2 className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 m-0">Issue Return (Un-issue Formed Crates)</h3>
                <p className="text-[11px] text-slate-500 m-0">Return excess or un-inspected crates back to Forming Stock</p>
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl text-xs space-y-1 text-amber-900">
              <div>Job: <b>{activeBatchObj.job.id}</b> ({activeBatchObj.job.product})</div>
              <div>Currently in QC Desk: <b>{activeBatchObj.batch.issuedQty} Crates</b></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Enter Crates Quantity to Return:
              </label>
              <input
                type="number"
                min="1"
                max={activeBatchObj.batch.issuedQty}
                value={unissueQtyInput}
                onChange={(e) => setUnissueQtyInput(e.target.value)}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm font-bold text-slate-800 outline-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsUnissueModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmQuickUnissue}
                className="px-4 py-2 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer shadow-xs flex items-center gap-1"
              >
                <Undo2 className="w-4 h-4" /> Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Run & Revert Confirm Modal */}
      {isCancelConfirmOpen && activeBatchObj && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-rose-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-rose-100 pb-3">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <div>
                <h3 className="text-sm font-extrabold text-rose-950 m-0">Cancel QC Inspection & Revert</h3>
                <p className="text-[11px] text-slate-500 m-0">Safely cancel this inspection run and restore crates</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5 text-rose-900">
              <div>Are you sure you want to cancel QC Batch <b>#{activeBatchObj.batch.batchId}</b> for Job <b>{activeBatchObj.job.id}</b>?</div>
              <div className="font-extrabold text-rose-950 bg-white/80 p-2 rounded-lg border border-rose-200">
                📦 {activeBatchObj.batch.issuedQty || 0} Formed Crates will be returned to Forming Stock immediately.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelConfirmOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Keep Running
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelRun}
                className="px-4 py-2 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer shadow-xs flex items-center gap-1"
              >
                <XCircle className="w-4 h-4" /> Cancel & Return All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
