import React, { useState, useEffect } from 'react';
import { ArrowLeft, Cog, Play, Pause, Square, Zap, Undo2, XCircle, Check, Layers, AlertCircle, Box, Wrench, Search, ShieldCheck, CheckCircle2, AlertTriangle, RotateCcw, Calendar, Clock, Filter, ArrowUp, ArrowDown, ArrowUpDown, FileSpreadsheet, ChevronUp, ChevronDown } from 'lucide-react';
import { FactoryState, Job, ProductType, RunningBatch, OperatorRunSlice, LogEntry, ShiftHandoverRecord } from '../../types';
import { PRODUCTS, DEPT_WORKERS, MACHINES } from '../../lib/constants';
import { getCurrentExpectedShift, getJobAllReels, getJobAllGsms, getJobReelsSummary, getJobPlannedLayers } from '../../lib/utils';
import { getJobStageShiftLedger } from '../../lib/shiftSlices';
import { getNumberingMaster, generateFormingBatchId } from '../../lib/numberingMaster';
import { MachineBreakdownBanner } from '../MachineBreakdownBanner';
import { LotGenealogyModal } from '../LotGenealogyModal';
import { ShiftHandoverModal } from '../ShiftHandoverModal';
import { StationCrewModal } from '../StationCrewModal';
import { Users } from 'lucide-react';

import { autoRegisterWorker } from '../../lib/workerUtils';
interface FormingViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  onOpenHoldModal: (machineName: string) => void;
  onOpenAttendModal?: (machineName: string) => void;
  onNavigateToTraceability?: (query: string) => void;
}

