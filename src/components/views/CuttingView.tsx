import React, { useState, useEffect } from 'react';
import { ArrowLeft, Scissors, Play, Pause, Square, Zap, Undo2, XCircle, Check, Layers, AlertCircle, Box, Wrench, Search, ShieldCheck, CheckCircle2, AlertTriangle, RotateCcw, Calendar, Clock, Droplets, Users, UserCheck, Recycle, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { FactoryState, Job, ProductType, RunningBatch, OperatorRunSlice, LogEntry, GlueUsageEntry } from '../../types';
import { PRODUCTS, DEPT_WORKERS, MACHINES } from '../../lib/constants';
import { getCurrentExpectedShift, getJobAllReels, getJobReelsSummary, getJobReelItemsBreakdown, getJobAllGsms } from '../../lib/utils';
import { getNumberingMaster, generateCuttingBatchId } from '../../lib/numberingMaster';
import { MachineBreakdownBanner } from '../MachineBreakdownBanner';
import { LotGenealogyModal } from '../LotGenealogyModal';
import { ShiftHandoverModal } from '../ShiftHandoverModal';
import { StationCrewModal } from '../StationCrewModal';
import { GlueUsageModal } from '../GlueUsageModal';
import { LiveFloorManpowerTracker } from '../LiveFloorManpowerTracker';

interface CuttingViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  onOpenHoldModal: (machineName: string) => void;
  onOpenAttendModal?: (machineName: string) => void;
  onNavigateToTraceability?: (query: string) => void;
}

const DEFAULT_PCS_PER_KG_MAP: Record<string, number> = {
  Spoon: 500,
  Fork: 520,
  Knife: 480,
  'Dessert Spoon': 550,
  Tea: 600
};

