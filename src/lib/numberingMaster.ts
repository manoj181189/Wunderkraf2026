import { FactoryState, Job, RunningBatch, SeriesConfig, NumberingSeriesMaster, NumberingEntityConfig } from '../types';
import { DEFAULT_NUMBERING_MASTER, PRODUCT_PREFIX_MAP } from './constants';

export function getNumberingMaster(seriesConfig?: SeriesConfig): NumberingSeriesMaster {
  const custom = seriesConfig?.numberingMaster;
  return {
    jobSeries: {
      prefix: custom?.jobSeries?.prefix?.trim() || DEFAULT_NUMBERING_MASTER.jobSeries.prefix,
      paddingDigits: custom?.jobSeries?.paddingDigits || DEFAULT_NUMBERING_MASTER.jobSeries.paddingDigits,
      nextSeq: custom?.jobSeries?.nextSeq || DEFAULT_NUMBERING_MASTER.jobSeries.nextSeq
    },
    slitSeries: {
      prefix: custom?.slitSeries?.prefix?.trim() || DEFAULT_NUMBERING_MASTER.slitSeries.prefix,
      paddingDigits: custom?.slitSeries?.paddingDigits || DEFAULT_NUMBERING_MASTER.slitSeries.paddingDigits,
      nextSeq: custom?.slitSeries?.nextSeq || DEFAULT_NUMBERING_MASTER.slitSeries.nextSeq
    },
    cutSeries: {
      prefix: custom?.cutSeries?.prefix?.trim() || DEFAULT_NUMBERING_MASTER.cutSeries.prefix,
      paddingDigits: custom?.cutSeries?.paddingDigits || DEFAULT_NUMBERING_MASTER.cutSeries.paddingDigits,
      nextSeq: custom?.cutSeries?.nextSeq || DEFAULT_NUMBERING_MASTER.cutSeries.nextSeq
    },
    qcSeries: {
      prefix: custom?.qcSeries?.prefix?.trim() || DEFAULT_NUMBERING_MASTER.qcSeries.prefix,
      paddingDigits: custom?.qcSeries?.paddingDigits || DEFAULT_NUMBERING_MASTER.qcSeries.paddingDigits,
      nextSeq: custom?.qcSeries?.nextSeq || DEFAULT_NUMBERING_MASTER.qcSeries.nextSeq
    },
    useGlobalJobPrefix: custom?.useGlobalJobPrefix ?? false
  };
}

export function formatPaddedNumber(num: number, digits: number): string {
  const safeNum = Math.max(1, isNaN(num) ? 1 : Math.floor(num));
  const safeDigits = Math.max(1, Math.min(6, digits || 3));
  return String(safeNum).padStart(safeDigits, '0');
}

/**
 * Generates a collision-free Parent Job ID based on Master Configuration.
 * Parent Job / Batch: [PREFIX]-[JOB_SEQ] (e.g. WK-LOT-001 or SPN-001)
 */
export function generateUnifiedJobId(
  product: string,
  seriesConfig: SeriesConfig,
  productPrefixMap: Record<string, string> = {},
  existingJobs: Job[] = []
): { jobId: string; updatedSeriesConfig: SeriesConfig } {
  const master = getNumberingMaster(seriesConfig);
  const existingJobIds = new Set(existingJobs.map((j) => j.id));

  let candidateId = '';
  let finalSeq = 1;
  const updatedProductSeqs = { ...(seriesConfig.productSeqs || {}) };
  const updatedMaster = { ...master };

  if (master.useGlobalJobPrefix) {
    // Mode A: Unified Global Parent Prefix (e.g. WK-LOT-001)
    let pfx = master.jobSeries.prefix.trim() || 'WK-LOT';
    if (pfx.endsWith('-')) pfx = pfx.slice(0, -1);
    const pad = master.jobSeries.paddingDigits || 3;
    let seq = master.jobSeries.nextSeq || 1;

    candidateId = `${pfx}-${formatPaddedNumber(seq, pad)}`;
    while (existingJobIds.has(candidateId)) {
      seq += 1;
      candidateId = `${pfx}-${formatPaddedNumber(seq, pad)}`;
    }
    finalSeq = seq + 1;
    updatedMaster.jobSeries = {
      ...updatedMaster.jobSeries,
      nextSeq: finalSeq
    };
  } else {
    // Mode B: Per-Product Prefix (e.g. SPN-001, FRK-001)
    const prefixMap = { ...PRODUCT_PREFIX_MAP, ...productPrefixMap };
    let pfx = prefixMap[product] || product.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'ITM';
    if (pfx.endsWith('-')) pfx = pfx.slice(0, -1);
    const pad = master.jobSeries.paddingDigits || 3;
    let seq = updatedProductSeqs[product] || 1;

    candidateId = `${pfx}-${formatPaddedNumber(seq, pad)}`;
    while (existingJobIds.has(candidateId)) {
      seq += 1;
      candidateId = `${pfx}-${formatPaddedNumber(seq, pad)}`;
    }
    finalSeq = seq + 1;
    updatedProductSeqs[product] = finalSeq;
  }

  const updatedSeriesConfig: SeriesConfig = {
    ...seriesConfig,
    productSeqs: updatedProductSeqs,
    numberingMaster: updatedMaster
  };

  return { jobId: candidateId, updatedSeriesConfig };
}

