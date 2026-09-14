import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Play, Pause, Lock, Square, XCircle, Plus, AlertCircle, Check, Search, Tag, ShieldCheck, Layers, Eye, AlertTriangle, RotateCcw, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { FactoryState, Job, JobReelItem, ProductType, RunningBatch, OperatorRunSlice, LogEntry, PlannedLayer } from '../../types';
import { PRODUCTS, PAPER_BRANDS, DEPT_WORKERS, PRODUCT_PREFIX_MAP } from '../../lib/constants';
import {
  getCurrentExpectedShift,
  getJobAllReels,
  getJobReelsSummary,
  getJobReelItemsBreakdown,
  formatGsmString,
  getJobAllGsms,
  getJobGsmsSummary,
  calculateLayerFulfillmentMatrix,
  isJobLayersFullySlit,
  getJobPlannedLayers,
  parseNumericGsm,
  normalizeGsmLabel,
  LayerFulfillmentStatus
} from '../../lib/utils';
import {
  getNumberingMaster,
  generateUnifiedJobId,
  generateSlittingBatchId
} from '../../lib/numberingMaster';

import { MachineBreakdownBanner } from '../MachineBreakdownBanner';
import { LotGenealogyModal } from '../LotGenealogyModal';
import { ShiftHandoverModal } from '../ShiftHandoverModal';
import { StationCrewModal } from '../StationCrewModal';
import { Users } from 'lucide-react';

interface SlittingViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  onOpenHoldModal: (machineName: string) => void;
  onOpenAttendModal?: (machineName: string) => void;
  onOpenVoiceModalForTarget?: (callback: (text: string) => void) => void;
  onNavigateToTraceability?: (query: string) => void;
  preSelectedPlanId?: string;
}

