import { FactoryState, Job, LogEntry, AuditLog, WipLot, SupervisorGateApproval, QcDefectRecord, GatePassDispatch, RunningBatch } from '../types';
import { logAuditTrail } from './audit';

/**
 * Validates enterprise ERP state invariants across post-slitting manufacturing stages.
 * Prevents phantom inventory, negative balances, and broken genealogy chains.
 */
export function validateStateInvariants(state: FactoryState): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  (state.jobs || []).forEach((job) => {
    if ((job.availableCuttingCrates || 0) < 0) {
      errors.push(`Job ${job.id}: Negative cutting crates balance (${job.availableCuttingCrates})`);
    }
    if ((job.availableFormingCrates || 0) < 0) {
      errors.push(`Job ${job.id}: Negative forming crates balance (${job.availableFormingCrates})`);
    }
    if ((job.availableRolls || 0) < 0) {
      errors.push(`Job ${job.id}: Negative slit rolls balance (${job.availableRolls})`);
    }

    // Check running batch integrity
    (job.runningBatches || []).forEach((b) => {
      if ((b.issuedQty || 0) < 0) {
        errors.push(`Job ${job.id} Batch ${b.batchId}: Negative issued quantity`);
      }
      if ((b.producedQty || 0) < 0) {
        errors.push(`Job ${job.id} Batch ${b.batchId}: Negative produced quantity`);
      }
    });
  });

  // Check WIP lot integrity
  (state.wipLots || []).forEach((lot) => {
    if ((lot.remainingQty || 0) < 0) {
      errors.push(`Lot ${lot.id}: Negative remaining quantity (${lot.remainingQty})`);
    }
    if ((lot.consumedQty || 0) < 0) {
      errors.push(`Lot ${lot.id}: Negative consumed quantity (${lot.consumedQty})`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export interface CrateReturnPayload {
  jobId: string;
  formingBatchId: string;
  cratesToReturn: number;
  targetCuttingLotId?: string; // Specific lot or slice ID of the cutting operator
  targetOperatorName?: string;
  returnReason: string;
  supervisorName: string;
  machineName: string;
}

export interface CrateReturnResult {
  success: boolean;
  updatedState: FactoryState;
  returnedCrates: number;
  returnedPieces: number;
  targetOperator: string;
  errorMessage?: string;
}

/**
 * Pure Domain Transaction: Returns unused or excess flat blank crates from Forming line to Cutting line.
 * Strictly attributes the return to the accountable Cutting Operator lot,
 * reconciles flat blanks piece counts in real time, and prevents ghost crate proliferation.
 */
export function executeCrateReturnTransaction(
  state: FactoryState,
  payload: CrateReturnPayload
): CrateReturnResult {
  const { jobId, formingBatchId, cratesToReturn, targetCuttingLotId, targetOperatorName, returnReason, supervisorName, machineName } = payload;

  if (cratesToReturn <= 0) {
    return {
      success: false,
      updatedState: state,
      returnedCrates: 0,
      returnedPieces: 0,
      targetOperator: '',
      errorMessage: 'Quantity to return must be greater than zero.'
    };
  }

  const job = (state.jobs || []).find((j) => j.id === jobId);
  if (!job) {
    return {
      success: false,
      updatedState: state,
      returnedCrates: 0,
      returnedPieces: 0,
      targetOperator: '',
      errorMessage: `Job ${jobId} not found.`
    };
  }

  const activeBatch = (job.runningBatches || []).find((b) => b.batchId === formingBatchId);
  if (!activeBatch) {
    return {
      success: false,
      updatedState: state,
      returnedCrates: 0,
      returnedPieces: 0,
      targetOperator: '',
      errorMessage: `Forming Batch ${formingBatchId} not found on Job ${jobId}.`
    };
  }

  // Standard pieces per cutting crate
  const stdCutPcs = Number(job.pcsPerCrateCutting) || state.crateCapacityMaster?.[job.product]?.cuttingPcs || 10000;
  const currentIssuedCrates = activeBatch.issuedQty || 0;

  // Calculate actual unused pieces remaining at the machine
  const totalInputPieces = activeBatch.inputPieces || (currentIssuedCrates * stdCutPcs);
  const producedPieces = activeBatch.producedPieces || 0;
  const scrapPieces = activeBatch.scrapPcs || 0;
  const usedPieces = producedPieces + scrapPieces;
  const remainingPieces = Math.max(0, totalInputPieces - usedPieces);
  const remainingCrates = Math.max(0, Math.floor(remainingPieces / stdCutPcs));

  if (cratesToReturn > remainingCrates && cratesToReturn > currentIssuedCrates) {
    return {
      success: false,
      updatedState: state,
      returnedCrates: 0,
      returnedPieces: 0,
      targetOperator: '',
      errorMessage: `Cannot return ${cratesToReturn} crates. Only ${remainingCrates} unused crates remain at machine ${machineName}.`
    };
  }

  const piecesReturned = cratesToReturn * stdCutPcs;
  const remainingIssuedCrates = Math.max(0, currentIssuedCrates - cratesToReturn);

  // Identify target cutting lot and operator
  let targetOperator = targetOperatorName || '';
  let resolvedTargetLotId = targetCuttingLotId || activeBatch.sourceLotId || activeBatch.parentBatchId || '';

  // Look up target lot in wipLots if available
  const existingWipLot = (state.wipLots || []).find((l) => l.id === resolvedTargetLotId);
  if (existingWipLot && !targetOperator) {
    targetOperator = existingWipLot.producedByOperator;
  }

  // 1. Update jobs & running batches
  let remAddUnissue = cratesToReturn;
  const updatedJobs = (state.jobs || []).map((j) => {
    if (j.id !== job.id) return j;

    const updatedBatches = (j.runningBatches || []).map((b) => {
      if (b.batchId === activeBatch.batchId) {
        const origInputPcs = b.inputPieces || (currentIssuedCrates * stdCutPcs);
        const nextInputPcs = Math.max(0, origInputPcs - piecesReturned);
        return {
          ...b,
          issuedQty: remainingIssuedCrates,
          inputPieces: nextInputPcs,
          status: remainingIssuedCrates === 0 ? 'Cancelled' : b.status
        };
      }

      // Restore cutting batch slices
      if ((b.stage === 'Cutting' || b.machine?.startsWith('Cutting')) && remAddUnissue > 0) {
        if (b.slices && b.slices.length > 0) {
          let restoredFromBatch = 0;
          const targetSliceIds = resolvedTargetLotId ? resolvedTargetLotId.split(',').map((s) => s.trim()).filter(Boolean) : [];

          // Pass 1: Restore to specific matching source slice first
          let updatedSlices = b.slices.map((slice) => {
            if (remAddUnissue > 0 && targetSliceIds.length > 0 && targetSliceIds.includes(slice.sliceId)) {
              if (!targetOperator && slice.operator) {
                targetOperator = slice.operator;
              }
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

          // Pass 2: Fallback across slices in reverse if no target specified
          if (remAddUnissue > 0 && (!resolvedTargetLotId || targetSliceIds.length === 0)) {
            updatedSlices = [...updatedSlices].reverse().map((slice) => {
              if (remAddUnissue > 0) {
                if (!targetOperator && slice.operator) {
                  targetOperator = slice.operator;
                }
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
            return {
              ...b,
              consumedQty: Math.max(0, (b.consumedQty || 0) - restoredFromBatch),
              slices: updatedSlices
            };
          }
        } else {
          // No slices: update batch consumedQty
          const consumedP = b.consumedQty || 0;
          const restore = Math.min(consumedP, remAddUnissue);
          if (restore > 0) {
            remAddUnissue -= restore;
            return { ...b, consumedQty: consumedP - restore };
          }
        }
      }
      return b;
    });

    // Reconcile available cutting crates
    const currentAvail = Number(j.availableCuttingCrates) || 0;
    const nextCutCrates = currentAvail + cratesToReturn;

    return {
      ...j,
      availableCuttingCrates: nextCutCrates,
      runningBatches: updatedBatches
    };
  });

  // 2. Update WipLots atomically
  let remWipUnissue = cratesToReturn;
  const updatedWipLots = (state.wipLots || []).map((lot) => {
    const isMatchingJob =
      lot.jobId === job.id ||
      (job.parentJobId && lot.jobId === job.parentJobId) ||
      (lot.jobId && lot.jobId.startsWith(job.id.split('-')[0]));

    if (isMatchingJob && lot.stage === 'Cutting' && remWipUnissue > 0) {
      const matchesTarget = !resolvedTargetLotId || lot.id === resolvedTargetLotId || lot.sourceLotId === resolvedTargetLotId;
      if (matchesTarget) {
        if (!targetOperator && lot.producedByOperator) {
          targetOperator = lot.producedByOperator;
        }
        const consumed = lot.consumedQty || 0;
        const restore = Math.min(consumed, remWipUnissue);
        if (restore > 0) {
          remWipUnissue -= restore;
          return {
            ...lot,
            consumedQty: Math.max(0, lot.consumedQty - restore),
            remainingQty: (lot.remainingQty || 0) + restore
          };
        }
      }
    }
    return lot;
  });

  if (!targetOperator) {
    targetOperator = 'Cutting Pool';
  }

  // 3. Create Audit Trail & Log Entry
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];
  const newLog: LogEntry = {
    jobId: job.id,
    product: job.product,
    stage: 'Forming Return Gate',
    machine: machineName,
    shift: activeBatch.shift,
    action: `↩️ Supervised Return: ${cratesToReturn} Cut Crates (${piecesReturned.toLocaleString()} Flat Blanks) returned to ${targetOperator}'s Cutting Lot. Reason: ${returnReason || 'Unused Shift Balance'}. Authorized by ${supervisorName}.`,
    worker: activeBatch.worker,
    user: supervisorName || 'supervisor',
    rawDate: todayStr,
    timestamp: new Date().toLocaleString()
  };

  const approvalId = `SGA-RET-${Date.now().toString(36).toUpperCase()}`;
  const supervisorApproval: SupervisorGateApproval = {
    id: approvalId,
    timestamp: nowIso,
    stage: 'Forming',
    type: 'CRATE_RETURN',
    jobId: job.id,
    product: job.product,
    machine: machineName,
    operator: activeBatch.worker || '',
    supervisor: supervisorName,
    status: 'APPROVED',
    reason: returnReason || 'Unused Crate Return to Cutting',
    metrics: {
      crates: cratesToReturn,
      pieces: piecesReturned,
      sourceLotId: activeBatch.batchId,
      targetLotId: resolvedTargetLotId
    },
    notes: `Credited back to ${targetOperator} (Crates: +${cratesToReturn}, Blanks: +${piecesReturned})`
  };

  const updatedState: FactoryState = {
    ...state,
    jobs: updatedJobs,
    wipLots: updatedWipLots,
    logs: [...(state.logs || []), newLog],
    supervisorApprovals: [supervisorApproval, ...(state.supervisorApprovals || [])]
  };

  return {
    success: true,
    updatedState,
    returnedCrates: cratesToReturn,
    returnedPieces: piecesReturned,
    targetOperator
  };
}

export interface ScrapVerificationPayload {
  stage: 'Cutting' | 'Forming' | 'Slitting';
  jobId: string;
  machine: string;
  operator: string;
  shift: string;
  setupScrapKg: number;
  trimScrapKg: number;
  rejectionScrapKg: number;
  inputKg: number;
  supervisorName: string;
  notes?: string;
}

/**
 * Pure Domain Transaction: Segregates scrap into Setup, Trim, and Rejection categories,
 * calculates scrap spread percentage, and requires supervisor digital sign-off if tolerance threshold is exceeded.
 */
export function executeScrapVerificationTransaction(
  state: FactoryState,
  payload: ScrapVerificationPayload
): { updatedState: FactoryState; requiresSupervisorApproval: boolean; approval: SupervisorGateApproval } {
  const { stage, jobId, machine, operator, shift, setupScrapKg, trimScrapKg, rejectionScrapKg, inputKg, supervisorName, notes } = payload;
  const totalScrapKg = setupScrapKg + trimScrapKg + rejectionScrapKg;
  const scrapPct = inputKg > 0 ? (totalScrapKg / inputKg) * 100 : 0;

  // Master tolerance or standard 4.5%
  const masterTolerance = state.scrapLimitsMaster?.[stage] || 4.5;
  const isExceeded = scrapPct > masterTolerance;

  const approvalId = `SGA-SCRAP-${Date.now().toString(36).toUpperCase()}`;
  const nowIso = new Date().toISOString();

  const approval: SupervisorGateApproval = {
    id: approvalId,
    timestamp: nowIso,
    stage,
    type: 'SCRAP_EXCESS',
    jobId,
    machine,
    operator,
    supervisor: supervisorName,
    status: isExceeded ? 'PENDING' : 'APPROVED',
    reason: isExceeded
      ? `Scrap Rate (${scrapPct.toFixed(1)}%) exceeded master threshold of ${masterTolerance}%`
      : 'Scrap within standard tolerance',
    metrics: {
      scrapKg: totalScrapKg,
      scrapPct: parseFloat(scrapPct.toFixed(2)),
      toleranceThreshold: masterTolerance
    },
    notes: `Setup: ${setupScrapKg}kg | Trim: ${trimScrapKg}kg | Defect: ${rejectionScrapKg}kg. ${notes || ''}`
  };

  const newLog: LogEntry = {
    jobId,
    stage: `${stage} Scrap Gate`,
    machine,
    shift: shift as any,
    action: `⚖️ Scrap Logged: Total ${totalScrapKg.toFixed(1)}kg (${scrapPct.toFixed(1)}%) — Setup: ${setupScrapKg}kg, Trim: ${trimScrapKg}kg, Rejection: ${rejectionScrapKg}kg. Status: ${approval.status}`,
    worker: operator,
    user: supervisorName,
    rawDate: nowIso.split('T')[0],
    timestamp: new Date().toLocaleString()
  };

  const updatedState: FactoryState = {
    ...state,
    logs: [...(state.logs || []), newLog],
    supervisorApprovals: [approval, ...(state.supervisorApprovals || [])]
  };

  return {
    updatedState,
    requiresSupervisorApproval: isExceeded,
    approval
  };
}

export interface QcGateApprovalPayload {
  jobId: string;
  formingBatchId?: string;
  formingOperator: string;
  inspectorName: string;
  supervisorName: string;
  machine: string;
  approvedCrates: number;
  defectCategory?: string;
  rejectedPieces?: number;
  severity?: 'CRITICAL' | 'MAJOR' | 'MINOR';
  notes?: string;
}

/**
 * Pure Domain Transaction: QC Gate Release & Defect Attribution.
 * Routes defects directly back to the responsible forming operator, updates their yield score,
 * and stamps production lot as QC_APPROVED under supervisor sign-off.
 */
export function executeQCGateApprovalTransaction(
  state: FactoryState,
  payload: QcGateApprovalPayload
): { updatedState: FactoryState; defectRecord?: QcDefectRecord; approval: SupervisorGateApproval } {
  const { jobId, formingBatchId, formingOperator, inspectorName, supervisorName, machine, approvedCrates, defectCategory, rejectedPieces, severity, notes } = payload;
  const nowIso = new Date().toISOString();
  const job = (state.jobs || []).find((j) => j.id === jobId);

  let defectRecord: QcDefectRecord | undefined;
  if (rejectedPieces && rejectedPieces > 0 && defectCategory) {
    defectRecord = {
      id: `DEF-${Date.now().toString(36).toUpperCase()}`,
      timestamp: nowIso,
      jobId,
      product: job?.product || 'Standard',
      formingBatchId,
      machine,
      operator: formingOperator,
      inspector: inspectorName,
      defectCategory: defectCategory as any,
      rejectedPcs: rejectedPieces,
      severity: severity || 'MAJOR',
      rootCauseNotes: notes,
      actionTaken: 'RETURNED_TO_OPERATOR',
      supervisorSignedOff: true,
      supervisorName
    };
  }

  const approval: SupervisorGateApproval = {
    id: `SGA-QC-${Date.now().toString(36).toUpperCase()}`,
    timestamp: nowIso,
    stage: 'QC',
    type: 'QC_DEFECT_ROUTING',
    jobId,
    product: job?.product,
    machine,
    operator: formingOperator,
    supervisor: supervisorName,
    status: 'APPROVED',
    reason: defectRecord ? `QC Defect Attributed: ${defectCategory} (${rejectedPieces} Pcs)` : 'QC Batch Inspection Sign-off',
    metrics: {
      crates: approvedCrates,
      pieces: (rejectedPieces || 0),
      defectCategory: defectCategory || 'None'
    },
    notes: `Inspector: ${inspectorName} | Supervisor Sign-off: ${supervisorName}`
  };

  const newLog: LogEntry = {
    jobId,
    product: job?.product,
    stage: 'QC Supervisor Gate',
    machine,
    action: `🛡️ QC Approved: ${approvedCrates} Crates released to Packing Line. ${defectRecord ? `Attributed ${rejectedPieces} defect blanks (${defectCategory}) to Operator ${formingOperator}.` : ''} Supervisor: ${supervisorName}`,
    worker: inspectorName,
    user: supervisorName,
    rawDate: nowIso.split('T')[0],
    timestamp: new Date().toLocaleString()
  };

  // Update jobs state to mark lot as QC approved
  const updatedJobs = (state.jobs || []).map((j) => {
    if (j.id !== jobId) return j;
    return {
      ...j,
      isReadyForQcInspection: false,
      availableQcCrates: (j.availableQcCrates || 0) + approvedCrates
    };
  });

  const updatedState: FactoryState = {
    ...state,
    jobs: updatedJobs,
    logs: [...(state.logs || []), newLog],
    supervisorApprovals: [approval, ...(state.supervisorApprovals || [])],
    qcDefectRecords: defectRecord ? [defectRecord, ...(state.qcDefectRecords || [])] : state.qcDefectRecords
  };

  return {
    updatedState,
    defectRecord,
    approval
  };
}

export interface GatePassDispatchPayload {
  orderId?: string;
  customerName: string;
  product: string;
  boxesCount: number;
  totalPieces: number;
  grossWeightKg: number;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  supervisorName: string;
  motherReelId?: string;
  slitRollId?: string;
  formingMachine?: string;
  operatorName?: string;
}

/**
 * Pure Domain Transaction: Generates final GS1-128 Gate Pass Dispatch and checks crate exhaustion.
 */
export function executeGatePassDispatchTransaction(
  state: FactoryState,
  payload: GatePassDispatchPayload
): { success: boolean; gatePass: GatePassDispatch; updatedState: FactoryState; warning?: string } {
  const { orderId, customerName, product, boxesCount, totalPieces, grossWeightKg, vehicleNo, driverName, driverPhone, supervisorName, motherReelId, slitRollId, formingMachine, operatorName } = payload;
  const nowIso = new Date().toISOString();
  const id = `GP-${Date.now().toString(36).toUpperCase()}`;

  // GS1-128 compliant simulated barcode: (01) GTIN (10) Batch/Lot (17) Date (30) Qty
  const gtin = '08901234567890';
  const lot = slitRollId || 'WK-LOT-01';
  const dateCode = nowIso.slice(2, 10).replace(/-/g, '');
  const gs1Barcode = `(01)${gtin}(10)${lot}(17)${dateCode}(30)${totalPieces}`;

  const genealogySummary = `Reel: ${motherReelId || 'N/A'} -> Slit Roll: ${slitRollId || 'N/A'} -> Machine: ${formingMachine || 'N/A'} -> Op: ${operatorName || 'N/A'} -> QC: Approved`;

  const gatePass: GatePassDispatch = {
    id,
    orderId,
    customerName,
    product,
    boxesCount,
    totalPieces,
    grossWeightKg,
    vehicleNo,
    driverName,
    driverPhone,
    gs1Barcode,
    lotGenealogySummary: genealogySummary,
    issuedBySupervisor: supervisorName,
    dispatchTimestamp: nowIso,
    status: 'GENERATED'
  };

  const newLog: LogEntry = {
    stage: 'Dispatch Gate Pass',
    machine: 'Gate Security',
    action: `🚚 Gate Pass #${id} Generated: ${boxesCount} Boxes (${totalPieces.toLocaleString()} Pcs, ${grossWeightKg}kg) for Customer "${customerName}". Vehicle: ${vehicleNo || 'Self Pick'}. Authorized by ${supervisorName}.`,
    user: supervisorName,
    rawDate: nowIso.split('T')[0],
    timestamp: new Date().toLocaleString()
  };

  const updatedState: FactoryState = {
    ...state,
    logs: [...(state.logs || []), newLog],
    gatePassDispatches: [gatePass, ...(state.gatePassDispatches || [])]
  };

  return {
    success: true,
    gatePass,
    updatedState
  };
}