export const CuttingView: React.FC<CuttingViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onOpenHoldModal,
  onOpenAttendModal,
  onNavigateToTraceability
}) => {
  const { jobs, shiftConfig } = state;
  const cutWorkers = state.deptWorkers?.['Cutting'] || DEPT_WORKERS['Cutting'] || ['CUT_OP1', 'CUT_OP2', 'VIKRAM_CUT'];

  const [filterProduct, setFilterProduct] = useState<string>('');
  const [selectedMachine, setSelectedMachine] = useState('Cutting-1');
  const [shift, setShift] = useState<'DAY' | 'NIGHT'>(() => getCurrentExpectedShift(shiftConfig));
  const [operatorName, setOperatorName] = useState(cutWorkers[0] || 'CUT_OP1');
  const [selectedPendingJobId, setSelectedPendingJobId] = useState('');
  const [issueRollsQty, setIssueRollsQty] = useState('');

  const [outputCrates, setOutputCrates] = useState('');
  const [loosePiecesInput, setLoosePiecesInput] = useState('0');
  const [pcsPerCrateOverride, setPcsPerCrateOverride] = useState<string>('');
  const [scrapKg, setScrapKg] = useState('0');
  const [pcsPerKgInput, setPcsPerKgInput] = useState<string>('');
  const [rejectedPcsInput, setRejectedPcsInput] = useState<string>('');
  const [selectedActiveBatchId, setSelectedActiveBatchId] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [actualGlueConsumed, setActualGlueConsumed] = useState<string>('');
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [lastShownSpecBatchId, setLastShownSpecBatchId] = useState('');

  // Assigned Helpers for Cutting Station
  const [assignedHelpers, setAssignedHelpers] = useState<string[]>(['SUNIL_HELPER', 'DINESH_HELPER']);
  const [newHelperInput, setNewHelperInput] = useState('');

  // Dialog states for Quick Actions (Replacing window.prompt)
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardQtyInput, setForwardQtyInput] = useState('');

  const [isUnissueModalOpen, setIsUnissueModalOpen] = useState(false);
  const [unissueQtyInput, setUnissueQtyInput] = useState('');

  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  // Strict Quantity & Crate Audit Error Modal State
  const [auditMismatchError, setAuditMismatchError] = useState<{
    outputPcs: number;
    outputCrates: number;
    inputPcs: number;
    inputCrates: number;
    scrapPcs?: number;
    details: string;
  } | null>(null);

  // Genealogy Modal Job State
  const [genealogyModalJob, setGenealogyModalJob] = useState<Job | null>(null);

  // Shift Handover Modal State
  const [isShiftHandoverModalOpen, setIsShiftHandoverModalOpen] = useState(false);

  // Dialog states for Glue Usage & Station Crew Modals
  const [isGlueModalOpen, setIsGlueModalOpen] = useState(false);
  const [isCrewModalOpen, setIsCrewModalOpen] = useState(false);
  const [showLiveManpowerRoster, setShowLiveManpowerRoster] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Pending queue of slit rolls
  let pendingSlitJobs = jobs.filter((j) => {
    const hasRolls = (j.availableRolls || 0) > 0;
    const isReadyOrInProgress = j.status === 'READY_FOR_CUTTING' || j.status === 'CUTTING_IN_PROGRESS';
    return hasRolls && isReadyOrInProgress;
  });
  if (filterProduct) {
    pendingSlitJobs = pendingSlitJobs.filter((j) => j.product === filterProduct);
  }

  const selectedPendingJob = jobs.find((j) => j.id === selectedPendingJobId);

  // Active running / held batches on selected machine
  const activeBatches: Array<{ job: Job; batch: RunningBatch }> = [];
  jobs.forEach((j) => {
    if (j.runningBatches) {
      j.runningBatches.forEach((b) => {
        if (b.machine === selectedMachine && (b.status === 'Running' || b.status === 'Held')) {
          activeBatches.push({ job: j, batch: b });
        }
      });
    }
  });

  const activeBatchObj =
    activeBatches.find((item) => item.batch?.batchId === selectedActiveBatchId) || activeBatches[0];

  useEffect(() => {
    if (activeBatchObj && activeBatchObj.batch && activeBatchObj.batch.batchId) {
      if (activeBatchObj.batch.batchId !== lastShownSpecBatchId) {
        setShowSpecModal(true);
        setLastShownSpecBatchId(activeBatchObj.batch.batchId);
        setActualGlueConsumed(activeBatchObj.batch.glueUsageKg ? String(activeBatchObj.batch.glueUsageKg) : '');
      }
    } else {
      setShowSpecModal(false);
    }
  }, [activeBatchObj?.batch.batchId, lastShownSpecBatchId]);

  const standardCutPcs = activeBatchObj?.job.pcsPerCrateCutting || (activeBatchObj ? state.crateCapacityMaster?.[activeBatchObj.job.product]?.cuttingPcs : 10000) || 10000;
  const effectiveCutPcs = pcsPerCrateOverride !== '' ? (parseInt(pcsPerCrateOverride, 10) || standardCutPcs) : standardCutPcs;

  const defaultPcsPerKg = activeBatchObj?.job.cuttingPcsPerKg || activeBatchObj?.batch.pcsPerKg || DEFAULT_PCS_PER_KG_MAP[activeBatchObj?.job.product || ''] || 500;
  const effectivePcsPerKg = pcsPerKgInput !== '' ? (parseFloat(pcsPerKgInput) || defaultPcsPerKg) : defaultPcsPerKg;

  // CRITICAL USER DIRECTIVE:
  // User requirement: Add separate cutting scrap. Extra material scrap from cutting should not minus from pieces. Only reject pieces will minus. Keep them separate.
  // 1. Cutting Material Scrap (KG) = Extra paper scrap/trim. NEVER subtracted from pieces!
  // 2. Rejected Pieces (Pcs) = Defective blanks. ONLY this is subtracted from gross pieces!
  const handleScrapKgChange = (val: string) => {
    setScrapKg(val);
  };

  const handleRejectedPcsChange = (val: string) => {
    setRejectedPcsInput(val);
  };

  const handlePcsPerKgChange = (val: string) => {
    setPcsPerKgInput(val);
  };

  const handleGlueConsumedChange = (val: string) => {
    setActualGlueConsumed(val);
    if (!activeBatchObj) return;
    const numericVal = parseFloat(val) || 0;
    const brandToDeduct = activeBatchObj.job.targetGlueBrand || 'Pidilite W-10 (Food Grade Adhesive)';

    const updatedJobs = jobs.map((j) => {
      if (j.id !== activeBatchObj.job.id) return j;
      return {
        ...j,
        glueUsageKg: numericVal,
        glueBrand: brandToDeduct,
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== activeBatchObj.batch.batchId) return b;
          return {
            ...b,
            glueBrand: brandToDeduct,
            glueUsageKg: numericVal
          };
        })
      };
    });

    onSaveState({
      ...state,
      jobs: updatedJobs
    });
  };

  // Live output numbers: Crates (in pcs) + Loose Pieces (-) ONLY Rejected Pieces = Net Main Counter Output
  // Cutting Material Scrap (in KG) is extra scrap recorded separately and NEVER subtracted from pieces!
  const liveCratesDone = parseFloat(outputCrates) || 0;
  const liveLooseDone = parseInt(loosePiecesInput, 10) || 0;
  const liveScrapKgVal = parseFloat(scrapKg) || 0;
  const liveRejectedPcsVal = parseInt(rejectedPcsInput, 10) || 0;
  const liveGrossCutPcs = Math.round(liveCratesDone * effectiveCutPcs) + liveLooseDone;
  const liveNetCutPcs = Math.max(0, liveGrossCutPcs - liveRejectedPcsVal);

  const handleStartRun = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorName.trim()) {
      alert('⚠️ Mandatory: Cutting Operator Name is required!');
      return;
    }
    if (!selectedPendingJobId) {
      alert('Please select a Slit Rolls Job from queue!');
      return;
    }
    const rollsCount = parseInt(issueRollsQty, 10) || 0;
    if (rollsCount <= 0) {
      alert('Please enter valid rolls quantity to issue!');
      return;
    }

    const job = jobs.find((j) => j.id === selectedPendingJobId);
    if (!job || (job.availableRolls || 0) < rollsCount) {
      alert(`Insufficient slit rolls! Available: ${job?.availableRolls || 0}`);
      return;
    }

    // Check if machine is running another job
    const activeRunning = activeBatches.find((b) => b.batch.status === 'Running');
    if (activeRunning && activeRunning.job.id !== job.id) {
      alert(
        `⚠️ MACHINE BUSY WITH DIFFERENT JOB!\nMachine [${selectedMachine}] is currently running Job [${activeRunning.job.id}].\nYou cannot start a new Job [${job.id}] until the active job is Finished or Placed on Hold.`
      );
      return;
    }

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let updatedJobs: Job[] = [];
    let logMessage = '';

    if (activeRunning && activeRunning.job.id === job.id) {
      // Same-job Top-up
      updatedJobs = jobs.map((j) => {
        if (j.id !== job.id) return j;
        return {
          ...j,
          availableRolls: (j.availableRolls || 0) - rollsCount,
          runningBatches: (j.runningBatches || []).map((b) => {
            if (b.batchId !== activeRunning.batch.batchId) return b;
            return {
              ...b,
              issuedQty: (b.issuedQty || 0) + rollsCount
            };
          })
        };
      });
      logMessage = `Cutting Top-up on ${selectedMachine} (+${rollsCount} Rolls Added to Running Batch)`;
      alert(`✅ Top-up Successful! Added ${rollsCount} more rolls to running Job ${job.id} on ${selectedMachine}.`);
    } else {
      // Fresh batch
      const master = getNumberingMaster(state.seriesConfig);
      const batchId = generateCuttingBatchId(job.id, job.runningBatches || [], master);
      const allJobReels = getJobAllReels(job);
      const reelsSummary = getJobReelsSummary(job);
      const slitBatchId = job.runningBatches?.find((b) => b.stage === 'Slitting' || b.machine.startsWith('Slitting'))?.batchId || job.tracedLots?.Slitting || `${job.id}-SLIT-01`;
      const newBatch: RunningBatch = {
        batchId,
        stage: 'Cutting',
        machine: selectedMachine,
        shift,
        startTime: nowTime,
        status: 'Running',
        parentBatchId: slitBatchId,
        parentReelNo: allJobReels[0] || job.reelNo || '',
        reelNo: allJobReels.join(', '),
        reelNumbers: allJobReels,
        reelsSummary,
        gsm: job.gsm,
        issuedQty: rollsCount,
        producedQty: 0,
        worker: operatorName.trim().toUpperCase(),
        helpers: assignedHelpers,
        helperCount: assignedHelpers.length,
        user: 'cut_user'
      };

      updatedJobs = jobs.map((j) => {
        if (j.id !== job.id) return j;
        return {
          ...j,
          tracedLots: { ...(j.tracedLots || {}), Cutting: batchId, Slitting: j.tracedLots?.Slitting || slitBatchId },
          availableRolls: (j.availableRolls || 0) - rollsCount,
          status: 'CUTTING_IN_PROGRESS',
          runningBatches: [...(j.runningBatches || []), newBatch]
        };
      });

      logMessage = `Started Cutting on ${selectedMachine} (${rollsCount} Rolls Issued) | Worker: ${operatorName.toUpperCase()}`;
      setSelectedActiveBatchId(batchId);
      alert(`✅ Cutting Job ${job.id} Loaded on ${selectedMachine} (${rollsCount} Rolls)!`);
    }

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Cutting',
      machine: selectedMachine,
      shift,
      action: logMessage,
      worker: operatorName.toUpperCase(),
      user: 'cut_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    setIssueRollsQty('');
    setSelectedPendingJobId('');
  };

  const handleConfirmForwardPartial = () => {
    if (!activeBatchObj) return;
    const qty = parseFloat(forwardQtyInput) || 0;
    if (qty <= 0) {
      alert('Please enter a valid quantity of cut crates to forward!');
      return;
    }

    const { job, batch } = activeBatchObj;
    const forwardedPcs = Math.round(qty * effectiveCutPcs);
    const inputRolls = batch.issuedQty || 0;

    // Physical yield conservation check: configurable from Admin settings
    const maxPcsPerRoll = state.maxPiecesPerSlitRoll || 30000;
    const totalMaxTheoreticalInputPieces = (inputRolls > 0 ? inputRolls : 1) * maxPcsPerRoll;
    const prevProducedPieces = batch.producedPieces || 0;
    const cumulativeOutputPieces = prevProducedPieces + forwardedPcs;
    const cumulativeOutputCrates = (batch.producedQty || 0) + qty;

    if (state.strictAuditRollYield && inputRolls > 0 && cumulativeOutputPieces > totalMaxTheoreticalInputPieces) {
      const estimatedInputCratesEquivalent = Math.ceil(totalMaxTheoreticalInputPieces / effectiveCutPcs);
      setAuditMismatchError({
        outputPcs: cumulativeOutputPieces,
        outputCrates: cumulativeOutputCrates,
        inputPcs: totalMaxTheoreticalInputPieces,
        inputCrates: estimatedInputCratesEquivalent,
        scrapPcs: 0,
        details: `Audit Mismatch: Output quantity (${(cumulativeOutputPieces ?? 0).toLocaleString()} pcs across ${cumulativeOutputCrates} crates) exceeds issued input quantity (${(totalMaxTheoreticalInputPieces ?? 0).toLocaleString()} pcs across ${estimatedInputCratesEquivalent} crates). Entry blocked.`
      });
      return;
    }

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        pcsPerCrateCutting: effectiveCutPcs,
        availableCuttingCrates: (j.availableCuttingCrates || 0) + qty,
        totalCutPieces: (j.totalCutPieces || 0) + forwardedPcs,
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return {
            ...b,
            producedQty: (b.producedQty || 0) + qty,
            pcsPerCrate: effectiveCutPcs,
            producedPieces: (b.producedPieces || 0) + forwardedPcs
          };
        })
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Cutting Forward',
      machine: selectedMachine,
      shift: batch.shift,
      action: `⚡ Partial Forward: ${qty} Cut Crates (= ${forwardedPcs.toLocaleString()} Flat Blanks) forwarded to Forming Desk (Batch #${batch.batchId})`,
      worker: batch.worker,
      user: 'cut_user',
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
    alert(`✅ Forwarded ${qty} Cut Crates to Forming Queue! Machine remains RUNNING.`);
  };

  const handleConfirmQuickUnissue = () => {
    if (!activeBatchObj) return;
    const qty = parseInt(unissueQtyInput, 10) || 0;
    if (qty <= 0) {
      alert('Please enter a valid quantity of slit rolls to return!');
      return;
    }

    const { job, batch } = activeBatchObj;
    const curIssued = batch.issuedQty || 0;
    if (qty > curIssued) {
      alert(`Cannot un-issue more than currently issued rolls count (${curIssued})!`);
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
        availableRolls: (j.availableRolls || 0) + qty,
        runningBatches: updatedBatches
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Cutting Un-issue',
      machine: selectedMachine,
      shift: batch.shift,
      action: `↩️ Quick Un-issue: ${qty} Slit Rolls returned to Slitting Stock (Remaining: ${remaining})`,
      worker: batch.worker,
      user: 'cut_user',
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
    alert(`✅ Returned ${qty} Slit Rolls back to Slitting Stock!`);
  };

  const handleConfirmShiftHandover = (handoverData: {
    relievedByOperator: string;
    nextShift: 'DAY' | 'NIGHT' | string;
    handoverTime: string;
    meterReading?: number;
    sliceProducedQty: number;
    sliceProducedPieces?: number;
    sliceLoosePieces?: number;
    sliceScrapQty: number;
    helpers?: string[];
    handoverNotes?: string;
  }) => {
    if (!activeBatchObj) return;
    const { job, batch } = activeBatchObj;

    const producedPiecesSlice =
      handoverData.sliceProducedPieces ||
      (Math.round(handoverData.sliceProducedQty * effectiveCutPcs) + (handoverData.sliceLoosePieces || 0));

    const nextHelpers = handoverData.helpers && handoverData.helpers.length > 0 ? handoverData.helpers : assignedHelpers;

    const newSlice: OperatorRunSlice = {
      sliceId: `SLICE-CUT-${Date.now()}`,
      operator: batch.worker,
      relievedByOperator: handoverData.relievedByOperator,
      shift: batch.shift || 'DAY',
      startTime: batch.startTime,
      handoverTime: handoverData.handoverTime,
      startMeterReading: batch.startMeterReading || batch.meterReading,
      endMeterReading: handoverData.meterReading,
      strokeCount: handoverData.meterReading,
      producedQty: handoverData.sliceProducedQty,
      loosePieces: handoverData.sliceLoosePieces || 0,
      producedPieces: producedPiecesSlice,
      scrapQty: handoverData.sliceScrapQty,
      scrapKg: handoverData.sliceScrapQty,
      notes: handoverData.handoverNotes || '',
      helpers: batch.helpers || assignedHelpers,
      helperCount: (batch.helpers || assignedHelpers)?.length || 0,
      handoverConfirmed: true
    };

    const updatedBatches = (job.runningBatches || []).map((b) => {
      if (b.batchId === batch.batchId) {
        return {
          ...b,
          worker: handoverData.relievedByOperator,
          shift: handoverData.nextShift,
          meterReading: handoverData.meterReading,
          startMeterReading: handoverData.meterReading,
          producedQty: (b.producedQty || 0) + handoverData.sliceProducedQty,
          producedPieces: (b.producedPieces || 0) + producedPiecesSlice,
          scrapKg: (b.scrapKg || 0) + handoverData.sliceScrapQty,
          loosePieces: 0, // Reset for incoming operator
          helpers: nextHelpers,
          helperCount: nextHelpers.length,
          slices: [...(b.slices || []), newSlice]
        };
      }
      return b;
    });

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        availableCuttingCrates: (j.availableCuttingCrates || 0) + handoverData.sliceProducedQty,
        totalCutPieces: (j.totalCutPieces || 0) + producedPiecesSlice,
        runningBatches: updatedBatches
      };
    });

    // Update Floor Workers roster if present
    const updatedFloorWorkers = (state.floorWorkers || []).map((w) => {
      if (w.assignedMachine === selectedMachine && w.role === 'OPERATOR') {
        return {
          ...w,
          name: handoverData.relievedByOperator,
          shift: handoverData.nextShift as 'DAY' | 'NIGHT',
          isPresent: true
        };
      }
      return w;
    });

    const handoverLog: LogEntry = {
      jobId: job.id,
      product: job.product,
      stage: 'Cutting',
      machine: selectedMachine,
      shift: handoverData.nextShift,
      action: `🔄 Shift Handover: Operator [${batch.worker}] handed over active run [${batch.batchId}] to [${handoverData.relievedByOperator}] (${handoverData.nextShift})${nextHelpers.length ? ` with ${nextHelpers.length} Helpers (${nextHelpers.join(', ')})` : ''}. Locked slice: ${handoverData.sliceProducedQty} Cut Crates, ${handoverData.sliceLoosePieces || 0} Loose Pcs, ${handoverData.sliceScrapQty}kg Scrap, Meter: ${handoverData.meterReading || 'N/A'}.`,
      worker: handoverData.relievedByOperator,
      user: 'cut_supervisor',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      floorWorkers: updatedFloorWorkers.length > 0 ? updatedFloorWorkers : state.floorWorkers,
      logs: [handoverLog, ...(state.logs || [])]
    });

    setOutputCrates('');
    setLoosePiecesInput('0');
    setScrapKg('0');
    setOperatorName(handoverData.relievedByOperator);
    setShift(handoverData.nextShift as 'DAY' | 'NIGHT');
    setAssignedHelpers(nextHelpers);
    setIsShiftHandoverModalOpen(false);

    alert(
      `✅ Cutting Shift Handover completed successfully!

` +
      `Outgoing Operator [${batch.worker}] secured record:
` +
      `• Full Crates: ${handoverData.sliceProducedQty} Crates\n` +
      `• Loose Pieces: ${handoverData.sliceLoosePieces || 0} Pcs\n` +
      `• Total Prepared Blanks: ${producedPiecesSlice.toLocaleString()} Pieces\n` +
      `• Rejection Scrap: ${handoverData.sliceScrapQty} KG\n\n` +
      `Machine [${selectedMachine}] ongoing charge operator ${handoverData.relievedByOperator} (${handoverData.nextShift} Shift)${nextHelpers.length > 0 ? ` + ${nextHelpers.length} Helpers (${nextHelpers.join(', ')})` : ''} without stopping work.`
    );
  };

  const handleConfirmCrew = (operator: string, helpers: string[]) => {
    setOperatorName(operator);
    setAssignedHelpers(helpers);
    setIsCrewModalOpen(false);

    // If there is an active batch on this machine, update it immediately
    if (activeBatchObj) {
      const { job, batch } = activeBatchObj;
      const updatedJobs = jobs.map((j) => {
        if (j.id !== job.id) return j;
        return {
          ...j,
          runningBatches: (j.runningBatches || []).map((b) => {
            if (b.batchId !== batch.batchId) return b;
            return {
              ...b,
              worker: operator.trim().toUpperCase(),
              helpers: helpers,
              helperCount: helpers.length
            };
          })
        };
      });

      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const updatedWorkers = (state.floorWorkers || []).map((w) => {
        if (w.name.toUpperCase() === operator.trim().toUpperCase()) {
          return {
            ...w,
            assignedMachine: selectedMachine,
            isPresent: true,
            status: 'PRODUCING' as const,
            inTime: w.inTime || nowTime
          };
        }
        if (helpers.some((h) => h.toUpperCase() === w.name.toUpperCase())) {
          return {
            ...w,
            assignedMachine: selectedMachine,
            pairedWithOperator: operator.trim().toUpperCase(),
            isPresent: true,
            status: 'PRODUCING' as const,
            inTime: w.inTime || nowTime
          };
        }
        // Unpair previously assigned helpers for this machine or operator
        if (w.role === 'HELPER' && (w.assignedMachine === selectedMachine || w.pairedWithOperator === operator.trim().toUpperCase())) {
          return {
            ...w,
            assignedMachine: undefined,
            pairedWithOperator: undefined,
            status: undefined
          };
        }
        return w;
      });

      const crewLog: LogEntry = {
        jobId: job.id,
        product: job.product,
        stage: 'Cutting',
        machine: selectedMachine,
        shift: batch.shift,
        action: `👥 Station Crew Assigned: Operator [${operator}] with ${helpers.length} Helpers (${helpers.join(', ')}) on ${selectedMachine} for Batch [${batch.batchId}]`,
        worker: operator,
        user: 'cut_supervisor',
        rawDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      };

      onSaveState({
        ...state,
        jobs: updatedJobs,
        floorWorkers: updatedWorkers.length > 0 ? updatedWorkers : state.floorWorkers,
        logs: [crewLog, ...(state.logs || [])]
      });
    }
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
      stage: 'Cutting',
      machine: selectedMachine,
      shift: batch.shift,
      action: `▶️ Cutting Run Resumed to RUNNING | Worker: ${batch.worker}`,
      worker: batch.worker,
      user: 'cut_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog]
    });

    alert(`▶️ Job [${job.id}] resumed to RUNNING on ${selectedMachine}!`);
  };


  const executeFinishJob = () => {
    try {
      setIsSaving(true);
      if (!activeBatchObj) throw new Error('Select batch to finish!');
      
      const cratesDone = parseFloat(outputCrates) || 0;
      const looseDone = parseInt(loosePiecesInput, 10) || 0;
      const materialScrapKgVal = parseFloat(scrapKg) || 0;
      const rejectedPcsVal = parseInt(rejectedPcsInput, 10) || 0;
      const glueUsedVal = parseFloat(actualGlueConsumed) || 0;

      const { job, batch } = activeBatchObj;

      const grossCutPcs = Math.round(cratesDone * effectiveCutPcs) + looseDone;
      const totalCutPcs = Math.max(0, grossCutPcs - rejectedPcsVal);
      const inputRolls = batch.issuedQty || 0;

      const maxPcsPerRoll = state.maxPiecesPerSlitRoll || 30000;
      const totalMaxTheoreticalInputPieces = (inputRolls > 0 ? inputRolls : 1) * maxPcsPerRoll;
      const prevProducedPieces = batch.producedPieces || 0;
      const prevProducedCrates = batch.producedQty || 0;
      const cumulativeOutputPieces = prevProducedPieces + totalCutPcs;
      const cumulativeOutputCrates = prevProducedCrates + cratesDone;

      if (state.strictAuditRollYield && inputRolls > 0 && cumulativeOutputPieces > totalMaxTheoreticalInputPieces) {
        const estimatedInputCratesEquivalent = Math.ceil(totalMaxTheoreticalInputPieces / effectiveCutPcs);
        setAuditMismatchError({
          outputPcs: cumulativeOutputPieces,
          outputCrates: cumulativeOutputCrates,
          inputPcs: totalMaxTheoreticalInputPieces,
          inputCrates: estimatedInputCratesEquivalent,
          scrapPcs: rejectedPcsVal,
          details: `Audit Mismatch: Output quantity (${(cumulativeOutputPieces ?? 0).toLocaleString()} pcs across ${cumulativeOutputCrates} crates) exceeds issued input quantity (${(totalMaxTheoreticalInputPieces ?? 0).toLocaleString()} pcs across ${estimatedInputCratesEquivalent} crates). Entry blocked.`
        });
        setIsSaving(false);
        return;
      }

      const stopTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const brandToDeduct = job.targetGlueBrand || 'Pidilite W-10 (Food Grade Adhesive)';

      const updatedJobs = jobs.map((j) => {
        if (j.id !== job.id) return j;
        return {
          ...j,
          pcsPerCrateCutting: effectiveCutPcs,
          availableCuttingCrates: (j.availableCuttingCrates || 0) + cratesDone,
          totalCutPieces: (j.totalCutPieces || 0) + totalCutPcs,
          cuttingLoosePcs: (j.cuttingLoosePcs || 0) + looseDone,
          cuttingScrapKg: (j.cuttingScrapKg || 0) + materialScrapKgVal,
          cuttingMaterialScrapKg: (j.cuttingMaterialScrapKg || 0) + materialScrapKgVal,
          cuttingRejectedPcs: (j.cuttingRejectedPcs || 0) + rejectedPcsVal,
          cuttingScrapPcs: (j.cuttingScrapPcs || 0) + rejectedPcsVal,
          cuttingPcsPerKg: effectivePcsPerKg,
          glueUsageKg: (j.glueUsageKg || 0) + glueUsedVal,
          glueBrand: brandToDeduct,
          runningBatches: (j.runningBatches || []).map((b) => {
            if (b.batchId !== batch.batchId) return b;
            const finalSlices = [...(b.slices || [])];
            if (finalSlices.length > 0) {
              finalSlices.push({
                sliceId: `SLC-${Date.now()}-${finalSlices.length + 1}`,
                operator: b.worker,
                shift: b.shift,
                producedQty: cratesDone,
                producedPieces: totalCutPcs,
                grossPieces: grossCutPcs,
                scrapQty: materialScrapKgVal,
                scrapPcs: rejectedPcsVal,
                cuttingMaterialScrapKg: materialScrapKgVal,
                rejectedPieces: rejectedPcsVal,
                pcsPerKg: effectivePcsPerKg,
                handoverTime: stopTime,
                notes: 'Final Run Completion'
              });
            }
            return {
              ...b,
              status: 'Completed',
              endTime: stopTime,
              producedQty: (b.producedQty || 0) + cratesDone,
              pcsPerCrate: effectiveCutPcs,
              producedPieces: (b.producedPieces || 0) + totalCutPcs,
              grossPieces: (b.grossPieces || 0) + grossCutPcs,
              loosePieces: looseDone,
              scrapKg: (b.scrapKg || 0) + materialScrapKgVal,
              cuttingMaterialScrapKg: (b.cuttingMaterialScrapKg || 0) + materialScrapKgVal,
              scrapPcs: (b.scrapPcs || 0) + rejectedPcsVal,
              rejectedPieces: (b.rejectedPieces || 0) + rejectedPcsVal,
              pcsPerKg: effectivePcsPerKg,
              glueBrand: brandToDeduct,
              glueUsageKg: (b.glueUsageKg || 0) + glueUsedVal,
              slices: finalSlices
            };
          })
        };
      });

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let glueDeductedMsg = '';
      const updatedRequisitions = (state.materialRequisitions || []).map((req) => {
        if (
          glueUsedVal > 0 &&
          req.status === 'RECEIVED' &&
          (req.itemName.toLowerCase().includes(brandToDeduct.toLowerCase()) ||
            req.itemCategory.toLowerCase().includes('adhesive') ||
            req.itemName.toLowerCase().includes('glue')) &&
          (req.receivedQty || 0) >= glueUsedVal
        ) {
          glueDeductedMsg = ` (Deducted ${glueUsedVal} KG from Warehouse PO Stock Requisition ${req.id})`;
          return {
            ...req,
            receivedQty: Math.max(0, (req.receivedQty || 0) - glueUsedVal)
          };
        }
        return req;
      });

      let nextGlueLogs = [...(state.glueUsageLogs || [])];
      if (glueUsedVal > 0) {
        const newGlueEntry: GlueUsageEntry = {
          id: `GLUE-${Date.now()}`,
          date: dateStr,
          time: timeStr,
          shift: batch.shift || shift,
          machine: selectedMachine,
          stage: 'Cutting',
          jobId: job.id,
          batchId: batch.batchId,
          product: job.product,
          glueBrand: brandToDeduct,
          quantityKg: glueUsedVal,
          operator: batch.worker || operatorName,
          user: 'cut_user',
          createdAt: now.toISOString()
        };
        nextGlueLogs = [newGlueEntry, ...nextGlueLogs];
      }

      const newLog = {
        jobId: job.id,
        product: job.product,
        stage: 'Cutting',
        machine: selectedMachine,
        shift: batch.shift,
        action: `⏹️ Finished Cutting Batch ${batch.batchId} (${cratesDone} Crates + ${looseDone} Loose = ${grossCutPcs.toLocaleString()} Gross - ${rejectedPcsVal.toLocaleString()} Rejected Pcs = ${totalCutPcs.toLocaleString()} Net Passed Cut Blanks | Extra Paper Scrap: ${materialScrapKgVal} KG [Added separately to scrap, not minus from pieces])${glueUsedVal > 0 ? ` | Adhesive Glue Consumed: ${glueUsedVal} KG of ${brandToDeduct}${glueDeductedMsg}` : ''}`,
        worker: batch.worker,
        user: 'cut_user',
        startTime: batch.startTime,
        endTime: stopTime,
        rawDate: dateStr,
        timestamp: now.toLocaleString()
      };

      onSaveState({
        ...state,
        jobs: updatedJobs,
        glueUsageLogs: nextGlueLogs,
        materialRequisitions: updatedRequisitions,
        logs: [...state.logs, newLog]
      });

      setOutputCrates('');
      setLoosePiecesInput('0');
      setPcsPerCrateOverride('');
      setScrapKg('0');
      setRejectedPcsInput('');
      setPcsPerKgInput('');
      setActualGlueConsumed('');
      setSelectedActiveBatchId('');
      alert(`✅ Cutting Run Finished!\nMain Counter: ${totalCutPcs.toLocaleString()} Net Flat Blanks (${cratesDone} Crates + ${looseDone} Loose - ${rejectedPcsVal.toLocaleString()} Rejected Pcs). Added to inventory.${glueUsedVal > 0 ? `\n• Glue Consumed: ${glueUsedVal} KG of ${brandToDeduct} recorded and deducted from inventory.` : ''}`);
    } catch (err: any) {
      console.error("Database Save Failed:", err);
      alert(`Database Save Failed: ${err.message}. Please check console or retry.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinish = () => {
    if (!activeBatchObj) return alert('Select batch to finish!');
    
    // VALIDATIONS
    if (!activeBatchObj.batch.worker) {
      alert('Cannot finish job: Operator Name is required.');
      return;
    }
    
    const hasHelpers = activeBatchObj.batch.helpers && activeBatchObj.batch.helpers.length > 0;
    if (!hasHelpers) {
      alert('Cannot finish job: Helper assignment is required.');
      return;
    }
    
    const cratesDone = parseFloat(outputCrates) || 0;
    const looseDone = parseInt(loosePiecesInput, 10) || 0;
    
    if (cratesDone <= 0 && looseDone <= 0) {
      alert('Cannot finish job: Actual Sheets Cut (Crates or Loose pieces) is required or invalid.');
      return;
    }
    
    if (scrapKg.trim() === '' || isNaN(parseFloat(scrapKg))) {
      alert('Cannot finish job: Cutting Skeleton Scrap (KG) is required or invalid.');
      return;
    }

    executeFinishJob();
  };

  const handleConfirmCancelRun = () => {
    if (!activeBatchObj) return;
    const { job, batch } = activeBatchObj;
    const rollsToReturn = batch.issuedQty || 0;

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        availableRolls: (j.availableRolls || 0) + rollsToReturn,
        runningBatches: (j.runningBatches || []).filter((b) => b.batchId !== batch.batchId)
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Cutting Cancelled',
      machine: selectedMachine,
      shift: batch.shift,
      action: `❌ Cutting Run Cancelled: Batch ${batch.batchId} deleted, ${rollsToReturn} slit rolls returned to stock.`,
      worker: batch.worker,
      user: 'cut_user',
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
    alert('✅ Cutting run cancelled and slit rolls restored.');
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
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#1a365d] uppercase tracking-wide m-0">
              2. Cutting Desk (Slit Rolls to Cut Pieces)
            </h3>
            <p className="text-[11px] text-slate-500 m-0">
              Machine Floor Station Grid, Slit Roll Issuance & Cutting Runs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsGlueModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-300 px-3 py-1.5 rounded-lg transition cursor-pointer shadow-2xs"
            title="Record Glue Usage"
          >
            <Droplets className="w-4 h-4 text-teal-600" />
            <span>💧 Adhesive Glue (Glue Tracker)</span>
          </button>
          <button
            type="button"
            onClick={() => setShowLiveManpowerRoster((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-3 py-1.5 rounded-lg transition cursor-pointer shadow-2xs"
            title="View & Change Floor Manpower Roster"
          >
            <Users className="w-4 h-4 text-blue-600" />
            <span>👥 Live Manpower (Floor Roster)</span>
          </button>
        </div>
      </div>

      {/* Optional Expandable Live Floor Manpower Roster */}
      {showLiveManpowerRoster && (
        <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 space-y-3 relative shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h4 className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Live Cutting Floor Manpower Roster (Live Station Crew & Floor Manpower)</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowLiveManpowerRoster(false)}
              className="text-slate-500 hover:text-slate-800 text-xs font-bold px-2.5 py-1 bg-white border border-slate-300 rounded-lg cursor-pointer"
            >
              Close ✕
            </button>
          </div>
          <LiveFloorManpowerTracker state={state} onSaveState={onSaveState} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISUAL WORKSTATION FLOOR SELECTOR */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <Scissors className="w-4 h-4 text-blue-600" />
            Select Cutting Machine:
          </label>
          <span className="text-[11px] font-bold text-slate-500">
            Click any machine card to operate its template
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
          {MACHINES['Cutting'].map((mName) => {
            let mActiveBatch: { job: Job; batch: RunningBatch } | undefined;
            for (const j of jobs) {
              if (j.runningBatches) {
                const b = j.runningBatches.find(
                  (x) => x.machine === mName && (x.status === 'Running' || x.status === 'Held')
                );
                if (b) {
                  mActiveBatch = { job: j, batch: b };
                  break;
                }
              }
            }

            const isSelected = selectedMachine === mName;

            const activeInc = (state.maintenanceIncidents || []).find(
              (inc) => inc.machine === mName && (inc.status === 'OPEN' || inc.status === 'IN_PROGRESS')
            );
            const isUnderRepair = activeInc?.status === 'IN_PROGRESS';
            const isOpenDown = activeInc?.status === 'OPEN';

            let statusBadge = (
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                ⚪ IDLE
              </span>
            );

            if (isUnderRepair) {
              statusBadge = (
                <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                  <Wrench className="w-2.5 h-2.5" /> REPAIRING ({activeInc.technicianName || 'Tech'})
                </span>
              );
            } else if (isOpenDown || mActiveBatch?.batch.status === 'Held') {
              statusBadge = (
                <span className="text-[10px] font-extrabold text-red-800 bg-red-100 border border-red-300 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                  <Pause className="w-2.5 h-2.5 fill-red-600" /> DOWN
                </span>
              );
            } else if (mActiveBatch?.batch.status === 'Running') {
              statusBadge = (
                <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> RUNNING
                </span>
              );
            }

            return (
              <button
                key={mName}
                type="button"
                onClick={() => setSelectedMachine(mName)}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                  isSelected
                    ? isUnderRepair
                      ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-400/40 shadow-sm'
                      : isOpenDown
                      ? 'border-red-500 bg-red-50/70 ring-2 ring-red-400/40 shadow-sm'
                      : 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/40 shadow-sm'
                    : isUnderRepair
                    ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50'
                    : isOpenDown
                    ? 'border-red-300 bg-red-50/40 hover:bg-red-50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-extrabold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                    {mName}
                  </span>
                  {statusBadge}
                </div>

                {isUnderRepair && (
                  <div className="mb-2 p-1.5 bg-amber-100/90 border border-amber-300 rounded text-[11px] text-amber-950 font-bold">
                    👨‍🔧 Working: {activeInc?.technicianName}
                  </div>
                )}

                {isOpenDown && !isUnderRepair && (
                  <div className="mb-2 p-1.5 bg-red-100/90 border border-red-300 rounded text-[11px] text-red-950 font-bold">
                    ⚠️ {activeInc?.reason || 'Machine Down'}
                  </div>
                )}

                {mActiveBatch ? (
                  <div className="space-y-0.5 text-xs">
                    <div className="font-extrabold text-blue-950 truncate">{mActiveBatch.job.id}</div>
                    <div className="text-slate-600 font-semibold truncate">{mActiveBatch.job.product} ({mActiveBatch.job.paperBrand || 'ITC'})</div>
                    <div className="text-blue-700 font-bold">
                      {mActiveBatch.batch.issuedQty} Rolls Issued | Worker: {mActiveBatch.batch.worker}
                    </div>
                  </div>
                ) : !isUnderRepair && !isOpenDown ? (
                  <div className="text-xs text-slate-400 italic py-1">Ready for next cutting batch</div>
                ) : null}

                {isSelected && (
                  <div className="mt-2 pt-1 border-t border-blue-200/80 flex items-center justify-between text-[10px] font-extrabold text-blue-700">
                    <span>Active Screen</span>
                    <Check className="w-3.5 h-3.5 text-blue-700" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Machine Breakdown & Technician Attendance Banner */}
      <MachineBreakdownBanner
        machineName={selectedMachine}
        state={state}
        onOpenAttendModal={onOpenAttendModal || onOpenHoldModal}
        onOpenHoldModal={onOpenHoldModal}
      />

      {/* ======================================================== */}
      {/* ACTIVE BATCH CONTROLS FOR SELECTED MACHINE */}
      {/* ======================================================== */}
      <div className="border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
            <Layers className="w-4 h-4 text-blue-600" />
            Active Workstation Status: [{selectedMachine}]
          </h4>
          {activeBatchObj && (
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
                  <Play className="w-3 h-3 fill-emerald-700" /> ACTIVE RUNNING
                </>
              )}
            </span>
          )}
        </div>

        {activeBatches.length > 0 && activeBatchObj ? (
          <div className="space-y-4">
            {activeBatches.length > 1 && (
              <select
                value={selectedActiveBatchId || activeBatchObj?.batch.batchId}
                onChange={(e) => setSelectedActiveBatchId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                {activeBatches.map(({ job, batch }) => (
                  <option key={batch.batchId} value={batch.batchId}>
                    {job.id} [{job.product}] (Batch {batch.batchId}) - {batch.status.toUpperCase()}
                  </option>
                ))}
              </select>
            )}

            <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 rounded-xl space-y-2.5 text-xs shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 flex-wrap gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Job:</span>
                  <span className="font-extrabold text-sm text-blue-950">
                    {activeBatchObj.job.id} — <span className="text-slate-800">{activeBatchObj.job.product}</span>
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600 font-medium">
                    <span>Layers: <b className="text-slate-800">{activeBatchObj.job.targetLayers || 'N/A'}</b></span>
                    <span>GSM: <b className="text-slate-800">{activeBatchObj.job.targetGsm || activeBatchObj.job.gsm || 'N/A'}</b></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const activeJobReels = getJobAllReels(activeBatchObj.job);
                    return (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Jumbo Reels ({activeJobReels.length}):</span>
                        {activeJobReels.map((r, idx) => (
                          <span
                            key={idx}
                            className="font-mono text-xs bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-bold border border-blue-200"
                            title={`Jumbo Reel #${idx + 1}`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                  <span className="text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-200">
                    {activeBatchObj.job.gsm || activeBatchObj.job.targetGsm || '-'}
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold border border-slate-200">
                    {activeBatchObj.job.paperBrand || 'ITC'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 bg-white/80 p-2.5 rounded-lg border border-slate-200">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Operator:</span>
                    <button
                      type="button"
                      onClick={() => setIsCrewModalOpen(true)}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-extrabold flex items-center gap-0.5 cursor-pointer"
                      title="Change / Assign Crew & Helper"
                    >
                      <Users className="w-3 h-3" /> Change Crew
                    </button>
                  </div>
                  <b>{activeBatchObj.batch.worker}</b> ({activeBatchObj.batch.shift || 'DAY'})
                  <div className="mt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-50 text-amber-950 border border-amber-300 px-1.5 py-0.5 rounded">
                      🤝 {activeBatchObj.batch.helpers && activeBatchObj.batch.helpers.length > 0
                        ? `${activeBatchObj.batch.helpers.length} Helpers (${activeBatchObj.batch.helpers.join(', ')})`
                        : assignedHelpers.length > 0
                        ? `${assignedHelpers.length} Helpers (${assignedHelpers.join(', ')})`
                        : '2 Helpers (Sunil, Dinesh)'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Adhesive Glue:</span>
                    <button
                      type="button"
                      onClick={() => setIsGlueModalOpen(true)}
                      className="text-[10px] text-teal-600 hover:text-teal-800 font-extrabold flex items-center gap-0.5 cursor-pointer"
                      title="Record Glue Usage"
                    >
                      <Droplets className="w-3 h-3" /> + Record
                    </button>
                  </div>
                  <div className="text-xs font-bold text-teal-950 flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="truncate">
                      {activeBatchObj.batch.glueBrand
                        ? `${activeBatchObj.batch.glueBrand} (${activeBatchObj.batch.glueUsageKg || 0} KG)`
                        : 'No Glue Logged'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {state.glueUsageLogs && state.glueUsageLogs.filter((l) => l.machine === selectedMachine).length > 0
                      ? `${state.glueUsageLogs.filter((l) => l.machine === selectedMachine).length} entries logged on ${selectedMachine}`
                      : 'Click + Record to record drum'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Start Time & Input:</span>
                  <b>{activeBatchObj.batch.startTime || '-'}</b>
                  <div className="text-xs font-bold text-blue-700 mt-0.5">
                    Issued: {activeBatchObj.batch.issuedQty} Rolls
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Batch Status:</span>
                  <b
                    className={
                      activeBatchObj.batch.status === 'Held' ? 'text-orange-700' : 'text-emerald-700'
                    }
                  >
                    {activeBatchObj.batch.status.toUpperCase()}
                  </b>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    ID: {activeBatchObj.batch.batchId}
                  </div>
                </div>
              </div>

              {activeBatchObj.batch.holdReason && (
                <div className="text-orange-800 font-bold bg-orange-100 border border-orange-300 p-2 rounded-lg flex items-center gap-2">
                  <Pause className="w-4 h-4 text-orange-700 shrink-0" />
                  <span>Hold Reason: {activeBatchObj.batch.holdReason}</span>
                </div>
              )}

              {/* Slices History Banner */}
              {activeBatchObj.batch.slices && activeBatchObj.batch.slices.length > 0 && (
                <div className="bg-blue-50/90 border border-blue-200 p-2.5 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-blue-950 uppercase text-[10px]">
                      Prior Shift Slices ({activeBatchObj.batch.slices.length}):
                    </span>
                    {activeBatchObj.batch.slices.map((sl, sIdx) => (
                      <span key={sIdx} className="bg-white px-2 py-0.5 rounded border border-blue-200 text-[11px] font-bold text-blue-900">
                        {sl.operator} ({sl.producedQty} Crates)
                      </span>
                    ))}
                    <span className="text-slate-400">➔</span>
                    <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-extrabold text-[11px] border border-emerald-300">
                      Active: {activeBatchObj.batch.worker}
                    </span>
                  </div>
                  <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded">
                    Continuous Mid-Batch Handover Active
                  </span>
                </div>
              )}
            </div>

            {/* Crate Capacity & Piece Calculator Banner */}
            <div className="bg-amber-50/90 border border-amber-200 p-3.5 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-950">
                  <Box className="w-4 h-4 text-amber-700" />
                  <span>Crate Packing Standard ({activeBatchObj.job.product}):</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600">Standard Pcs/Crate:</span>
                  <input
                    type="number"
                    value={pcsPerCrateOverride !== '' ? pcsPerCrateOverride : standardCutPcs}
                    onChange={(e) => setPcsPerCrateOverride(e.target.value)}
                    className="w-24 px-2 py-1 bg-white border border-amber-300 rounded text-xs font-black text-slate-800 outline-none text-right"
                    title="Job-level override: Change pieces per crate for this cutting job"
                  />
                  <span className="text-[10px] text-amber-900 font-extrabold bg-amber-200/80 px-2 py-0.5 rounded">
                    Flat Blanks
                  </span>
                </div>
              </div>

              {/* Live pieces calculation preview */}
              {outputCrates && (parseFloat(outputCrates) || 0) > 0 && (
                <div className="bg-white/95 border border-amber-300 px-3 py-2 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="font-bold text-slate-700">
                    Current Shift Output: <span className="text-emerald-700 font-black">{outputCrates} Crates</span> × {(effectiveCutPcs ?? 0).toLocaleString()} Pcs
                    {parseInt(loosePiecesInput, 10) > 0 && <span> + {loosePiecesInput} Loose</span>}
                  </div>
                  <div className="text-amber-950 font-black bg-amber-100 px-2.5 py-1 rounded-md text-xs border border-amber-300">
                    = {(Math.round((parseFloat(outputCrates) || 0) * effectiveCutPcs) + (parseInt(loosePiecesInput, 10) || 0)).toLocaleString()} Flat Blanks
                  </div>
                </div>
              )}
            </div>

            {/* Shift Handover Guidance Notice if batch was relieved */}
            {activeBatchObj?.batch && (activeBatchObj.batch.producedQty || 0) > 0 && (
              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-blue-950 flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-blue-600" />
                    <span>Active Shift Handover on this Continuous Batch</span>
                  </span>
                  <span className="text-[10px] font-extrabold bg-blue-600 text-white px-2 py-0.5 rounded">
                    Prior Output Locked: {activeBatchObj.batch.producedQty} Crates
                  </span>
                </div>
                <p className="text-blue-900 text-[11px] m-0 leading-relaxed">
                  👉 <b>Enter ONLY the new crates produced in YOUR current shift below.</b> Do not add the previous {activeBatchObj.batch.producedQty} crates. The system automatically calculates total batch output: <b>{activeBatchObj.batch.producedQty} + {parseFloat(outputCrates) || 0} = {((activeBatchObj.batch.producedQty || 0) + (parseFloat(outputCrates) || 0))} Crates</b>.
                </p>
              </div>
            )}

            {/* Output and scrap entries */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Scissors className="w-4 h-4 text-emerald-600" />
                  <span>Output Reporting & Scrap/Rejection Counter Deduction:</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  Main Counter Auto-Calculation
                </span>
              </div>

              {/* Row 1: Production Additions (Quantity to be added to main counter) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                <div>
                  <label className="block text-xs font-bold text-emerald-900 uppercase mb-1 flex items-center gap-1">
                    <Box className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Passed Cut Crates Output (Current Shift):</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={outputCrates}
                    onChange={(e) => setOutputCrates(e.target.value)}
                    placeholder="e.g. 5 or 0.5 Crates"
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-emerald-700 mt-0.5 block font-medium">
                    {liveCratesDone > 0 ? `= ${(Math.round(liveCratesDone * effectiveCutPcs)).toLocaleString()} Pcs (@ ${effectiveCutPcs.toLocaleString()} pcs/crate)` : 'Decimals allowed (e.g. 0.5, 1.5)'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-900 uppercase mb-1 flex items-center gap-1">
                    <span>+ Loose Pieces (Loose Pieces - Will be added to main counter):</span>
                  </label>
                  <input
                    type="number"
                    value={loosePiecesInput}
                    onChange={(e) => setLoosePiecesInput(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-amber-700 mt-0.5 block font-medium">
                    Main counter me crate pieces ke sath PLUS (+) hoga
                  </span>
                </div>
              </div>

              {/* Row 2: Rejection Pieces (Deducted) vs Material Scrap KG (Separate Scrap, Not Deducted from Pieces) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Defective / Rejected Pieces: MINUS from pieces */}
                <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-300 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-rose-950 uppercase flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>1. Rejected Pieces:</span>
                    </label>
                    <span className="text-[10px] font-black text-rose-800 bg-rose-200 px-2 py-0.5 rounded-md border border-rose-300">
                      MINUS (-) FROM PIECES
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={rejectedPcsInput}
                    onChange={(e) => handleRejectedPcsChange(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white border border-rose-400 rounded-lg text-sm font-black text-rose-800 outline-none focus:border-rose-600 shadow-2xs"
                  />
                  <span className="text-[11px] text-rose-800 font-semibold block leading-tight">
                    ⚠️ <b>Only these rejected pieces will be minus (-) from prepared pieces.</b> (Both will not mix)
                  </span>
                </div>

                {/* 2. Cutting Material Scrap (KG): Extra Paper Scrap, NOT deducted from pieces */}
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-300 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-amber-950 uppercase flex items-center gap-1.5">
                      <Recycle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>2. Cutting Material Scrap KG:</span>
                    </label>
                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                      EXTRA SCRAP (NOT MINUS FROM PCS)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={scrapKg}
                      onChange={(e) => handleScrapKgChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white border border-amber-400 rounded-lg text-sm font-black text-amber-950 outline-none focus:border-amber-600 shadow-2xs"
                    />
                    <span className="text-xs font-black text-amber-900 shrink-0 bg-amber-200/80 px-2 py-2 rounded-lg border border-amber-300">
                      KG
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-900 font-semibold block leading-tight">
                    ℹ️ <b>Extra paper scrap from cutting will directly add to scrap account. It will not be minus from pieces.</b>
                  </span>
                </div>
              </div>

              {/* Row 2.5: Adhesive/Glue Inline Consumption Input (Optional) */}
              <div className="bg-teal-50/70 p-3.5 rounded-xl border border-teal-300 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-teal-950 uppercase flex items-center gap-1.5">
                    <Droplets className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>3. Adhesive Glue Consumed (KG) [Optional]:</span>
                  </label>
                  <span className="text-[10px] font-black text-teal-800 bg-teal-100 px-2 py-0.5 rounded-md border border-teal-300">
                    OPTIONAL CONSUMPTION LOG
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={actualGlueConsumed}
                    onChange={(e) => handleGlueConsumedChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-white border border-teal-400 rounded-lg text-sm font-black text-teal-950 outline-none focus:border-teal-600 shadow-2xs"
                  />
                  <span className="text-xs font-black text-teal-900 shrink-0 bg-teal-200/80 px-2 py-2 rounded-lg border border-teal-300">
                    KG
                  </span>
                </div>
                <div className="text-[11px] text-teal-900 font-semibold flex items-center justify-between">
                  <span>ℹ️ Planned Glue Brand: <b>{activeBatchObj.job.targetGlueBrand || activeBatchObj.batch.glueBrand || 'Pidilite W-10 (Food Grade Adhesive)'}</b> (Read-Only)</span>
                  <span className="text-[10px] bg-teal-100/80 text-teal-800 border border-teal-200 rounded px-1.5 py-0.5 font-bold">Auto-Deducts from Stock</span>
                </div>
              </div>

              {/* Row 3: Live Main Counter Summary Breakdown */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-2.5">
                <div className="text-[11px] font-extrabold text-slate-300 uppercase flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Main Counter Live Calculation:</span>
                  </span>
                  <span className="text-amber-300 font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded">
                    Crates + Loose - Only rejected pieces
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="bg-emerald-950 text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-700">
                    Crates: {(Math.round(liveCratesDone * effectiveCutPcs)).toLocaleString()} Pcs
                  </span>
                  <span className="text-slate-400 font-bold">+</span>
                  <span className="bg-amber-950 text-amber-300 px-2.5 py-1 rounded-md border border-amber-700">
                    Loose: {liveLooseDone.toLocaleString()} Pcs
                  </span>
                  <span className="text-slate-400 font-bold">-</span>
                  <span className="bg-rose-950 text-rose-300 px-2.5 py-1 rounded-md border border-rose-700">
                    Rejected: {liveRejectedPcsVal.toLocaleString()} Pcs
                  </span>
                  <span className="text-slate-400 font-bold">=</span>
                  <span className="bg-emerald-500 text-slate-950 font-black text-sm px-3.5 py-1 rounded-lg shadow-md">
                    Net Output: {liveNetCutPcs.toLocaleString()} Flat Blanks
                  </span>
                  <div className="w-full sm:w-auto ml-auto pt-1 sm:pt-0">
                    <span className="bg-amber-400/20 text-amber-200 border border-amber-400/30 px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1">
                      <Recycle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Separate Cutting Scrap: <b>{liveScrapKgVal} KG</b> (Not minus from pieces)</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCrewModalOpen(true)}
                  className="py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                  title="Change Station Crew & Helper"
                >
                  <Users className="w-3.5 h-3.5" /> Crew & Helper
                </button>
                <button
                  type="button"
                  onClick={() => setIsGlueModalOpen(true)}
                  className="py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                  title="Enter Adhesive Glue Usage"
                >
                  <Droplets className="w-3.5 h-3.5" /> Glue Usage
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForwardQtyInput('1');
                    setIsForwardModalOpen(true);
                  }}
                  className="py-2.5 bg-[#805ad5] hover:bg-[#6b46c1] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
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
                >
                  <Undo2 className="w-3.5 h-3.5" /> Issue Return
                </button>
                <button
                  type="button"
                  onClick={() => setIsShiftHandoverModalOpen(true)}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                  title="Handover machine to incoming shift operator without stopping the batch"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Shift Handover
                </button>
                <button
                  type="button"
                  onClick={() => onOpenHoldModal(selectedMachine)}
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
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={handleFinish}
                    disabled={isSaving}
                    className="py-2.5 bg-[#2f855a] hover:bg-[#276749] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed w-full"
                  >
                    <Square className="w-3.5 h-3.5" /> {isSaving ? 'Saving...' : 'Finish Run'}
                  </button>
                  {isSaving && (
                    <span className="text-[10px] text-slate-500 text-center">Processing...</span>
                  )}
                  {(!outputCrates && !loosePiecesInput) && (
                    <span className="text-[10px] text-rose-500 text-center">Please fill Actual Sheets Cut</span>
                  )}
                </div>
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
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
            ⚪ Workstation [{selectedMachine}] is currently IDLE. Select slit rolls below to start a run.
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* START / ISSUE SLIT ROLLS TO WORKSTATION FORM */}
      {/* ======================================================== */}
      <div className="border-t border-slate-200 pt-4">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Play className="w-4 h-4 text-blue-600" />
          Start or Top-up Cutting Run on [{selectedMachine}]:
        </h4>

        <form onSubmit={handleStartRun} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-purple-700 uppercase mb-1">
                Cutting Operator Name <span className="text-rose-600">*Mandatory</span>:
              </label>
              <input
                type="text"
                list="cutWorkerList"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="Type Operator Name..."
                className="w-full px-3 py-2 bg-white border border-purple-300 rounded-lg text-xs font-bold uppercase text-slate-800 outline-none"
                required
              />
              <datalist id="cutWorkerList">
                {cutWorkers.map((w) => (
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
                disabled={!!selectedPendingJobId}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
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

          {/* Helper Assignment for this Operator */}
          <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black text-amber-950 flex items-center gap-1.5 uppercase">
                <span>🤝 Assigned Helpers with Operator:</span>
                <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                  {assignedHelpers.length} Helpers
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCrewModalOpen(true)}
                  className="text-xs font-extrabold text-blue-800 bg-white hover:bg-blue-50 border border-blue-300 px-2.5 py-1 rounded-lg transition cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>👥 Crew & Helper Popup (Modal)</span>
                </button>
                <span className="text-[11px] text-amber-800 font-medium">
                  (e.g. Operator + 2 Helpers will appear on side)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 items-center">
              {assignedHelpers.map((h, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 bg-white border border-amber-300 text-amber-950 font-bold text-xs px-2.5 py-1 rounded-lg shadow-2xs"
                >
                  <span>Helper {idx + 1}: {h}</span>
                  <button
                    type="button"
                    onClick={() => setAssignedHelpers(assignedHelpers.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-600 transition cursor-pointer font-black"
                  >
                    ×
                  </button>
                </span>
              ))}

              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newHelperInput}
                  onChange={(e) => setNewHelperInput(e.target.value)}
                  placeholder="+ New helper name..."
                  className="px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold uppercase text-slate-800 outline-none w-36"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = newHelperInput.trim().toUpperCase();
                      if (val && !assignedHelpers.includes(val)) {
                        setAssignedHelpers([...assignedHelpers, val]);
                        setNewHelperInput('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = newHelperInput.trim().toUpperCase();
                    if (val && !assignedHelpers.includes(val)) {
                      setAssignedHelpers([...assignedHelpers, val]);
                      setNewHelperInput('');
                    }
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select Slit Rolls Job from Queue:
            </label>
            <select
              value={selectedPendingJobId}
              onChange={(e) => {
                setSelectedPendingJobId(e.target.value);
                const j = jobs.find((x) => x.id === e.target.value);
                if (j) setIssueRollsQty(String(j.availableRolls || 1));
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
            >
              <option value="">-- SELECT SLIT ROLLS QUEUE --</option>
              {pendingSlitJobs.map((j) => {
                const allReels = getJobAllReels(j);
                const reelsLabel = allReels.length > 1
                  ? `Jumbo Reels (${allReels.length}): ${allReels.join(', ')}`
                  : `Reel: ${allReels[0] || j.reelNo || 'RL-RAW-001'}`;
                return (
                  <option key={j.id} value={j.id}>
                    {j.id} - {j.product} [{reelsLabel}] [{j.gsm || j.targetGsm || '-'}] [{j.paperBrand || 'ITC'}] (Avail: {j.availableRolls} Rolls)
                  </option>
                );
              })}
            </select>
          </div>

          {selectedPendingJob && (() => {
            const allReels = getJobAllReels(selectedPendingJob);
            const reelBreakdown = getJobReelItemsBreakdown(selectedPendingJob);
            return (
              <div className="p-3.5 bg-blue-50/90 border-2 border-blue-200 rounded-xl text-xs space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-blue-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                      Selected Job #{selectedPendingJob.id}
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm">{selectedPendingJob.product}</span>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium ml-2 border-l border-blue-200 pl-2">
                      <span>Layers: <b className="text-slate-800">{selectedPendingJob.targetLayers || '9 Layers'}</b></span>
                      <span>GSM: <b className="text-slate-800">{selectedPendingJob.targetGsm || selectedPendingJob.gsm || 'N/A'}</b></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Available Slit Rolls:</span>
                    <span className="font-black text-sm text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-300">
                      {selectedPendingJob.availableRolls} Rolls
                    </span>
                  </div>
                </div>

                {/* STRICT OPERATIONAL HARD-LOCK SPECIFICATION CARD */}
                <div className="bg-white/95 p-3 rounded-xl border border-blue-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-[10px] font-black uppercase text-blue-950 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-700" />
                      PPC Master Specification Hard-Lock
                    </span>
                    <span className="text-[10px] font-extrabold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-blue-600" /> 100% Read-Only (Bound to Job #{selectedPendingJob.id})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Target Product (Locked):
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{selectedPendingJob.product}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        Layer Configuration:
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{selectedPendingJob.targetLayers || '9 Layers'} (PPC Master Spec)</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                        GSM Specification:
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{selectedPendingJob.targetGsm || selectedPendingJob.gsm || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* All Jumbo Reels Traceability Badges */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold text-blue-950 uppercase tracking-wide">
                      Mother Jumbo Reels Used in this Job ({allReels.length} Reels):
                    </span>
                    <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                      ✓ 100% Traceability Active
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allReels.map((r, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 font-mono text-xs bg-white text-blue-950 font-black px-2 py-1 rounded-lg border border-blue-300 shadow-2xs"
                      >
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-black">
                          {idx + 1}
                        </span>
                        <span>Reel: {r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Multi-reel Itemized Breakdown */}
                {reelBreakdown.length > 0 && (
                  <div className="bg-white/90 p-2 rounded-lg border border-blue-200 text-[11px]">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                      Individual Jumbo Reel Production Log:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      {reelBreakdown.map((item, idx) => (
                        <div key={idx} className="p-1.5 bg-slate-50 rounded border border-slate-200 font-medium text-slate-800">
                          <div className="font-mono font-bold text-blue-900">Reel #{idx + 1}: {item.reelNo}</div>
                          <div className="text-[10px] text-slate-600 flex justify-between mt-0.5">
                            <span>{item.rolls || Math.floor((selectedPendingJob.availableRolls || 0) / reelBreakdown.length)} Rolls</span>
                            <span>{item.weightKg || Math.round((selectedPendingJob.inputWeightKg || 200) / reelBreakdown.length)} KG In</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white/80 p-2.5 rounded-lg border border-blue-200 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-800 font-bold">
                    <span className="text-slate-500 uppercase">📄 Specified Paper:</span>
                    <span className="text-blue-900 font-extrabold bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                      {selectedPendingJob.paperBrand || 'ITC'} • {selectedPendingJob.gsm || selectedPendingJob.targetGsm || '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-800 font-bold">
                    <span className="text-slate-500 uppercase">💧 Adhesive/Glue:</span>
                    <span className="text-teal-900 font-extrabold bg-teal-100 px-2 py-0.5 rounded border border-teal-200">
                      {selectedPendingJob.targetGlueBrand || 'Pidilite W-10 (Food Grade Adhesive)'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 italic block leading-snug">
                    🔒 Pre-defined BOM specifications pre-filled from Planning Desk (PPC). Operator cannot change glue brand.
                  </span>
                  {selectedPendingJob.customRemark && (
                    <div className="text-[11px] text-slate-600 italic mt-1 border-t border-slate-100 pt-1">
                      Note: {selectedPendingJob.customRemark}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Enter Slit Rolls to Issue (Roll Count) *:
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 4, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setIssueRollsQty(String(num))}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                      issueRollsQty === String(num)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {num} Rolls
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              value={issueRollsQty}
              onChange={(e) => setIssueRollsQty(e.target.value)}
              placeholder="Enter Rolls Quantity"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!selectedPendingJobId}
            className="w-full py-3 bg-[#2b6cb0] hover:bg-[#1a365d] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start Cutting Run on {selectedMachine}</span>
          </button>
        </form>
      </div>

      {/* ======================================================== */}
      {/* CUTTING REELS & TRACEABILITY REGISTER (BOTTOM TEMPLATE MATCHING SLITTING) */}
      {/* ======================================================== */}
      <div className="mt-8 pt-6 border-t-2 border-slate-200 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2 m-0">
              <Layers className="w-5 h-5 text-teal-600" />
              <span>Cutting Reels & Traceability Register</span>
            </h3>
            <p className="text-xs text-slate-500 m-0">
              Reel number, GSM, and forward traceability status for each cutting job ID
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search Reel No, Job ID, GSM, Mill..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 shadow-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-xs">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-left">
                <th className="p-3">Job ID</th>
                <th className="p-3 text-indigo-900">Date</th>
                <th className="p-3 text-blue-900">Reel No.</th>
                <th className="p-3 text-amber-900">GSM</th>
                <th className="p-3">Paper Mill</th>
                <th className="p-3">Product</th>
                <th className="p-3">Remarks / Lot</th>
                <th className="p-3 text-right">Cut Stock</th>
                <th className="p-3 text-right">In / Out / Scrap (KG)</th>
                <th className="p-3 text-center">Stage Status</th>
                <th className="p-3 text-center">Traceability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs
                .filter((j) => {
                  if (!tableSearch.trim()) return true;
                  const q = tableSearch.toLowerCase();
                  const allReels = getJobAllReels(j);
                  const allGsms = getJobAllGsms(j);
                  const cutBatches = (j.runningBatches || []).filter((b) => b.stage === 'Cutting' || b.machine.startsWith('Cutting'));
                  return (
                    j.id.toLowerCase().includes(q) ||
                    allReels.some((r) => r.toLowerCase().includes(q)) ||
                    allGsms.some((g) => g.toLowerCase().includes(q)) ||
                    (j.paperBrand && j.paperBrand.toLowerCase().includes(q)) ||
                    j.product.toLowerCase().includes(q) ||
                    (j.customRemark && j.customRemark.toLowerCase().includes(q)) ||
                    cutBatches.some((b) => (b.worker || '').toLowerCase().includes(q) || b.machine.toLowerCase().includes(q) || b.batchId.toLowerCase().includes(q))
                  );
                })
                .map((j) => {
                  const allReels = getJobAllReels(j);
                  const allGsms = getJobAllGsms(j);
                  const cutBatches = (j.runningBatches || []).filter((b) => b.stage === 'Cutting' || b.machine.startsWith('Cutting'));
                  const cutPcsStd = j.pcsPerCrateCutting || state.crateCapacityMaster?.[j.product]?.cuttingPcs || 10000;
                  const totalCutPieces = j.totalCutPieces || ((j.availableCuttingCrates || 0) * cutPcsStd);
                  const totalScrapKg = cutBatches.reduce((sum, b) => sum + (b.scrapKg || 0), 0);
                  const totalInRolls = cutBatches.reduce((sum, b) => sum + (b.issuedQty || 0), 0);
                  const inKgEst = totalInRolls > 0 ? (totalInRolls * 12) : ((j.inputWeightKg || 200));

                  const latestLog = (state.logs || []).filter((l) => l.jobId === j.id).slice(-1)[0];
                  const entryDate = latestLog?.rawDate || (j.createdAt ? j.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
                  const entryTime = latestLog?.startTime || (latestLog?.timestamp ? latestLog.timestamp.split(',')[1]?.trim() : '');

                  return (
                    <tr key={j.id} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 font-mono font-bold text-blue-800">{j.id}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-bold text-slate-800 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>{entryDate}</span>
                        </div>
                        {entryTime && <div className="text-[10px] text-slate-400 font-mono ml-4">{entryTime}</div>}
                      </td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1 items-center max-w-[220px]">
                          {allReels.map((r, idx) => (
                            <span
                              key={idx}
                              className="font-mono font-bold text-[11px] bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200"
                              title={`Parent Jumbo Reel #${idx + 1}`}
                            >
                              {r}
                            </span>
                          ))}
                          {cutBatches.length > 0 && (
                            <span className="font-mono text-[10px] bg-purple-50 text-purple-800 px-1 py-0.5 rounded border border-purple-200">
                              Lot: {cutBatches[0].batchId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1 items-center max-w-[190px]">
                          {allGsms.map((g, gIdx) => (
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
                      <td className="p-2.5 font-medium text-slate-800">{j.paperBrand || 'ITC'}</td>
                      <td className="p-2.5 font-bold text-slate-700">{j.product}</td>
                      <td className="p-2.5 text-slate-500 max-w-[150px] truncate" title={j.customRemark}>
                        {j.customRemark || 'Standard'}
                      </td>
                      <td className="p-2.5 text-right font-extrabold text-emerald-700">
                        {j.availableCuttingCrates || 0} Crates
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          ({(totalCutPieces ?? 0).toLocaleString()} Blanks)
                        </div>
                      </td>
                      <td className="p-2.5 text-right font-mono text-xs">
                        <div className="flex flex-col items-end">
                          <span className="text-slate-700 font-bold">
                            In: {totalInRolls > 0 ? `${totalInRolls} Rolls` : `${j.availableRolls || 0} Rolls`}
                          </span>
                          <span className="text-blue-700 font-medium">
                            Out: {j.availableCuttingCrates || 0} Crates
                          </span>
                          {totalScrapKg > 0 && (
                            <span className="text-rose-700 font-bold text-[11px]">
                              Scrap: {totalScrapKg} KG
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 text-center">
                        {(j.availableCuttingCrates || 0) > 0 ? (
                          <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            Pending Forming ({j.availableCuttingCrates} Crates)
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
                          title="View genealogy traceability for this reel and batch lot"
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

      {/* ======================================================== */}
      {/* INLINE MODALS FOR FORWARD, UNISSUE & CANCEL */}
      {/* ======================================================== */}

      {/* Forward Partial Modal */}
      {isForwardModalOpen && activeBatchObj && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Zap className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 m-0">Forward Cut Crates to Forming Queue</h3>
                <p className="text-[11px] text-slate-500 m-0">Forward crates while cutting machine continues running</p>
              </div>
            </div>

            <div className="bg-purple-50 p-3 rounded-xl text-xs space-y-1 text-purple-900">
              <div>Job: <b>{activeBatchObj.job.id}</b> ({activeBatchObj.job.product})</div>
              <div>Machine: <b>{selectedMachine}</b> | Operator: <b>{activeBatchObj.batch.worker}</b></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Enter Cut Crates to Forward:
              </label>
              <input
                type="number"
                min="1"
                value={forwardQtyInput}
                onChange={(e) => setForwardQtyInput(e.target.value)}
                className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm font-bold text-slate-800 outline-none"
                autoFocus
              />
              {forwardQtyInput && parseInt(forwardQtyInput, 10) > 0 && (
                <div className="mt-2 text-xs font-bold text-purple-900 bg-purple-100/70 p-2 rounded-lg border border-purple-200 flex items-center justify-between">
                  <span>Equates to Flat Pieces:</span>
                  <span className="font-black text-purple-950">
                    {((parseInt(forwardQtyInput, 10) || 0) * (effectiveCutPcs || 10000)).toLocaleString()} Flat Blanks
                  </span>
                </div>
              )}
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
                <h3 className="text-sm font-extrabold text-slate-900 m-0">Issue Return (Un-issue Slit Rolls)</h3>
                <p className="text-[11px] text-slate-500 m-0">Return excess rolls back to Slitting Stock</p>
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl text-xs space-y-1 text-amber-900">
              <div>Job: <b>{activeBatchObj.job.id}</b> ({activeBatchObj.job.product})</div>
              <div>Currently Issued to Machine: <b>{activeBatchObj.batch.issuedQty} Rolls</b></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Enter Rolls Quantity to Return:
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

      {/* Cancel Run Confirm Modal */}
      {isCancelConfirmOpen && activeBatchObj && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-rose-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-rose-100 pb-3">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <div>
                <h3 className="text-sm font-extrabold text-rose-950 m-0">Cancel Cutting Run & Return Rolls</h3>
                <p className="text-[11px] text-slate-500 m-0">Safely cancel this cutting run and restore slit rolls</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5 text-rose-900">
              <div>Are you sure you want to cancel Cutting Batch on <b>{selectedMachine}</b> for Job <b>{activeBatchObj.job.id}</b>?</div>
              <div className="font-extrabold text-rose-950 bg-white/80 p-2 rounded-lg border border-rose-200">
                📜 {activeBatchObj.batch.issuedQty || 0} Slit Rolls will be returned to Slitting Stock immediately.
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

      {/* Strict Quantity & Crate Audit Mismatch Error Modal */}
      {auditMismatchError && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border-2 border-rose-500 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-3 text-rose-700">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <AlertCircle className="w-7 h-7 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-rose-950 uppercase tracking-wide m-0">
                  ⚠️ AUDIT MISMATCH: ENTRY BLOCKED
                </h3>
                <p className="text-xs text-rose-700 font-semibold m-0">
                  Multi-Stage Strict Quantity & Crate Conversion Integrity Audit
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl">
              <div className="font-mono font-extrabold text-rose-950 text-sm leading-relaxed">
                "{auditMismatchError.details}"
              </div>
            </div>

            {/* Side-by-side verification comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 uppercase">1. Issued Input (Slit Rolls)</div>
                <div className="text-xl font-black text-slate-800">
                  {activeBatchObj?.batch.issuedQty || 0} Slit Rolls
                </div>
                <div className="text-slate-600 font-semibold">
                  Equiv: ~{auditMismatchError.inputCrates} Cut Crates max
                </div>
                <div className="font-black text-blue-900 text-sm pt-1.5 border-t border-slate-200">
                  Max Yield: {(auditMismatchError.inputPcs ?? 0).toLocaleString()} Blanks
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl space-y-1.5">
                <div className="text-[11px] font-bold text-rose-600 uppercase">2. Claimed Output (Cutting)</div>
                <div className="text-xl font-black text-rose-950">
                  {auditMismatchError.outputCrates} Cut Crates
                </div>
                <div className="text-rose-700 font-semibold">
                  @ {(effectiveCutPcs ?? 0).toLocaleString()} Flat Blanks / Crate
                </div>
                <div className="font-black text-rose-950 text-sm pt-1.5 border-t border-rose-200">
                  Total Claimed: {(auditMismatchError.outputPcs ?? 0).toLocaleString()} Blanks
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Conservation of Paper & Zero Tolerance Audit Rule:</span>
              </div>
              <p className="m-0 leading-relaxed text-[11px]">
                The total number of cut blanks produced cannot exceed the maximum physical capacity of the issued slit rolls. Under Zero Tolerance policy, this entry has been blocked.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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

      {/* Shift Handover Modal */}
      {activeBatchObj && (
        <ShiftHandoverModal
          isOpen={isShiftHandoverModalOpen}
          onClose={() => setIsShiftHandoverModalOpen(false)}
          batch={activeBatchObj.batch}
          job={activeBatchObj.job}
          machine={selectedMachine}
          stageName="Cutting"
          availableWorkers={cutWorkers}
          availableHelpers={
            state.floorWorkers?.filter((w) => w.department === 'Cutting' && w.role === 'HELPER').map((w) => w.name) || [
              'SUNIL_HELPER',
              'DINESH_HELPER',
              'MUKESH_HELPER',
              'RAMU_HELPER'
            ]
          }
          unitLabel="Cut Crates"
          piecesPerUnit={effectiveCutPcs}
          initialProducedQty={parseFloat(outputCrates) || undefined}
          initialLoosePieces={parseInt(loosePiecesInput, 10) || undefined}
          initialScrapQty={parseFloat(scrapKg) || undefined}
          initialHelpers={
            activeBatchObj.batch.helpers && activeBatchObj.batch.helpers.length > 0
              ? activeBatchObj.batch.helpers
              : assignedHelpers
          }
          onConfirmHandover={handleConfirmShiftHandover}
        />
      )}

      {/* Station Crew Assignment Modal */}
      <StationCrewModal
        isOpen={isCrewModalOpen}
        onClose={() => setIsCrewModalOpen(false)}
        machine={selectedMachine}
        stage="Cutting"
        shift={shift}
        currentOperator={activeBatchObj?.batch.worker || operatorName}
        currentHelpers={
          activeBatchObj?.batch.helpers && activeBatchObj.batch.helpers.length > 0
            ? activeBatchObj.batch.helpers
            : assignedHelpers
        }
        state={state}
        onConfirmCrew={handleConfirmCrew}
      />

      {/* Glue Usage Modal */}
      <GlueUsageModal
        isOpen={isGlueModalOpen}
        onClose={() => setIsGlueModalOpen(false)}
        state={state}
        onSaveState={onSaveState}
        defaultMachine={selectedMachine}
        defaultStage="Cutting"
        defaultJobId={activeBatchObj?.job.id || selectedPendingJobId}
        defaultBatchId={activeBatchObj?.batch.batchId}
      />

      {/* Adhesive Specification & Pre-Filled BOM Card Modal */}
      {showSpecModal && activeBatchObj && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-teal-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-teal-100 pb-3">
              <Droplets className="w-6 h-6 text-teal-600" />
              <div>
                <h3 className="text-sm font-extrabold text-teal-950 m-0">Adhesive & Glue Specifications</h3>
                <p className="text-[11px] text-slate-500 m-0">BOM allocation defined by Planning Desk (PPC)</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <span className="text-slate-500">Job ID:</span>
                  <span className="font-extrabold text-slate-900">{activeBatchObj.job.id}</span>
                  <span className="text-slate-500">Product:</span>
                  <span className="font-bold text-slate-900">{activeBatchObj.job.product}</span>
                  <span className="text-slate-500">Pre-defined Brand:</span>
                  <span className="font-black text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded text-[10px] w-fit">
                    {activeBatchObj.job.targetGlueBrand || 'Pidilite W-10 (Food Grade Adhesive)'}
                  </span>
                </div>
              </div>

              <div className="bg-teal-50/70 p-3.5 rounded-xl border border-teal-300 space-y-1.5">
                <label className="text-xs font-black text-teal-950 uppercase flex items-center gap-1.5">
                  <span>Enter Actual Glue Consumed (KG) *:</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={actualGlueConsumed}
                    onChange={(e) => setActualGlueConsumed(e.target.value)}
                    placeholder="e.g. 12.5"
                    className="w-full px-3 py-2 bg-white border border-teal-400 rounded-lg text-sm font-black text-teal-950 outline-none focus:border-teal-600 shadow-2xs"
                  />
                  <span className="text-xs font-black text-teal-900 shrink-0 bg-teal-200/80 px-2.5 py-2 rounded-lg border border-teal-300">
                    KG
                  </span>
                </div>
                <p className="text-[10px] text-teal-800 m-0 font-medium leading-normal">
                  💡 This is read-only pre-filled specification. Operator only inputs actual consumption weight.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSpecModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Close & Finish Later
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(actualGlueConsumed) || 0;
                  if (val <= 0) {
                    alert('⚠️ Please enter a valid quantity of glue consumed!');
                    return;
                  }
                  const brandToDeduct = activeBatchObj.job.targetGlueBrand || 'Pidilite W-10 (Food Grade Adhesive)';

                  const updatedJobs = jobs.map((j) => {
                    if (j.id !== activeBatchObj.job.id) return j;
                    return {
                      ...j,
                      glueUsageKg: val,
                      glueBrand: brandToDeduct,
                      runningBatches: (j.runningBatches || []).map((b) => {
                        if (b.batchId !== activeBatchObj.batch.batchId) return b;
                        return {
                          ...b,
                          glueBrand: brandToDeduct,
                          glueUsageKg: val
                        };
                      })
                    };
                  });

                  onSaveState({
                    ...state,
                    jobs: updatedJobs
                  });

                  setShowSpecModal(false);
                  alert(`✅ Specification Confirmed!\n• Planned Brand: ${brandToDeduct}\n• Actual Glue: ${val} KG has been saved and integrated with the active run.`);
                }}
                className="px-4 py-2 text-xs font-extrabold text-white bg-teal-600 hover:bg-teal-700 rounded-xl cursor-pointer shadow-xs flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> Save Specification & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