export const SlittingView: React.FC<SlittingViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onOpenHoldModal,
  onOpenAttendModal,
  onOpenVoiceModalForTarget,
  onNavigateToTraceability,
  preSelectedPlanId
}) => {
  const { jobs, seriesConfig, shiftConfig, productionPlans = [], motherReelInventory = [] } = state;
  const productList = state.products && state.products.length > 0 ? state.products : PRODUCTS;
  const paperBrandList = state.paperBrands && state.paperBrands.length > 0 ? state.paperBrands : PAPER_BRANDS;
  const slitWorkers = state.deptWorkers?.['Slitting'] || DEPT_WORKERS['Slitting'] || ['SLIT_RAMESH', 'SLIT_SURESH'];

  // Planning & Mother Reel Link
  const [selectedPlanId, setSelectedPlanId] = useState<string>(preSelectedPlanId || '');
  const [selectedMotherReelId, setSelectedMotherReelId] = useState<string>('');
  const [actualSlitLengthMeters, setActualSlitLengthMeters] = useState<string>('');

  // Selected Plan Object & its Planned GSMs
  const selectedPlan = productionPlans.find((p) => p.id === selectedPlanId);
  const planAvailableGsms: string[] = React.useMemo(() => {
    if (!selectedPlan) return [];
    if (selectedPlan.plannedGsms && selectedPlan.plannedGsms.length > 0) {
      return selectedPlan.plannedGsms;
    }
    if (selectedPlan.targetGsm) {
      return selectedPlan.targetGsm
        .split(/[,+/]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, [selectedPlan]);

  const [product, setProduct] = useState<ProductType>(() => {
    if (preSelectedPlanId) {
      const p = productionPlans.find((plan) => plan.id === preSelectedPlanId);
      if (p) return p.product;
    }
    return productList[0] || 'Spoon';
  });
  const [paperBrand, setPaperBrand] = useState(() => {
    if (preSelectedPlanId) {
      const p = productionPlans.find((plan) => plan.id === preSelectedPlanId);
      if (p && p.paperBrand) return p.paperBrand;
    }
    return paperBrandList[0] || 'ITC';
  });
  const [operatorName, setOperatorName] = useState(slitWorkers[0] || 'SLIT_RAMESH');
  const [shift, setShift] = useState<'DAY' | 'NIGHT'>(() => {
    if (preSelectedPlanId) {
      const p = productionPlans.find((plan) => plan.id === preSelectedPlanId);
      if (p && p.assignedShift) return p.assignedShift;
    }
    return getCurrentExpectedShift(shiftConfig);
  });
  
  // Separate Reel Number, GSM, and Remarks
  const [reelNo, setReelNo] = useState('');
  const [gsm, setGsm] = useState(() => {
    if (preSelectedPlanId) {
      const p = productionPlans.find((plan) => plan.id === preSelectedPlanId);
      if (p) {
        if (p.plannedGsms && p.plannedGsms.length > 0) return p.plannedGsms[0];
        if (p.targetGsm) {
          const parts = p.targetGsm.split(/[,+/]/).map(s => s.trim()).filter(Boolean);
          if (parts.length > 0) return parts[0];
          return p.targetGsm;
        }
      }
    }
    return '120 GSM';
  });
  const [customGsm, setCustomGsm] = useState('');
  const [reelRemarks, setReelRemarks] = useState('');
  const [jumboWeightKg, setJumboWeightKg] = useState('200');

  const [isHotFoilLayer, setIsHotFoilLayer] = useState(false);
  const [addReelIsHotFoilLayer, setAddReelIsHotFoilLayer] = useState(false);

  // Printed Roll States
  const [isPrintedRoll, setIsPrintedRoll] = useState(false);
  const [printedRollDesign, setPrintedRollDesign] = useState('');
  const [printedRollIcon, setPrintedRollIcon] = useState('Sparkles');

  // Add Reel Printed Roll States
  const [addReelIsPrintedRoll, setAddReelIsPrintedRoll] = useState(false);
  const [addReelPrintedRollDesign, setAddReelPrintedRollDesign] = useState('');
  const [addReelPrintedRollIcon, setAddReelPrintedRollIcon] = useState('Sparkles');

  const [isLengthWarningModalOpen, setIsLengthWarningModalOpen] = useState(false);

  // Planned Slit Output Limit Exceed Modal (Applies strictly to Output Rolls Produced)
  const [isExceedOutputModalOpen, setIsExceedOutputModalOpen] = useState(false);

  const [outputRolls, setOutputRolls] = useState('');
  const [outputWeightKg, setOutputWeightKg] = useState('');
  const [scrapKgInput, setScrapKgInput] = useState('');
  const [selectedActiveBatchId, setSelectedActiveBatchId] = useState('');

  // Table filter search
  const [tableSearch, setTableSearch] = useState('');

  // Genealogy Modal Job State
  const [genealogyModalJob, setGenealogyModalJob] = useState<Job | null>(null);

  // Shift Handover Modal State
  const [isShiftHandoverModalOpen, setIsShiftHandoverModalOpen] = useState(false);
  const [assignedHelpers, setAssignedHelpers] = useState<string[]>([]);
  const [isCrewModalOpen, setIsCrewModalOpen] = useState(false);

  // Modals
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isAddReelModalOpen, setIsAddReelModalOpen] = useState(false);
  const [addReelJobId, setAddReelJobId] = useState('');
  const [addReelWorker, setAddReelWorker] = useState(slitWorkers[0] || 'SLIT_RAMESH');
  const [addReelNo, setAddReelNo] = useState('');
  const [addReelGsm, setAddReelGsm] = useState(() => (state.targetGsmMaster && state.targetGsmMaster.length > 0 ? state.targetGsmMaster[0] : '120 GSM'));
  const [addReelRemarks, setAddReelRemarks] = useState('');
  const [addReelWeightKg, setAddReelWeightKg] = useState('200');

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

  // Single Active Job restriction: Only 1 job can be 'Running' on Slitting-1 at any time
  const currentRunningBatch = activeBatches.find((item) => item.batch.status === 'Running');

  
  const handleConfirmCrew = (operator: string, helpers: string[]) => {
    setOperatorName(operator);
    setAssignedHelpers(helpers);
    setIsCrewModalOpen(false);

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
            assignedMachine: 'Slitting-1',
            isPresent: true,
            status: 'PRODUCING' as const,
            inTime: w.inTime || nowTime
          };
        }
        if (helpers.some((h) => h.toUpperCase() === w.name.toUpperCase())) {
          return {
            ...w,
            assignedMachine: 'Slitting-1',
            pairedWithOperator: operator.trim().toUpperCase(),
            isPresent: true,
            status: 'PRODUCING' as const,
            inTime: w.inTime || nowTime
          };
        }
        // Unpair previously assigned helpers for this machine or operator
        if (w.role === 'HELPER' && (w.assignedMachine === 'Slitting-1' || w.pairedWithOperator === operator.trim().toUpperCase())) {
          return {
            ...w,
            assignedMachine: undefined,
            pairedWithOperator: undefined,
            status: undefined
          };
        }
        return w;
      });

      const newLog: LogEntry = {
        jobId: job.id,
        product: job.product,
        stage: 'Slitting',
        machine: 'Slitting-1',
        action: `👥 Station Crew Assigned: Operator [${operator}] with ${helpers.length} Helpers (${helpers.join(', ')}) on Slitting-1 for Batch [${batch.batchId}]`,
        worker: operator,
        user: 'slit_supervisor',
        rawDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      };

      onSaveState({
        ...state,
        jobs: updatedJobs,
        floorWorkers: updatedWorkers.length > 0 ? updatedWorkers : state.floorWorkers,
        logs: [newLog, ...(state.logs || [])]
      });
    }
  };

  const handleStartNewReel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorName.trim()) {
      alert('⚠️ Mandatory: Operator Name is required!');
      return;
    }

    // Strict PPC Job Requirement
    if (!selectedPlanId) {
      alert('⚠️ Mandatory: You must select a Scheduled PPC Plan to start slitting. Direct runs are disabled.');
      return;
    }

    // Strict Single Active Job Constraint
    if (currentRunningBatch) {
      alert(
        `⚠️ Single Active Job Constraint:

Job [${currentRunningBatch.job.id}] (Reel: ${currentRunningBatch.batch.reelNo || currentRunningBatch.job.reelNo}) is already running on machine [Slitting-1]!

Only one active job can run on a machine at a time. Until the current job is Held or Completed, no new job should be started (Run) on that machine.

👉 If you need to add an extra reel to this same job, use the 'Add Reel to Running Job' option (without stopping/holding the job).`
      );
      return;
    }

    const master = getNumberingMaster(seriesConfig);
    const targetPlan = selectedPlanId ? productionPlans.find(p => p.id === selectedPlanId) : null;
    
    // Check if a job was already created for this plan during PPC Planning Desk step
    const existingPlanJob = (state.jobs || []).find(
      (j) => (targetPlan?.jobId && j.id === targetPlan.jobId) || (selectedPlanId && j.planId === selectedPlanId && j.stage === 'Planning')
    );

    let newJobId: string;
    let nextSeriesConfig = state.seriesConfig;

    if (existingPlanJob) {
      newJobId = existingPlanJob.id;
    } else {
      const generated = generateUnifiedJobId(product, seriesConfig, state.productPrefixMap, state.jobs || []);
      newJobId = generated.jobId;
      nextSeriesConfig = generated.updatedSeriesConfig;
    }

    const batchId = generateSlittingBatchId(newJobId, [], master);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Effective GSM dynamically bound from selected PPC plan or target master
    const effectiveGsm = gsm === 'Custom'
      ? (customGsm.trim() || targetPlan?.targetGsm || (targetPlan?.plannedGsms && targetPlan.plannedGsms[0]) || (state.targetGsmMaster && state.targetGsmMaster[0]) || '120 GSM')
      : gsm;
    // Effective Reel Number
    const effectiveReelNo =
      reelNo.trim() ||
      `RL-${paperBrand.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'ITC'}-${Math.floor(1000 + Math.random() * 9000)}`;

    const parsedJumboWeight = parseFloat(jumboWeightKg) || 0;
    if (parsedJumboWeight <= 0) {
      alert('⚠️ Mandatory: Jumbo Reel Weight (KG) is required before starting slitting!');
      return;
    }

    const newBatch: RunningBatch = {
      batchId,
      stage: 'Slitting',
      machine: 'Slitting-1',
      shift,
      startTime: nowTime,
      status: 'Running',
      reelNo: effectiveReelNo,
      gsm: effectiveGsm,
      issuedQty: 1,
      producedQty: 0,
      inputWeightKg: parsedJumboWeight,
      outputWeightKg: 0,
      scrapKg: 0,
      scrapPercent: 0,
      worker: operatorName.trim().toUpperCase(),
      user: 'slit_user',
      isHotFoilLayer: isHotFoilLayer || undefined,
      isPrintedRoll: isPrintedRoll || undefined,
      printedRollDesign: isPrintedRoll ? printedRollDesign : undefined,
      printedRollIcon: isPrintedRoll ? printedRollIcon : undefined
    };

    const initialReelItem: JobReelItem = {
      reelNo: effectiveReelNo,
      rolls: 0,
      weightKg: parsedJumboWeight,
      gsm: effectiveGsm,
      paperBrand,
      batchId,
      startTime: nowTime,
      worker: operatorName.trim().toUpperCase(),
      isHotFoilLayer: isHotFoilLayer || undefined,
      isPrintedRoll: isPrintedRoll || undefined,
      printedRollDesign: isPrintedRoll ? printedRollDesign : undefined,
      printedRollIcon: isPrintedRoll ? printedRollIcon : undefined
    };

    const newJob: Job = {
      id: newJobId,
      product,
      paperBrand,
      reelNo: effectiveReelNo,
      reelNumbers: [effectiveReelNo],
      reelsList: [initialReelItem],
      gsm: effectiveGsm,
      customRemark: reelRemarks.trim(),
      stage: 'Slitting',
      status: 'SLITTING_IN_PROGRESS',
      availableRolls: 0,
      availableCuttingCrates: 0,
      availableFormingCrates: 0,
      availableQcCrates: 0,
      inputWeightKg: parsedJumboWeight,
      outputWeightKg: 0,
      scrapKg: 0,
      scrapPercent: 0,
      runningBatches: [newBatch],
      planId: selectedPlanId || undefined,
      targetLayers: selectedPlanId ? productionPlans.find(p => p.id === selectedPlanId)?.targetLayers : undefined,
      targetLengthMeters: selectedPlanId ? productionPlans.find(p => p.id === selectedPlanId)?.targetLengthMeters : undefined,
      targetGlueBrand: selectedPlanId ? productionPlans.find(p => p.id === selectedPlanId)?.adhesiveBrand : undefined,
      targetScrapLimitPct: selectedPlanId ? productionPlans.find(p => p.id === selectedPlanId)?.targetScrapLimitPct : undefined,
      motherReelsAllocated: !isHotFoilLayer && selectedMotherReelId ? [selectedMotherReelId] : undefined,
      printedRollRequired: isPrintedRoll || undefined,
      printedRollDesign: isPrintedRoll ? printedRollDesign : undefined,
      printedRollIcon: isPrintedRoll ? printedRollIcon : undefined
    };

    const newLog = {
      jobId: newJobId,
      product,
      stage: 'Slitting',
      machine: 'Slitting-1',
      shift,
      action: isHotFoilLayer
        ? `🚀 Started Specialty Hot Foil / Hot Layer Reel [${effectiveReelNo}] | Weight: ${parsedJumboWeight} KG | Job: ${newJobId} | Worker: ${operatorName.toUpperCase()}`
        : `🚀 Started New Slitting Reel [${effectiveReelNo}] | Jumbo Weight: ${parsedJumboWeight} KG | GSM: ${effectiveGsm} | Mill: ${paperBrand} (${reelRemarks || 'Standard Reel'}) | Job: ${newJobId} | Worker: ${operatorName.toUpperCase()}` + (selectedPlanId ? ` | Linked Plan: ${selectedPlanId}` : ''),
      worker: operatorName.toUpperCase(),
      user: 'slit_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    const updatedPlans = productionPlans.map((p) => {
      if (p.id === selectedPlanId) {
        return { ...p, status: 'In-Progress' as const, jobId: newJobId };
      }
      return p;
    });

    const updatedMotherReels = isHotFoilLayer
      ? motherReelInventory
      : motherReelInventory.map((mr) => {
          if (mr.id === selectedMotherReelId) {
            return {
              ...mr,
              status: 'In-Use' as const,
              allocatedJobId: newJobId,
              allocatedDate: new Date().toISOString().split('T')[0]
            };
          }
          return mr;
        });

    let updatedJobs: Job[];
    if (existingPlanJob) {
      updatedJobs = state.jobs.map((j) => {
        if (j.id !== existingPlanJob.id) return j;
        return {
          ...j,
          ...newJob,
          id: existingPlanJob.id,
          plannedGsms: j.plannedGsms || newJob.plannedGsms,
          plannedLayers: j.plannedLayers || newJob.plannedLayers,
          runningBatches: [...(j.runningBatches || []), newBatch]
        };
      });
    } else {
      updatedJobs = [newJob, ...state.jobs];
    }

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog],
      seriesConfig: nextSeriesConfig,
      productionPlans: updatedPlans,
      motherReelInventory: updatedMotherReels
    });

    setReelNo('');
    setReelRemarks('');
    setSelectedPlanId('');
    setSelectedMotherReelId('');
    setIsHotFoilLayer(false);
    setSelectedActiveBatchId(batchId);
    alert(`✅ New Slitting Reel Started!\nJob ID: [${newJobId}]\nReel No: [${effectiveReelNo}]\nGSM: [${effectiveGsm}]\non Slitting-1.`);
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

    // Decoupled: Input Mother Jumbo Reels mounting on the unwinder is NOT restricted by output limits.
    // The restriction applies exclusively to the final operator input "Actual Slitted Output Rolls Produced".
    const existingReelsList = targetJob.reelsList && targetJob.reelsList.length > 0
      ? targetJob.reelsList
      : getJobReelItemsBreakdown(targetJob);

    // If a job is currently running on Slitting-1, operator can only add reel to THAT running job!
    if (currentRunningBatch && currentRunningBatch.job.id !== targetJob.id) {
      alert(
        `⚠️ Single Active Job Constraint:\n\nJob [${currentRunningBatch.job.id}] is currently running on machine [Slitting-1]! You can only add-on extra reels to this active job [${currentRunningBatch.job.id}].\n\nTo run another job [${targetJob.id}], first Hold or Complete the current job!`
      );
      return;
    }

    const master = getNumberingMaster(seriesConfig);
    const batchId = generateSlittingBatchId(targetJob.id, targetJob.runningBatches || [], master);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const effectiveReelNo =
      addReelNo.trim() ||
      `RL-${(targetJob.paperBrand || 'ITC').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const effectiveGsm = addReelGsm.trim() || targetJob.gsm || (targetJob.plannedGsms && targetJob.plannedGsms[0]) || (state.targetGsmMaster && state.targetGsmMaster[0]) || '120 GSM';
    const parsedAddWeight = parseFloat(addReelWeightKg) || 0;

    const newBatch: RunningBatch = {
      batchId,
      stage: 'Slitting',
      machine: 'Slitting-1',
      shift,
      startTime: nowTime,
      status: 'Running',
      reelNo: effectiveReelNo,
      gsm: effectiveGsm,
      issuedQty: 1,
      producedQty: 0,
      inputWeightKg: parsedAddWeight,
      outputWeightKg: 0,
      scrapKg: 0,
      scrapPercent: 0,
      worker: addReelWorker.trim().toUpperCase(),
      user: 'slit_user',
      isHotFoilLayer: addReelIsHotFoilLayer || undefined,
      isPrintedRoll: addReelIsPrintedRoll || undefined,
      printedRollDesign: addReelIsPrintedRoll ? addReelPrintedRollDesign : undefined,
      printedRollIcon: addReelIsPrintedRoll ? addReelPrintedRollIcon : undefined
    };

    const existingReels = getJobAllReels(targetJob);
    const updatedReelNumbers = Array.from(new Set([...existingReels, effectiveReelNo]));
    const combinedReelNoStr = updatedReelNumbers.join(', ');

    const existingGsms = getJobAllGsms(targetJob);
    const updatedGsmList = Array.from(new Set([...existingGsms, formatGsmString(effectiveGsm)]));
    const combinedGsmStr = updatedGsmList.join(' + ');

    const newReelItem: JobReelItem = {
      reelNo: effectiveReelNo,
      rolls: 0,
      weightKg: parsedAddWeight,
      gsm: formatGsmString(effectiveGsm),
      paperBrand: targetJob.paperBrand,
      batchId,
      startTime: nowTime,
      worker: addReelWorker.trim().toUpperCase(),
      customRemark: addReelRemarks.trim(),
      isHotFoilLayer: addReelIsHotFoilLayer || undefined,
      isPrintedRoll: addReelIsPrintedRoll || undefined,
      printedRollDesign: addReelIsPrintedRoll ? addReelPrintedRollDesign : undefined,
      printedRollIcon: addReelIsPrintedRoll ? addReelPrintedRollIcon : undefined
    };

    const updatedReelsList = [...existingReelsList, newReelItem];

    const updatedJobs = jobs.map((j) => {
      if (j.id !== targetJob.id) return j;
      const combinedRemarks = addReelRemarks.trim()
        ? j.customRemark
          ? `${j.customRemark}; ${addReelRemarks.trim()}`
          : addReelRemarks.trim()
        : j.customRemark;
      const hasPrintedRoll = j.printedRollRequired || addReelIsPrintedRoll;
      return {
        ...j,
        reelNo: combinedReelNoStr,
        reelNumbers: updatedReelNumbers,
        reelsList: updatedReelsList,
        gsm: combinedGsmStr,
        gsmList: updatedGsmList,
        gsmsSummary: combinedGsmStr,
        customRemark: combinedRemarks,
        inputWeightKg: (j.inputWeightKg || 0) + parsedAddWeight,
        runningBatches: [...(j.runningBatches || []), newBatch],
        printedRollRequired: hasPrintedRoll || undefined,
        printedRollDesign: hasPrintedRoll ? (j.printedRollDesign || addReelPrintedRollDesign) : undefined,
        printedRollIcon: hasPrintedRoll ? (j.printedRollIcon || addReelPrintedRollIcon) : undefined
      };
    });

    const newLog = {
      jobId: targetJob.id,
      product: targetJob.product,
      stage: 'Slitting Re-open',
      machine: 'Slitting-1',
      shift,
      action: addReelIsHotFoilLayer
        ? `➕ Added Specialty Hot Foil / Hot Layer Reel [${effectiveReelNo}] (Weight: ${parsedAddWeight} KG) to Existing Job ${targetJob.id} | Worker: ${addReelWorker.toUpperCase()}`
        : `➕ Added Reel [${effectiveReelNo}] (Weight: ${parsedAddWeight} KG | GSM: ${effectiveGsm}) to Existing Job ${targetJob.id} | Worker: ${addReelWorker.toUpperCase()}`,
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
    setAddReelNo('');
    setAddReelRemarks('');
    setAddReelIsHotFoilLayer(false);
    setSelectedActiveBatchId(batchId);
    alert(`✅ Added Reel [${effectiveReelNo}] (Batch ${batchId}) to existing job [${targetJob.id}]!`);
  };

  const handleResumeSlitting = () => {
    if (!activeBatchObj) return alert('No active or held slitting batch!');
    const { job, batch } = activeBatchObj;
    if (batch.status === 'Running') return alert('This job is already running on Slitting-1.');

    // Single active job constraint: cannot resume if another job is currently Running on Slitting-1
    const otherRunning = activeBatches.find(
      (b) => b.batch.status === 'Running' && b.job.id !== job.id
    );
    if (otherRunning) {
      alert(
        `⚠️ Single Active Job Constraint:

