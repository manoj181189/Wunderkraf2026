import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Play, Pause, Square, XCircle, Plus, AlertCircle, Check } from 'lucide-react';
import { FactoryState, Job, ProductType, RunningBatch } from '../../types';
import { PRODUCTS, PAPER_BRANDS, DEPT_WORKERS } from '../../lib/constants';
import { getCurrentExpectedShift } from '../../lib/utils';

interface SlittingViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  onOpenHoldModal: (machineName: string) => void;
  onOpenVoiceModalForTarget?: (callback: (text: string) => void) => void;
}

export const SlittingView: React.FC<SlittingViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onOpenHoldModal,
  onOpenVoiceModalForTarget
}) => {
  const { jobs, seriesConfig, shiftConfig } = state;
  const slitWorkers = state.deptWorkers?.['Slitting'] || DEPT_WORKERS['Slitting'] || ['SLIT_RAMESH', 'SLIT_SURESH'];

  const [product, setProduct] = useState<ProductType>('Spoon');
  const [paperBrand, setPaperBrand] = useState(PAPER_BRANDS[0]);
  const [operatorName, setOperatorName] = useState(slitWorkers[0] || 'SLIT_RAMESH');
  const [shift, setShift] = useState<'DAY' | 'NIGHT'>(() => getCurrentExpectedShift(shiftConfig));
  const [reelRemarks, setReelRemarks] = useState('');

  const [outputRolls, setOutputRolls] = useState('');
  const [outputWeightKg, setOutputWeightKg] = useState('');
  const [selectedActiveBatchId, setSelectedActiveBatchId] = useState('');

  // Modals
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isAddReelModalOpen, setIsAddReelModalOpen] = useState(false);
  const [addReelJobId, setAddReelJobId] = useState('');
  const [addReelWorker, setAddReelWorker] = useState(slitWorkers[0] || 'SLIT_RAMESH');

  // Find all active / held batches on Slitting-1
  const activeBatches: Array<{ job: Job; batch: RunningBatch }> = [];
  jobs.forEach((j) => {
    if (j.runningBatches) {
      j.runningBatches.forEach((b) => {
        if (b.machine === 'Slitting-1' && (b.status === 'Running' || b.status === 'Held')) {
          activeBatches.push({ job: j, batch: b });
        }
      });
    }
  });

  const activeBatchObj =
    activeBatches.find((item) => item.batch?.batchId === selectedActiveBatchId) || activeBatches[0];

  const handleStartNewReel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorName.trim()) {
      alert('⚠️ Mandatory: Operator Name is required!');
      return;
    }

    const runningCount = activeBatches.filter((b) => b.batch.status === 'Running').length;
    if (runningCount >= 2) {
      alert('⚠️ Maximum 2 concurrent slitting reels can run at once. Finish or hold one first.');
      return;
    }

    let prefix = 'SPN-';
    if (product === 'Fork') prefix = 'FRK-';
    else if (product === 'Knife') prefix = 'KNF-';
    else if (product === 'Dessert Spoon') prefix = 'DSP-';

    const currentSeq = seriesConfig.productSeqs[product] || 1;
    const formattedSeq = String(currentSeq).padStart(3, '0');
    const newJobId = `${prefix}${formattedSeq}`;

    const batchId = 'B-' + Math.floor(1000 + Math.random() * 9000);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newBatch: RunningBatch = {
      batchId,
      stage: 'Slitting',
      machine: 'Slitting-1',
      shift,
      startTime: nowTime,
      status: 'Running',
      issuedQty: 1,
      producedQty: 0,
      outputWeightKg: 0,
      worker: operatorName.trim().toUpperCase(),
      user: 'slit_user'
    };

    const newJob: Job = {
      id: newJobId,
      product,
      paperBrand,
      customRemark: reelRemarks.trim(),
      stage: 'Slitting',
      availableRolls: 0,
      availableCuttingCrates: 0,
      availableFormingCrates: 0,
      availableQcCrates: 0,
      runningBatches: [newBatch]
    };

    const newLog = {
      jobId: newJobId,
      product,
      stage: 'Slitting',
      machine: 'Slitting-1',
      shift,
      action: `🚀 Started New Slitting Reel on ${paperBrand} (${reelRemarks || 'Standard Reel'}) | Worker: ${operatorName.toUpperCase()}`,
      worker: operatorName.toUpperCase(),
      user: 'slit_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    const nextSeqs = {
      ...seriesConfig.productSeqs,
      [product]: currentSeq + 1
    };

    onSaveState({
      ...state,
      jobs: [newJob, ...state.jobs],
      logs: [...state.logs, newLog],
      seriesConfig: {
        ...seriesConfig,
        productSeqs: nextSeqs
      }
    });

    setReelRemarks('');
    setSelectedActiveBatchId(batchId);
    alert(`✅ New Slitting Reel Started: Job ID [${newJobId}] (Batch ${batchId}) on Slitting-1!`);
  };

  const handleConfirmAddReelToJob = () => {
    if (!addReelJobId) {
      alert('Please select an existing Job ID!');
      return;
    }
    const targetJob = jobs.find((j) => j.id === addReelJobId);
    if (!targetJob) {
      alert(`Job [${addReelJobId}] not found in database!`);
      return;
    }
    if (!addReelWorker.trim()) {
      alert('Please enter operator name!');
      return;
    }

    const batchId = 'B-' + Math.floor(1000 + Math.random() * 9000);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newBatch: RunningBatch = {
      batchId,
      stage: 'Slitting',
      machine: 'Slitting-1',
      shift,
      startTime: nowTime,
      status: 'Running',
      issuedQty: 1,
      producedQty: 0,
      outputWeightKg: 0,
      worker: addReelWorker.trim().toUpperCase(),
      user: 'slit_user'
    };

    const updatedJobs = jobs.map((j) => {
      if (j.id !== targetJob.id) return j;
      return {
        ...j,
        runningBatches: [...(j.runningBatches || []), newBatch]
      };
    });

    const newLog = {
      jobId: targetJob.id,
      product: targetJob.product,
      stage: 'Slitting Re-open',
      machine: 'Slitting-1',
      shift,
      action: `➕ Added New Batch/Reel to Existing Job ${targetJob.id} | Worker: ${addReelWorker.toUpperCase()}`,
      worker: addReelWorker.toUpperCase(),
      user: 'slit_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    setIsAddReelModalOpen(false);
    setSelectedActiveBatchId(batchId);
    alert(`✅ Added Batch ${batchId} to existing job [${targetJob.id}]!`);
  };

  const handleResumeSlitting = () => {
    if (!activeBatchObj) return alert('No active or held slitting batch!');
    const { job, batch } = activeBatchObj;
    if (batch.status === 'Running') return alert('This job is already running on Slitting-1.');

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
      stage: 'Slitting',
      machine: 'Slitting-1',
      shift: batch.shift,
      action: `▶️ Slitting Resumed from Pause/Hold | Worker: ${batch.worker}`,
      worker: batch.worker,
      user: 'slit_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    alert(`▶️ Slitting Job [${job.id}] resumed to RUNNING state!`);
  };

  const handleCompleteSlitting = () => {
    if (!activeBatchObj) return alert('No active slitting batch to finish!');
    const rollsCount = parseInt(outputRolls, 10) || 0;
    const weightKg = parseInt(outputWeightKg, 10) || 0;

    if (rollsCount <= 0) return alert('Please enter output rolls count (at least 1)!');
    if (weightKg <= 0) {
      alert('⚠️ Mandatory Field Missing: Output Weight in KG is required before finishing slitting!');
      return;
    }

    const { job, batch } = activeBatchObj;
    const stopTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        availableRolls: (j.availableRolls || 0) + rollsCount,
        stage: 'Slitting Completed',
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return {
            ...b,
            status: 'Completed',
            endTime: stopTime,
            producedQty: rollsCount,
            outputWeightKg: weightKg
          };
        })
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Slitting',
      machine: 'Slitting-1',
      shift: batch.shift,
      action: `⏹ Slitting Finished (${rollsCount} Rolls, ${weightKg} KG Output)`,
      worker: batch.worker,
      user: 'slit_user',
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

    setOutputRolls('');
    setOutputWeightKg('');
    setSelectedActiveBatchId('');
    alert(`✅ Slitting Finished! ${rollsCount} Rolls (${weightKg} KG) credited to Raw Rolls Inventory.`);
  };

  const handleConfirmCancelRun = () => {
    if (!activeBatchObj) return;
    const { job, batch } = activeBatchObj;

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        runningBatches: (j.runningBatches || []).filter((b) => b.batchId !== batch.batchId)
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Slitting Cancelled',
      machine: 'Slitting-1',
      shift: batch.shift,
      action: `❌ Slitting Run Cancelled & Reverted (Batch ${batch.batchId} deleted)`,
      worker: batch.worker,
      user: 'slit_user',
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
    alert('✅ Slitting run cancelled and batch removed.');
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
          <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#1a365d] uppercase tracking-wide m-0">
              1. Slitting Desk (Jumbo Reel to Slit Rolls)
            </h3>
            <p className="text-[11px] text-slate-500 m-0">
              Jumbo Reel Auto Numbering, Slitting Machine Operations & Rolls Log
            </p>
          </div>
        </div>
      </div>

      {/* Active Batches Selector */}
      {activeBatches.length > 0 && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase">
              Active / Held Slitting Batches on Slitting-1 ({activeBatches.length}):
            </label>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                activeBatchObj?.batch.status === 'Held'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {activeBatchObj?.batch.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeBatches.map(({ job, batch }) => {
              const isSelected = (selectedActiveBatchId || activeBatchObj?.batch.batchId) === batch.batchId;
              return (
                <button
                  key={batch.batchId}
                  type="button"
                  onClick={() => setSelectedActiveBatchId(batch.batchId)}
                  className={`text-left p-3 rounded-lg border text-xs transition cursor-pointer flex justify-between items-center ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 font-bold text-blue-900 shadow-xs ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="font-extrabold">{job.id} — {job.product}</div>
                    <div className="text-slate-500 text-[11px]">
                      Batch #{batch.batchId} | Op: {batch.worker} | Start: {batch.startTime}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      batch.status === 'Held' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {batch.status}
                  </span>
                </button>
              );
            })}
          </div>

          {activeBatchObj && (
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-800 uppercase mb-1">
                    Output Slit Rolls Count (रोल संख्या):
                  </label>
                  <input
                    type="number"
                    value={outputRolls}
                    onChange={(e) => setOutputRolls(e.target.value)}
                    placeholder="e.g. 8 Rolls"
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-800 uppercase mb-1">
                    Output Weight (KG) <span className="text-rose-600">*Mandatory</span>:
                  </label>
                  <input
                    type="number"
                    value={outputWeightKg}
                    onChange={(e) => setOutputWeightKg(e.target.value)}
                    placeholder="e.g. 185 KG"
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenHoldModal('Slitting-1')}
                  className="py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" /> Hold / Shift
                </button>
                <button
                  type="button"
                  onClick={handleResumeSlitting}
                  className="py-2.5 bg-[#319795] hover:bg-[#285e61] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" /> Resume
                </button>
                <button
                  type="button"
                  onClick={handleCompleteSlitting}
                  className="py-2.5 bg-[#2f855a] hover:bg-[#276749] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" /> Finish Slitting
                </button>
                <button
                  type="button"
                  onClick={() => setIsCancelConfirmOpen(true)}
                  className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" /> Cancel Run
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Start New Slitting Reel Form */}
      <form onSubmit={handleStartNewReel} className="space-y-4">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-1">
          Start New Jumbo Reel Slitting:
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Product:</label>
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value as ProductType)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
            >
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Paper Brand / Mill:</label>
            <select
              value={paperBrand}
              onChange={(e) => setPaperBrand(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
            >
              {PAPER_BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Operator Name <span className="text-rose-600">*Mandatory</span>:
            </label>
            <input
              type="text"
              list="slitWorkerList"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Type Operator Name..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase text-slate-800 outline-none"
              required
            />
            <datalist id="slitWorkerList">
              {slitWorkers.map((w) => (
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
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Reel Remarks / GSM (Optional):
          </label>
          <input
            type="text"
            value={reelRemarks}
            onChange={(e) => setReelRemarks(e.target.value)}
            placeholder="e.g. 400 GSM Special Grade, Reel #1024"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 py-3 bg-[#2b6cb0] hover:bg-[#1a365d] text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start Slitting (Auto-Generate Job ID)</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddReelModalOpen(true)}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add to Existing Job</span>
          </button>
        </div>
      </form>

      {/* Add Reel to Existing Job Modal */}
      {isAddReelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Plus className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 m-0">Add Reel to Existing Slitting Job</h3>
                <p className="text-[11px] text-slate-500 m-0">Attach an additional jumbo reel to an open Job ID</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Job ID:</label>
              <select
                value={addReelJobId}
                onChange={(e) => setAddReelJobId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                <option value="">-- SELECT JOB ID --</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.id} - {j.product} [{j.paperBrand || 'ITC'}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Operator Name:</label>
              <input
                type="text"
                list="slitWorkerList"
                value={addReelWorker}
                onChange={(e) => setAddReelWorker(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold uppercase text-slate-800 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddReelModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddReelToJob}
                disabled={!addReelJobId}
                className="px-4 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl cursor-pointer shadow-xs flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> Add Batch & Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Run Confirm Modal */}
      {isCancelConfirmOpen && activeBatchObj && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-rose-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-rose-100 pb-3">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <div>
                <h3 className="text-sm font-extrabold text-rose-950 m-0">Cancel Slitting Run</h3>
                <p className="text-[11px] text-slate-500 m-0">Safely cancel this slitting run and delete batch</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5 text-rose-900">
              <div>Are you sure you want to cancel Slitting Batch <b>#{activeBatchObj.batch.batchId}</b> for Job <b>{activeBatchObj.job.id}</b>?</div>
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
                <XCircle className="w-4 h-4" /> Cancel & Delete Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