export const FormingView: React.FC<FormingViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onOpenHoldModal,
  onOpenAttendModal,
  onNavigateToTraceability
}) => {
  const { jobs, shiftConfig } = state;
  const formWorkers = state.deptWorkers?.['Forming'] || DEPT_WORKERS['Forming'] || ['Operator'];

  const [filterProduct, setFilterProduct] = useState<string>('');
  const [selectedMachine, setSelectedMachine] = useState('Forming-1');
  const [shift, setShift] = useState<'DAY' | 'NIGHT'>(() => getCurrentExpectedShift(shiftConfig));
  const [operatorName, setOperatorName] = useState(formWorkers[0] || 'Operator');
  const [selectedPendingJobId, setSelectedPendingJobId] = useState('');
  const [issueCratesQty, setIssueCratesQty] = useState('');
  const [outputCrates, setOutputCrates] = useState('');
  const [loosePiecesInput, setLoosePiecesInput] = useState('0');
  const [pcsPerCrateOverride, setPcsPerCrateOverride] = useState<string>('');
  const [scrapPcs, setScrapPcs] = useState('0');
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

  // Strict Quantity & Crate Audit Error Modal State
  const [auditMismatchError, setAuditMismatchError] = useState<{
    outputPcs: number;
    outputCrates: number;
    inputPcs: number;
    inputCrates: number;
    scrapPcs: number;
    details: string;
  } | null>(null);

  // Genealogy Modal Job State
  const [genealogyModalJob, setGenealogyModalJob] = useState<Job | null>(null);

  // Shift Handover Modal State
  const [isShiftHandoverModalOpen, setIsShiftHandoverModalOpen] = useState(false);
  const [assignedHelpers, setAssignedHelpers] = useState<string[]>([]);
  const [isCrewModalOpen, setIsCrewModalOpen] = useState(false);

  // Dialog states for Quick Actions (Replacing window.prompt)
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardQtyInput, setForwardQtyInput] = useState('');

  const [isUnissueModalOpen, setIsUnissueModalOpen] = useState(false);
  const [unissueQtyInput, setUnissueQtyInput] = useState('');
  const [unissueTargetLotId, setUnissueTargetLotId] = useState('');
  const [selectedCuttingBatchId, setSelectedCuttingBatchId] = useState('');

  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

  // Pending queue of cut crates
  let pendingCutJobs = jobs.filter((j) => (j.availableCuttingCrates || 0) > 0);
  if (filterProduct) {
    pendingCutJobs = pendingCutJobs.filter((j) => j.product === filterProduct);
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
    if (activeBatchObj?.job) {
      const savedVal = activeBatchObj.job.pcsPerCrateForming;
      if (savedVal) {
        setPcsPerCrateOverride(String(savedVal));
      } else {
        const masterVal = state.crateCapacityMaster?.[activeBatchObj.job.product]?.formingPcs;
        setPcsPerCrateOverride(masterVal ? String(masterVal) : '');
      }
    } else {
      setPcsPerCrateOverride('');
    }

    if (activeBatchObj?.batch) {
      if (activeBatchObj.batch.worker) {
        setOperatorName(activeBatchObj.batch.worker);
      }
      if (activeBatchObj.batch.helpers) {
        setAssignedHelpers(activeBatchObj.batch.helpers);
      }
    }
  }, [activeBatchObj?.job?.id, activeBatchObj?.batch?.batchId, activeBatchObj?.batch?.worker]);

  const handlePcsPerCrateChange = (val: string) => {
    setPcsPerCrateOverride(val);
    if (activeBatchObj) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) {
        const updatedJobs = state.jobs.map((j) => {
          if (j.id === activeBatchObj.job.id) {
            return {
              ...j,
              pcsPerCrateForming: parsed
            };
          }
          return j;
        });
        onSaveState({
          ...state,
          jobs: updatedJobs
        });
      }
    }
  };

  // Helper function to calculate exact cutting metrics and net pieces per crate
  const getJobCuttingMetrics = (j: Job | undefined | null) => {
    if (!j) {
      return {
        totalCutCrates: 0,
        rawStdCutPcs: 10000,
        cuttingRejectedPcs: 0,
        totalNetPieces: 0,
        netPcsPerCrate: 10000,
        hasRejectionDeduction: false
      };
    }
    const cuttingBatches = (j.runningBatches || []).filter(
      (b) => b.stage === 'Cutting' || b.machine?.startsWith('Cutting')
    );
    const totalCutCrates = cuttingBatches.reduce((sum, b) => sum + (b.producedQty || 0), 0);
    const rawStdCutPcs = j.pcsPerCrateCutting || state.crateCapacityMaster?.[j.product]?.cuttingPcs || 10000;
    const cuttingRejectedPcs = j.cuttingRejectedPcs || j.cuttingScrapPcs || 0;

    // Total net flat blanks after cutting minor rejections:
    let totalNetPieces = 0;
    if (j.totalCutPieces !== undefined && j.totalCutPieces > 0) {
      totalNetPieces = j.totalCutPieces;
    } else if (totalCutCrates > 0) {
      totalNetPieces = Math.max(0, (totalCutCrates * rawStdCutPcs) - cuttingRejectedPcs);
    } else {
      totalNetPieces = (j.availableCuttingCrates || 0) * rawStdCutPcs;
    }

    // Net pieces per cutting crate (minor rejections distributed evenly across crates):
    const netPcsPerCrate = totalCutCrates > 0
      ? Math.round(totalNetPieces / totalCutCrates)
      : ((j.availableCuttingCrates || 0) > 0 ? Math.round(totalNetPieces / j.availableCuttingCrates) : rawStdCutPcs);

    const hasRejectionDeduction = cuttingRejectedPcs > 0 && totalNetPieces < ((totalCutCrates || j.availableCuttingCrates || 0) * rawStdCutPcs);

    return {
      totalCutCrates,
      rawStdCutPcs,
      cuttingRejectedPcs,
      totalNetPieces,
      netPcsPerCrate: Math.max(1, netPcsPerCrate),
      hasRejectionDeduction
    };
  };

  const activeJobMetrics = getJobCuttingMetrics(activeBatchObj?.job);
  const standardCutPcs = activeJobMetrics.netPcsPerCrate;
  const standardFormPcs = activeBatchObj?.job.pcsPerCrateForming || (activeBatchObj ? state.crateCapacityMaster?.[activeBatchObj.job.product]?.formingPcs : 7000) || 7000;
  const effectiveFormPcs = pcsPerCrateOverride !== '' ? (parseInt(pcsPerCrateOverride, 10) || standardFormPcs) : standardFormPcs;
  const expansionRatio = (standardCutPcs / effectiveFormPcs).toFixed(2);

  const handleStartOrTopup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorName.trim()) {
      alert('⚠️ Mandatory: Forming Operator Name is required!');
      return;
    }
    if (!selectedPendingJobId) {
      alert('Please select a Cut Crates Job from queue!');
      return;
    }
    const cratesCount = parseInt(issueCratesQty, 10) || 0;
    if (cratesCount <= 0) {
      alert('Please enter valid crates quantity to issue!');
      return;
    }

    const job = jobs.find((j) => j.id === selectedPendingJobId);
    if (!job || (job.availableCuttingCrates || 0) < cratesCount) {
      alert(`Insufficient cut crates! Available: ${job?.availableCuttingCrates || 0}`);
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
    const jobMetrics = getJobCuttingMetrics(job);
    const netCutPcsPerCrate = jobMetrics.netPcsPerCrate;
    const issuedInputPieces = Math.round(cratesCount * netCutPcsPerCrate);

    let remDeduct = cratesCount;
    const modifiedCuttingBatches = (job.runningBatches || []).map((b) => {
      if ((b.stage === 'Cutting' || b.machine?.startsWith('Cutting')) && remDeduct > 0) {
        if (b.slices && b.slices.length > 0) {
          const hasMatchingSlice = b.slices.some(s => s.sliceId === selectedCuttingBatchId);
          const isSelectedEmptyOrMatched = !selectedCuttingBatchId || b.batchId === selectedCuttingBatchId || hasMatchingSlice;
          
          if (isSelectedEmptyOrMatched) {
            const updatedSlices = b.slices.map(slice => {
              if (remDeduct > 0 && (!selectedCuttingBatchId || slice.sliceId === selectedCuttingBatchId)) {
                const sliceTotal = slice.producedQty || 0;
                const sliceConsumed = slice.consumedQty || 0;
                const sliceRem = Math.max(0, sliceTotal - sliceConsumed);
                
                if (sliceRem > 0) {
                  const dec = Math.min(sliceRem, remDeduct);
                  remDeduct -= dec;
                  return { ...slice, consumedQty: sliceConsumed + dec };
                }
              }
              return slice;
            });
            
            const totalSlicesConsumed = updatedSlices.reduce((sum, s) => sum + (s.consumedQty || 0), 0);
            return {
              ...b,
              consumedQty: totalSlicesConsumed,
              slices: updatedSlices
            };
          }
        } else {
          const totalP = b.producedQty || 0;
          const consumedP = b.consumedQty || 0;
          const remP = Math.max(0, totalP - consumedP);
          
          if (remP > 0 && (!selectedCuttingBatchId || b.batchId === selectedCuttingBatchId)) {
            const dec = Math.min(remP, remDeduct);
            remDeduct -= dec;
            return { ...b, consumedQty: consumedP + dec };
          }
        }
      }
      return b;
    });

    // Also deduct from new WipLots
    let remWipDeduct = cratesCount;
    const updatedWipLots = (state.wipLots || []).map(lot => {
      if (lot.jobId === job.id && lot.stage === 'Cutting' && remWipDeduct > 0) {
        if (!selectedCuttingBatchId || lot.id === selectedCuttingBatchId) {
          const rem = lot.remainingQty;
          if (rem > 0) {
            const dec = Math.min(rem, remWipDeduct);
            remWipDeduct -= dec;
            return {
              ...lot,
              consumedQty: lot.consumedQty + dec,
              remainingQty: lot.remainingQty - dec
            };
          }
        }
      }
      return lot;
    });

    if (remDeduct > 0 && remWipDeduct > 0) {
      alert(`⚠️ Insufficient crates in selected Cutting Operator Lot! Available remaining: ${cratesCount - Math.min(remDeduct, remWipDeduct)}, Requested: ${cratesCount}`);
      return;
    }

    // Find worker name and ID of selected lot for provenance
    let selectedCuttingLotWorker = '';
    const cuttingBatchesForJob = (job.runningBatches || []).filter((b) => b.stage === 'Cutting' || b.machine?.startsWith('Cutting'));
    for (const cb of cuttingBatchesForJob) {
      if (cb.slices && cb.slices.length > 0) {
        const matchingSlice = cb.slices.find(s => s.sliceId === selectedCuttingBatchId);
        if (matchingSlice) {
          selectedCuttingLotWorker = matchingSlice.operator;
          break;
        }
      }
      if (cb.batchId === selectedCuttingBatchId) {
        selectedCuttingLotWorker = cb.worker;
        break;
      }
    }
    if (!selectedCuttingLotWorker) {
      const matchWip = (state.wipLots || []).find(l => l.id === selectedCuttingBatchId);
      if (matchWip) selectedCuttingLotWorker = matchWip.producedByOperator;
    }

    let updatedJobs: Job[] = [];
    let logMessage = '';
    if (activeRunning && activeRunning.job.id === job.id) {
      // Same-job Top-up
      updatedJobs = jobs.map((j) => {
        if (j.id !== job.id) return j;
        return {
          ...j,
          availableCuttingCrates: Math.max(0, (j.availableCuttingCrates || 0) - cratesCount),
          runningBatches: modifiedCuttingBatches.map((b) => {
            if (b.batchId !== activeRunning.batch.batchId) return b;
            const currentOps = b.sourceOperator || '';
            const newOp = selectedCuttingLotWorker || '';
            const nextSourceOperator = currentOps 
              ? (currentOps.split(', ').includes(newOp) ? currentOps : `${currentOps}, ${newOp}`)
              : newOp;

            const currentLots = b.sourceLotId || '';
            const newLotId = selectedCuttingBatchId || '';
            const nextSourceLotId = currentLots
              ? (currentLots.split(', ').includes(newLotId) ? currentLots : `${currentLots}, ${newLotId}`)
              : newLotId;

            return {
              ...b,
              sourceLotId: nextSourceLotId || undefined,
              sourceOperator: nextSourceOperator || undefined,
              issuedQty: (b.issuedQty || 0) + cratesCount,
              inputPieces: (b.inputPieces || 0) + issuedInputPieces,
              pcsPerCrate: netCutPcsPerCrate
            };
          })
        };
      });
      logMessage = `Forming Top-up on ${selectedMachine} (+${cratesCount} Crates = +${issuedInputPieces.toLocaleString()} Net Blanks Added from Lot ${selectedCuttingBatchId || 'Cut'} by ${selectedCuttingLotWorker || 'Operator'})`;
      alert(`✅ Top-up Successful! Added ${cratesCount} more crates (+${issuedInputPieces.toLocaleString()} Net Blanks @ ${netCutPcsPerCrate.toLocaleString()} pcs/crate) to running Job ${job.id} on ${selectedMachine}.`);
    } else {
      // Fresh batch
      const master = getNumberingMaster(state.seriesConfig);
      const batchId = generateFormingBatchId(job.id, job.runningBatches || [], master);
      const upstreamBatchId = selectedCuttingBatchId || job.tracedLots?.Cutting || job.tracedLots?.Slitting || job.id;
      const newBatch: RunningBatch = {
        batchId,
        stage: 'Forming',
        machine: selectedMachine,
        shift,
        startTime: nowTime,
        status: 'Running',
        parentBatchId: upstreamBatchId,
        sourceLotId: selectedCuttingBatchId || undefined,
        sourceOperator: selectedCuttingLotWorker || undefined,
        issuedQty: cratesCount,
        inputCrates: cratesCount,
        inputPieces: issuedInputPieces,
        producedQty: 0,
        pcsPerCrate: netCutPcsPerCrate,
        worker: operatorName.trim().toUpperCase(),
        user: 'form_user'
      };
      updatedJobs = jobs.map((j) => {
        if (j.id !== job.id) return j;
        return {
          ...j,
          tracedLots: { ...(j.tracedLots || {}), Forming: batchId, Cutting: selectedCuttingBatchId || j.tracedLots?.Cutting },
          availableCuttingCrates: Math.max(0, (j.availableCuttingCrates || 0) - cratesCount),
          runningBatches: [...modifiedCuttingBatches, newBatch]
        };
      });
      logMessage = `Started Forming on ${selectedMachine} (${cratesCount} Crates = ${issuedInputPieces.toLocaleString()} Net Blanks Issued from ${selectedCuttingLotWorker ? `${selectedCuttingLotWorker}'s Cut Lot` : 'Cut Queue'} @ ${netCutPcsPerCrate.toLocaleString()} pcs/crate) | Worker: ${operatorName.toUpperCase()}`;
      setSelectedActiveBatchId(batchId);
      alert(`✅ Forming Job ${job.id} Loaded on ${selectedMachine} (${cratesCount} Crates = ${issuedInputPieces.toLocaleString()} Net Blanks @ ${netCutPcsPerCrate.toLocaleString()} pcs/crate)!`);
    }

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Forming',
      machine: selectedMachine,
      shift,
      action: logMessage,
      worker: operatorName.toUpperCase(),
      user: 'form_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    const { floorWorkers, deptWorkers } = autoRegisterWorker(state, operatorName, 'Forming', selectedMachine, shift);

    onSaveState({
      ...state,
      jobs: updatedJobs,
      wipLots: updatedWipLots,
      floorWorkers,
      deptWorkers,
      logs: [...state.logs, newLog]
    });

    setIssueCratesQty('');
    setSelectedPendingJobId('');
  };

  const handleConfirmForwardToQC = () => {
    if (!activeBatchObj) return;
    const qty = parseFloat(forwardQtyInput) || 0;
    if (qty <= 0) {
      alert('Please enter a valid crates quantity to forward!');
      return;
    }

    const { job, batch } = activeBatchObj;
    const forwardedFormedPcs = Math.round(qty * effectiveFormPcs);

    // Dynamic conversion standards: Forming capacity per crate
    const inputCrates = batch.issuedQty || 0;
    const totalInputPieces = batch.inputPieces || (inputCrates * standardCutPcs);
    const prevProducedPieces = batch.producedPieces || 0;
    const prevProducedCrates = batch.producedQty || 0;
    const cumulativeOutputPieces = prevProducedPieces + forwardedFormedPcs;
    const cumulativeOutputCrates = prevProducedCrates + qty;

    // Strict piece-count mass-balance audit check removed to allow volume expansion flexibility.

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        pcsPerCrateForming: effectiveFormPcs,
        availableFormingCrates: Math.max(0, (j.availableFormingCrates || 0) - qty),
        availableForQcCrates: (j.availableForQcCrates || 0) + qty,
        isReadyForQcInspection: true,
        totalFormedPieces: (j.totalFormedPieces || 0) + forwardedFormedPcs,
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return {
            ...b,
            producedQty: (b.producedQty || 0) + qty,
            pcsPerCrate: effectiveFormPcs,
            producedPieces: (b.producedPieces || 0) + forwardedFormedPcs
          };
        })
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Forming Forward',
      machine: selectedMachine,
      shift: batch.shift,
      action: `⚡ Partial Forward: ${qty} Formed Crates (= ${(forwardedFormedPcs ?? 0).toLocaleString()} 3D Pieces) forwarded to QC Desk (Batch #${batch.batchId})`,
      worker: batch.worker,
      user: 'form_user',
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
    alert(`✅ Forwarded ${qty} Formed Crates (= ${(forwardedFormedPcs ?? 0).toLocaleString()} 3D Pieces) to QC Inspection Desk! Machine remains RUNNING.`);
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
      alert(`Cannot un-issue more than issued crates count (${curIssued})!`);
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
            const originalInputPieces = b.inputPieces || (curIssued * standardCutPcs);
            const nextInputPieces = Math.max(0, originalInputPieces - (qty * standardCutPcs));
            return { ...b, issuedQty: remaining, inputPieces: nextInputPieces };
          }
          if ((b.stage === 'Cutting' || b.machine?.startsWith('Cutting')) && remAddUnissue > 0) {
            if (b.slices && b.slices.length > 0) {
              let restoredFromBatch = 0;
              // Pass 1: Restore to specific matching source slice first (e.g. Tushar's slice)
              let updatedSlices = b.slices.map(slice => {
                if (remAddUnissue > 0 && targetSourceLotId && slice.sliceId === targetSourceLotId) {
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
              // Pass 2: If still remaining, restore across slices in reverse order
              if (remAddUnissue > 0) {
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
              if (restoredFromBatch > 0) {
                return { ...b, consumedQty: Math.max(0, (b.consumedQty || 0) - restoredFromBatch), slices: updatedSlices };
              }
            } else {
              if (!targetSourceLotId || b.batchId === targetSourceLotId || remAddUnissue > 0) {
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
        availableCuttingCrates: (j.availableCuttingCrates || 0) + qty,
        runningBatches: updatedBatches
      };
    });

    // Also restore wipLots if applicable
    let remWipUnissue = qty;
    const updatedWipLots = (state.wipLots || []).map(lot => {
      if (lot.jobId === job.id && lot.stage === 'Cutting' && remWipUnissue > 0) {
        if (!targetSourceLotId || lot.id === targetSourceLotId) {
          const consumed = lot.consumedQty || 0;
          const restore = Math.min(consumed, remWipUnissue);
          if (restore > 0) {
            remWipUnissue -= restore;
            return {
              ...lot,
              consumedQty: lot.consumedQty - restore,
              remainingQty: lot.remainingQty + restore
            };
          }
        }
      }
      return lot;
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Forming Un-issue',
      machine: selectedMachine,
      shift: batch.shift,
      action: `↩️ Quick Un-issue: ${qty} Cut Crates returned to ${batch.sourceOperator ? `${batch.sourceOperator}'s Cutting Lot` : 'Cutting Stock'} (Remaining in Forming: ${remaining})`,
      worker: batch.worker,
      user: 'form_user',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      wipLots: updatedWipLots,
      logs: [...state.logs, newLog]
    });

    setIsUnissueModalOpen(false);
    setUnissueQtyInput('');
    setUnissueTargetLotId('');
    if (remaining === 0) {
      setSelectedActiveBatchId('');
    }
    alert(`✅ Returned ${qty} Cut Crates back to Cutting Stock!`);
  };

  const handleConfirmShiftHandover = (handoverData: {
    relievedByOperator: string;
    helpers?: string[];
    nextShift: 'DAY' | 'NIGHT' | string;
    handoverTime: string;
    meterReading: number;
    sliceProducedQty: number;
    sliceProducedPieces?: number;
    sliceScrapQty: number;
    handoverNotes: string;
  }) => {
    if (!activeBatchObj) return;
    const { job, batch } = activeBatchObj;

    const nextHelpers = handoverData.helpers && handoverData.helpers.length > 0 ? handoverData.helpers : assignedHelpers;
    const producedPiecesSlice = handoverData.sliceProducedPieces || (handoverData.sliceProducedQty * effectiveFormPcs);

    const newSlice: OperatorRunSlice = {
      sliceId: `SLICE-FORM-${Date.now()}`,
      operator: batch.worker,
      relievedByOperator: handoverData.relievedByOperator,
      shift: batch.shift || 'DAY',
      date: new Date().toISOString().split('T')[0],
      machine: selectedMachine,
      stage: 'Forming',
      startTime: batch.startTime,
      handoverTime: handoverData.handoverTime,
      startMeterReading: batch.startMeterReading || batch.meterReading,
      endMeterReading: handoverData.meterReading,
      strokeCount: handoverData.meterReading,
      producedQty: handoverData.sliceProducedQty,
      producedPieces: producedPiecesSlice,
      scrapQty: handoverData.sliceScrapQty,
      scrapPcs: handoverData.sliceScrapQty,
      notes: handoverData.handoverNotes,
      helpers: nextHelpers,
      helperCount: nextHelpers.length,
      handoverConfirmed: true
    };

    const handoverRecord: ShiftHandoverRecord = {
      id: `HO-FORM-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      date: new Date().toISOString().split('T')[0],
      jobId: job.id,
      batchId: batch.batchId,
      department: 'Forming',
      machine: selectedMachine,
      outgoingOperator: batch.worker,
      relievedByOperator: handoverData.relievedByOperator,
      currentShift: batch.shift || 'DAY',
      nextShift: handoverData.nextShift,
      meterReading: handoverData.meterReading,
      producedQty: handoverData.sliceProducedQty,
      producedPieces: producedPiecesSlice,
      scrapQty: handoverData.sliceScrapQty,
      notes: handoverData.handoverNotes,
      helpers: nextHelpers
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
          scrapPcs: (b.scrapPcs || 0) + handoverData.sliceScrapQty,
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
        availableFormingCrates: (j.availableFormingCrates || 0) + handoverData.sliceProducedQty,
        totalFormedPieces: (j.totalFormedPieces || 0) + producedPiecesSlice,
        formingScrapPcs: (j.formingScrapPcs || 0) + handoverData.sliceScrapQty,
        formingRejectedPcs: (j.formingRejectedPcs || 0) + handoverData.sliceScrapQty,
        runningBatches: updatedBatches
      };
    });

    const handoverLog: LogEntry = {
      jobId: job.id,
      product: job.product,
      stage: 'Forming',
      machine: selectedMachine,
      shift: handoverData.nextShift,
      action: `🔄 Shift Handover: Operator [${batch.worker}] handed over active run [${batch.batchId}] to [${handoverData.relievedByOperator}] (${handoverData.nextShift}). Locked slice: ${handoverData.sliceProducedQty} Formed Crates, ${handoverData.sliceScrapQty} Defect Pcs, Meter: ${handoverData.meterReading || 'N/A'}.`,
      worker: handoverData.relievedByOperator,
      user: 'forming_supervisor',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      shiftHandovers: [handoverRecord, ...(state.shiftHandovers || [])],
      logs: [handoverLog, ...(state.logs || [])]
    });

    setOutputCrates('');
    setLoosePiecesInput('');
    setScrapPcs('0');
    setOperatorName(handoverData.relievedByOperator);
    if (handoverData.helpers && handoverData.helpers.length > 0) setAssignedHelpers(handoverData.helpers);
    setShift(handoverData.nextShift as 'DAY' | 'NIGHT');
    setIsShiftHandoverModalOpen(false);
    alert(`✅ Shift Handover Complete! Ongoing batch transferred from ${batch.worker} to ${handoverData.relievedByOperator} without stopping. ${handoverData.sliceProducedQty} Formed Crates locked to ${batch.worker}.`);
  };


  const handleConfirmCrew = (operator: string, helpers: string[]) => {
    setOperatorName(operator);
    setAssignedHelpers(helpers);
    setIsCrewModalOpen(false);

    // If there is an active batch on this machine, update it immediately
    if (!activeBatchObj) return;
    
    const { job, batch } = activeBatchObj;

    const updatedJobs = state.jobs.map((j) => {
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

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Forming',
      machine: selectedMachine,
      shift: batch.shift,
      action: `👥 Station Crew Assigned: Operator [${operator}] with ${helpers.length} Helpers (${helpers.join(', ')}) on ${selectedMachine} for Batch [${batch.batchId}]`,
      worker: operator,
      user: 'form_supervisor',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      floorWorkers: updatedWorkers,
      logs: [newLog, ...(state.logs || [])]
    });
    alert('Crew assigned successfully!');
    setIsCrewModalOpen(false);
  };

  const handleResume = () => {
    if (!activeBatchObj) return alert('Select batch to resume!');
    const { job, batch } = activeBatchObj;
    if (batch.status === 'Running') return alert('Batch is already running.');

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();

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

    // Clear any active readyAlerts or incidents for this machine
    const updatedIncidents = (state.maintenanceIncidents || []).map((inc) => {
      if (inc.machine === selectedMachine && (inc.status === 'REPAIRED_READY' || inc.status === 'OPEN' || inc.status === 'IN_PROGRESS')) {
        return {
          ...inc,
          status: 'ACKNOWLEDGED' as const,
          acknowledgedAt: nowIso
        };
      }
      return inc;
    });
    const updatedReadyAlerts = (state.machineReadyAlerts || []).filter(
      (a) => a.machine !== selectedMachine
    );

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Forming',
      machine: selectedMachine,
      shift: batch.shift,
      action: `▶️ Forming Run Resumed to RUNNING | Worker: ${batch.worker}`,
      worker: batch.worker,
      user: 'form_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      maintenanceIncidents: updatedIncidents,
      machineReadyAlerts: updatedReadyAlerts,
      logs: [...state.logs, newLog]
    });

    alert(`▶️ Job [${job.id}] resumed to RUNNING on ${selectedMachine}!`);
  };

  const handleFinish = () => {
    if (!activeBatchObj) return alert('Select batch to finish!');
    const cratesDone = parseFloat(outputCrates) || 0;
    const looseDone = parseInt(loosePiecesInput, 10) || 0;
    const scrapPcsVal = parseInt(scrapPcs, 10) || 0;

    if (cratesDone <= 0 && looseDone <= 0) {
      alert('⚠️ Cannot finish run: Please enter Actual Formed Crates or Loose Pieces produced!');
      return;
    }

    const { job, batch } = activeBatchObj;

    const inputCrates = batch.issuedQty || 0;
    const totalInputPieces = batch.inputPieces || (inputCrates * standardCutPcs);
    const currentOutputPieces = Math.round(cratesDone * effectiveFormPcs) + looseDone;
    const prevProducedPieces = batch.producedPieces || 0;
    const prevProducedCrates = batch.producedQty || 0;
    const cumulativeOutputPieces = prevProducedPieces + currentOutputPieces;
    const cumulativeOutputCrates = prevProducedCrates + cratesDone;

    // Strict piece-count validation: Output cannot exceed input by more than 100 pieces
    if (cumulativeOutputPieces > totalInputPieces + 100) {
      alert(`❌ Submission Blocked (जमा करने से रोका गया):\nYour reported OK output pieces (${cumulativeOutputPieces.toLocaleString()}) exceed the total input pieces (${totalInputPieces.toLocaleString()}) from the issued cutting crates by more than 100 pieces! Please check your crate or loose piece entries.`);
      return;
    }

    // Zero-tolerance auto-calculation: Any remaining difference is counted as rejection scrap
    const autoRejectionPieces = Math.max(0, totalInputPieces - cumulativeOutputPieces);
    const finalScrapPcs = Math.max(scrapPcsVal, autoRejectionPieces);

    const totalFormedPcs = Math.round(cratesDone * effectiveFormPcs) + looseDone;
    const stopTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        pcsPerCrateForming: effectiveFormPcs,
        availableFormingCrates: (j.availableFormingCrates || 0) + cratesDone,
        isReadyForQcInspection: true,
        stage: (j.availableCuttingCrates || 0) <= 0 ? 'QC' : j.stage,
        totalFormedPieces: (j.totalFormedPieces || 0) + totalFormedPcs,
        formingLoosePcs: (j.formingLoosePcs || 0) + looseDone,
        formingScrapPcs: (j.formingScrapPcs || 0) + finalScrapPcs,
        formingRejectedPcs: (j.formingRejectedPcs || 0) + finalScrapPcs,
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== batch.batchId) return b;
          const finalSlices = [...(b.slices || [])];
          finalSlices.push({
            sliceId: `SLC-FORM-${Date.now()}-${finalSlices.length + 1}`,
            operator: b.worker,
            shift: b.shift || 'DAY',
            date: new Date().toISOString().split('T')[0],
            machine: selectedMachine,
            stage: 'Forming',
            startTime: finalSlices.length > 0 ? finalSlices[finalSlices.length - 1].handoverTime : b.startTime,
            handoverTime: stopTime,
            producedQty: cratesDone,
            producedPieces: totalFormedPcs,
            scrapQty: finalScrapPcs,
            scrapPcs: finalScrapPcs,
            notes: finalSlices.length > 0 ? 'Incoming Shift Final Completion' : 'Single Shift Run Completion'
          });
          return {
            ...b,
            status: 'Completed',
            endTime: stopTime,
            producedQty: (b.producedQty || 0) + cratesDone,
            pcsPerCrate: effectiveFormPcs,
            producedPieces: (b.producedPieces || 0) + totalFormedPcs,
            loosePieces: looseDone,
            scrapPcs: finalScrapPcs,
            slices: finalSlices
          };
        })
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Forming',
      machine: selectedMachine,
      shift: batch.shift,
      action: `⏹️ Finished Forming Batch ${batch.batchId} (${cratesDone} Crates = ${(totalFormedPcs ?? 0).toLocaleString()} 3D Pieces, Auto Rejection/Defect: ${finalScrapPcs.toLocaleString()} Pieces)`,
      worker: batch.worker,
      user: 'form_user',
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

    setOutputCrates('');
    setLoosePiecesInput('0');
    setPcsPerCrateOverride('');
    setScrapPcs('0');
    setSelectedActiveBatchId('');
    alert(`✅ Forming Run Finished! Added ${cratesDone} Formed Crates (= ${(totalFormedPcs ?? 0).toLocaleString()} 3D Pieces) to inventory.`);
  };

  const handleConfirmCancelRun = () => {
    if (!activeBatchObj) return;
    const { job, batch } = activeBatchObj;
    const cratesToReturn = batch.issuedQty || 0;
    const targetSourceLotId = batch.sourceLotId || batch.parentBatchId;
    let remCancelReturn = cratesToReturn;
    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      const updatedBatches = (j.runningBatches || [])
        .map((b) => {
          if ((b.stage === 'Cutting' || b.machine?.startsWith('Cutting')) && remCancelReturn > 0) {
            if (b.slices && b.slices.length > 0) {
              let restoredFromBatch = 0;
              // Pass 1: Target matching slice first
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
        availableCuttingCrates: Math.min((j.availableCuttingCrates || 0) + cratesToReturn, j.totalCutCrates || (j.availableCuttingCrates || 0) + cratesToReturn), // Hard Cap logic
        runningBatches: updatedBatches
      };
      // If returning all crates, cancel the batch
      if (remCancelReturn === 0) {
        // Additional logic to mark batch as Cancelled if all crates are returned
      }
    });

    // Also restore wipLots
    let remWipCancel = cratesToReturn;
    const updatedWipLots = (state.wipLots || []).map(lot => {
      if (lot.jobId === job.id && lot.stage === 'Cutting' && remWipCancel > 0) {
        if (!targetSourceLotId || lot.id === targetSourceLotId) {
          const consumed = lot.consumedQty || 0;
          const restore = Math.min(consumed, remWipCancel);
          if (restore > 0) {
            remWipCancel -= restore;
            return {
              ...lot,
              consumedQty: lot.consumedQty - restore,
              remainingQty: lot.remainingQty + restore
            };
          }
        }
      }
      return lot;
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Forming Cancelled',
      machine: selectedMachine,
      shift: batch.shift,
      action: `❌ Forming Run Cancelled: Batch ${batch.batchId} deleted, ${cratesToReturn} cut crates returned to ${batch.sourceOperator ? `${batch.sourceOperator}'s Cutting Lot` : 'stock'}.`,
      worker: batch.worker,
      user: 'form_user',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      wipLots: updatedWipLots,
      logs: [...state.logs, newLog]
    });

    setIsCancelConfirmOpen(false);
    setSelectedActiveBatchId('');
    alert('✅ Forming run cancelled and cut crates restored.');
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
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <Cog className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#1a365d] uppercase tracking-wide m-0">
              3. Forming Desk (Hydraulic Pressing & Shape Moulding)
            </h3>
            <p className="text-[11px] text-slate-500 m-0">
              Machine Floor Station Grid, Cut Piece Moulding & Forming Runs
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISUAL WORKSTATION FLOOR SELECTOR */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <Cog className="w-4 h-4 text-indigo-600" />
            Select Forming Machine:
          </label>
          <span className="text-[11px] font-bold text-slate-500">
            Click any machine card to operate its template
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {MACHINES['Forming'].map((mName) => {
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
                      : 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/40 shadow-sm'
                    : isUnderRepair
                    ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50'
                    : isOpenDown
                    ? 'border-red-300 bg-red-50/40 hover:bg-red-50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-extrabold text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
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
                    <div className="text-slate-600 font-semibold truncate">{mActiveBatch.job.product}</div>
                    <div className="text-indigo-700 font-bold">
                      {mActiveBatch.batch.issuedQty} Crates Issued | Op: {mActiveBatch.batch.worker}
                    </div>
                  </div>
                ) : !isUnderRepair && !isOpenDown ? (
                  <div className="text-xs text-slate-400 italic py-1">Ready for next forming batch</div>
                ) : null}

                {isSelected && (
                  <div className="mt-2 pt-1 border-t border-indigo-200/80 flex items-center justify-between text-[10px] font-extrabold text-indigo-700">
                    <span>Active Screen</span>
                    <Check className="w-3.5 h-3.5 text-indigo-700" />
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
        onResume={handleResume}
      />

      {/* ======================================================== */}
      {/* ACTIVE BATCH CONTROLS FOR SELECTED MACHINE */}
      {/* ======================================================== */}
      <div className="border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
            <Layers className="w-4 h-4 text-indigo-600" />
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

            <div className="p-4 bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-slate-200 rounded-xl space-y-2.5 text-xs shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 flex-wrap gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Job:</span>
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
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Operator:</span>
                  <b>{activeBatchObj.batch.worker}</b> ({activeBatchObj.batch.shift || 'DAY'})
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Start Time:</span>
                  <b>{activeBatchObj.batch.startTime || '-'}</b>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Issued In Batch:</span>
                  <b className="text-indigo-700">{activeBatchObj.batch.issuedQty} Crates</b>
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

            {/* Crate Capacity & 3D Expansion Banner */}
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
                    value={pcsPerCrateOverride !== '' ? pcsPerCrateOverride : standardFormPcs}
                    onChange={(e) => handlePcsPerCrateChange(e.target.value)}
                    className="w-24 px-2 py-1 bg-white border border-amber-300 rounded text-xs font-black text-slate-800 outline-none text-right"
                    title="Job-level override: Change pieces per crate for this forming job"
                  />
                  <span className="text-[10px] text-amber-900 font-extrabold bg-amber-200/80 px-2 py-0.5 rounded">
                    3D Formed Pcs
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-amber-900 bg-amber-100/60 p-2 rounded-lg border border-amber-200/80 flex-wrap gap-2">
                <span>
                  📐 <b>3D Volume Expansion:</b> 1 Cut Crate ({(standardCutPcs ?? 0).toLocaleString()} net flat) expands to ≈ <b>{expansionRatio} Formed Crates</b> ({(effectiveFormPcs ?? 0).toLocaleString()} 3D pcs/crate).
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {activeJobMetrics.hasRejectionDeduction && (
                    <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300">
                      ✂️ -{(activeJobMetrics.cuttingRejectedPcs ?? 0).toLocaleString()} Cutting Minor Rejection Deducted
                    </span>
                  )}
                  <span className="font-bold text-slate-700">
                    Input Issued: <b>{activeBatchObj.batch.issuedQty || 0} Cut Crates</b> (≈ {(activeBatchObj.batch.inputPieces || ((activeBatchObj.batch.issuedQty || 0) * standardCutPcs) || 0).toLocaleString()} Net Flat Blanks @ {(standardCutPcs ?? 0).toLocaleString()} pcs/crate)
                  </span>
                </div>
              </div>

              {/* Live pieces calculation preview & Dynamic Packing Audit Check */}
              {activeBatchObj && (
                (() => {
                  const inputCrates = activeBatchObj.batch.issuedQty || 0;
                  const totalInputPieces = activeBatchObj.batch.inputPieces || (inputCrates * standardCutPcs);
                  const enterCrates = parseFloat(outputCrates) || 0;
                  const enterLoose = parseInt(loosePiecesInput, 10) || 0;
                  const enterScrap = parseInt(scrapPcs, 10) || 0;
                  const prevPcs = activeBatchObj.batch.producedPieces || 0;
                  const currentOutPcs = Math.round(enterCrates * effectiveFormPcs) + enterLoose;
                  const cumulativeOutPcs = prevPcs + currentOutPcs;
                  const isAuditExceeded = cumulativeOutPcs > totalInputPieces;
                  const isScrapExceeded = (cumulativeOutPcs + enterScrap) > totalInputPieces;

                  return (
                    <div className="space-y-2">
                      <div className="bg-white/95 border border-amber-300 px-3 py-2.5 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="font-bold text-slate-700">
                          Conversion Formula: <span className="text-emerald-700 font-black">{enterCrates} Crates</span> × {(effectiveFormPcs ?? 0).toLocaleString()} Pcs/Crate
                          {enterLoose > 0 && <span> + {enterLoose} Loose</span>}
                        </div>
                        <div className="text-amber-950 font-black bg-amber-100 px-2.5 py-1 rounded-md text-xs border border-amber-300">
                          Claimed: {(cumulativeOutPcs ?? 0).toLocaleString()} / Issued: {(totalInputPieces ?? 0).toLocaleString()} Net Blanks
                        </div>
                      </div>

                      {/* Dynamic Audit Status Pill */}
                      {isAuditExceeded ? (
                        <div className="bg-rose-100 border-2 border-rose-500 text-rose-950 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between animate-pulse">
                          <span className="flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>🚨 AUDIT MISMATCH: Output ({(cumulativeOutPcs ?? 0).toLocaleString()} pcs) exceeds Input ({(totalInputPieces ?? 0).toLocaleString()} pcs) by {(cumulativeOutPcs - totalInputPieces).toLocaleString()} pcs!</span>
                          </span>
                          <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">
                            Submission Blocked
                          </span>
                        </div>
                      ) : isScrapExceeded ? (
                        <div className="bg-rose-100 border-2 border-rose-500 text-rose-950 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>🚨 AUDIT MISMATCH: Good Pcs + Defect Pcs ({((cumulativeOutPcs + enterScrap) || 0).toLocaleString()} pcs) exceeds Input ({(totalInputPieces ?? 0).toLocaleString()} pcs)!</span>
                          </span>
                          <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">
                            Submission Blocked
                          </span>
                        </div>
                      ) : (enterCrates > 0 || prevPcs > 0) ? (
                        <div className="space-y-2">
                          <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>✅ AUDIT VERIFIED: Output quantity is strictly within issued {inputCrates} Cut Crates envelope.</span>
                            </span>
                            <span className="text-[11px] text-emerald-800 font-mono">
                              Yield: {((cumulativeOutPcs / (totalInputPieces || 1)) * 100).toFixed(1)}%
                            </span>
                          </div>

                          {totalInputPieces > cumulativeOutPcs && (
                            <div className="bg-amber-50 border border-amber-300 text-amber-950 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between animate-fade-in">
                              <span className="flex items-center gap-1.5">
                                <span className="text-amber-600 text-sm">📉</span>
                                <span>ZERO-TOLERANCE REJECTION: <b>{(totalInputPieces - cumulativeOutPcs).toLocaleString()} Pcs</b> will be automatically logged as scrap.</span>
                              </span>
                              <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                                Auto-Calculated
                              </span>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })()
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

            {/* Target Crate Guidance based on Cutting Input Pieces */}
            {activeBatchObj?.batch && (
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-950">
                  <span className="text-base">🎯</span>
                  <div>
                    <b>Target Crate Guidance:</b> Cutting Input = <span className="font-mono font-bold">{(activeBatchObj.batch.inputPieces || (activeBatchObj.batch.issuedQty * standardCutPcs)).toLocaleString()} Pcs</span> @ <span className="font-mono font-bold">{effectiveFormPcs.toLocaleString()} Pcs/Crate</span>.
                    <br />
                    Ideal Expected Total Output: <b className="text-emerald-700 font-mono text-sm">{((activeBatchObj.batch.inputPieces || (activeBatchObj.batch.issuedQty * standardCutPcs)) / effectiveFormPcs).toFixed(2)} Crates</b>.
                  </div>
                </div>
                <div className="bg-white px-3 py-1.5 rounded-lg border border-emerald-300 font-mono text-emerald-900 font-bold text-xs shadow-2xs">
                  Produced So Far: {(activeBatchObj.batch.producedQty || 0).toLocaleString()} Crates
                </div>
              </div>
            )}

            {/* Output and scrap entries */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-800 uppercase mb-1">
                    Passed Formed Crates Output (Current Shift):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={outputCrates}
                    onChange={(e) => setOutputCrates(e.target.value)}
                    placeholder="e.g. 5 or 0.5 Crates"
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Decimals allowed (e.g. 0.5, 1.5)
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-800 uppercase mb-1">
                    Loose Pieces:
                  </label>
                  <input
                    type="number"
                    value={loosePiecesInput}
                    onChange={(e) => setLoosePiecesInput(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-rose-700 uppercase mb-1">
                    Defective Pieces (PCS):
                  </label>
                  <input
                    type="number"
                    value={scrapPcs}
                    onChange={(e) => setScrapPcs(e.target.value)}
                    placeholder="e.g. 45 Pcs"
                    className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
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
                    const cuttingLots = (state.wipLots || []).filter(
                      (lot) => lot.jobId === activeBatchObj.job.id && lot.stage === 'Cutting' && (lot.consumedQty || 0) > 0
                    );
                    setUnissueTargetLotId(cuttingLots[0]?.id || activeBatchObj.batch.sourceLotId || '');
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
                  className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                  title="Handover machine to incoming shift operator without stopping the batch"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Shift Handover
                </button>
                <button
                  type="button"
                  onClick={() => onOpenHoldModal(selectedMachine)}
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
                  <Square className="w-3.5 h-3.5" /> Finish Run
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
            ⚪ Workstation [{selectedMachine}] is currently IDLE. Select cut crates below to start a run.
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* START / ISSUE CUT CRATES TO WORKSTATION FORM */}
      {/* ======================================================== */}
      <div className="border-t border-slate-200 pt-4">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Play className="w-4 h-4 text-indigo-600" />
          Start or Top-up Forming Run on [{selectedMachine}]:
        </h4>

        <form onSubmit={handleStartOrTopup} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="block text-xs font-bold text-purple-700 uppercase">
                Operator & Crew <span className="text-rose-600">*</span>:
              </label>
              <div className="flex items-center justify-between bg-white border border-purple-300 px-3 py-2 rounded-lg">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800">{operatorName || 'Select Operator'}</span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {assignedHelpers.length > 0 ? `${assignedHelpers.length} Helpers (${assignedHelpers.join(', ')})` : 'No Helpers Assigned'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCrewModalOpen(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded transition cursor-pointer"
                >
                  Change Crew
                </button>
              </div>
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
                  <span>👥 Crew & Helper Modal</span>
                </button>
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
              {assignedHelpers.length === 0 && (
                <span className="text-xs font-bold text-slate-400 italic">No helpers assigned for this batch yet.</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select Cut Crates Job from Queue:
            </label>
            <select
              value={selectedPendingJobId}
              onChange={(e) => {
                setSelectedPendingJobId(e.target.value);
                const j = jobs.find((x) => x.id === e.target.value);
                if (j) setIssueCratesQty(String(j.availableCuttingCrates || 1));
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
            >
              <option value="">-- SELECT CUT CRATES QUEUE --</option>
              {pendingCutJobs.map((j) => {
                const jm = getJobCuttingMetrics(j);
                const custSuffix = j.customerName ? ` [Customer: ${j.customerName}]` : '';
                return (
                  <option key={j.id} value={j.id}>
                    {j.id}{custSuffix} - {j.product} [{j.paperBrand || 'ITC'}] (Avail: {j.availableCuttingCrates} Crates = {jm.totalNetPieces.toLocaleString()} Net Blanks)
                  </option>
                );
              })}
            </select>
          </div>

          {selectedPendingJob && (() => {
            const jm = getJobCuttingMetrics(selectedPendingJob);
            const inputCratesNum = parseInt(issueCratesQty, 10) || 0;
            const issuingPcs = inputCratesNum * jm.netPcsPerCrate;
            return (
              <div className="space-y-2">
                <div className="p-3.5 bg-indigo-50/90 border border-indigo-200 rounded-xl space-y-2 text-xs text-indigo-950 shadow-2xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-indigo-900">
                        📦 Available Stock: {selectedPendingJob.availableCuttingCrates} Cut Crates {selectedPendingJob.customerName ? `[${selectedPendingJob.customerName}]` : ''}
                      </span>
                      <span className="bg-indigo-200/80 text-indigo-900 font-black px-2 py-0.5 rounded text-[11px]">
                        {jm.totalNetPieces.toLocaleString()} Net Flat Blanks
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600">
                      Packing: <b>{jm.netPcsPerCrate.toLocaleString()} Net Pcs / Crate</b> (Brand: {selectedPendingJob.paperBrand || 'ITC'})
                    </span>
                  </div>
                  {jm.hasRejectionDeduction && (
                    <div className="bg-white/90 border border-amber-300 px-3 py-1.5 rounded-lg text-amber-900 text-[11px] font-bold flex items-center justify-between flex-wrap gap-1">
                      <span>
                        ✂️ <b>Cutting Minor Rejection Deducted:</b> {jm.cuttingRejectedPcs.toLocaleString()} defect pieces were subtracted across {jm.totalCutCrates || selectedPendingJob.availableCuttingCrates} cut crates.
                      </span>
                      <span className="font-mono text-[10px] bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                        Net: {jm.netPcsPerCrate.toLocaleString()} pcs/crate (vs {jm.rawStdCutPcs.toLocaleString()} gross std)
                      </span>
                    </div>
                  )}
                  {inputCratesNum > 0 && (
                    <div className="pt-1 border-t border-indigo-200/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-semibold">
                        Currently Issuing: <b>{inputCratesNum} Cut Crates</b>
                      </span>
                      <span className="font-extrabold text-indigo-900">
                        = <b>{issuingPcs.toLocaleString()} Net Flat Blanks</b> entering Forming
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
                  <span className="font-extrabold text-slate-700 uppercase tracking-wide block text-[11px]">
                    🔍 Cutting Operator Lots Source Breakdown (Traceability):
                  </span>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {(() => {
                      const selectableLots: {
                        id: string;
                        batchId: string;
                        worker: string;
                        shift: string;
                        machine: string;
                        totalQty: number;
                        consumedQty: number;
                        remainingQty: number;
                        date?: string;
                      }[] = [];

                      const cuttingBatches = (selectedPendingJob.runningBatches || []).filter(b => b.stage === 'Cutting' || b.machine?.startsWith('Cutting'));
                      
                      cuttingBatches.forEach(cb => {
                        const totalP = cb.producedQty || 0;
                        const consumedP = cb.consumedQty || 0;
                        
                        if (cb.slices && cb.slices.length > 0) {
                          cb.slices.forEach(slice => {
                            const sliceTotal = slice.producedQty || 0;
                            const sliceConsumed = slice.consumedQty || 0;
                            const sliceRemaining = Math.max(0, sliceTotal - sliceConsumed);
                            selectableLots.push({
                              id: slice.sliceId,
                              batchId: cb.batchId,
                              worker: slice.operator,
                              shift: slice.shift,
                              machine: cb.machine || slice.machine || 'Cutting',
                              totalQty: sliceTotal,
                              consumedQty: sliceConsumed,
                              remainingQty: sliceRemaining,
                              date: slice.date
                            });
                          });
                        } else {
                          selectableLots.push({
                            id: cb.batchId,
                            batchId: cb.batchId,
                            worker: cb.worker,
                            shift: cb.shift,
                            machine: cb.machine || 'Cutting',
                            totalQty: totalP,
                            consumedQty: consumedP,
                            remainingQty: Math.max(0, totalP - consumedP)
                          });
                        }
                      });

                      // Add WIP Lots (New ERP Approach) without duplication
                      const wipLots = state.wipLots?.filter(lot => lot.jobId === selectedPendingJob.id && lot.stage === 'Cutting') || [];
                      wipLots.forEach(lot => {
                        if (!selectableLots.some(sl => sl.id === lot.id)) {
                          selectableLots.push({
                            id: lot.id,
                            batchId: lot.id,
                            worker: lot.producedByOperator,
                            shift: lot.shift,
                            machine: lot.machine,
                            totalQty: lot.producedQty,
                            consumedQty: lot.consumedQty,
                            remainingQty: lot.remainingQty,
                            date: lot.timestamp.split('T')[0]
                          });
                        }
                      });

                      if (selectableLots.length === 0) {
                        return <div className="text-slate-400 italic text-[11px]">No specific cutting lot metadata found (Legacy or Direct entry).</div>;
                      }

                      // If no lot is currently selected, pick the first one with remaining quantity
                      const activeSelectionId = selectedCuttingBatchId || selectableLots.find(l => l.remainingQty > 0)?.id || selectableLots[0].id;

                      return selectableLots.map(lot => {
                        const isSelected = activeSelectionId === lot.id;
                        
                        return (
                          <div 
                            key={lot.id} 
                            onClick={() => {
                              if (lot.remainingQty > 0) {
                                setSelectedCuttingBatchId(lot.id);
                                setIssueCratesQty(String(Math.min(lot.remainingQty, 2)));
                              }
                            }}
                            className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between text-[11px] ${
                              isSelected 
                                ? 'bg-indigo-100 border-indigo-500 text-indigo-950 font-bold shadow-xs ring-1 ring-indigo-400' 
                                : lot.remainingQty === 0
                                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono bg-indigo-50 text-indigo-900 border border-indigo-100 px-2 py-0.5 rounded text-[10px] font-bold">
                                Lot: {lot.id.substring(0, 16)}
                              </span>
                              <span className="font-extrabold text-slate-900">👨‍🏭 {lot.worker}</span>
                              <span className="text-slate-500 font-normal">({lot.machine} | ☀️ {lot.shift})</span>
                            </div>
                            <div className="font-mono text-right shrink-0">
                              <div className={`font-black ${lot.remainingQty > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                {lot.remainingQty} Crates Remaining
                              </div>
                              <div className="text-slate-400 text-[9px] font-medium">({lot.totalQty} Produced, {lot.consumedQty} Consumed)</div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Enter Cut Crates to Issue (Cut Crates) *:
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 4, 8].map((num) => (
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

          <button
            type="submit"
            disabled={!selectedPendingJobId}
            className="w-full py-3 bg-[#2b6cb0] hover:bg-[#1a365d] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start Forming Run on {selectedMachine}</span>
          </button>
        </form>
      </div>

      {/* ======================================================== */}
      {/* FORMING REELS & TRACEABILITY REGISTER (BOTTOM TEMPLATE MATCHING SLITTING) */}
      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* FORMING REELS & TRACEABILITY REGISTER (BOTTOM TEMPLATE MATCHING SLITTING) */}
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
          const formBatches = (j.runningBatches || []).filter((b) => b.stage === 'Forming' || b.machine.startsWith('Forming'));
          const formStageLedger = getJobStageShiftLedger(j, 'Forming', state);
          const formPcsStd = j.pcsPerCrateForming || state.crateCapacityMaster?.[j.product]?.formingPcs || 7000;
          const totalFormedPcs = j.totalFormedPieces || ((j.availableFormingCrates || 0) * formPcsStd);
          const totalDefects = formBatches.reduce((sum, b) => sum + (b.scrapPcs || 0), 0);
          const totalInCrates = formBatches.reduce((sum, b) => sum + (b.issuedQty || 0), 0);

          const latestLog = (state.logs || []).filter((l) => l.jobId === j.id).slice(-1)[0];
          const entryDate = latestLog?.rawDate || (j.createdAt ? j.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
          const entryTime = latestLog?.startTime || (latestLog?.timestamp ? latestLog.timestamp.split(',')[1]?.trim() : '');
          const paperBrand = j.paperBrand || 'ITC';
          const remark = j.customRemark || 'Standard';
          const stock = j.availableFormingCrates || 0;

          // Status representation
          let statusText = j.stage || '';
          if (stock > 0) {
            statusText = `Pending QC (${stock} Crates)`;
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
            totalFormedPcs,
            totalDefects,
            totalInCrates,
            statusText,
            formStageLedger,
            formBatches,
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
              item.formBatches.some((b) => (b.worker || '').toLowerCase().includes(q) || b.machine.toLowerCase().includes(q) || b.batchId.toLowerCase().includes(q))
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
          const headers = ['Job ID', 'Date', 'Time', 'Reel No.', 'GSM', 'Paper Mill', 'Product', 'Remarks / Lot', 'Stock (Crates)', 'Pieces', 'In (Crates)', 'Out (Crates)', 'Scrap (Pcs)', 'Stage Status'];
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
            escapeCSV(item.totalFormedPcs),
            escapeCSV(item.totalInCrates),
            escapeCSV(item.stock),
            escapeCSV(item.totalDefects),
            escapeCSV(item.statusText)
          ]);

          const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', `Forming_Traceability_Register_${new Date().toISOString().split('T')[0]}.csv`);
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
                  <span>Forming Reels & Traceability Register</span>
                </h3>
                <p className="text-xs text-slate-500 m-0">
                  Reel number, GSM, and forward traceability status for each forming job ID
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
                        <span>Formed Stock</span>
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
                            {item.formBatches.length > 0 && (
                              <span className="font-mono text-[10px] bg-purple-50 text-purple-800 px-1 py-0.5 rounded border border-purple-200">
                                Lot: {item.formBatches[0].batchId}
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
                          {item.formStageLedger.totalShifts > 1 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span
                                className="bg-blue-50 text-blue-900 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 cursor-help"
                                title={item.formStageLedger.items.map(it => `${it.date} | ${it.shift} (${it.operator}): ${it.producedQty} Crates (${it.producedPieces?.toLocaleString() || 0} Pcs), ${it.scrapPcs || 0} Scrap Pcs`).join(' \n ')}
                              >
                                <RotateCcw className="w-2.5 h-2.5 text-blue-600" />
                                <span>{item.formStageLedger.totalShifts} Shifts Handover</span>
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-emerald-700">
                          {item.stock} Crates
                          <div className="text-[10px] text-emerald-600 font-semibold">
                            ({item.totalFormedPcs.toLocaleString()} 3D Pcs)
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-mono text-xs">
                          <div className="flex flex-col items-end">
                            <span className="text-slate-700 font-bold">
                              In: {item.totalInCrates > 0 ? `${item.totalInCrates} Crates` : `${j.availableCuttingCrates || 0} Crates`}
                            </span>
                            <span className="text-blue-700 font-medium">
                              Out: {item.stock} Crates
                            </span>
                            {item.totalDefects > 0 && (
                              <span className="text-rose-700 font-bold text-[11px]">
                                Scrap: {item.totalDefects} Pcs
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          {item.stock > 0 ? (
                            <span className="text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              Pending QC ({item.stock} Crates)
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
                            title="Track Lot & Shift-wise Genealogy History (ऑपरेटर एवं शिफ्ट वार सम्पूर्ण विवरण)"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Track Lot</span>
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
      {/* INLINE MODALS FOR FORWARD, UNISSUE & CANCEL */}
      {/* ======================================================== */}

      {/* Forward Partial Modal */}
      {isForwardModalOpen && activeBatchObj && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Zap className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 m-0">Forward Formed Crates to QC Desk</h3>
                <p className="text-[11px] text-slate-500 m-0">Forward formed crates while forming machine continues running</p>
              </div>
            </div>

            <div className="bg-purple-50 p-3 rounded-xl text-xs space-y-1 text-purple-900">
              <div>Job: <b>{activeBatchObj.job.id}</b> ({activeBatchObj.job.product})</div>
              <div>Machine: <b>{selectedMachine}</b> | Operator: <b>{activeBatchObj.batch.worker}</b></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Enter Formed Crates to Forward:
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
                  <span>Equates to 3D Pieces:</span>
                  <span className="font-black text-purple-950">
                    {(parseInt(forwardQtyInput, 10) * effectiveFormPcs).toLocaleString()} 3D Pieces
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
                onClick={handleConfirmForwardToQC}
                className="px-4 py-2 text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 rounded-xl cursor-pointer shadow-xs flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> Confirm Forward
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Un-issue Modal */}
      {isUnissueModalOpen && activeBatchObj && (() => {
        const cuttingLotsForJob = (state.wipLots || []).filter(
          (lot) => lot.jobId === activeBatchObj.job.id && lot.stage === 'Cutting' && (lot.consumedQty || 0) > 0
        );
        const chosenLotObj = cuttingLotsForJob.find(l => l.id === unissueTargetLotId);
        const maxReturnable = chosenLotObj
          ? Math.min(activeBatchObj.batch.issuedQty || 0, chosenLotObj.consumedQty || 0)
          : (activeBatchObj.batch.issuedQty || 0);

        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Undo2 className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 m-0">Issue Return (Un-issue Cut Crates)</h3>
                  <p className="text-[11px] text-slate-500 m-0">Return excess cut crates back to Cutting Stock</p>
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl text-xs space-y-1 text-amber-900">
                <div>Job: <b>{activeBatchObj.job.id}</b> ({activeBatchObj.job.product})</div>
                <div>Currently Issued to Machine: <b>{activeBatchObj.batch.issuedQty} Crates</b></div>
                {activeBatchObj.batch.sourceOperator && (
                  <div className="text-amber-800 font-semibold flex items-center gap-1">
                    <span>↩️ Original Starting Operator:</span>
                    <span className="font-extrabold bg-amber-200/80 text-amber-950 px-1.5 py-0.5 rounded text-[11px]">
                      👨‍🏭 {activeBatchObj.batch.sourceOperator}
                    </span>
                  </div>
                )}
              </div>

              {cuttingLotsForJob.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Select Cutting Operator Lot to Return To:
                  </label>
                  <select
                    value={unissueTargetLotId}
                    onChange={(e) => {
                      setUnissueTargetLotId(e.target.value);
                      const chosenLot = cuttingLotsForJob.find(l => l.id === e.target.value);
                      if (chosenLot) {
                        const cappedQty = Math.min(activeBatchObj.batch.issuedQty || 0, chosenLot.consumedQty || 0);
                        if (parseFloat(unissueQtyInput) > cappedQty || !unissueQtyInput) {
                          setUnissueQtyInput(String(cappedQty));
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs font-bold text-slate-800 bg-white outline-none focus:border-amber-500"
                  >
                    {cuttingLotsForJob.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        👨‍🏭 {lot.producedByOperator} ({lot.id}) — Consumed: {lot.consumedQty || 0} Crates
                      </option>
                    ))}
                    <option value="">
                      Auto-Restore across all consumed lots (LIFO)
                    </option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                  <span>Enter Crates Quantity to Return:</span>
                  {chosenLotObj && (
                    <span className="text-[10px] text-amber-700 font-black">
                      Max: {chosenLotObj.consumedQty} Crates
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxReturnable}
                  value={unissueQtyInput}
                  onChange={(e) => {
                    const entered = parseFloat(e.target.value) || 0;
                    if (entered > maxReturnable) {
                      setUnissueQtyInput(String(maxReturnable));
                    } else {
                      setUnissueQtyInput(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUnissueModalOpen(false);
                    setUnissueTargetLotId('');
                  }}
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
        );
      })()}

      {/* Cancel Run Confirm Modal */}
      {isCancelConfirmOpen && activeBatchObj && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-rose-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-rose-100 pb-3">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <div>
                <h3 className="text-sm font-extrabold text-rose-950 m-0">Cancel Forming Run & Return Crates</h3>
                <p className="text-[11px] text-slate-500 m-0">Safely cancel this forming run and restore cut crates</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1.5 text-rose-900">
              <div>Are you sure you want to cancel Forming Batch on <b>{selectedMachine}</b> for Job <b>{activeBatchObj.job.id}</b>?</div>
              <div className="font-extrabold text-rose-950 bg-white/80 p-2 rounded-lg border border-rose-200">
                📦 {activeBatchObj.batch.issuedQty || 0} Cut Crates will be returned to Cutting Stock immediately.
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

      {/* ======================================================== */}
      {/* STRICT AUDIT MISMATCH MODAL (ZERO TOLERANCE / ENTRY BLOCKED) */}
      {/* ======================================================== */}
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
                <div className="text-[11px] font-bold text-slate-500 uppercase">1. Issued Input (Cut Crates)</div>
                <div className="text-xl font-black text-slate-800">
                  {auditMismatchError.inputCrates} Cut Crates
                </div>
                <div className="text-slate-600 font-semibold">
                  @ {(standardCutPcs ?? 0).toLocaleString()} Flat Blanks / Crate
                </div>
                <div className="font-black text-blue-900 text-sm pt-1.5 border-t border-slate-200">
                  Total Input: {(auditMismatchError.inputPcs ?? 0).toLocaleString()} Pcs
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl space-y-1.5">
                <div className="text-[11px] font-bold text-rose-600 uppercase">2. Claimed Output (Forming)</div>
                <div className="text-xl font-black text-rose-950">
                  {auditMismatchError.outputCrates} Formed Crates
                </div>
                <div className="text-rose-700 font-semibold">
                  @ {(effectiveFormPcs ?? 0).toLocaleString()} 3D Pieces / Crate
                </div>
                <div className="font-black text-rose-950 text-sm pt-1.5 border-t border-rose-200">
                  Total Claimed: {(auditMismatchError.outputPcs ?? 0).toLocaleString()} Pcs
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Dynamic Packing & Physical Conservation Rule:</span>
              </div>
              <p className="m-0 leading-relaxed text-[11px]">
                Cutting has <b>{(standardCutPcs ?? 0).toLocaleString()} flat blanks</b> per crate while forming has <b>{(effectiveFormPcs ?? 0).toLocaleString()} 3D pieces</b> per crate. Although crate count changes due to volume expansion, <b>total output pieces can never exceed total input pieces</b>. Under Zero Tolerance policy, this entry has been blocked.
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

      {/* Station Crew Assignment Modal */}
      <StationCrewModal
        isOpen={isCrewModalOpen}
        onClose={() => setIsCrewModalOpen(false)}
        machine={selectedMachine}
        stage="Forming"
        shift={activeBatchObj?.batch.shift || 'DAY'}
        currentOperator={activeBatchObj?.batch.worker || ''}
        currentHelpers={activeBatchObj?.batch.helpers || []}
        state={state}
        onConfirmCrew={handleConfirmCrew}
      />

      {/* Shift Handover Modal */}
      {activeBatchObj && (
        <ShiftHandoverModal
          isOpen={isShiftHandoverModalOpen}
          onClose={() => setIsShiftHandoverModalOpen(false)}
          batch={activeBatchObj.batch}
          job={activeBatchObj.job}
          machine={selectedMachine}
          stageName="Forming"
          availableWorkers={formWorkers}
          unitLabel="Formed Crates"
          piecesPerUnit={effectiveFormPcs}
          initialProducedQty={parseFloat(outputCrates) || undefined}
          initialLoosePieces={parseInt(loosePiecesInput, 10) || undefined}
          initialScrapQty={parseFloat(scrapPcs) || undefined}
          onConfirmHandover={handleConfirmShiftHandover}
        />
      )}
    </div>
  );
};