Job [${otherRunning.job.id}] (Reel: ${otherRunning.batch.reelNo || otherRunning.job.reelNo}) is already running on machine [Slitting-1]!

Only one job can run at a time. Please Hold or Finish job [${otherRunning.job.id}] first!`
      );
      return;
    }

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
    const newSlice: OperatorRunSlice = {
      sliceId: `SLICE-SLIT-${Date.now()}`,
      operator: batch.worker,
      relievedByOperator: handoverData.relievedByOperator,
      shift: batch.shift || 'DAY',
      startTime: batch.startTime,
      handoverTime: handoverData.handoverTime,
      startMeterReading: batch.startMeterReading || batch.meterReading,
      endMeterReading: handoverData.meterReading,
      strokeCount: handoverData.meterReading,
      producedQty: handoverData.sliceProducedQty,
      scrapQty: handoverData.sliceScrapQty,
      notes: handoverData.handoverNotes,
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
          scrapKg: (b.scrapKg || 0) + handoverData.sliceScrapQty,
          slices: [...(b.slices || []), newSlice]
        };
      }
      return b;
    });

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        availableRolls: (j.availableRolls || 0) + handoverData.sliceProducedQty,
        runningBatches: updatedBatches
      };
    });

    const handoverLog: LogEntry = {
      jobId: job.id,
      product: job.product,
      stage: 'Slitting',
      machine: 'Slitting-1',
      shift: handoverData.nextShift,
      action: `🔄 Shift Handover: Operator [${batch.worker}] handed over active run [${batch.batchId}] to [${handoverData.relievedByOperator}] (${handoverData.nextShift}). Locked slice: ${handoverData.sliceProducedQty} Rolls, ${handoverData.sliceScrapQty}kg Scrap, Meter: ${handoverData.meterReading || 'N/A'}.`,
      worker: handoverData.relievedByOperator,
      user: 'slitting_supervisor',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [handoverLog, ...(state.logs || [])]
    });

    setOutputRolls('');
    setOutputWeightKg('');
    setScrapKgInput('');
    setOperatorName(handoverData.relievedByOperator);
    if (handoverData.helpers && handoverData.helpers.length > 0) setAssignedHelpers(handoverData.helpers);
    if (handoverData.helpers && handoverData.helpers.length > 0) setAssignedHelpers(handoverData.helpers);
    setShift(handoverData.nextShift as 'DAY' | 'NIGHT');
    setIsShiftHandoverModalOpen(false);
    alert(`✅ Shift Handover Complete! Ongoing batch transferred from ${batch.worker} to ${handoverData.relievedByOperator} without stopping. ${handoverData.sliceProducedQty} Slit Rolls locked to ${batch.worker}.`);
  };

  const handleCompleteSlitting = (bypassWarning = false, bypassOutputLimit = false) => {
    if (!activeBatchObj) return alert('No active slitting batch to finish!');
    const rollsCount = parseInt(outputRolls, 10) || 0;
    const weightKg = parseFloat(outputWeightKg) || 0;

    if (rollsCount <= 0) return alert('Please enter output rolls count (at least 1)!');
    if (weightKg <= 0) {
      alert('⚠️ Mandatory Field Missing: Output Weight in KG is required before finishing slitting!');
      return;
    }

    const { job, batch } = activeBatchObj;

    // Shift from single run to cumulative job-level counting
    const ppcPlannedTarget = job.planId
      ? (productionPlans.find((p) => p.id === job.planId)?.targetLayers || job.targetLayers || 8)
      : (job.targetLayers || 8);

    const currentBatchId = batch.batchId;
    const currentReelNo = batch.reelNo;

    const totalSlitOutputSoFar = (
      job.reelsList && job.reelsList.length > 0
        ? job.reelsList
        : getJobReelItemsBreakdown(job)
    ).reduce((sum, r) => {
      if (r.batchId === currentBatchId || (currentReelNo && r.reelNo === currentReelNo)) {
        return sum;
      }
      return sum + (r.rolls || 0);
    }, 0);

    const projectedTotal = totalSlitOutputSoFar + rollsCount;

    if (projectedTotal > ppcPlannedTarget && !bypassOutputLimit) {
      setIsExceedOutputModalOpen(true);
      return;
    }

    // Compare actual length (meters) against planned target length
    const actualLen = parseFloat(actualSlitLengthMeters) || 0;
    const targetLen = job.planId
      ? (productionPlans.find((p) => p.id === job.planId)?.targetLengthMeters || 0)
      : 0;

    // Check for ±5% deviation
    if (targetLen > 0 && !bypassWarning) {
      const minLength = targetLen * 0.95;
      const maxLength = targetLen * 1.05;
      if (actualLen < minLength || actualLen > maxLength) {
        setIsLengthWarningModalOpen(true);
        return;
      }
    }
    const inputWeight = batch.inputWeightKg || job.inputWeightKg || 200;

    // Strict physical impossibility check
    if (weightKg > inputWeight) {
      alert(
        `⛔ Physical Impossibility Error!

` +
        `• Jumbo Reel Input Weight: ${inputWeight} KG
` +
        `• Entered Output Weight: ${weightKg} KG

` +
        `If 200 KG raw material was given, how can output be 210 KG? Output weight can never exceed input weight (${inputWeight} KG). It can be less due to wastage.