/**
 * Slitting Sub-Batch: [PARENT_LOT]-SLIT-[RUN_NO]
 * e.g. WK-LOT-001-SLIT-01 or SPN-001-SLIT-01
 */
export function generateSlittingBatchId(
  parentJobId: string,
  existingBatches: RunningBatch[] = [],
  numberingMaster?: NumberingSeriesMaster
): string {
  const master = numberingMaster || DEFAULT_NUMBERING_MASTER;
  const pfx = master.slitSeries.prefix.trim() || 'SLIT';
  const pad = master.slitSeries.paddingDigits || 2;

  const slitBatches = existingBatches.filter(
    (b) => b.stage === 'Slitting' || (b.machine && b.machine.startsWith('Slitting')) || b.batchId.includes(`-${pfx}-`)
  );

  let runNo = slitBatches.length + 1;
  let candidate = `${parentJobId}-${pfx}-${formatPaddedNumber(runNo, pad)}`;

  const existingIds = new Set(existingBatches.map((b) => b.batchId));
  while (existingIds.has(candidate)) {
    runNo += 1;
    candidate = `${parentJobId}-${pfx}-${formatPaddedNumber(runNo, pad)}`;
  }

  return candidate;
}

/**
 * Cutting Crate Lot: [PARENT_LOT]-CUT-[CRATE_NO]
 * e.g. WK-LOT-001-CUT-01 or SPN-001-CUT-01
 */
export function generateCuttingBatchId(
  parentJobId: string,
  existingBatches: RunningBatch[] = [],
  numberingMaster?: NumberingSeriesMaster
): string {
  const master = numberingMaster || DEFAULT_NUMBERING_MASTER;
  const pfx = master.cutSeries.prefix.trim() || 'CUT';
  const pad = master.cutSeries.paddingDigits || 2;

  const cutBatches = existingBatches.filter(
    (b) => b.stage === 'Cutting' || (b.machine && b.machine.startsWith('Cutting')) || b.batchId.includes(`-${pfx}-`)
  );

  let runNo = cutBatches.length + 1;
  let candidate = `${parentJobId}-${pfx}-${formatPaddedNumber(runNo, pad)}`;

  const existingIds = new Set(existingBatches.map((b) => b.batchId));
  while (existingIds.has(candidate)) {
    runNo += 1;
    candidate = `${parentJobId}-${pfx}-${formatPaddedNumber(runNo, pad)}`;
  }

  return candidate;
}

/**
 * QC Inspection Lot: [PARENT_LOT]-QC-[STAGE_NO]
 * e.g. WK-LOT-001-QC-01 or SPN-001-QC-01
 */
export function generateQCInspectionBatchId(
  parentJobId: string,
  existingBatches: RunningBatch[] = [],
  numberingMaster?: NumberingSeriesMaster
): string {
  const master = numberingMaster || DEFAULT_NUMBERING_MASTER;
  const pfx = master.qcSeries.prefix.trim() || 'QC';
  const pad = master.qcSeries.paddingDigits || 2;

  const qcBatches = existingBatches.filter(
    (b) => b.stage === 'QC' || (b.machine && b.machine.startsWith('QC')) || b.batchId.includes(`-${pfx}-`)
  );

  let runNo = qcBatches.length + 1;
  let candidate = `${parentJobId}-${pfx}-${formatPaddedNumber(runNo, pad)}`;

  const existingIds = new Set(existingBatches.map((b) => b.batchId));
  while (existingIds.has(candidate)) {
    runNo += 1;
    candidate = `${parentJobId}-${pfx}-${formatPaddedNumber(runNo, pad)}`;
  }

  return candidate;
}

