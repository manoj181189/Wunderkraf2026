import { autoRegisterWorker } from '../../lib/workerUtils';
import React, { useState } from 'react';
import { ArrowLeft, SearchCheck, Play, Pause, Square, Zap, Undo2, XCircle, Check, Layers, AlertCircle, PlusCircle, Users, Box, Search, ShieldCheck, Calendar, Clock, CheckCircle2, AlertTriangle, Filter, ArrowUp, ArrowDown, ArrowUpDown, FileSpreadsheet } from 'lucide-react';
import { FactoryState, Job, ProductType, RunningBatch } from '../../types';
import { PRODUCTS, DEPT_WORKERS, DEFAULT_PCS_PER_KG_MAP } from '../../lib/constants';
import { getCurrentExpectedShift, getJobAllReels, getJobAllGsms, calculateCratePieces, calculateDeskBalance } from '../../lib/utils';
import { getNumberingMaster, generateQCInspectionBatchId } from '../../lib/numberingMaster';
import { LotGenealogyModal } from '../LotGenealogyModal';

interface QCViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  onOpenHoldModal: (machineName: string) => void;

  onNavigateToTraceability?: (query: string) => void;
}

export const QCView: React.FC<QCViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onOpenHoldModal,
  onNavigateToTraceability
}) => {
  const { jobs, shiftConfig } = state;
  const qcWorkers = state.deptWorkers?.['QC'] || DEPT_WORKERS['QC'] || ['QC_RAMESH', 'QC_DINESH', 'QC_ANIL'];

  const [filterProduct, setFilterProduct] = useState<string>('');
  const [shift, setShift] = useState<'DAY' | 'NIGHT'>(() => getCurrentExpectedShift(shiftConfig));
  const [inspectorName, setInspectorName] = useState(qcWorkers[0] || 'QC_RAMESH');
  const [selectedPendingJobId, setSelectedPendingJobId] = useState('');
  const [issueCratesQty, setIssueCratesQty] = useState('');

  // --- DIRECT APPROVED QC VOUCHER FORM STATE ---
  const [qcFlowMode, setQcFlowMode] = useState<'standard' | 'direct'>('standard');
  const [directJobType, setDirectJobType] = useState<'existing' | 'new'>('new');
  const [directSelectedJobId, setDirectSelectedJobId] = useState('');
  const [directCustomJobId, setDirectCustomJobId] = useState('');
  const [directProduct, setDirectProduct] = useState<ProductType>('Spoon');
  const [directApprovedCrates, setDirectApprovedCrates] = useState('');
  const [directLoosePcs, setDirectLoosePcs] = useState('0');
  const [directScrapKg, setDirectScrapKg] = useState('0');
  const [directRemarks, setDirectRemarks] = useState('');

  const [outputApprovedCrates, setOutputApprovedCrates] = useState('');
  const [loosePiecesInput, setLoosePiecesInput] = useState('0');
  const [rejectedPiecesInput, setRejectedPiecesInput] = useState('0');
  const [scrapKg, setScrapKg] = useState('0');
  const [selectedActiveBatchId, setSelectedActiveBatchId] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [colFilters, setColFilters] = useState({
    id: '',
    date: '',
    reel: '',
    gsm: '',
    mill: '',
    product: '',
    remark: '',
    stock: '',
    status: '',
  });

  // Dialog states for Quick Actions (Replacing window.prompt to work 100% reliably in iframe)
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardQtyInput, setForwardQtyInput] = useState('');

  const [isUnissueModalOpen, setIsUnissueModalOpen] = useState(false);
  const [unissueQtyInput, setUnissueQtyInput] = useState('');
  const [unissueTargetLotId, setUnissueTargetLotId] = useState('');

  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  // Top-up Modal state for adding more crates to existing inspector/batch
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [topupQtyInput, setTopupQtyInput] = useState('2');
  const [selectedFormingBatchId, setSelectedFormingBatchId] = useState('');

  // Audit Mismatch Error Modal state
  const [auditMismatchError, setAuditMismatchError] = useState<{
    outputPcs: number;
    outputCrates: number;
    inputPcs: number;
    inputCrates: number;
    scrapPcs?: number;
    details: string;
  } | null>(null);

  // Genealogy Modal state
  const [genealogyModalJob, setGenealogyModalJob] = useState<Job | null>(null);

  // Formed crates queue: Any job with available crates waiting for QC inspection
  let pendingFormedJobs = jobs.filter((j) => ((j.availableForQcCrates || 0) + (j.availableFormingCrates || 0)) > 0);
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
    activeBatches.find((item) => item.batch?.batchId === selectedActiveBatchId) ||
    (activeBatches.length === 1 ? activeBatches[0] : null);

  const effectiveQcPcs = activeBatchObj?.job.pcsPerCrateForming || (activeBatchObj ? state.crateCapacityMaster?.[activeBatchObj.job.product]?.formingPcs : 7000) || 7000;

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
    const totalAvailFormed = (job?.availableForQcCrates || 0) + (job?.availableFormingCrates || 0);
    if (!job || totalAvailFormed < cratesCount) {
      alert(`Insufficient formed crates! Available: ${totalAvailFormed}`);
      return;
    }

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const cleanInspector = inspectorName.trim().toUpperCase();
    const existingBatch = (job.runningBatches || []).find(
      (b) => b.stage === 'QC' && b.status === 'Running' && (b.worker || '').trim().toUpperCase() === cleanInspector
    );

    if (existingBatch) {
      // TOP-UP EXISTING BATCH (Same inspector, same job -> Merge / Top-up crates instead of duplicate entry)
      const prevQty = existingBatch.issuedQty || 0;
      const newTotalQty = prevQty + cratesCount;

      let remDeductTopup = cratesCount;
      const updatedJobs = jobs.map((j) => {
        if (j.id !== job.id) return j;
        const deductForQc = Math.min(j.availableForQcCrates || 0, remDeductTopup);
        const remAfterForQc = remDeductTopup - deductForQc;
        const deductForming = Math.min(j.availableFormingCrates || 0, remAfterForQc);
        const newAvailForQc = Math.max(0, (j.availableForQcCrates || 0) - deductForQc);
        const newAvailForming = Math.max(0, (j.availableFormingCrates || 0) - deductForming);

        let remBatchDeduct = cratesCount;
        const newRunBatches = (j.runningBatches || []).map((b) => {
          if (b.batchId === existingBatch.batchId) {
            return { ...b, issuedQty: newTotalQty };
          }
          if ((b.stage === 'Forming' || b.machine?.startsWith('Forming')) && remBatchDeduct > 0) {
            const totalP = b.producedQty || 0;
            const consumedP = b.consumedQty || 0;
            const remP = Math.max(0, totalP - consumedP);
            if (remP > 0 && (!selectedFormingBatchId || b.batchId === selectedFormingBatchId)) {
              const dec = Math.min(remP, remBatchDeduct);
              remBatchDeduct -= dec;
              return { ...b, consumedQty: consumedP + dec };
            }
          }
          return b;
        });
        return {
          ...j,
          availableForQcCrates: newAvailForQc,
          availableFormingCrates: newAvailForming,
          isReadyForQcInspection: (newAvailForQc + newAvailForming) > 0,
          runningBatches: newRunBatches
        };
      });

      const newLog = {
        jobId: job.id,
        product: job.product,
        stage: 'QC',
        machine: 'QC-Desk',
        shift,
        action: `➕ QC Crate Top-up: Issued +${cratesCount} More Crates to Inspector [${cleanInspector}] on Job [${job.id}] (Total Crates with Inspector: ${newTotalQty} Crates)`,
        worker: cleanInspector,
        user: 'qc_user',
        startTime: nowTime,
        rawDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toLocaleString()
      };

      const { floorWorkers, deptWorkers } = autoRegisterWorker(state, cleanInspector, 'QC', 'QC-Desk', shift);

      onSaveState({
        ...state,
        jobs: updatedJobs,
        floorWorkers,
        deptWorkers,
        logs: [...state.logs, newLog]
      });

      setIssueCratesQty('');
      setSelectedPendingJobId('');
      setSelectedActiveBatchId(existingBatch.batchId);
      alert(
        `✅ Crate Top-up Successful!\n\n` +
        `• Inspector: ${cleanInspector}\n` +
        `• Job: ${job.id} (${job.product})\n` +
        `• Previously: ${prevQty} Crates
` +
        `• Newly Given: +${cratesCount} Crates
` +
        `• Total in Hand: ${newTotalQty} Crates

` +
        `Due to being the same product, a duplicate entry was not created; the quantity has been updated in the existing record.`
      );
      return;
    }

    // Fresh batch when new job or different inspector
    const master = getNumberingMaster(state.seriesConfig);
    const batchId = generateQCInspectionBatchId(job.id, job.runningBatches || [], master);
    const upstreamBatchId = selectedFormingBatchId || job.tracedLots?.Forming || job.tracedLots?.Cutting || job.tracedLots?.Slitting || job.id;

    // Find worker name of selected forming lot for provenance and calculate sourcePcsPerCrate
    let selectedFormingWorker = '';
    const formingBatchesForJob = (job.runningBatches || []).filter(b => b.stage === 'Forming' || b.machine?.startsWith('Forming'));
    let sourcePcsPerCrate = job.pcsPerCrateForming || state.crateCapacityMaster?.[job.product]?.formingPcs || 7000;

    if (selectedFormingBatchId) {
      const bMatch = formingBatchesForJob.find(b => b.batchId === selectedFormingBatchId);
      if (bMatch) {
        if (bMatch.pcsPerCrate) {
          sourcePcsPerCrate = bMatch.pcsPerCrate;
        }
        selectedFormingWorker = bMatch.worker;
      } else {
        for (const b of formingBatchesForJob) {
          const sMatch = (b.slices || []).find(s => s.sliceId === selectedFormingBatchId);
          if (sMatch) {
            if (sMatch.producedPieces && sMatch.producedQty) {
              sourcePcsPerCrate = Math.round(sMatch.producedPieces / sMatch.producedQty);
            }
            selectedFormingWorker = sMatch.operator;
            break;
          }
        }
      }
    } else {
      // Find average forming pcs per crate from all forming batches
      const totalFormedPieces = formingBatchesForJob.reduce((sum, b) => sum + (b.producedPieces || 0), 0);
      const totalFormedCrates = formingBatchesForJob.reduce((sum, b) => sum + (b.producedQty || 0), 0);
      if (totalFormedPieces > 0 && totalFormedCrates > 0) {
        sourcePcsPerCrate = Math.round(totalFormedPieces / totalFormedCrates);
      }
    }

    let inputPieces = Math.round(cratesCount * sourcePcsPerCrate);

    // Dynamic preservation logic: If the operator is issuing the ENTIRE remaining available forming crates of the job,
    // let's issue the EXACT remaining piece count to avoid any decimal or average rounding mismatch!
    const isIssuingAllJobFormedCrates = cratesCount === ((job.availableForQcCrates || 0) + (job.availableFormingCrates || 0));
    const totalFormedPiecesOfJob = job.totalFormedPieces || 0;
    const totalAlreadyIssuedPiecesForQc = (job.runningBatches || []).filter(b => b.stage === 'QC').reduce((sum, b) => sum + (b.inputPieces || 0), 0);
    const remainingFormedPiecesInJob = Math.max(0, totalFormedPiecesOfJob - totalAlreadyIssuedPiecesForQc);

    if (isIssuingAllJobFormedCrates && remainingFormedPiecesInJob > 0) {
      inputPieces = remainingFormedPiecesInJob;
    } else if (selectedFormingBatchId) {
      const specificFormingBatch = (job.runningBatches || []).find(b => b.batchId === selectedFormingBatchId);
      if (specificFormingBatch) {
        const totalP = specificFormingBatch.producedPieces || 0;
        const totalCrates = specificFormingBatch.producedQty || 1;
        const alreadyConsumedCrates = specificFormingBatch.consumedQty || 0;
        const isConsumingAllRemainingFormingCrates = (cratesCount + alreadyConsumedCrates) >= totalCrates;
        if (isConsumingAllRemainingFormingCrates) {
          const alreadyConsumedPieces = (job.runningBatches || [])
            .filter(b => b.stage === 'QC' && b.sourceLotId?.includes(selectedFormingBatchId))
            .reduce((sum, b) => sum + (b.inputPieces || 0), 0);
          const remPieces = Math.max(0, totalP - alreadyConsumedPieces);
          if (remPieces > 0) {
            inputPieces = remPieces;
          }
        }
      }
    }

    const newBatch: RunningBatch = {
      batchId,
      stage: 'QC',
      machine: 'QC-Desk',
      shift,
      startTime: nowTime,
      status: 'Running',
      parentBatchId: upstreamBatchId,
      sourceLotId: selectedFormingBatchId || undefined,
      sourceOperator: selectedFormingWorker || undefined,
      issuedQty: cratesCount,
      producedQty: 0,
      pcsPerCrate: sourcePcsPerCrate,
      inputPieces: inputPieces,
      worker: cleanInspector,
      user: 'qc_user'
    };

    let remDeductFresh = cratesCount;
    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      const deductForQc = Math.min(j.availableForQcCrates || 0, remDeductFresh);
      const remAfterForQc = remDeductFresh - deductForQc;
      const deductForming = Math.min(j.availableFormingCrates || 0, remAfterForQc);
      const newAvailForQc = Math.max(0, (j.availableForQcCrates || 0) - deductForQc);
      const newAvailForming = Math.max(0, (j.availableFormingCrates || 0) - deductForming);

      let remBatchDeduct = cratesCount;
      const modifiedFormBatches = (j.runningBatches || []).map((b) => {
        if ((b.stage === 'Forming' || b.machine?.startsWith('Forming')) && remBatchDeduct > 0) {
          if (b.slices && b.slices.length > 0) {
            const updatedSlices = b.slices.map(slice => {
              if (remBatchDeduct > 0 && (!selectedFormingBatchId || slice.sliceId === selectedFormingBatchId)) {
                const sliceTotal = slice.producedQty || 0;
                const sliceConsumed = slice.consumedQty || 0;
                const sliceRem = Math.max(0, sliceTotal - sliceConsumed);
                if (sliceRem > 0) {
                  const dec = Math.min(sliceRem, remBatchDeduct);
                  remBatchDeduct -= dec;
                  return { ...slice, consumedQty: sliceConsumed + dec };
                }
              }
              return slice;
            });
            const totalConsumed = updatedSlices.reduce((sum, s) => sum + (s.consumedQty || 0), 0);
            return { ...b, consumedQty: totalConsumed, slices: updatedSlices };
          } else {
            const totalP = b.producedQty || 0;
            const consumedP = b.consumedQty || 0;
            const remP = Math.max(0, totalP - consumedP);
            if (remP > 0 && (!selectedFormingBatchId || b.batchId === selectedFormingBatchId)) {
              const dec = Math.min(remP, remBatchDeduct);
              remBatchDeduct -= dec;
              return { ...b, consumedQty: consumedP + dec };
            }
          }
        }
        return b;
      });
      return {
        ...j,
        tracedLots: { ...(j.tracedLots || {}), QC: batchId, Forming: selectedFormingBatchId || j.tracedLots?.Forming },
        availableForQcCrates: newAvailForQc,
        availableFormingCrates: newAvailForming,
        isReadyForQcInspection: (newAvailForQc + newAvailForming) > 0,
        runningBatches: [...modifiedFormBatches, newBatch]
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'QC',
      machine: 'QC-Desk',
      shift,
      action: `Started QC Inspection on QC-Desk (${cratesCount} Crates Issued) | Inspector: ${cleanInspector}`,
      worker: cleanInspector,
      user: 'qc_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    const { floorWorkers, deptWorkers } = autoRegisterWorker(state, cleanInspector, 'QC', 'QC-Desk', shift);

    onSaveState({
      ...state,
      jobs: updatedJobs,
      floorWorkers,
      deptWorkers,
      logs: [...state.logs, newLog]
    });

    setIssueCratesQty('');
    setSelectedPendingJobId('');
    setSelectedActiveBatchId(batchId);
    alert(`✅ QC Inspection Started for Job ${job.id} (${cratesCount} Crates Issued to ${cleanInspector})!`);
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
    const forwardedQcPcs = qty * effectiveQcPcs;

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        availableQcCrates: (j.availableQcCrates || 0) + qty,
        totalQcPieces: (j.totalQcPieces || 0) + forwardedQcPcs,
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return {
            ...b,
            issuedQty: remainingQty,
            producedQty: (b.producedQty || 0) + qty,
            producedPieces: (b.producedPieces || 0) + forwardedQcPcs
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
      action: `⚡ Partial Forward: ${qty} QC Approved Crates (= ${forwardedQcPcs.toLocaleString()} Pieces) passed to Stock (Remaining under check: ${remainingQty})`,
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

  const handleConfirmTopupCrates = (overrideQty?: number) => {
    if (!activeBatchObj) return;
    const { job, batch } = activeBatchObj;
    const addCount = overrideQty !== undefined ? overrideQty : (parseInt(topupQtyInput, 10) || 0);
    if (addCount <= 0) {
      alert('⚠️ Please enter valid crates quantity to add!');
      return;
    }

    const availableStock = (job.availableForQcCrates || 0) + (job.availableFormingCrates || 0);
    if (availableStock < addCount) {
      alert(`⚠️ Insufficient formed stock! Available: ${availableStock} Crates`);
      return;
    }

    const prevQty = batch.issuedQty || 0;
    const newTotal = prevQty + addCount;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      const deductForQc = Math.min(j.availableForQcCrates || 0, addCount);
      const remAfterForQc = addCount - deductForQc;
      const deductForming = Math.min(j.availableFormingCrates || 0, remAfterForQc);
      const newAvailForQc = Math.max(0, (j.availableForQcCrates || 0) - deductForQc);
      const newAvailForming = Math.max(0, (j.availableFormingCrates || 0) - deductForming);

      return {
        ...j,
        availableForQcCrates: newAvailForQc,
        availableFormingCrates: newAvailForming,
        isReadyForQcInspection: (newAvailForQc + newAvailForming) > 0,
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return {
            ...b,
            issuedQty: newTotal
          };
        })
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'QC',
      machine: 'QC-Desk',
      shift: batch.shift || shift,
      action: `➕ QC Crate Top-up: Issued +${addCount} More Crates to Inspector [${batch.worker}] on Job [${job.id}] (Previous: ${prevQty} ➔ Total in Hand: ${newTotal} Crates)`,
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

    setIsTopupModalOpen(false);
    setTopupQtyInput('2');
    alert(
      `✅ Crate Top-up Successful!\n\n` +
      `• Inspector: ${batch.worker}\n` +
      `• Job: ${job.id} (${job.product})\n` +
      `• Added: +${addCount} Crates
` +
      `• Total in Hand Now: ${newTotal} Crates

` +
      `No separate new entry created, total crates ${newTotal} updated in the record.`
    );
  };

  const handleConfirmQuickUnissue = () => {
    if (!activeBatchObj) return;
    const { job, batch } = activeBatchObj;
    const curIssued = batch.issuedQty || 0;
    if (curIssued <= 0) {
      setIsUnissueModalOpen(false);
      setSelectedActiveBatchId('');
      alert('⚠️ This batch has no issued crates left to return.');
      return;
    }
    const qty = parseInt(unissueQtyInput, 10) || 0;
    if (qty > curIssued) {
      alert(`Cannot un-issue more than currently issued crates count (${curIssued})!`);
      return;
    }

    const remaining = curIssued - qty;
    const targetSourceLotId = unissueTargetLotId || batch.sourceLotId || batch.parentBatchId;

    let remAddUnissue = qty;
    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      const updatedBatches = (j.runningBatches || [])
        .map((b) => {
          if (b.batchId === batch.batchId) {
            return { ...b, issuedQty: remaining };
          }
          if ((b.stage === 'Forming' || b.machine?.startsWith('Forming')) && remAddUnissue > 0) {
            if (b.slices && b.slices.length > 0) {
              let restoredFromBatch = 0;
              const targetSliceIds = targetSourceLotId ? targetSourceLotId.split(',').map(s => s.trim()).filter(Boolean) : [];
              
              // Pass 1: Target matching slice
              let updatedSlices = b.slices.map(slice => {
                if (remAddUnissue > 0 && targetSliceIds.length > 0 && targetSliceIds.includes(slice.sliceId)) {
                  const sliceConsumed = slice.consumedQty || 0;
                  const restore = Math.min(sliceConsumed, remAddUnissue);
                  if (restore > 0) {
                    remAddUnissue -= restore;
                    restoredFromBatch += restore;
                    return { ...slice, consumedQty: sliceConsumed - restore };
                  }
                }
                return slice;
              });

              // Pass 2: Fallback in reverse order ONLY if no specific target lot was matched / selected
              if (remAddUnissue > 0 && (!unissueTargetLotId || targetSliceIds.length === 0)) {
                updatedSlices = [...updatedSlices].reverse().map(slice => {
                  if (remAddUnissue > 0) {
                    const sliceConsumed = slice.consumedQty || 0;
                    const restore = Math.min(sliceConsumed, remAddUnissue);
                    if (restore > 0) {
                      remAddUnissue -= restore;
                      restoredFromBatch += restore;
                      return { ...slice, consumedQty: sliceConsumed - restore };
                    }
                  }
                  return slice;
                }).reverse();
              }

              // Pass 3: Target batch level direct/untracked consumption
              let restoredFromBatchLevel = 0;
              if (remAddUnissue > 0) {
                const totalSlicesConsumed = updatedSlices.reduce((sum, s) => sum + (s.consumedQty || 0), 0);
                const untrackedConsumed = Math.max(0, (b.consumedQty || 0) - totalSlicesConsumed);
                if (untrackedConsumed > 0 && (targetSliceIds.length === 0 || targetSliceIds.includes(b.batchId))) {
                  const restore = Math.min(untrackedConsumed, remAddUnissue);
                  remAddUnissue -= restore;
                  restoredFromBatchLevel += restore;
                }
              }

              if (restoredFromBatch > 0 || restoredFromBatchLevel > 0) {
                return { ...b, consumedQty: Math.max(0, (b.consumedQty || 0) - restoredFromBatch - restoredFromBatchLevel), slices: updatedSlices };
              }
            } else {
              const targetBatchIds = targetSourceLotId ? targetSourceLotId.split(',').map(s => s.trim()).filter(Boolean) : [];
              if (targetBatchIds.length === 0 || targetBatchIds.includes(b.batchId) || remAddUnissue > 0) {
                const consumedP = b.consumedQty || 0;
                const restore = Math.min(consumedP, remAddUnissue);
                if (restore > 0) {
                  remAddUnissue -= restore;
                  return { ...b, consumedQty: consumedP - restore };
                }
              }
            }
          }
          return b;
        })
        .filter((b) => (b.issuedQty || 0) > 0 || (b.producedQty || 0) > 0 || (b.consumedQty || 0) > 0);

      return {
        ...j,
        availableForQcCrates: (j.availableForQcCrates || 0) + qty,
        isReadyForQcInspection: true,
        runningBatches: updatedBatches
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'QC Un-issue',
      machine: 'QC-Desk',
      shift: batch.shift,
      action: `↩️ Issue Return: ${qty} Formed Crates returned back to ${batch.sourceOperator ? `${batch.sourceOperator}'s Forming Lot` : 'Forming Stock'} (Remaining in QC: ${remaining})`,
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
    const looseDone = parseInt(loosePiecesInput, 10) || 0;
    const scrap = parseFloat(scrapKg) || 0;
    const rejectedPcs = parseInt(rejectedPiecesInput, 10) || 0;

    const { job, batch } = activeBatchObj;
    const formCrateCapacity = batch.pcsPerCrate || job.pcsPerCrateForming || state.crateCapacityMaster?.[job.product]?.formingPcs || 7000;
    const inputCrates = batch.issuedQty || 0;
    const totalInputPieces = batch.inputPieces || (inputCrates * formCrateCapacity);

    const approvedPcs = cratesDone * formCrateCapacity + looseDone;
    const prevProducedPieces = batch.producedPieces || 0;
    const prevProducedCrates = batch.producedQty || 0;
    const cumulativeOutputPieces = prevProducedPieces + approvedPcs;
    const cumulativeOutputCrates = prevProducedCrates + cratesDone;
    const pcsPerKg = DEFAULT_PCS_PER_KG_MAP[job.product] || 450;
    const scrapPcs = Math.round(scrap * pcsPerKg);
    const totalDefectsAndScrapPcs = scrapPcs + rejectedPcs;

    // Strict Mass Balance Conservation Check: Total Output (Approved + Scrap + Rejects) <= Total Input
    const balanceCheck = calculateDeskBalance(totalInputPieces, cumulativeOutputPieces, totalDefectsAndScrapPcs);

    if (inputCrates > 0 && !balanceCheck.isBalanced) {
      setAuditMismatchError({
        outputPcs: cumulativeOutputPieces,
        outputCrates: cumulativeOutputCrates,
        inputPcs: totalInputPieces,
        inputCrates,
        scrapPcs: totalDefectsAndScrapPcs,
        details: `Audit Block: Total output (${cumulativeOutputPieces.toLocaleString()} approved pcs + ${totalDefectsAndScrapPcs.toLocaleString()} scrap/reject pcs) exceeds issued input pieces (${totalInputPieces.toLocaleString()} pcs across ${inputCrates} crates) by ${balanceCheck.mismatchPcs.toLocaleString()} pcs. Entry blocked.`
      });
      return;
    }

    const stopTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const uninspectedCrates = Math.max(0, inputCrates - cratesDone);

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      const nextAvailForQc = (j.availableForQcCrates || 0) + uninspectedCrates;
      const remainingFormed = nextAvailForQc + (j.availableFormingCrates || 0);
      return {
        ...j,
        stage: remainingFormed === 0 ? 'Packing' : j.stage,
        availableForQcCrates: nextAvailForQc,
        availableQcCrates: (j.availableQcCrates || 0) + cratesDone,
        totalQcPieces: (j.totalQcPieces || 0) + approvedPcs,
        qcLoosePcs: (j.qcLoosePcs || 0) + looseDone,
        isReadyForQcInspection: remainingFormed > 0,
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return {
            ...b,
            status: 'Completed',
            endTime: stopTime,
            producedQty: (b.producedQty || 0) + cratesDone,
            pcsPerCrate: formCrateCapacity,
            producedPieces: approvedPcs,
            loosePieces: looseDone,
            scrapKg: scrap,
            rejectedPieces: rejectedPcs
          };
        })
      };
    });

    let logAction = `⏹️ Completed QC Inspection (${cratesDone} Crates = ${approvedPcs.toLocaleString()} Pieces Approved, Rejects: ${rejectedPcs.toLocaleString()} Pcs, Scrap: ${scrap} KG)`;
    if (uninspectedCrates > 0) {
      logAction += ` | Auto-Returned ${uninspectedCrates} Uninspected Formed Crates back to Queue`;
    }

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'QC',
      machine: 'QC-Desk',
      shift: batch.shift,
      action: logAction,
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
    setLoosePiecesInput('0');
    setRejectedPiecesInput('0');
    setScrapKg('0');
    setSelectedActiveBatchId('');
    alert(`✅ QC Inspection Finished! Approved ${cratesDone} Crates (= ${approvedPcs.toLocaleString()} Pieces) into Finished Stock.`);
  };

  const handleDirectQCVoucherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cratesDone = parseInt(directApprovedCrates, 10) || 0;
    const looseDone = parseInt(directLoosePcs, 10) || 0;
    const scrap = parseFloat(directScrapKg) || 0;

    if (cratesDone <= 0 && looseDone <= 0) {
      alert('⚠️ Please enter either Approved Crates or Loose Pieces!');
      return;
    }

    if (!inspectorName.trim()) {
      alert('⚠️ Mandatory: QC Inspector Name is required!');
      return;
    }

    let targetJobId = '';
    if (directJobType === 'existing') {
      if (!directSelectedJobId) {
        alert('⚠️ Please select an existing Job ID!');
        return;
      }
      targetJobId = directSelectedJobId;
    } else {
      targetJobId = directCustomJobId.trim().toUpperCase() || `JOB-OPN-QC-${Date.now().toString().slice(-4)}`;
    }

    const prod = directJobType === 'existing' 
      ? (jobs.find((j) => j.id === targetJobId)?.product || directProduct)
      : directProduct;

    const pcsPerCrate = state.crateCapacityMaster?.[prod]?.formingPcs || 7000;
    const totalQcPcs = cratesDone * pcsPerCrate + looseDone;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let updatedJobs = [...jobs];
    const existingIndex = updatedJobs.findIndex((j) => j.id === targetJobId);

    if (existingIndex > -1) {
      const j = updatedJobs[existingIndex];
      updatedJobs[existingIndex] = {
        ...j,
        availableQcCrates: (j.availableQcCrates || 0) + cratesDone,
        totalQcPieces: (j.totalQcPieces || 0) + totalQcPcs,
        qcLoosePcs: (j.qcLoosePcs || 0) + looseDone,
        customRemark: (j.customRemark || '') + ` | Direct QC: +${cratesDone} Crates approved directly`
      };
    } else {
      const newJob: Job = {
        id: targetJobId,
        product: prod,
        paperBrand: 'ITC',
        reelNo: `LOT-QC-DIRECT-${Date.now().toString().slice(-4)}`,
        reelNumbers: [`LOT-QC-DIRECT-${Date.now().toString().slice(-4)}`],
        gsm: '120 GSM',
        customRemark: 'Direct QC Crate Approval Voucher Entry' + (directRemarks ? `: ${directRemarks}` : ''),
        stage: 'Packing', // Ready for Packing
        status: 'Ready for Packing',
        availableRolls: 0,
        availableCuttingCrates: 0,
        availableFormingCrates: 0,
        availableQcCrates: cratesDone,
        totalQcPieces: totalQcPcs,
        qcLoosePcs: looseDone,
        isOpeningBalance: true,
        lotId: `LOT-QC-${Date.now().toString().slice(-4)}`,
        runningBatches: []
      };
      updatedJobs = [newJob, ...updatedJobs];
    }

    const newLog = {
      jobId: targetJobId,
      product: prod,
      stage: 'QC',
      machine: 'QC-Desk',
      shift,
      action: `⏹️ DIRECT QC VOUCHER: Approved +${cratesDone} Crates & +${looseDone} Loose Pcs directly to Job [${targetJobId}] (${totalQcPcs.toLocaleString()} Pieces, Scrap: ${scrap} KG) - ${directRemarks || 'No Remarks'}`,
      worker: inspectorName,
      user: 'qc_user',
      startTime: nowTime,
      endTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    const { floorWorkers, deptWorkers } = autoRegisterWorker(state, inspectorName, 'QC', 'QC-Desk', shift);

    onSaveState({
      ...state,
      jobs: updatedJobs,
      floorWorkers,
      deptWorkers,
      logs: [...state.logs, newLog]
    });

    setDirectApprovedCrates('');
    setDirectLoosePcs('0');
    setDirectScrapKg('0');
    setDirectCustomJobId('');
    setDirectRemarks('');

    alert(`✅ Direct QC Approval Voucher Saved!\n\n• Job ID: ${targetJobId}\n• Product: ${prod}\n• Crates Added: +${cratesDone}\n• Pieces Added: +${totalQcPcs.toLocaleString()}\n\nThese are now immediately available on the Packing Desk!`);
  };

  const handleConfirmCancelRun = () => {
    if (!activeBatchObj) return;
    const { job, batch } = activeBatchObj;
    const cratesToReturn = batch.issuedQty || 0;
    if (cratesToReturn <= 0) {
      setIsCancelConfirmOpen(false);
      setSelectedActiveBatchId('');
      alert('⚠️ This QC batch has no issued crates to return.');
      return;
    }

    const targetSourceLotId = batch.sourceLotId || batch.parentBatchId;
    let remCancelReturn = cratesToReturn;
    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      const updatedBatches = (j.runningBatches || [])
        .map((b) => {
          if ((b.stage === 'Forming' || b.machine?.startsWith('Forming')) && remCancelReturn > 0) {
            if (b.slices && b.slices.length > 0) {
              let restoredFromBatch = 0;
              // Pass 1: Target matching slice
              let updatedSlices = b.slices.map(slice => {
                if (remCancelReturn > 0 && targetSourceLotId && slice.sliceId === targetSourceLotId) {
                  const sliceConsumed = slice.consumedQty || 0;
                  const restore = Math.min(sliceConsumed, remCancelReturn);
                  if (restore > 0) {
                    remCancelReturn -= restore;
                    restoredFromBatch += restore;
                    return { ...slice, consumedQty: sliceConsumed - restore };
                  }
                }
                return slice;
              });
              // Pass 2: Remaining fallback in reverse order
              if (remCancelReturn > 0) {
                updatedSlices = [...updatedSlices].reverse().map(slice => {
                  if (remCancelReturn > 0) {
                    const sliceConsumed = slice.consumedQty || 0;
                    const restore = Math.min(sliceConsumed, remCancelReturn);
                    if (restore > 0) {
                      remCancelReturn -= restore;
                      restoredFromBatch += restore;
                      return { ...slice, consumedQty: sliceConsumed - restore };
                    }
                  }
                  return slice;
                }).reverse();
              }
              if (restoredFromBatch > 0) {
                return { ...b, consumedQty: Math.max(0, (b.consumedQty || 0) - restoredFromBatch), slices: updatedSlices };
              }
            } else {
              if (!targetSourceLotId || b.batchId === targetSourceLotId || remCancelReturn > 0) {
                const consumedP = b.consumedQty || 0;
                const restore = Math.min(consumedP, remCancelReturn);
                if (restore > 0) {
                  remCancelReturn -= restore;
                  return { ...b, consumedQty: consumedP - restore };
                }
              }
            }
          }
          return b;
        })
        .filter((b) => b.batchId !== batch.batchId);

      return {
        ...j,
        availableFormingCrates: (j.availableFormingCrates || 0) + cratesToReturn,
        isReadyForQcInspection: true,
        runningBatches: updatedBatches
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'QC Cancelled',
      machine: 'QC-Desk',
      shift: batch.shift,
      action: `❌ QC Run Cancelled & Reverted: Batch ${batch.batchId} deleted, ${cratesToReturn} crates returned to ${batch.sourceOperator ? `${batch.sourceOperator}'s Forming Lot` : 'forming stock'}.`,
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
      {/* SLDS FORMED GOODS STREAM & ISSUE-RETURN ACCOUNTING PANEL */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-md space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5 text-cyan-400" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-cyan-300 m-0">
                Forming ➔ QC Live Stock Location & Dispatch Stream (SLDS)
              </h4>
              <p className="text-[10px] text-slate-300 m-0">
                Total Formed Crates received from Forming Desk, Crates issued for Inspection & Approved Stock Balance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-extrabold bg-white/10 border border-white/15 px-3 py-1 rounded-xl">
            <span className="text-emerald-400">● Live Stream Synchronized</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white/10 border border-white/15 p-2.5 rounded-xl">
            <span className="text-[10px] text-slate-300 uppercase font-bold block">1. Formed Stock Received:</span>
            <span className="text-base font-black text-white">
              {jobs.reduce((sum, j) => sum + (j.availableFormingCrates || 0) + (j.availableForQcCrates || 0), 0)} Crates
            </span>
            <span className="text-[10px] text-cyan-300 block">
              ({jobs.reduce((sum, j) => sum + ((j.availableFormingCrates || 0) + (j.availableForQcCrates || 0)) * (j.pcsPerCrateForming || state.crateCapacityMaster?.[j.product]?.formingPcs || 7000), 0).toLocaleString()} Formed Pcs)
            </span>
          </div>

          <div className="bg-white/10 border border-white/15 p-2.5 rounded-xl">
            <span className="text-[10px] text-slate-300 uppercase font-bold block">2. Issued to QC Inspector:</span>
            <span className="text-base font-black text-amber-300">
              {activeBatches.reduce((sum, b) => sum + (b.batch.issuedQty || 0), 0)} Crates
            </span>
            <span className="text-[10px] text-amber-200 block">
              ({activeBatches.length} Active Inspector{activeBatches.length === 1 ? '' : 's'})
            </span>
          </div>

          <div className="bg-white/10 border border-white/15 p-2.5 rounded-xl">
            <span className="text-[10px] text-slate-300 uppercase font-bold block">3. QC Passed Stock (Packing Ready):</span>
            <span className="text-base font-black text-emerald-300">
              {jobs.reduce((sum, j) => sum + (j.availableQcCrates || 0), 0)} Crates
            </span>
            <span className="text-[10px] text-emerald-200 block">
              ({jobs.reduce((sum, j) => sum + (j.totalQcPieces || 0), 0).toLocaleString()} Approved Pcs)
            </span>
          </div>

          <div className="bg-white/10 border border-white/15 p-2.5 rounded-xl">
            <span className="text-[10px] text-slate-300 uppercase font-bold block">4. QC Defect Rejects:</span>
            <span className="text-base font-black text-rose-300">
              {jobs.reduce((sum, j) => sum + (j.formingRejectedPcs || 0), 0).toLocaleString()} Pcs
            </span>
            <span className="text-[10px] text-rose-200 block">
              Recorded Defects / Scrap
            </span>
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
            Active QC Inspection Lots:
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
      {/* INSPECTOR / WORKER CRATE BALANCE TRACKING (Crates Account for Inspectors) */}
      {/* ======================================================== */}
      {activeBatches.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
              <Users className="w-4 h-4 text-blue-600" />
              Inspector Crates Live Balance:
            </h4>
            <span className="text-[11px] font-bold text-slate-500">
              Same Job = Merged Balance (No separate entry)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden bg-white">
              <thead className="bg-slate-100/80 text-[11px] font-black text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">Inspector Name</th>
                  <th className="px-3 py-2">Date & Shift</th>
                  <th className="px-3 py-2">Job & Product</th>
                  <th className="px-3 py-2">Current in Hand</th>
                  <th className="px-3 py-2">Approved / Forwarded</th>
                  <th className="px-3 py-2 text-right">Quick Top-up (+ Add Crates)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeBatches.map(({ job, batch }) => (
                  <tr key={batch.batchId} className="hover:bg-cyan-50/40 transition">
                    <td className="px-3 py-2 font-black text-blue-950 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      {batch.worker}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                      <div className="flex items-center gap-1 font-bold text-xs">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{batch.startTime?.includes(':') ? new Date().toISOString().split('T')[0] : (batch.startTime || new Date().toISOString().split('T')[0])}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold">
                        Shift: <b className="text-slate-800">{batch.shift || shift}</b>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-bold text-slate-700">
                      {job.id} — <span className="text-slate-500">{job.product}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="bg-blue-100 text-blue-900 font-extrabold px-2 py-0.5 rounded-md text-xs">
                        {batch.issuedQty} Crates
                      </span>
                    </td>
                    <td className="px-3 py-2 font-bold text-emerald-700">
                      {batch.producedQty || 0} Crates Passed
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedActiveBatchId(batch.batchId);
                          setTopupQtyInput('2');
                          setIsTopupModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] rounded-lg transition cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                      >
                        <PlusCircle className="w-3 h-3" /> + 2 Crates
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

          {/* Crate Capacity & Piece Calculator Banner */}
          <div className="bg-emerald-50/90 border border-emerald-200 p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-black text-emerald-950">
                <Box className="w-4 h-4 text-emerald-700" />
                <span>Crate Packing Standard ({activeBatchObj.job.product}):</span>
              </div>
              <div className="font-extrabold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                {effectiveQcPcs.toLocaleString()} Pieces / Crate
              </div>
            </div>

            {outputApprovedCrates && parseInt(outputApprovedCrates, 10) > 0 && (
              <div className="bg-white/95 border border-emerald-300 px-3 py-2 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="font-bold text-slate-700">
                  Approved Total: <span className="text-emerald-700 font-black">{outputApprovedCrates} Crates</span> × {effectiveQcPcs.toLocaleString()} Pcs
                  {parseInt(loosePiecesInput, 10) > 0 && <span> + {loosePiecesInput} Loose</span>}
                </div>
                <div className="text-emerald-950 font-black bg-emerald-100 px-2.5 py-1 rounded-md text-xs border border-emerald-300">
                  = {((parseInt(outputApprovedCrates, 10) || 0) * effectiveQcPcs + (parseInt(loosePiecesInput, 10) || 0)).toLocaleString()} Finished Pieces (Total Passed)
                </div>
              </div>
            )}
          </div>

          {/* Output and scrap entries */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-rose-800 uppercase mb-1">
                  Rejected Pieces (Pcs):
                </label>
                <input
                  type="number"
                  value={rejectedPiecesInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRejectedPiecesInput(val);
                    const formCrateCapacity = activeBatchObj.job.pcsPerCrateForming || state.crateCapacityMaster?.[activeBatchObj.job.product]?.formingPcs || 7000;
                    const inputCrates = activeBatchObj.batch.issuedQty || 0;
                    const totalInputPieces = inputCrates * formCrateCapacity;
                    
                    const rejectedVal = parseInt(val, 10) || 0;
                    const computedApproved = Math.max(0, totalInputPieces - rejectedVal);
                    
                    const autoCrates = Math.floor(computedApproved / formCrateCapacity);
                    const autoLoose = computedApproved % formCrateCapacity;
                    
                    setOutputApprovedCrates(String(autoCrates));
                    setLoosePiecesInput(String(autoLoose));
                  }}
                  placeholder="e.g. 250 Pcs"
                  className="w-full px-3 py-2 bg-rose-50/50 border border-rose-300 rounded-lg text-xs font-extrabold text-rose-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
                <span className="text-[10px] text-rose-600 block mt-0.5 font-semibold">⚡ Deducts from total crates</span>
              </div>
              <div>
                <label className="block text-xs font-bold text-emerald-800 uppercase mb-1">
                  Passed / Approved Crates:
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
                <label className="block text-xs font-bold text-emerald-800 uppercase mb-1">
                  Loose Passed Pcs:
                </label>
                <input
                  type="number"
                  value={loosePiecesInput}
                  onChange={(e) => setLoosePiecesInput(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Rejected Scrap (KG):
                </label>
                <input
                  type="number"
                  value={scrapKg}
                  onChange={(e) => setScrapKg(e.target.value)}
                  placeholder="e.g. 1.5 KG"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>
            </div>

            {/* Live Mass Balance Audit Board */}
            <div className="bg-blue-50 border border-blue-200/80 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-blue-950 flex-wrap gap-2">
              <div className="flex items-center gap-1">
                <span>📊 Live Balance Audit:</span>
              </div>
              <div>
                Input: <span className="text-blue-900">{(activeBatchObj.batch.issuedQty * effectiveQcPcs).toLocaleString()} Pcs</span> ({activeBatchObj.batch.issuedQty} Crates)
              </div>
              <div className="text-emerald-700">
                Approved: {(((parseInt(outputApprovedCrates, 10) || 0) * effectiveQcPcs) + (parseInt(loosePiecesInput, 10) || 0)).toLocaleString()} Pcs
              </div>
              <div className="text-rose-700">
                Rejected: {(parseInt(rejectedPiecesInput, 10) || 0).toLocaleString()} Pcs
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setTopupQtyInput('2');
                  setIsTopupModalOpen(true);
                }}
                className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                title="Top-up / add more crates into this inspector's hand without creating a new batch"
              >
                <PlusCircle className="w-3.5 h-3.5" /> + Add Crates
              </button>
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
                  const formingBatches = (activeBatchObj.job.runningBatches || []).filter(
                    b => b.stage === 'Forming' || b.machine?.startsWith('Forming')
                  );
                  const localFormingLots: string[] = [];
                  formingBatches.forEach(fb => {
                    if (fb.slices && fb.slices.length > 0) {
                      const slicesConsumedP = fb.slices.reduce((sum, s) => sum + (s.consumedQty || 0), 0);
                      fb.slices.forEach(slice => {
                        if ((slice.consumedQty || 0) > 0) {
                          localFormingLots.push(slice.sliceId);
                        }
                      });
                      const untrackedConsumed = Math.max(0, (fb.consumedQty || 0) - slicesConsumedP);
                      if (untrackedConsumed > 0) {
                        localFormingLots.push(fb.batchId);
                      }
                    } else {
                      if ((fb.consumedQty || 0) > 0) {
                        localFormingLots.push(fb.batchId);
                      }
                    }
                  });

                  setUnissueTargetLotId(localFormingLots[0] || activeBatchObj.batch.sourceLotId || '');
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
                <Pause className="w-3.5 h-3.5" /> Call In-Charge / Report Hold
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
      {/* QC ACTION MODE SWITCHER & FORMS */}
      {/* ======================================================== */}
      <div className="border-t-2 border-slate-200/80 pt-6 mt-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>Select QC Activity Workflow:</span>
          </h3>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setQcFlowMode('standard')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all duration-200 cursor-pointer ${
                qcFlowMode === 'standard'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              1. Formed Queue Inspection
            </button>
            <button
              type="button"
              onClick={() => setQcFlowMode('direct')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all duration-200 cursor-pointer ${
                qcFlowMode === 'direct'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              2. Direct Approved QC Entry (Voucher)
            </button>
          </div>
        </div>

        {qcFlowMode === 'standard' ? (
          <div>
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
                    {(state.floorWorkers || []).map(w => w.name).map((w) => (
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
                    {(state.products && state.products.length > 0 ? state.products : PRODUCTS).map((p) => (
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
                    if (j) setIssueCratesQty(String(((j.availableForQcCrates || 0) + (j.availableFormingCrates || 0)) || 1));
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="">-- SELECT FORMED CRATES QUEUE --</option>
                  {pendingFormedJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.id} - {j.product} [{j.paperBrand || 'ITC'}] (Avail: {(j.availableForQcCrates || 0) + (j.availableFormingCrates || 0)} Crates)
                    </option>
                  ))}
                </select>
              </div>

              {selectedPendingJob && (
                <div className="space-y-2">
                  <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-xs font-bold text-cyan-900 flex items-center justify-between">
                    <span>Available Formed Stock: {(selectedPendingJob.availableFormingCrates || 0) + (selectedPendingJob.availableForQcCrates || 0)} Crates [Brand: {selectedPendingJob.paperBrand || 'ITC'}]</span>
                  </div>
                  
                  {/* Forming Operator Lots / Batches Breakdown */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                    <span className="font-extrabold text-slate-700 uppercase tracking-wide block text-[11px]">
                      🔍 Forming Operator Lots Source Breakdown (Traceability):
                    </span>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {(() => {
                        const selectableFormingLots: {
                          id: string;
                          batchId: string;
                          worker: string;
                          shift: string;
                          machine: string;
                          totalQty: number;
                          consumedQty: number;
                          remainingQty: number;
                        }[] = [];

                        const formingBatches = (selectedPendingJob.runningBatches || []).filter(b => b.stage === 'Forming' || b.machine?.startsWith('Forming'));
                        
                        formingBatches.forEach(fb => {
                          const totalP = fb.producedQty || 0;
                          const consumedP = fb.consumedQty || 0;
                          
                          if (fb.slices && fb.slices.length > 0) {
                            fb.slices.forEach(slice => {
                              const sliceTotal = slice.producedQty || 0;
                              const sliceConsumed = slice.consumedQty || 0;
                              const sliceRemaining = Math.max(0, sliceTotal - sliceConsumed);
                              selectableFormingLots.push({
                                id: slice.sliceId,
                                batchId: fb.batchId,
                                worker: slice.operator,
                                shift: slice.shift,
                                machine: fb.machine || slice.machine || 'Forming',
                                totalQty: sliceTotal,
                                consumedQty: sliceConsumed,
                                remainingQty: sliceRemaining
                              });
                            });
                          } else {
                            selectableFormingLots.push({
                              id: fb.batchId,
                              batchId: fb.batchId,
                              worker: fb.worker,
                              shift: fb.shift,
                              machine: fb.machine || 'Forming',
                              totalQty: totalP,
                              consumedQty: consumedP,
                              remainingQty: Math.max(0, totalP - consumedP)
                            });
                          }
                        });

                        if (selectableFormingLots.length === 0) {
                          return <div className="text-slate-400 italic text-[11px]">No specific forming lot metadata found (Legacy or Direct entry).</div>;
                        }

                        const activeSelectionId = selectedFormingBatchId || selectableFormingLots.find(l => l.remainingQty > 0)?.id || selectableFormingLots[0].id;

                        return selectableFormingLots.map(lot => {
                          const isSelected = activeSelectionId === lot.id;
                          return (
                            <div 
                              key={lot.id} 
                              onClick={() => {
                                if (lot.remainingQty > 0) {
                                  setSelectedFormingBatchId(lot.id);
                                  setIssueCratesQty(String(Math.min(lot.remainingQty, 2)));
                                }
                              }}
                              className={`p-2 rounded-lg border cursor-pointer transition flex items-center justify-between text-[11px] ${
                                isSelected 
                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold shadow-2xs ring-1 ring-indigo-400' 
                                  : lot.remainingQty === 0
                                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded font-bold text-[10px]">{lot.id.substring(0, 16)}</span>
                                <span className="font-extrabold">👨‍🏭 {lot.worker || 'OPERATOR'}</span>
                                <span className="text-slate-500 font-normal text-[10px]">({lot.machine} | ☀️ {lot.shift})</span>
                              </div>
                              <div className="font-mono text-right">
                                <div className={`font-black ${lot.remainingQty > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                  {lot.remainingQty} Crates Remaining
                                </div>
                                <div className="text-slate-400 text-[10px]">({lot.totalQty} Produced, {lot.consumedQty} Consumed)</div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Enter Formed Crates to Inspect (Issue Crates) *:
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 4, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setIssueCratesQty(String(num))}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                          issueCratesQty === String(num)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {num} Crates
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  value={issueCratesQty}
                  onChange={(e) => setIssueCratesQty(e.target.value)}
                  placeholder="Enter Crates Quantity"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <button
                  type="submit"
                  disabled={!selectedPendingJobId}
                  className="sm:col-span-3 py-3 bg-[#2b6cb0] hover:bg-[#1a365d] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start QC Inspection on QC-Desk</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeBatchObj) {
                      setTopupQtyInput('1');
                      setIsTopupModalOpen(true);
                    } else {
                      alert('No active running QC batch to top-up.');
                    }
                  }}
                  disabled={!activeBatchObj}
                  className="py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-extrabold text-xs rounded-xl transition border border-slate-300 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>+ Top-up Crates</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-indigo-50/40 border border-indigo-150 p-4 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-700" />
              <div>
                <h4 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wide m-0">
                  Direct QC Approved Crate Entry (Voucher Addition)
                </h4>
                <p className="text-[10px] text-indigo-700/80 m-0">
                  Directly record and increment QC-approved stock for any Job ID without running the inspection queue
                </p>
              </div>
            </div>

            <form onSubmit={handleDirectQCVoucherSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-indigo-100">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-black text-indigo-950 uppercase">Job Number Association *:</label>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-700 mb-1">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="directJobType"
                        checked={directJobType === 'existing'}
                        onChange={() => setDirectJobType('existing')}
                        className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Existing active Job</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="directJobType"
                        checked={directJobType === 'new'}
                        onChange={() => setDirectJobType('new')}
                        className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Assign Custom Job No</span>
                    </label>
                  </div>

                  {directJobType === 'existing' ? (
                    <select
                      value={directSelectedJobId}
                      onChange={(e) => {
                        setDirectSelectedJobId(e.target.value);
                        const j = jobs.find((x) => x.id === e.target.value);
                        if (j) setDirectProduct(j.product);
                      }}
                      className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-lg text-xs font-bold text-slate-800 outline-none"
                    >
                      <option value="">-- SELECT ACTIVE JOB ID --</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.id} - {j.product} (Approved QC: {j.availableQcCrates || 0} Crates)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={directCustomJobId}
                      onChange={(e) => setDirectCustomJobId(e.target.value)}
                      placeholder="e.g. JOB-OPN-104"
                      className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-lg text-xs font-bold text-slate-800 outline-none uppercase"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-black text-indigo-950 uppercase mb-1">Target Product:</label>
                  <select
                    value={directProduct}
                    onChange={(e) => setDirectProduct(e.target.value as ProductType)}
                    disabled={directJobType === 'existing'}
                    className="w-full px-3 py-2 border border-slate-300 bg-white disabled:bg-slate-50 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  >
                    {(state.products && state.products.length > 0 ? state.products : PRODUCTS).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-800 uppercase mb-1">
                    Approved QC Crates Output:
                  </label>
                  <input
                    type="number"
                    value={directApprovedCrates}
                    onChange={(e) => setDirectApprovedCrates(e.target.value)}
                    placeholder="e.g. 5 Crates"
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-800 uppercase mb-1">
                    Loose Passed Pcs:
                  </label>
                  <input
                    type="number"
                    value={directLoosePcs}
                    onChange={(e) => setDirectLoosePcs(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-rose-700 uppercase mb-1">
                    Rejected Scrap (KG):
                  </label>
                  <input
                    type="number"
                    value={directScrapKg}
                    onChange={(e) => setDirectScrapKg(e.target.value)}
                    placeholder="e.g. 1.2"
                    className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Remarks / Lot Details:
                  </label>
                  <input
                    type="text"
                    value={directRemarks}
                    onChange={(e) => setDirectRemarks(e.target.value)}
                    placeholder="e.g. Go-Live Stock Entry"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-indigo-100">
                <div>
                  <label className="block text-[11px] font-black text-indigo-950 uppercase mb-1">Inspector:</label>
                  <input
                    type="text"
                    list="qcWorkerList"
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs font-bold uppercase text-slate-800 outline-none"
                    placeholder="Type Inspector..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-indigo-950 uppercase mb-1">Shift:</label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="DAY">DAY SHIFT</option>
                    <option value="NIGHT">NIGHT SHIFT</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Direct QC Approval Voucher</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* QC REELS & TRACEABILITY REGISTER (BOTTOM TEMPLATE MATCHING SLITTING) */}
      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* QC REELS & TRACEABILITY REGISTER (BOTTOM TEMPLATE MATCHING SLITTING) */}
      {/* ======================================================== */}
      {(() => {
        // Local state toggle handler
        const handleSort = (column: string) => {
          if (sortColumn === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            setSortColumn(column);
            setSortOrder('asc');
          }
        };

        const escapeCSV = (val: any) => {
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        // Memoized processed jobs
        const processedJobs = jobs.map((j) => {
          const allReels = getJobAllReels(j);
          const allGsms = getJobAllGsms(j);
          const qcBatches = (j.runningBatches || []).filter((b) => b.stage === 'QC' || b.machine === 'QC-Desk');
          const formPcsStd = j.pcsPerCrateForming || state.crateCapacityMaster?.[j.product]?.formingPcs || 7000;
          const activeQcBatch = qcBatches.find((b) => b.status === 'Running' || b.status === 'Held');
          const qcAllocatedCrates = qcBatches.reduce((sum, b) => sum + (b.issuedQty || 0), 0);
          const approvedCrates = qcBatches.reduce((sum, b) => sum + (b.producedQty || 0), 0);
          const approvedPieces = approvedCrates * formPcsStd;
          const totalScrapKg = qcBatches.reduce((sum, b) => sum + (b.scrapPcs || 0), 0);

          const latestLog = (state.logs || []).filter((l) => l.jobId === j.id).slice(-1)[0];
          const entryDate = latestLog?.rawDate || (j.createdAt ? j.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
          const entryTime = latestLog?.startTime || (latestLog?.timestamp ? latestLog.timestamp.split(',')[1]?.trim() : '');
          const paperBrand = j.paperBrand || 'ITC';
          const remark = j.customRemark || 'Standard';
          const stock = approvedCrates;

          // Status representation
          let statusText = j.stage || '';
          if (activeQcBatch) {
            statusText = `In Inspection (${activeQcBatch.worker})`;
          } else if ((j.availableFormingCrates || 0) > 0) {
            statusText = `Pending QC (${j.availableFormingCrates} Crates)`;
          }

          return {
            job: j,
            id: j.id,
            date: entryDate,
            time: entryTime,
            reels: allReels,
            reelsStr: allReels.join(', '),
            gsms: allGsms,
            gsmsStr: allGsms.join(', '),
            mill: paperBrand,
            product: j.product,
            remark: remark,
            stock: stock,
            approvedPieces,
            qcAllocatedCrates,
            totalScrapKg,
            statusText,
            activeQcBatch,
            qcBatches,
          };
        });

        // 1. Global Filter
        let filtered = processedJobs;
        if (tableSearch.trim()) {
          const q = tableSearch.toLowerCase();
          filtered = filtered.filter((item) => {
            return (
              item.id.toLowerCase().includes(q) ||
              item.reelsStr.toLowerCase().includes(q) ||
              item.gsmsStr.toLowerCase().includes(q) ||
              item.mill.toLowerCase().includes(q) ||
              item.product.toLowerCase().includes(q) ||
              item.remark.toLowerCase().includes(q) ||
              item.statusText.toLowerCase().includes(q) ||
              item.qcBatches.some((b) => (b.worker || '').toLowerCase().includes(q) || b.batchId.toLowerCase().includes(q))
            );
          });
        }

        // 2. Column-Specific Filter
        if (showFilters) {
          filtered = filtered.filter((item) => {
            const f = colFilters;
            const matchId = !f.id || item.id.toLowerCase().includes(f.id.toLowerCase());
            const matchDate = !f.date || item.date.toLowerCase().includes(f.date.toLowerCase());
            const matchReel = !f.reel || item.reelsStr.toLowerCase().includes(f.reel.toLowerCase());
            const matchGsm = !f.gsm || item.gsmsStr.toLowerCase().includes(f.gsm.toLowerCase());
            const matchMill = !f.mill || item.mill.toLowerCase().includes(f.mill.toLowerCase());
            const matchProduct = !f.product || item.product.toLowerCase().includes(f.product.toLowerCase());
            const matchRemark = !f.remark || item.remark.toLowerCase().includes(f.remark.toLowerCase());
            const matchStock = !f.stock || String(item.stock).toLowerCase().includes(f.stock.toLowerCase());
            const matchStatus = !f.status || item.statusText.toLowerCase().includes(f.status.toLowerCase());

            return matchId && matchDate && matchReel && matchGsm && matchMill && matchProduct && matchRemark && matchStock && matchStatus;
          });
        }

        // 3. Sort
        if (sortColumn) {
          filtered.sort((a, b) => {
            let valA: any = a[sortColumn as keyof typeof a];
            let valB: any = b[sortColumn as keyof typeof b];

            if (sortColumn === 'reels') {
              valA = a.reelsStr.toLowerCase();
              valB = b.reelsStr.toLowerCase();
            } else if (sortColumn === 'gsm') {
              valA = a.gsmsStr.toLowerCase();
              valB = b.gsmsStr.toLowerCase();
            } else if (sortColumn === 'status') {
              valA = a.statusText.toLowerCase();
              valB = b.statusText.toLowerCase();
            } else if (typeof valA === 'string') {
              valA = valA.toLowerCase();
              valB = (valB || '').toLowerCase();
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
          });
        }

        const exportToCSV = () => {
          const headers = ['Job ID', 'Date', 'Time', 'Reel No.', 'GSM', 'Paper Mill', 'Product', 'Remarks / Lot', 'Approved Stock (Crates)', 'Pieces', 'In (Crates)', 'Out (Crates)', 'Scrap (KG)', 'Stage Status'];
          const rows = filtered.map(item => [
            escapeCSV(item.id),
            escapeCSV(item.date),
            escapeCSV(item.time),
            escapeCSV(item.reelsStr),
            escapeCSV(item.gsmsStr),
            escapeCSV(item.mill),
            escapeCSV(item.product),
            escapeCSV(item.remark),
            escapeCSV(item.stock),
            escapeCSV(item.approvedPieces),
            escapeCSV(item.qcAllocatedCrates),
            escapeCSV(item.stock),
            escapeCSV(item.totalScrapKg),
            escapeCSV(item.statusText)
          ]);

          const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', `QC_Traceability_Register_${new Date().toISOString().split('T')[0]}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        return (
          <div className="mt-8 pt-6 border-t-2 border-slate-200 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 m-0">
                  <Layers className="w-5 h-5 text-teal-600" />
                  <span>QC Reels & Traceability Register</span>
                </h3>
                <p className="text-xs text-slate-500 m-0">
                  Reel number, GSM used in each Job ID and onward traceability status
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1 border transition cursor-pointer ${showFilters ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{showFilters ? 'Hide Filters' : 'Column Filters'}</span>
                </button>
                <button
                  type="button"
                  onClick={exportToCSV}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 border border-emerald-500 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Excel</span>
                </button>
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Quick search..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-xs">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-left">
                    <th className="p-3 cursor-pointer select-none hover:bg-slate-200 transition" onClick={() => handleSort('id')}>
                      <div className="flex items-center gap-1">
                        <span>Job ID</span>
                        {sortColumn === 'id' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3 text-indigo-900 cursor-pointer select-none hover:bg-slate-200 transition" onClick={() => handleSort('date')}>
                      <div className="flex items-center gap-1">
                        <span>Date</span>
                        {sortColumn === 'date' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3 text-blue-900 cursor-pointer select-none hover:bg-slate-200 transition" onClick={() => handleSort('reels')}>
                      <div className="flex items-center gap-1">
                        <span>Reel No.</span>
                        {sortColumn === 'reels' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3 text-amber-900 cursor-pointer select-none hover:bg-slate-200 transition" onClick={() => handleSort('gsm')}>
                      <div className="flex items-center gap-1">
                        <span>GSM</span>
                        {sortColumn === 'gsm' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3 cursor-pointer select-none hover:bg-slate-200 transition" onClick={() => handleSort('mill')}>
                      <div className="flex items-center gap-1">
                        <span>Paper Mill</span>
                        {sortColumn === 'mill' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3 cursor-pointer select-none hover:bg-slate-200 transition" onClick={() => handleSort('product')}>
                      <div className="flex items-center gap-1">
                        <span>Product</span>
                        {sortColumn === 'product' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3 cursor-pointer select-none hover:bg-slate-200 transition" onClick={() => handleSort('remark')}>
                      <div className="flex items-center gap-1">
                        <span>Remarks / Lot</span>
                        {sortColumn === 'remark' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3 text-right cursor-pointer select-none hover:bg-slate-200 transition" onClick={() => handleSort('stock')}>
                      <div className="flex items-center justify-end gap-1">
                        <span>Approved Stock</span>
                        {sortColumn === 'stock' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3 text-right">In / Out / Scrap</th>
                    <th className="p-3 text-center cursor-pointer select-none hover:bg-slate-200 transition" onClick={() => handleSort('status')}>
                      <div className="flex items-center justify-center gap-1">
                        <span>Stage Status</span>
                        {sortColumn === 'status' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                      </div>
                    </th>
                    <th className="p-3 text-center">Traceability</th>
                  </tr>

                  {showFilters && (
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <td className="p-1">
                        <input
                          type="text"
                          value={colFilters.id}
                          onChange={(e) => setColFilters(prev => ({ ...prev, id: e.target.value }))}
                          placeholder="Filter ID..."
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px] font-bold text-slate-700 focus:border-blue-500 outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={colFilters.date}
                          onChange={(e) => setColFilters(prev => ({ ...prev, date: e.target.value }))}
                          placeholder="Filter Date..."
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px] font-bold text-slate-700 focus:border-blue-500 outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={colFilters.reel}
                          onChange={(e) => setColFilters(prev => ({ ...prev, reel: e.target.value }))}
                          placeholder="Filter Reel..."
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px] font-bold text-slate-700 focus:border-blue-500 outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={colFilters.gsm}
                          onChange={(e) => setColFilters(prev => ({ ...prev, gsm: e.target.value }))}
                          placeholder="Filter GSM..."
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px] font-bold text-slate-700 focus:border-blue-500 outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={colFilters.mill}
                          onChange={(e) => setColFilters(prev => ({ ...prev, mill: e.target.value }))}
                          placeholder="Filter Mill..."
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px] font-bold text-slate-700 focus:border-blue-500 outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={colFilters.product}
                          onChange={(e) => setColFilters(prev => ({ ...prev, product: e.target.value }))}
                          placeholder="Filter Product..."
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px] font-bold text-slate-700 focus:border-blue-500 outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={colFilters.remark}
                          onChange={(e) => setColFilters(prev => ({ ...prev, remark: e.target.value }))}
                          placeholder="Filter Remark..."
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px] font-bold text-slate-700 focus:border-blue-500 outline-none"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={colFilters.stock}
                          onChange={(e) => setColFilters(prev => ({ ...prev, stock: e.target.value }))}
                          placeholder="Filter Stock..."
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px] font-bold text-slate-700 focus:border-blue-500 outline-none text-right"
                        />
                      </td>
                      <td className="p-1"></td>
                      <td className="p-1">
                        <input
                          type="text"
                          value={colFilters.status}
                          onChange={(e) => setColFilters(prev => ({ ...prev, status: e.target.value }))}
                          placeholder="Filter Status..."
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px] font-bold text-slate-700 focus:border-blue-500 outline-none text-center"
                        />
                      </td>
                      <td className="p-1"></td>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item) => {
                    const j = item.job;
                    return (
                      <tr key={j.id} className="hover:bg-slate-50 transition">
                        <td className="p-2.5 font-mono font-bold text-blue-800">{j.id}</td>
                        <td className="p-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 font-bold text-slate-800 text-xs">
                            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{item.date}</span>
                          </div>
                          {item.time && <div className="text-[10px] text-slate-400 font-mono ml-4">{item.time}</div>}
                        </td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1 items-center max-w-[220px]">
                            {item.reels.map((r, idx) => (
                              <span
                                key={idx}
                                className="font-mono font-bold text-[11px] bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200"
                                title={`Parent Jumbo Reel #${idx + 1}`}
                              >
                                {r}
                              </span>
                            ))}
                            {item.qcBatches.length > 0 && (
                              <span className="font-mono text-[10px] bg-purple-50 text-purple-800 px-1 py-0.5 rounded border border-purple-200">
                                Lot: {item.qcBatches[0].batchId}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1 items-center max-w-[190px]">
                            {item.gsms.map((g, gIdx) => (
                              <span
                                key={gIdx}
                                className="font-bold text-[11px] bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200"
                                title={`GSM #${gIdx + 1}`}
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-2.5 font-medium text-slate-800">{item.mill}</td>
                        <td className="p-2.5 font-bold text-slate-700">{item.product}</td>
                        <td className="p-2.5">
                          <div className="text-slate-600 text-xs max-w-[150px] truncate" title={item.remark}>
                            {item.remark}
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-emerald-700">
                          {item.stock} Crates
                          <div className="text-[10px] text-emerald-600 font-semibold">
                            ({item.approvedPieces.toLocaleString()} Pcs)
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-mono text-xs">
                          <div className="flex flex-col items-end">
                            <span className="text-slate-700 font-bold">
                              In: {item.qcAllocatedCrates > 0 ? `${item.qcAllocatedCrates} Crates` : `${j.availableFormingCrates || 0} Crates`}
                            </span>
                            <span className="text-blue-700 font-medium">
                              Out: {item.stock} Crates
                            </span>
                            {item.totalScrapKg > 0 && (
                              <span className="text-rose-700 font-bold text-[11px]">
                                Scrap: {item.totalScrapKg} KG
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          {item.activeQcBatch ? (
                            <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse">
                              ● In Inspection ({item.activeQcBatch.worker})
                            </span>
                          ) : ((j.availableFormingCrates || 0) + (j.availableForQcCrates || 0)) > 0 ? (
                            <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              Pending QC ({(j.availableFormingCrates || 0) + (j.availableForQcCrates || 0)} Crates)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                              {j.stage}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setGenealogyModalJob(j);
                            }}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[11px] transition shadow-xs inline-flex items-center gap-1 cursor-pointer"
                            title="See where this reel/lot reached in Traceability"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Trace Lot</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

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
              {activeBatchObj.batch.sourceOperator && (
                <div className="text-amber-800 font-semibold flex items-center gap-1">
                  <span>↩️ Returning directly to Forming Operator Lot:</span>
                  <span className="font-extrabold bg-amber-200/80 text-amber-950 px-1.5 py-0.5 rounded text-[11px]">
                    👨‍🏭 {activeBatchObj.batch.sourceOperator}
                  </span>
                </div>
              )}
            </div>

            {/* Real list of forming lots/slices that have been consumed */}
            {(() => {
              const formingBatches = (activeBatchObj.job.runningBatches || []).filter(
                b => b.stage === 'Forming' || b.machine?.startsWith('Forming')
              );

              const formingLotsForJob: {
                id: string;
                batchId: string;
                producedByOperator: string;
                consumedQty: number;
              }[] = [];

              formingBatches.forEach(fb => {
                const totalP = fb.producedQty || 0;
                const consumedP = fb.consumedQty || 0;

                if (fb.slices && fb.slices.length > 0) {
                  const slicesTotalP = fb.slices.reduce((sum, s) => sum + (s.producedQty || 0), 0);
                  const slicesConsumedP = fb.slices.reduce((sum, s) => sum + (s.consumedQty || 0), 0);

                  fb.slices.forEach(slice => {
                    const sliceConsumed = slice.consumedQty || 0;
                    if (sliceConsumed > 0) {
                      formingLotsForJob.push({
                        id: slice.sliceId,
                        batchId: fb.batchId,
                        producedByOperator: `${slice.operator} (${slice.shift})`,
                        consumedQty: sliceConsumed
                      });
                    }
                  });

                  const untrackedConsumed = Math.max(0, consumedP - slicesConsumedP);
                  if (untrackedConsumed > 0) {
                    formingLotsForJob.push({
                      id: fb.batchId,
                      batchId: fb.batchId,
                      producedByOperator: fb.worker || 'Direct Forwarded',
                      consumedQty: untrackedConsumed
                    });
                  }
                } else {
                  if (consumedP > 0) {
                    formingLotsForJob.push({
                      id: fb.batchId,
                      batchId: fb.batchId,
                      producedByOperator: fb.worker || 'Direct/Untracked',
                      consumedQty: consumedP
                    });
                  }
                }
              });

              if (formingLotsForJob.length > 0) {
                return (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Select Forming Operator Lot to Return To:
                    </label>
                    <select
                      value={unissueTargetLotId}
                      onChange={(e) => {
                        setUnissueTargetLotId(e.target.value);
                        const chosenLot = formingLotsForJob.find(l => l.id === e.target.value);
                        if (chosenLot) {
                          const cappedQty = Math.min(activeBatchObj.batch.issuedQty || 0, chosenLot.consumedQty || 0);
                          if (parseFloat(unissueQtyInput) > cappedQty || !unissueQtyInput) {
                            setUnissueQtyInput(String(cappedQty));
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs font-bold text-slate-800 bg-white outline-none focus:border-amber-500"
                    >
                      {formingLotsForJob.map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          👨‍🏭 {lot.producedByOperator} ({lot.id}) — Consumed: {lot.consumedQty || 0} Crates
                        </option>
                      ))}
                      <option value="">
                        Auto-Restore across all consumed lots (LIFO)
                      </option>
                    </select>
                  </div>
                );
              }
              return null;
            })()}

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

      {/* Topup Modal */}
      {isTopupModalOpen && activeBatchObj && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <PlusCircle className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 m-0">Top-up Crates to Inspector</h3>
                <p className="text-[11px] text-slate-500 m-0">Add more formed crates to the same inspector without creating duplicate entries</p>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-xl text-xs space-y-1 text-blue-950">
              <div>Inspector: <b>{activeBatchObj.batch.worker}</b></div>
              <div>Job: <b>{activeBatchObj.job.id}</b> ({activeBatchObj.job.product})</div>
              <div>Currently in Hand: <b>{activeBatchObj.batch.issuedQty} Crates</b></div>
              <div className="text-emerald-800 font-bold">
                Available in Forming Stock: <b>{(activeBatchObj.job.availableFormingCrates || 0) + (activeBatchObj.job.availableForQcCrates || 0)} Crates</b>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Enter Additional Crates to Give:
              </label>
              <input
                type="number"
                min="1"
                max={(activeBatchObj.job.availableFormingCrates || 0) + (activeBatchObj.job.availableForQcCrates || 0) || 999}
                value={topupQtyInput}
                onChange={(e) => setTopupQtyInput(e.target.value)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm font-bold text-slate-800 outline-none"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                {[1, 2, 4, 6].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setTopupQtyInput(String(q))}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md border cursor-pointer ${
                      topupQtyInput === String(q)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    +{q} Crates
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTopupModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmTopupCrates()}
                className="px-4 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer shadow-xs flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> Confirm Top-up
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Zero Tolerance Audit Mismatch Error Modal */}
      {auditMismatchError && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border-2 border-rose-500 animate-in fade-in duration-150">
            <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
              <AlertTriangle className="w-7 h-7 shrink-0" />
              <div>
                <h3 className="text-base font-black text-rose-950 uppercase tracking-wide m-0">
                  🚫 ZERO TOLERANCE AUDIT BLOCK!
                </h3>
                <p className="text-xs font-bold text-rose-700 m-0">QC Quantity Overload Detected</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs space-y-2 text-rose-950">
              <div className="font-extrabold text-sm text-rose-900 leading-snug">
                {auditMismatchError.details}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rose-200/80 font-bold">
                <div className="bg-white p-2.5 rounded-lg border border-rose-200">
                  <span className="text-slate-500 block text-[10px] uppercase">Issued Input:</span>
                  <span className="text-slate-900 font-black text-sm">
                    {auditMismatchError.inputCrates} Crates ({auditMismatchError.inputPcs.toLocaleString()} Pcs)
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-rose-200">
                  <span className="text-rose-600 block text-[10px] uppercase">Attempted Output:</span>
                  <span className="text-rose-700 font-black text-sm">
                    {auditMismatchError.outputCrates} Crates ({auditMismatchError.outputPcs.toLocaleString()} Pcs)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAuditMismatchError(null)}
                className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Acknowledge & Correct Quantities</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lot Genealogy Modal */}
      <LotGenealogyModal
        isOpen={!!genealogyModalJob}
        onClose={() => setGenealogyModalJob(null)}
        job={genealogyModalJob}
        state={state}
      />
    </div>
  );
};