` +
        `Please check the correct scale weight and enter!`
      );
      return;
    }

    const calculatedScrapKg = Math.max(0, Number((inputWeight - weightKg).toFixed(2)));
    const finalScrapKg = scrapKgInput.trim() !== '' ? Math.max(0, parseFloat(scrapKgInput) || 0) : calculatedScrapKg;

    if (weightKg + finalScrapKg > inputWeight + 0.1) {
      alert(
        `⛔ Weight Balance Error!\n\n` +
        `Output weight (${weightKg} KG) + Wastage scrap (${finalScrapKg} KG) = ${(weightKg + finalScrapKg).toFixed(1)} KG\n` +
        `This total input weight (${inputWeight} KG) is greater than!\n\n` +
        `Please enter correct output and scrap weight!`
      );
      return;
    }

    const stopTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const finalScrapPercent = inputWeight > 0 ? Number(((finalScrapKg / inputWeight) * 100).toFixed(2)) : 0;

    const updatedJobs = jobs.map((j) => {
      if (j.id !== job.id) return j;
      const prevScrap = j.scrapKg || 0;
      const prevOutKg = j.outputWeightKg || 0;
      const newOutKg = prevOutKg + weightKg;
      const newScrapKg = prevScrap + finalScrapKg;
      const totalInKg = j.inputWeightKg || inputWeight;
      const totalScrapPct = totalInKg > 0 ? Number(((newScrapKg / totalInKg) * 100).toFixed(2)) : finalScrapPercent;

      const allReels = getJobAllReels(j);
      const effectiveReelNumbers = allReels.length > 0 ? allReels : [batch.reelNo || j.reelNo || ''];

      const existingList = j.reelsList && j.reelsList.length > 0 ? j.reelsList : getJobReelItemsBreakdown(j);
      const updatedReelsList = existingList.map((rItem) => {
        if (rItem.batchId === batch.batchId || (batch.reelNo && rItem.reelNo === batch.reelNo)) {
          return {
            ...rItem,
            rolls: (rItem.rolls || 0) + rollsCount,
            outputWeightKg: (rItem.outputWeightKg || 0) + weightKg,
            scrapKg: (rItem.scrapKg || 0) + finalScrapKg,
            endTime: stopTime,
            worker: batch.worker
          };
        }
        return rItem;
      });

      return {
        ...j,
        reelNo: effectiveReelNumbers.join(', '),
        reelNumbers: effectiveReelNumbers,
        reelsList: updatedReelsList,
        availableRolls: (j.availableRolls || 0) + rollsCount,
        stage: 'Slitting Completed',
        status: 'READY_FOR_CUTTING',
        outputWeightKg: newOutKg,
        scrapKg: newScrapKg,
        scrapPercent: totalScrapPct,
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return {
            ...b,
            status: 'Completed',
            endTime: stopTime,
            producedQty: rollsCount,
            inputWeightKg: inputWeight,
            outputWeightKg: weightKg,
            scrapKg: finalScrapKg,
            scrapPercent: finalScrapPercent
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
      action: `⏹ Slitting Finished (${rollsCount} Rolls, ${weightKg} KG Output | Jumbo In: ${inputWeight} KG | Scrap: ${finalScrapKg} KG (${finalScrapPercent}% Wastage))`,
      worker: batch.worker,
      user: 'slit_user',
      startTime: batch.startTime,
      endTime: stopTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    let updatedPlans = [...productionPlans];
    let updatedMotherReels = [...motherReelInventory];

    if (job.planId) {
      updatedPlans = productionPlans.map((p) => {
        if (p.id === job.planId) {
          const finalJobObj = updatedJobs.find((j) => j.id === job.id);
          const finalScrapPct = finalJobObj?.scrapPercent || 0;
          const finalScrapKg = finalJobObj?.scrapKg || 0;
          const finalLayers = finalJobObj?.reelsList?.filter((r) => !r.isHotFoilLayer).length || 0;

          return {
            ...p,
            status: 'Completed' as const,
            actualLayersUsed: finalLayers,
            actualMetersSlit: Number(actualSlitLengthMeters) || p.targetLengthMeters,
            actualScrapKg: finalScrapKg,
            actualScrapPct: finalScrapPct
          };
        }
        return p;
      });
    }

    if (job.motherReelsAllocated && job.motherReelsAllocated.length > 0) {
      updatedMotherReels = motherReelInventory.map((mr) => {
        if (job.motherReelsAllocated?.includes(mr.id)) {
          return {
            ...mr,
            status: 'Consumed' as const
          };
        }
        return mr;
      });
    }

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [...state.logs, newLog],
      productionPlans: updatedPlans,
      motherReelInventory: updatedMotherReels
    });

    setOutputRolls('');
    setOutputWeightKg('');
    setScrapKgInput('');
    setActualSlitLengthMeters('');
    setIsLengthWarningModalOpen(false);
    setIsExceedOutputModalOpen(false);
    setSelectedActiveBatchId('');
    alert(`✅ Slitting Finished!\n• Output: ${rollsCount} Rolls (${weightKg} KG)\n• Jumbo Loaded: ${inputWeight} KG\n• Scrap Wastage: ${finalScrapKg} KG (${finalScrapPercent}%)\nLogged to Total Traceability and Inventory!`);
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

      {/* Machine Breakdown & Technician Live Attendance Banner */}
      <MachineBreakdownBanner
        machineName="Slitting-1"
        state={state}
        onOpenAttendModal={onOpenAttendModal || onOpenHoldModal}
        onOpenHoldModal={onOpenHoldModal}
      />

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
              const displayReel = batch.reelNo || job.reelNo || `RL-${(job.paperBrand || 'ITC').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()}-${job.id.replace(/[^0-9]/g, '').padStart(4, '0')}`;
              const displayGsm = batch.gsm || job.gsm || (job.plannedGsms && job.plannedGsms.join(', ')) || job.targetGsm || 'N/A';
              const displayWeight = batch.inputWeightKg || job.inputWeightKg || 200;
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
                    <div className="font-extrabold flex items-center gap-1.5 flex-wrap">
                      <span>{job.id} — {job.product}</span>
                      <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold border border-blue-200">
                        Reel: {displayReel}
                      </span>
                      <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                        {displayGsm}
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                        {displayWeight} KG In
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Batch #{batch.batchId} | Op: {batch.worker} | Mill: {job.paperBrand || 'ITC'} | Start: {batch.startTime}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                      batch.status === 'Held' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {batch.status}
                  </span>
                </button>
              );
            })}
          </div>

          {activeBatchObj && (() => {
            const activeInputWeight = activeBatchObj.batch.inputWeightKg || activeBatchObj.job.inputWeightKg || 200;
            const parsedOutWeight = parseFloat(outputWeightKg) || 0;
            const autoScrap = parsedOutWeight > 0 ? Math.max(0, Number((activeInputWeight - parsedOutWeight).toFixed(2))) : 0;
            const effectiveScrap = scrapKgInput.trim() !== '' ? (parseFloat(scrapKgInput) || 0) : autoScrap;
            const effectiveWastagePercent = activeInputWeight > 0 && parsedOutWeight > 0 ? Number(((effectiveScrap / activeInputWeight) * 100).toFixed(2)) : 0;
            const activeReelDisplay = activeBatchObj.batch.reelNo || activeBatchObj.job.reelNo || `RL-${(activeBatchObj.job.paperBrand || 'ITC').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()}-1024`;
            const activeGsmDisplay = activeBatchObj.batch.gsm || activeBatchObj.job.gsm || (activeBatchObj.job.plannedGsms && activeBatchObj.job.plannedGsms.join(', ')) || activeBatchObj.job.targetGsm || 'N/A';

            return (
            <div className="pt-2 border-t border-slate-200 space-y-3">
              {/* Highlight Reel & GSM currently running */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-600 uppercase">Loaded Jumbo Reel:</span>
                  <span className="font-mono font-black text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-300">
                    {activeReelDisplay}
                  </span>
                  <span className="font-bold text-amber-900 bg-white px-2 py-0.5 rounded border border-amber-300">
                    {activeGsmDisplay}
                  </span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ⚖️ Jumbo Weight: {activeInputWeight} KG
                  </span>
                  <span className="text-slate-600 font-medium">
                    ({activeBatchObj.job.paperBrand || 'ITC'})
                  </span>
                  {activeBatchObj.job.printedRollRequired && (
                    <span className="font-black text-indigo-900 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 shadow-xs flex items-center gap-1 text-[11px]">
                      <span>
                        {activeBatchObj.job.printedRollIcon === 'Coffee' && '☕'}
                        {activeBatchObj.job.printedRollIcon === 'ShoppingBag' && '🛍️'}
                        {activeBatchObj.job.printedRollIcon === 'Droplets' && '💧'}
                        {activeBatchObj.job.printedRollIcon === 'Tag' && '🏷️'}
                        {activeBatchObj.job.printedRollIcon === 'Boxes' && '📦'}
                        {(!activeBatchObj.job.printedRollIcon || activeBatchObj.job.printedRollIcon === 'Sparkles') && '✨'}
                      </span>
                      <span>Printed Reel: {activeBatchObj.job.printedRollDesign}</span>
                    </span>
                  )}
                </div>
                {onNavigateToTraceability && (
                  <button
                    type="button"
                    onClick={() => onNavigateToTraceability(activeReelDisplay)}
                    className="text-[11px] font-bold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer"
                    title="Trace this Reel across factory"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                    <span>Trace Reel Forward →</span>
                  </button>
                )}
              </div>

              {/* Slices History Banner */}
              {activeBatchObj.batch.slices && activeBatchObj.batch.slices.length > 0 && (
                <div className="bg-blue-50/90 border border-blue-200 p-2.5 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-blue-950 uppercase text-[10px]">
                      Prior Shift Slices ({activeBatchObj.batch.slices.length}):
                    </span>
                    {activeBatchObj.batch.slices.map((sl, sIdx) => (
                      <span key={sIdx} className="bg-white px-2 py-0.5 rounded border border-blue-200 text-[11px] font-bold text-blue-900">
                        {sl.operator} ({sl.producedQty} Rolls)
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

              {/* REAL-TIME UI STATUS CARD ON SLITTING SCREEN */}
              {(() => {
                const targetPlan = activeBatchObj.job.planId
                  ? productionPlans.find(p => p.id === activeBatchObj.job.planId)
                  : null;
                const ppcPlannedTarget = targetPlan?.targetLayers || activeBatchObj.job.targetLayers || 8;
                const currentBatchId = activeBatchObj.batch.batchId;
                const currentReelNo = activeBatchObj.batch.reelNo;

                const totalSlitOutputSoFar = (
                  activeBatchObj.job.reelsList && activeBatchObj.job.reelsList.length > 0
                    ? activeBatchObj.job.reelsList
                    : getJobReelItemsBreakdown(activeBatchObj.job)
                ).reduce((sum, r) => {
                  if (r.batchId === currentBatchId || (currentReelNo && r.reelNo === currentReelNo)) {
                    return sum;
                  }
                  return sum + (r.rolls || 0);
                }, 0);

                const remainingAllowed = Math.max(0, ppcPlannedTarget - totalSlitOutputSoFar);
                const enteredCurrent = parseInt(outputRolls, 10) || 0;
                const projectedTotal = totalSlitOutputSoFar + enteredCurrent;
                const isOverLimit = projectedTotal > ppcPlannedTarget;

                return (
                  <div className={`p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between flex-wrap gap-3 ${
                    isOverLimit
                      ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-md'
                      : 'bg-indigo-50/70 border-indigo-200 text-indigo-950 shadow-xs'
                  }`}>
                    <div className="flex items-center gap-3">
                      <Layers className={`w-5 h-5 shrink-0 ${isOverLimit ? 'text-rose-600 animate-bounce' : 'text-indigo-600'}`} />
                      <div className="text-xs space-y-1">
                        <span className="font-extrabold uppercase tracking-wider text-[10px] text-slate-500 block">
                          Real-Time Cumulative Job Progress
                        </span>
                        <div className="text-sm font-semibold text-slate-800 leading-normal">
                          Cumulative Job Output: <b className={isOverLimit ? 'text-rose-700 font-black' : 'text-indigo-900 font-black'}>{totalSlitOutputSoFar} / {ppcPlannedTarget}</b> Rolls Slit (Remaining Quota: <b className="text-emerald-700 font-black">{remainingAllowed} Rolls</b>)
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {enteredCurrent > 0 && (
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                          isOverLimit
                            ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          Current Run Entry: +{enteredCurrent} Rolls ({projectedTotal}/{ppcPlannedTarget} Total)
                        </span>
                      )}
                      {isOverLimit && (
                        <span className="text-[10px] font-black uppercase bg-rose-600 text-white px-2 py-1 rounded-lg animate-pulse">
                          ⛔ Over PPC Target!
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-emerald-800 uppercase">
                      Output Slit Rolls Count:
                    </label>
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200" title="Remaining allowed based on PPC plan target and previously completed runs">
                      Remaining Allowed: {(() => {
                        const targetPlan = activeBatchObj ? (productionPlans.find(p => p.id === activeBatchObj.job.planId) || activeBatchObj.job) : null;
                        const ppcPlannedTarget = targetPlan?.targetLayers || 8;
                        const totalSlitOutputSoFar = activeBatchObj
                          ? (activeBatchObj.job.reelsList && activeBatchObj.job.reelsList.length > 0
                              ? activeBatchObj.job.reelsList
                              : getJobReelItemsBreakdown(activeBatchObj.job)
                            ).reduce((sum, r) => {
                              if (r.batchId === activeBatchObj.batch.batchId || (activeBatchObj.batch.reelNo && r.reelNo === activeBatchObj.batch.reelNo)) {
                                return sum;
                              }
                              return sum + (r.rolls || 0);
                            }, 0)
                          : 0;
                        return Math.max(0, ppcPlannedTarget - totalSlitOutputSoFar);
                      })()} Rolls
                    </span>
                  </div>
                  <input
                    type="number"
                    max={(() => {
                      const targetPlan = activeBatchObj ? (productionPlans.find(p => p.id === activeBatchObj.job.planId) || activeBatchObj.job) : null;
                      const ppcPlannedTarget = targetPlan?.targetLayers || 8;
                      const totalSlitOutputSoFar = activeBatchObj
                        ? (activeBatchObj.job.reelsList && activeBatchObj.job.reelsList.length > 0
                            ? activeBatchObj.job.reelsList
                            : getJobReelItemsBreakdown(activeBatchObj.job)
                          ).reduce((sum, r) => {
                            if (r.batchId === activeBatchObj.batch.batchId || (activeBatchObj.batch.reelNo && r.reelNo === activeBatchObj.batch.reelNo)) {
                              return sum;
                            }
                            return sum + (r.rolls || 0);
                          }, 0)
                        : 0;
                      return Math.max(0, ppcPlannedTarget - totalSlitOutputSoFar);
                    })()}
                    min={1}
                    value={outputRolls}
                    onChange={(e) => setOutputRolls(e.target.value)}
                    placeholder="e.g. 1"
                    className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-bold text-slate-800 outline-none transition ${
                      (() => {
                        const targetPlan = activeBatchObj ? (productionPlans.find(p => p.id === activeBatchObj.job.planId) || activeBatchObj.job) : null;
                        const ppcPlannedTarget = targetPlan?.targetLayers || 8;
                        const totalSlitOutputSoFar = activeBatchObj
                          ? (activeBatchObj.job.reelsList && activeBatchObj.job.reelsList.length > 0
                              ? activeBatchObj.job.reelsList
                              : getJobReelItemsBreakdown(activeBatchObj.job)
                            ).reduce((sum, r) => {
                              if (r.batchId === activeBatchObj.batch.batchId || (activeBatchObj.batch.reelNo && r.reelNo === activeBatchObj.batch.reelNo)) {
                                return sum;
                              }
                              return sum + (r.rolls || 0);
                            }, 0)
                          : 0;
                        const remainingAllowed = Math.max(0, ppcPlannedTarget - totalSlitOutputSoFar);
                        return (parseInt(outputRolls, 10) || 0) > remainingAllowed;
                      })()
                        ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-400 text-rose-900'
                        : 'border-emerald-300 focus:border-emerald-500'
                    }`}
                  />
                  {(() => {
                    const targetPlan = activeBatchObj ? (productionPlans.find(p => p.id === activeBatchObj.job.planId) || activeBatchObj.job) : null;
                    const ppcPlannedTarget = targetPlan?.targetLayers || 8;
                    const totalSlitOutputSoFar = activeBatchObj
                      ? (activeBatchObj.job.reelsList && activeBatchObj.job.reelsList.length > 0
                          ? activeBatchObj.job.reelsList
                          : getJobReelItemsBreakdown(activeBatchObj.job)
                        ).reduce((sum, r) => {
                          if (r.batchId === activeBatchObj.batch.batchId || (activeBatchObj.batch.reelNo && r.reelNo === activeBatchObj.batch.reelNo)) {
                            return sum;
                          }
                          return sum + (r.rolls || 0);
                        }, 0)
                      : 0;
                    const remainingAllowed = Math.max(0, ppcPlannedTarget - totalSlitOutputSoFar);
                    const isExceeded = (parseInt(outputRolls, 10) || 0) > remainingAllowed;
                    if (!isExceeded) return null;
                    return (
                      <span className="text-[10px] font-black text-rose-600 block mt-1">
                        ⛔ Entered current run output ({outputRolls} rolls) exceeds the remaining allowed quota of {remainingAllowed} rolls for this job!
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-800 uppercase mb-1">
                    Output Slit Rolls Wt (KG) <span className="text-rose-600">*Mandatory</span>:
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={outputWeightKg}
                    onChange={(e) => setOutputWeightKg(e.target.value)}
                    placeholder="e.g. 188 KG"
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-rose-800 uppercase">
                      Trim / Scrap (KG) (Auto Wastage):
                    </label>
                    {parsedOutWeight > 0 && (
                      <span className="text-[10px] font-bold text-slate-500">
                        Auto: {autoScrap} KG
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={scrapKgInput !== '' ? scrapKgInput : (parsedOutWeight > 0 ? autoScrap : '')}
                    onChange={(e) => setScrapKgInput(e.target.value)}
                    placeholder={parsedOutWeight > 0 ? `${autoScrap} KG` : 'Auto-calculated'}
                    className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs font-bold text-rose-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-800 uppercase mb-1">
                    Actual Slit Length (Meters):
                  </label>
                  <input
                    type="number"
                    value={actualSlitLengthMeters}
                    onChange={(e) => setActualSlitLengthMeters(e.target.value)}
                    placeholder={
                      activeBatchObj?.job.planId
                        ? `Target: ${productionPlans.find(p => p.id === activeBatchObj?.job.planId)?.targetLengthMeters || 1200} M`
                        : "e.g. 1200 M"
                    }
                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Physical Impossibility Live Warning */}
              {parsedOutWeight > activeInputWeight && (
                <div className="bg-red-50 border-2 border-red-500 rounded-xl p-3 flex items-start gap-3 text-red-900 shadow-sm animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <div className="font-black text-red-700 uppercase tracking-wide">
                      ⛔ Physical Impossibility Error:
                    </div>
                    <div className="font-semibold text-red-800">
                      Output roll weight (<b>{parsedOutWeight} KG</b>) exceeds input jumbo reel (<b>{activeInputWeight} KG</b>)! 200kg raw material cannot produce 210kg goods. Entry cannot be saved. Please enter correct scale weight.
                    </div>
                  </div>
                </div>
              )}

              {/* Live Scrap & Wastage calculation banner */}
              {parsedOutWeight > 0 && parsedOutWeight <= activeInputWeight && (
                <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-800 uppercase flex items-center gap-1">
                      <span>⚡ Auto Scrap Integration:</span>
                    </span>
                    <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-medium text-slate-700">
                      Jumbo Input: <b>{activeInputWeight} KG</b>
                    </span>
                    <span className="text-slate-400 font-bold">-</span>
                    <span className="bg-white px-2 py-0.5 rounded border border-blue-200 font-medium text-blue-900">
                      Rolls Output: <b>{parsedOutWeight} KG</b>
                    </span>
                    <span className="text-slate-400 font-bold">=</span>
                    <span className="bg-white px-2 py-0.5 rounded border border-rose-300 font-bold text-rose-800">
                      Scrap: <b>{effectiveScrap} KG</b>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600">Calculated Wastage:</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-black text-xs border ${
                        effectiveWastagePercent <= 6
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : effectiveWastagePercent <= 8
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}
                    >
                      {effectiveWastagePercent}% Wastage
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
                  onClick={() => onOpenHoldModal('Slitting-1')}
                  className="py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                >
                  <Pause className="w-3.5 h-3.5" /> Call In-Charge / Report Hold
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
                  onClick={() => handleCompleteSlitting(false)}
                  disabled={parsedOutWeight > activeInputWeight}
                  title={parsedOutWeight > activeInputWeight ? 'Physical impossibility: Output weight exceeds input!' : 'Finish and record slit rolls'}
                  className="py-2.5 bg-[#2f855a] hover:bg-[#276749] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
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
            );
          })()}
        </div>
      )}

      {/* Start New Slitting Reel Form */}
      <form onSubmit={handleStartNewReel} className="space-y-4">
        {currentRunningBatch && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3.5 space-y-2 text-xs text-amber-950">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="font-extrabold uppercase tracking-wide text-amber-900">
                  🔒 Single Active Job Policy:
                </span>
                <span className="bg-amber-200 text-amber-900 font-mono font-black px-2 py-0.5 rounded">
                  Job {currentRunningBatch.job.id} ({currentRunningBatch.job.product})
                </span>
              </div>
              <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                Active Reel: {currentRunningBatch.batch.reelNo || currentRunningBatch.job.reelNo}
              </span>
            </div>
            <p className="text-[11px] text-amber-900 m-0 leading-relaxed font-medium">
              Job <b>[{currentRunningBatch.job.id}]</b> is currently active running on machine <b>Slitting-1</b>. Only one job can run at a time. Hold or Complete current job before starting a new one, or add-on new reel to this active job <b>without stopping</b>:
            </p>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                type="button"
                onClick={() => {
                  setAddReelJobId(currentRunningBatch.job.id);
                  setIsAddReelModalOpen(true);
                }}
                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>➕ Add-on Reel to Running Job [{currentRunningBatch.job.id}]</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenHoldModal('Slitting-1')}
                className="py-1.5 px-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Put Active Job on Hold</span>
              </button>
            </div>
          </div>
        )}

        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-1">
          Start New Jumbo Reel Slitting:
        </h4>

        {/* PPC Plan & Mother Reel Link Section */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-3">
          <div className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Link Production Plan (PPC) & Mother Reel</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Select Active/Scheduled PPC Plan:
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPlanId(val);
                  if (val) {
                    const selPlan = productionPlans.find((p) => p.id === val);
                    if (selPlan) {
                      setProduct(selPlan.product);
                      if (selPlan.paperBrand) setPaperBrand(selPlan.paperBrand);
                      const gsms = (selPlan.plannedGsms && selPlan.plannedGsms.length > 0)
                        ? selPlan.plannedGsms
                        : (selPlan.targetGsm ? selPlan.targetGsm.split(/[,+/]/).map(s => s.trim()).filter(Boolean) : []);
                      if (gsms.length > 0) {
                        setGsm(gsms[0]);
                      } else if (selPlan.targetGsm) {
                        setGsm(selPlan.targetGsm);
                      }
                      if (selPlan.assignedShift) setShift(selPlan.assignedShift);
                      
                      // Auto-populate printed roll configuration from PPC plan
                      if (selPlan.printedRollRequired) {
                        setIsPrintedRoll(true);
                        setPrintedRollDesign(selPlan.printedRollDesign || '');
                        setPrintedRollIcon(selPlan.printedRollIcon || 'Sparkles');
                      } else {
                        setIsPrintedRoll(false);
                        setPrintedRollDesign('');
                        setPrintedRollIcon('Sparkles');
                      }

                      // Auto-select a matching mother reel if available
                      const matchingReel = motherReelInventory.find(
                        (r) =>
                          r.status === 'Available' &&
                          r.brand.toLowerCase() === (selPlan.paperBrand || '').toLowerCase()
                      );
                      if (matchingReel) {
                        setSelectedMotherReelId(matchingReel.id);
                        setJumboWeightKg(String(matchingReel.weightKg));
                        setReelNo(matchingReel.id);
                        if (matchingReel.gsm) {
                          const matchedInPlan = gsms.find(g => g.toLowerCase().includes(String(matchingReel.gsm).toLowerCase()));
                          if (matchedInPlan) {
                            setGsm(matchedInPlan);
                          }
                        }
                      } else {
                        setSelectedMotherReelId('');
                      }
                    }
                  } else {
                    setSelectedMotherReelId('');
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="" disabled>-- Select a Scheduled PPC Plan --</option>
                {productionPlans
                  .filter((p) => p.status === 'Scheduled' || p.status === 'In-Progress')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.id}] {p.product} • {p.targetLayers}L • {p.targetLengthMeters}M • {p.paperBrand || 'ITC'} ({p.status})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Allocate Mother Jumbo Reel:
              </label>
              <select
                disabled={isHotFoilLayer}
                value={isHotFoilLayer ? '' : selectedMotherReelId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedMotherReelId(val);
                  if (val) {
                    const reel = motherReelInventory.find((r) => r.id === val);
                    if (reel) {
                      setJumboWeightKg(String(reel.weightKg));
                      setReelNo(reel.id);
                      if (reel.brand) setPaperBrand(reel.brand);
                      if (reel.gsm) {
                        const gsmStr = String(reel.gsm);
                        const standardOptions = ['120 GSM', '60 GSM', '115 GSM', '125 GSM', '150 GSM', '90 GSM'];
                        const matched = standardOptions.find(opt => opt.toLowerCase().includes(gsmStr.toLowerCase()));
                        if (matched) {
                          setGsm(matched);
                        } else {
                          setGsm('Custom');
                          setCustomGsm(gsmStr.includes('GSM') ? gsmStr : `${gsmStr} GSM`);
                        }
                      }
                    }
                  }
                }}
                className="w-full px-3 py-2 bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="">{isHotFoilLayer ? '-- Not Applicable for Specialty Layers --' : '-- No Mother Reel Allocated (Manual Reel No.) --'}</option>
                {!isHotFoilLayer && motherReelInventory
                  .filter((r) => r.status === 'Available')
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.id} ({r.brand} • {r.gsm} • {r.weightKg} KG • {r.lengthMeters || 1400}M)
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* PRINTED / NON-PRINTED ROLL SWITCHER */}
          <div className="bg-indigo-50/50 border border-indigo-200 p-3 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[11px] uppercase tracking-wider text-indigo-900 block">
                Roll Print Option:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintedRoll(false);
                    setPrintedRollDesign('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !isPrintedRoll
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  Without Printed (Plain Reel)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintedRoll(true);
                    // Pre-fill if linked plan has it
                    if (selectedPlanId) {
                      const sp = productionPlans.find(p => p.id === selectedPlanId);
                      if (sp?.printedRollRequired) {
                        setPrintedRollDesign(sp.printedRollDesign || '');
                        setPrintedRollIcon(sp.printedRollIcon || 'Sparkles');
                        return;
                      }
                    }
                    if (!printedRollDesign) setPrintedRollDesign('ITC Printed Design');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isPrintedRoll
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  Printed Roll
                </button>
              </div>
            </div>

            {isPrintedRoll && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in slide-in-from-top-1 duration-150">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Printed Brand / Design Name:
                  </label>
                  <input
                    type="text"
                    value={printedRollDesign}
                    onChange={(e) => setPrintedRollDesign(e.target.value)}
                    placeholder="e.g. Tata Tea Gold 250g"
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Display Icon:
                  </label>
                  <select
                    value={printedRollIcon}
                    onChange={(e) => setPrintedRollIcon(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="Sparkles">✨ Sparkles</option>
                    <option value="Coffee">☕ Coffee / Tea</option>
                    <option value="ShoppingBag">🛍️ Shopping Bag</option>
                    <option value="Droplets">💧 Droplet</option>
                    <option value="Tag">🏷️ Tag</option>
                    <option value="Boxes">📦 Box</option>
                  </select>
                </div>
              </div>
            )}
          </div>


          {selectedPlanId && (() => {
            const sp = productionPlans.find(p => p.id === selectedPlanId);
            return sp ? (
            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200 text-[11px] text-indigo-950 font-medium flex flex-col gap-2.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-indigo-200/80 pb-1.5">
                <span className="font-extrabold uppercase text-[10px] tracking-wider text-indigo-900 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  PPC 9-Layer Master Configuration
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3 text-indigo-700" /> 100% Read-Only (Locked to PPC #{sp.id})
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  Target Layers: <b className="text-indigo-900">{sp.targetLayers} Layers (Max {sp.targetLayers} Reels)</b>
                </div>
                <div>
                  Planned GSMs: <b className="text-indigo-900">{(sp.plannedGsms && sp.plannedGsms.join(', ')) || sp.targetGsm || 'N/A'}</b>
                </div>
                <div>
                  Target Length: <b className="text-indigo-900">{sp.targetLengthMeters} Meters</b>
                </div>
                <div>
                  Scrap Limit: <b className="text-indigo-900">≤ {sp.targetScrapLimitPct}%</b>
                </div>
              </div>
              {sp.printedRollRequired && (
                <div className="pt-2 mt-1 border-t border-indigo-200 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="text-indigo-800">
                    Printed Layers: <b className="text-indigo-950">{sp.printedLayersCount || 2}</b>
                  </div>
                  <div className="text-indigo-800">
                    Plain Layers: <b className="text-indigo-950">{sp.plainLayersCount || (sp.targetLayers - (sp.printedLayersCount || 2))}</b>
                  </div>
                  <div className="text-indigo-800">
                    Brand/Design: <b className="text-indigo-950">{sp.printedRollDesign || 'N/A'}</b>
                  </div>
                </div>
              )}
            </div>
          ) : null;
          })()}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Product:</label>
            {selectedPlanId ? (
              <div className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 cursor-not-allowed flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{product}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Locked to PPC Plan</span>
              </div>
            ) : (
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value as ProductType)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                {productList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Paper Brand / Mill:</label>
            <select
              value={paperBrand}
              onChange={(e) => setPaperBrand(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
            >
              {paperBrandList.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              Operator & Crew <span className="text-rose-600">*</span>:
            </label>
            <div className="flex items-center justify-between bg-white border border-slate-300 px-3 py-2 rounded-lg">
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
        </div>

        {/* Dedicated Jumbo Reel Weight, Reel Number, GSM, and Remarks columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold text-slate-800 uppercase">
                Jumbo Reel Weight (KG) <span className="text-rose-600">*</span>:
              </label>
            </div>
            <input
              type="number"
              step="0.1"
              value={jumboWeightKg}
              onChange={(e) => setJumboWeightKg(e.target.value)}
              placeholder="e.g. 200 KG"
              className="w-full px-3 py-2 bg-white border border-emerald-400 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <div className="flex gap-1 mt-1">
              {['180', '200', '220', '250'].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setJumboWeightKg(w)}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer transition ${
                    jumboWeightKg === w
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {w}k
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold text-blue-900 uppercase">
                Reel Number:
              </label>
              <button
                type="button"
                onClick={() =>
                  setReelNo(
                    `RL-${paperBrand.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'ITC'}-${Math.floor(1000 + Math.random() * 9000)}`
                  )
                }
                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
              >
                Auto Generate
              </button>
            </div>
            <input
              type="text"
              value={reelNo}
              onChange={(e) => setReelNo(e.target.value)}
              placeholder="e.g. RL-ITC-1024 or Barcode"
              className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold text-slate-700 uppercase flex items-center gap-1">
                <span>GSM (Thickness):</span>
              </label>
              {planAvailableGsms.length > 0 && (
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                  {planAvailableGsms.length} Planned
                </span>
              )}
            </div>

            <select
              value={gsm}
              onChange={(e) => setGsm(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {planAvailableGsms.length > 0 && (
                <optgroup label="📋 Planned GSMs from PPC Desk">
                  {planAvailableGsms.map((g) => (
                    <option key={g} value={g}>
                      ✓ {g} (Planned)
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Other Standard GSMs">
                {['60 GSM', '80 GSM', '100 GSM', '115 GSM', '120 GSM', '125 GSM', '140 GSM', '150 GSM', '160 GSM', '180 GSM', '200 GSM', '220 GSM', '250 GSM', '280 GSM', '300 GSM', '320 GSM', '350 GSM']
                  .filter((g) => !planAvailableGsms.includes(g))
                  .map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                <option value="Custom">Custom GSM...</option>
              </optgroup>
            </select>
            {gsm === 'Custom' && (
              <input
                type="text"
                value={customGsm}
                onChange={(e) => setCustomGsm(e.target.value)}
                placeholder="Enter custom GSM (e.g. 70 GSM)"
                className="w-full mt-1 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              />
            )}
            {planAvailableGsms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                <span className="text-[10px] text-slate-500 font-semibold">Select:</span>
                {planAvailableGsms.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGsm(g)}
                    className={`text-[10px] px-2 py-0.5 rounded font-black cursor-pointer transition ${
                      gsm === g
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Reel Remarks / Lot Note:
            </label>
            <input
              type="text"
              value={reelRemarks}
              onChange={(e) => setReelRemarks(e.target.value)}
              placeholder="e.g. Special Export Lot #992"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!!currentRunningBatch}
            className={`flex-1 py-3 font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 ${
              currentRunningBatch
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                : 'bg-[#2b6cb0] hover:bg-[#1a365d] text-white cursor-pointer'
            }`}
            title={
              currentRunningBatch
                ? `Job [${currentRunningBatch.job.id}] is running on machine Slitting-1. Only one job can run at a time.`
                : 'Start Slitting (Auto-Generate Job ID)'
            }
          >
            <Play className={`w-4 h-4 ${currentRunningBatch ? 'fill-slate-400' : 'fill-white'}`} />
            <span>
              {currentRunningBatch
                ? `🔒 Locked: Job [${currentRunningBatch.job.id}] Already Running`
                : 'Start Slitting (Auto-Generate Job ID)'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (currentRunningBatch) {
                setAddReelJobId(currentRunningBatch.job.id);
              }
              setIsAddReelModalOpen(true);
            }}
            className={`px-4 py-3 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
              currentRunningBatch
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>
              {currentRunningBatch
                ? `Add-on Reel to Running Job [${currentRunningBatch.job.id}]`
                : 'Add to Existing Job'}
            </span>
          </button>
        </div>
      </form>

      {/* REEL NUMBER & JOB ID TRACEABILITY REGISTRY TABLE */}
      <div className="mt-6 pt-4 border-t border-slate-200 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5 m-0">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Slitting Reels & Traceability Register</span>
            </h4>
            <p className="text-[11px] text-slate-500 m-0">
              Reel number, GSM used in each Job ID and onward stage traceability status
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search Reel No, Job ID, GSM, Mill..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-xs">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-left">
                <th className="p-2.5">Job ID</th>
                <th className="p-2.5 text-indigo-900">Date</th>
                <th className="p-2.5 text-blue-900">Reel No.</th>
                <th className="p-2.5 text-amber-900">GSM</th>
                <th className="p-2.5">Paper Mill</th>
                <th className="p-2.5">Product</th>
                <th className="p-2.5">Remarks / Lot</th>
                <th className="p-2.5 text-right">Rolls Stock</th>
                <th className="p-2.5 text-right">In / Out / Scrap (KG)</th>
                <th className="p-2.5 text-center">Stage Status</th>
                <th className="p-2.5 text-center">Traceability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs
                .filter((j) => {
                  if (!tableSearch.trim()) return true;
                  const q = tableSearch.toLowerCase();
                  const allReels = getJobAllReels(j);
                  const allGsms = getJobAllGsms(j);
                  return (
                    j.id.toLowerCase().includes(q) ||
                    allReels.some((r) => r.toLowerCase().includes(q)) ||
                    allGsms.some((g) => g.toLowerCase().includes(q)) ||
                    (j.reelNo && j.reelNo.toLowerCase().includes(q)) ||
                    (j.gsm && String(j.gsm).toLowerCase().includes(q)) ||
                    (j.paperBrand && j.paperBrand.toLowerCase().includes(q)) ||
                    j.product.toLowerCase().includes(q) ||
                    (j.customRemark && j.customRemark.toLowerCase().includes(q))
                  );
                })
                .map((j) => {
                  const allReels = getJobAllReels(j);
                  const allGsms = getJobAllGsms(j);
                  const displayReelSummary = getJobReelsSummary(j);
                  const inKg = j.inputWeightKg || 200;
                  const outKg = j.outputWeightKg || 0;
                  const scrapKg = j.scrapKg || 0;
                  const scrapPct = j.scrapPercent || (inKg > 0 && scrapKg > 0 ? Number(((scrapKg / inKg) * 100).toFixed(1)) : 0);

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
                              title={`Jumbo Reel #${idx + 1}`}
                            >
                              {r}
                            </span>
                          ))}
                          {allReels.length > 1 && (
                            <span className="text-[10px] bg-blue-100 text-blue-900 font-extrabold px-1.5 py-0.2 rounded border border-blue-300">
                              {allReels.length} Jumbo Reels
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
                          {allGsms.length > 1 && (
                            <span className="text-[9.5px] font-extrabold bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded border border-amber-300">
                              {allGsms.length} Mixed GSM
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 font-medium text-slate-800">{j.paperBrand || 'ITC'}</td>
                      <td className="p-2.5 font-bold text-slate-700">{j.product}</td>
                      <td className="p-2.5 text-slate-500 max-w-[150px] truncate" title={j.customRemark}>
                        {j.customRemark || 'Standard'}
                      </td>
                      <td className="p-2.5 text-right font-extrabold text-emerald-700">
                        {j.availableRolls || 0} Rolls
                      </td>
                      <td className="p-2.5 text-right font-mono text-xs">
                        <div className="flex flex-col items-end">
                          <span className="text-slate-700 font-bold">In: {inKg} KG</span>
                          <span className="text-blue-700 font-medium">Out: {outKg} KG</span>
                          {scrapKg > 0 && (
                            <span className="text-rose-700 font-bold text-[11px]">
                              Scrap: {scrapKg} KG ({scrapPct}%)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {j.stage}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setGenealogyModalJob(j);
                          }}
                          className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[11px] transition shadow-xs inline-flex items-center gap-1 cursor-pointer"
                          title="See where this reel reached in Traceability"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Trace Reel</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase">Select Job ID:</label>
                {currentRunningBatch && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                    🟢 Active Running Job: {currentRunningBatch.job.id}
                  </span>
                )}
              </div>
              <select
                value={addReelJobId}
                onChange={(e) => setAddReelJobId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                <option value="">-- SELECT JOB ID --</option>
                {jobs.map((j) => {
                  const isRunningNow = currentRunningBatch?.job.id === j.id;
                  return (
                    <option key={j.id} value={j.id}>
                      {isRunningNow ? '⭐ [ACTIVE RUNNING] ' : ''}
                      {j.id} - {j.product} [{j.paperBrand || 'ITC'}]{' '}
                      {getJobAllReels(j).length > 0 ? `(Reels: ${getJobAllReels(j).join(', ')})` : ''}
                    </option>
                  );
                })}
              </select>
              {currentRunningBatch && addReelJobId && addReelJobId !== currentRunningBatch.job.id && (
                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-900 font-semibold">
                  ⚠️ <b>Single Active Job Info:</b> Job <b>{currentRunningBatch.job.id}</b> is currently running on machine Slitting-1. Until it is Held or Completed, new reel/entry can only be added-on to this active job <b>{currentRunningBatch.job.id}</b>.
                </div>
              )}
              {addReelJobId && (() => {
                const selectedJob = jobs.find((j) => j.id === addReelJobId);
                if (!selectedJob) return null;
                const currReels = getJobAllReels(selectedJob);
                const targetPlan = selectedJob.planId ? productionPlans.find((p) => p.id === selectedJob.planId) : null;
                const plannedLimit = targetPlan?.targetLayers || selectedJob.targetLayers || 8;
                const isLimitReached = currReels.length >= plannedLimit;

                return (
                  <div className="mt-2 p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-blue-950 uppercase text-[10px]">
                        Existing Jumbo Reels in Job ({currReels.length} / {plannedLimit} Planned):
                      </span>
                      <span className="text-[10px] font-mono text-blue-800 font-bold">
                        Job {selectedJob.id} ({selectedJob.product})
                      </span>
                    </div>

                    {isLimitReached && (
                      <div className="p-2 bg-amber-100/90 border border-amber-300 rounded-md text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>⚠️ Planned Reel Limit Reached ({currReels.length}/{plannedLimit} Reels). Adding another reel will trigger confirmation popup.</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {currReels.map((r, idx) => (
                        <span
                          key={idx}
                          className="font-mono text-[10px] bg-white text-blue-800 font-bold px-1.5 py-0.5 rounded border border-blue-300 shadow-2xs"
                        >
                          Reel #{idx + 1}: {r}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="font-extrabold text-amber-950 uppercase text-[10px]">
                        Current Job GSM:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {getJobAllGsms(selectedJob).map((g, gIdx) => (
                          <span
                            key={gIdx}
                            className="font-bold text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-blue-700 m-0">
                      💡 If adding a reel of different GSM (e.g. 300 GSM), enter new GSM below. Both GSMs will remain separate in Job Card and visible in cutting & forming!
                    </p>
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reel Number:</label>
                <input
                  type="text"
                  value={addReelNo}
                  onChange={(e) => setAddReelNo(e.target.value)}
                  placeholder="e.g. RL-ITC-2024"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Jumbo Weight (KG):</label>
                <input
                  type="number"
                  step="0.1"
                  value={addReelWeightKg}
                  onChange={(e) => setAddReelWeightKg(e.target.value)}
                  placeholder="e.g. 200 KG"
                  className="w-full px-3 py-2 border border-emerald-400 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(() => {
                const targetJob = jobs.find(j => j.id === addReelJobId);
                const targetPlan = targetJob?.planId ? productionPlans.find(p => p.id === targetJob.planId) : null;
                const jobPlannedGsms: string[] = targetPlan?.plannedGsms && targetPlan.plannedGsms.length > 0
                  ? targetPlan.plannedGsms
                  : (targetPlan?.targetGsm ? targetPlan.targetGsm.split(/[,+/]/).map(s => s.trim()).filter(Boolean) : []);

                return (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 uppercase">GSM:</label>
                      {jobPlannedGsms.length > 0 && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                          {jobPlannedGsms.length} Planned
                        </span>
                      )}
                    </div>
                    <select
                      value={addReelGsm}
                      onChange={(e) => setAddReelGsm(e.target.value)}
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-xs font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {jobPlannedGsms.length > 0 && (
                        <optgroup label="📋 Planned GSMs for this Job">
                          {jobPlannedGsms.map((g) => (
                            <option key={g} value={g}>✓ {g} (Planned)</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Standard GSMs">
                        {['60 GSM', '80 GSM', '100 GSM', '115 GSM', '120 GSM', '125 GSM', '140 GSM', '150 GSM', '180 GSM', '200 GSM', '250 GSM', '280 GSM', '300 GSM']
                          .filter(g => !jobPlannedGsms.includes(g))
                          .map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                      </optgroup>
                    </select>
                    {jobPlannedGsms.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        <span className="text-[10px] text-slate-500 font-semibold">Select:</span>
                        {jobPlannedGsms.map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setAddReelGsm(g)}
                            className={`text-[10px] px-2 py-0.5 rounded font-black cursor-pointer transition ${
                              addReelGsm === g
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
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
            </div>

            {/* ADD REEL PRINTED / NON-PRINTED ROLL SWITCHER */}
            <div className="bg-indigo-50/50 border border-indigo-200 p-2.5 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[11px] uppercase tracking-wider text-indigo-900 block">
                  Roll Print Option:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAddReelIsPrintedRoll(false);
                      setAddReelPrintedRollDesign('');
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      !addReelIsPrintedRoll
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                    }`}
                  >
                    Plain Roll
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddReelIsPrintedRoll(true);
                      if (!addReelPrintedRollDesign) {
                        const selJob = jobs.find(j => j.id === addReelJobId);
                        if (selJob && selJob.printedRollDesign) {
                          setAddReelPrintedRollDesign(selJob.printedRollDesign);
                          setAddReelPrintedRollIcon(selJob.printedRollIcon || 'Sparkles');
                        } else {
                          setAddReelPrintedRollDesign('ITC Printed Design');
                        }
                      }
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      addReelIsPrintedRoll
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                    }`}
                  >
                    Printed Roll
                  </button>
                </div>
              </div>

              {addReelIsPrintedRoll && (
                <div className="grid grid-cols-2 gap-2 pt-1 animate-in slide-in-from-top-1 duration-150">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Design Name:
                    </label>
                    <input
                      type="text"
                      value={addReelPrintedRollDesign}
                      onChange={(e) => setAddReelPrintedRollDesign(e.target.value)}
                      placeholder="e.g. Tata Tea 250g"
                      className="w-full px-2 py-1.5 bg-white border border-indigo-200 rounded text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Icon:
                    </label>
                    <select
                      value={addReelPrintedRollIcon}
                      onChange={(e) => setAddReelPrintedRollIcon(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-indigo-200 rounded text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    >
                      <option value="Sparkles">✨ Sparkles</option>
                      <option value="Coffee">☕ Coffee / Tea</option>
                      <option value="ShoppingBag">🛍️ Shopping Bag</option>
                      <option value="Droplets">💧 Droplet</option>
                      <option value="Tag">🏷️ Tag</option>
                      <option value="Boxes">📦 Box</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reel Remarks:</label>
              <input
                type="text"
                value={addReelRemarks}
                onChange={(e) => setAddReelRemarks(e.target.value)}
                placeholder="e.g. Extra reel added from bay 2"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
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
                onClick={() => handleConfirmAddReelToJob()}
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
        machine="Slitting-1"
        stage="Slitting"
        shift={activeBatchObj?.batch.shift || "DAY"}
        currentOperator={activeBatchObj?.batch.worker || ""}
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
          machine="Slitting-1"
          stageName="Slitting"
          availableWorkers={slitWorkers}
          unitLabel="Rolls"
          initialProducedQty={parseFloat(outputRolls) || undefined}
          initialScrapQty={parseFloat(scrapKgInput) || undefined}
          onConfirmHandover={handleConfirmShiftHandover}
        />
      )}

      {/* Target Length Warning Confirmation Modal */}
      {isLengthWarningModalOpen && activeBatchObj && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-200 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 border-b border-amber-100 pb-3">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
              <div>
                <h3 className="text-sm font-extrabold text-amber-950 m-0">Target Length Variance Warning</h3>
                <p className="text-[11px] text-slate-500 m-0">Output length deviates by more than ±5% from target</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-150 rounded-xl text-xs text-amber-900 leading-relaxed space-y-2">
              <p>
                The entered actual slitted length of <b className="font-extrabold text-amber-950">{parseFloat(actualSlitLengthMeters) || 0} meters</b> deviates from the planned target slitting length of <b className="font-extrabold text-amber-950">{activeBatchObj.job.planId ? (productionPlans.find(p => p.id === activeBatchObj.job.planId)?.targetLengthMeters || 1200) : 1200} meters</b> for this Job by more than ±5%.
              </p>
              <p className="font-medium text-amber-800">
                Are you sure you want to proceed and save this run with this deviation?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsLengthWarningModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition"
              >
                Cancel / Revise
              </button>
              <button
                type="button"
                onClick={() => handleCompleteSlitting(true)}
                className="px-4 py-2 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 rounded-xl cursor-pointer shadow-xs flex items-center gap-1 transition"
              >
                <Check className="w-4 h-4" /> Yes, Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strict Output Guard Modal (Applies strictly to Cumulative Output Rolls Produced) */}
      {isExceedOutputModalOpen && activeBatchObj && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border-2 border-rose-500 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-rose-600">
                  CRITICAL PROCESS DEVIATION GUARD
                </div>
                <h3 className="text-base font-black text-slate-900 m-0">
                  CUMULATIVE JOB OUTPUT LIMIT EXCEEDED
                </h3>
              </div>
            </div>

            <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl text-xs space-y-3 text-slate-800">
              {(() => {
                const targetPlan = activeBatchObj.job.planId
                  ? productionPlans.find(p => p.id === activeBatchObj.job.planId)
                  : null;
                const plannedOutput = targetPlan?.targetLayers || activeBatchObj.job.targetLayers || 8;
                const currentBatchId = activeBatchObj.batch.batchId;
                const currentReelNo = activeBatchObj.batch.reelNo;

                const totalSlitOutputSoFar = (
                  activeBatchObj.job.reelsList && activeBatchObj.job.reelsList.length > 0
                    ? activeBatchObj.job.reelsList
                    : getJobReelItemsBreakdown(activeBatchObj.job)
                ).reduce((sum, r) => {
                  if (r.batchId === currentBatchId || (currentReelNo && r.reelNo === currentReelNo)) {
                    return sum;
                  }
                  return sum + (r.rolls || 0);
                }, 0);

                const remainingAllowed = Math.max(0, plannedOutput - totalSlitOutputSoFar);
                const enteredOutput = parseInt(outputRolls, 10) || 0;
                const excess = enteredOutput - remainingAllowed;

                return (
                  <>
                    <div className="space-y-2 text-xs bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs font-bold text-slate-700">
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500 uppercase text-[10px]">Job ID:</span>
                        <span className="font-mono text-slate-900 text-xs">{activeBatchObj.job.id}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500 uppercase text-[10px]">PPC Planned Target:</span>
                        <span className="text-slate-900">{plannedOutput} Rolls</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500 uppercase text-[10px]">Already Slit & Recorded:</span>
                        <span className="text-slate-700">{totalSlitOutputSoFar} Rolls</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5 bg-emerald-50 px-2 py-1 rounded text-emerald-800">
                        <span className="uppercase text-[10px]">Maximum Remaining Allowed:</span>
                        <span className="font-black">{remainingAllowed} Rolls</span>
                      </div>
                      <div className="flex justify-between bg-rose-50 px-2 py-1 rounded text-rose-800">
                        <span className="uppercase text-[10px]">You Entered:</span>
                        <span className="font-black">{enteredOutput} Rolls (Exceeds by {excess} Rolls)</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-xs font-black text-rose-950 leading-relaxed space-y-1.5">
                      <p className="m-0 text-rose-950">
                        ⚠️ This job cannot absorb more than {remainingAllowed} additional rolls.
                      </p>
                      <p className="m-0 text-rose-800 font-bold">
                        Please adjust the current run output to {remainingAllowed} Rolls or confirm an authorized supervisor deviation.
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsExceedOutputModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition"
              >
                Cancel / Revise Output
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExceedOutputModalOpen(false);
                  handleCompleteSlitting(false, true);
                }}
                className="px-5 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer shadow-md flex items-center gap-1.5 transition"
              >
                <Check className="w-4 h-4" /> Authorize Deviation & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