/**
 * Forming Sub-Batch: [PARENT_LOT]-FORM-[RUN_NO]
 * e.g. WK-LOT-001-FORM-01 or SPN-001-FORM-01
 */
export function generateFormingBatchId(
  parentJobId: string,
  existingBatches: RunningBatch[] = [],
  _numberingMaster?: NumberingSeriesMaster
): string {
  const formBatches = existingBatches.filter(
    (b) => b.stage === 'Forming' || (b.machine && b.machine.startsWith('Forming')) || b.batchId.includes('-FORM-')
  );

  let runNo = formBatches.length + 1;
  let candidate = `${parentJobId}-FORM-${formatPaddedNumber(runNo, 2)}`;

  const existingIds = new Set(existingBatches.map((b) => b.batchId));
  while (existingIds.has(candidate)) {
    runNo += 1;
    candidate = `${parentJobId}-FORM-${formatPaddedNumber(runNo, 2)}`;
  }

  return candidate;
}

/**
 * Safety & Maintenance Utility:
 * Repairs corrupted or rogue batch IDs across all jobs in state,
 * rebuilds tracedLots relationships cleanly,
 * and sets the Next Sequence counters beyond all existing Job numbers to eliminate collisions.
 */
export function repairAndSyncAllSequences(state: FactoryState): {
  repairedState: FactoryState;
  repairedJobsCount: number;
  repairedBatchesCount: number;
  message: string;
} {
  const master = getNumberingMaster(state.seriesConfig);
  let repairedBatchesCount = 0;
  let repairedJobsCount = 0;

  const slitPfx = master.slitSeries.prefix.trim() || 'SLIT';
  const cutPfx = master.cutSeries.prefix.trim() || 'CUT';
  const qcPfx = master.qcSeries.prefix.trim() || 'QC';

  // Map to rewrite old batch IDs to new hierarchical IDs
  const batchIdMap: Record<string, string> = {};

  const highestSeqByProduct: Record<string, number> = {};
  let highestGlobalSeq = 0;

  // Scan jobs to track highest sequence numbers
  (state.jobs || []).forEach((job) => {
    // E.g. SPN-002 or WK-LOT-005
    const match = job.id.match(/[-_](\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) {
        highestGlobalSeq = Math.max(highestGlobalSeq, num);
        if (job.product) {
          highestSeqByProduct[job.product] = Math.max(highestSeqByProduct[job.product] || 0, num);
        }
      }
    }
  });

  const updatedJobs: Job[] = (state.jobs || []).map((job) => {
    let jobChanged = false;
    const existingBatches = job.runningBatches || [];
    let slitCount = 0;
    let cutCount = 0;
    let formCount = 0;
    let qcCount = 0;

    let primarySlitId = '';
    let primaryCutId = '';
    let primaryFormId = '';
    let primaryQcId = '';

    const newBatches: RunningBatch[] = existingBatches.map((batch) => {
      let isRogue = false;
      let newBatchId = batch.batchId;

      // Check if rogue (e.g. B-1234 or doesn't start with parent job.id)
      if (!batch.batchId || batch.batchId.startsWith('B-') || !batch.batchId.startsWith(job.id)) {
        isRogue = true;
      }

      if (batch.stage === 'Slitting' || (batch.machine && batch.machine.startsWith('Slitting'))) {
        slitCount += 1;
        if (isRogue) {
          newBatchId = `${job.id}-${slitPfx}-${formatPaddedNumber(slitCount, master.slitSeries.paddingDigits || 2)}`;
        }
        if (!primarySlitId) primarySlitId = newBatchId;
      } else if (batch.stage === 'Cutting' || (batch.machine && batch.machine.startsWith('Cutting'))) {
        cutCount += 1;
        if (isRogue) {
          newBatchId = `${job.id}-${cutPfx}-${formatPaddedNumber(cutCount, master.cutSeries.paddingDigits || 2)}`;
        }
        if (!primaryCutId) primaryCutId = newBatchId;
      } else if (batch.stage === 'Forming' || (batch.machine && batch.machine.startsWith('Forming'))) {
        formCount += 1;
        if (isRogue) {
          newBatchId = `${job.id}-FORM-${formatPaddedNumber(formCount, 2)}`;
        }
        if (!primaryFormId) primaryFormId = newBatchId;
      } else if (batch.stage === 'QC' || (batch.machine && batch.machine.startsWith('QC'))) {
        qcCount += 1;
        if (isRogue) {
          newBatchId = `${job.id}-${qcPfx}-${formatPaddedNumber(qcCount, master.qcSeries.paddingDigits || 2)}`;
        }
        if (!primaryQcId) primaryQcId = newBatchId;
      }

      if (newBatchId !== batch.batchId) {
        batchIdMap[batch.batchId] = newBatchId;
        repairedBatchesCount += 1;
        jobChanged = true;
        return {
          ...batch,
          batchId: newBatchId,
          parentBatchId:
            batch.stage === 'Cutting'
              ? primarySlitId || batch.parentBatchId
              : batch.stage === 'Forming'
              ? primaryCutId || primarySlitId || batch.parentBatchId
              : batch.stage === 'QC'
              ? primaryFormId || primaryCutId || primarySlitId || batch.parentBatchId
              : batch.parentBatchId
        };
      }

      return batch;
    });

    // Update reelsList batchId references if they changed
    const updatedReelsList = (job.reelsList || []).map((reel) => {
      if (reel.batchId && batchIdMap[reel.batchId]) {
        jobChanged = true;
        return { ...reel, batchId: batchIdMap[reel.batchId] };
      }
      return reel;
    });

    // Update tracedLots
    const updatedTracedLots = {
      ...(job.tracedLots || {}),
      ...(primarySlitId ? { Slitting: primarySlitId } : {}),
      ...(primaryCutId ? { Cutting: primaryCutId } : {}),
      ...(primaryFormId ? { Forming: primaryFormId } : {}),
      ...(primaryQcId ? { QC: primaryQcId } : {})
    };

    if (jobChanged) {
      repairedJobsCount += 1;
      return {
        ...job,
        runningBatches: newBatches,
        reelsList: updatedReelsList,
        tracedLots: updatedTracedLots
      };
    }

    return job;
  });

  // Remap log action strings if they reference old batch IDs
  const updatedLogs = (state.logs || []).map((log) => {
    let action = log.action;
    Object.entries(batchIdMap).forEach(([oldId, newId]) => {
      if (action.includes(oldId)) {
        action = action.replaceAll(oldId, newId);
      }
    });
    return action !== log.action ? { ...log, action } : log;
  });

  // Calculate clean next sequence counters
  const updatedProductSeqs = { ...(state.seriesConfig?.productSeqs || {}) };
  Object.keys(updatedProductSeqs).forEach((prod) => {
    const highest = highestSeqByProduct[prod] || 0;
    if (updatedProductSeqs[prod] <= highest) {
      updatedProductSeqs[prod] = highest + 1;
    }
  });

  const nextJobGlobalSeq = Math.max(master.jobSeries.nextSeq || 1, highestGlobalSeq + 1);

  const updatedSeriesConfig: SeriesConfig = {
    orderSeq: state.seriesConfig?.orderSeq || 1,
    productSeqs: updatedProductSeqs,
    numberingMaster: {
      ...master,
      jobSeries: {
        ...master.jobSeries,
        nextSeq: nextJobGlobalSeq
      }
    }
  };

  const auditLog = {
    jobId: 'SYSTEM-REPAIR',
    product: 'All',
    stage: 'Admin',
    machine: 'IndexedDB-Engine',
    shift: 'SYSTEM',
    action: `🔧 Repaired & Synchronized Batch Traceability Hierarchy: ${repairedBatchesCount} rogue batch IDs resolved across ${repairedJobsCount} jobs. Next sequences safely synced without collisions.`,
    worker: 'ADMIN',
    user: 'admin',
    startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    rawDate: new Date().toISOString().split('T')[0],
    timestamp: new Date().toLocaleString()
  };

  const repairedState: FactoryState = {
    ...state,
    jobs: updatedJobs,
    logs: [auditLog, ...updatedLogs],
    seriesConfig: updatedSeriesConfig
  };

  return {
    repairedState,
    repairedJobsCount,
    repairedBatchesCount,
    message: `Collision Repair Successful: ${repairedBatchesCount} batch IDs standardized and sequence counters safely synchronized!`
  };
}
