import { FactoryState, Job, LogEntry, RunningBatch, OperatorRunSlice } from '../types';

export interface StageShiftBreakdownItem {
  id: string;
  stage: 'Slitting' | 'Cutting' | 'Forming' | 'QC' | 'Packing' | string;
  machine: string;
  batchId: string;
  shift: string; // 'DAY' | 'NIGHT' | 'A' | 'B' | etc.
  date: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  operator: string;
  relievedByOperator?: string;
  helpers?: string[];
  glueKg?: number;
  glueBrand?: string;
  producedQty: number; // Crates / Rolls / Units
  unitLabel: string; // "Cut Crates", "Slit Rolls", "Formed Crates"
  producedPieces?: number; // Blanks or 3D pieces
  loosePieces?: number;
  grossPieces?: number;
  scrapKg?: number;
  scrapPcs?: number;
  scrapPercent?: number;
  meterReading?: number;
  notes?: string;
  isHandover: boolean;
  status: 'Completed' | 'Handed Over' | 'Running' | string;
}

export interface StageShiftLedgerSummary {
  items: StageShiftBreakdownItem[];
  totalShifts: number;
  totalProducedQty: number;
  totalProducedPieces: number;
  totalLoosePieces: number;
  totalScrapKg: number;
  totalScrapPcs: number;
  totalGrossPieces: number;
  totalGlueKg?: number;
  glueBrand?: string;
  uniqueOperators: string[];
  unitLabel: string;
  targetUnitPcs: number;
}

/**
 * Returns comprehensive, verified Shift-by-Shift changeover & operator ledger
 * for any given job and stage.
 */
export function getJobStageShiftLedger(
  job: Job | null | undefined,
  stage: 'Slitting' | 'Cutting' | 'Forming' | 'QC' | string,
  state: FactoryState
): StageShiftLedgerSummary {
  if (!job) {
    return {
      items: [],
      totalShifts: 0,
      totalProducedQty: 0,
      totalProducedPieces: 0,
      totalLoosePieces: 0,
      totalScrapKg: 0,
      totalScrapPcs: 0,
      totalGrossPieces: 0,
      uniqueOperators: [],
      unitLabel: 'Units',
      targetUnitPcs: 1
    };
  }

  const stageLower = stage.toLowerCase();
  let unitLabel = 'Units';
  let targetUnitPcs = 1;

  if (stageLower.includes('slit')) {
    unitLabel = 'Slit Rolls';
    targetUnitPcs = 1;
  } else if (stageLower.includes('cut')) {
    unitLabel = 'Cut Crates';
    targetUnitPcs = job.pcsPerCrateCutting || state.crateCapacityMaster?.[job.product]?.cuttingPcs || 10000;
  } else if (stageLower.includes('form')) {
    unitLabel = 'Formed Crates';
    targetUnitPcs = job.pcsPerCrateForming || state.crateCapacityMaster?.[job.product]?.formingPcs || 7000;
  } else if (stageLower.includes('qc')) {
    unitLabel = 'QC Crates';
    targetUnitPcs = job.pcsPerCrateForming || state.crateCapacityMaster?.[job.product]?.formingPcs || 7000;
  }

  const jobDateFallback = job.createdAt
    ? job.createdAt.split('T')[0]
    : new Date().toISOString().split('T')[0];

  const batches = (job.runningBatches || []).filter((b) => {
    if (stageLower.includes('slit')) return b.stage === 'Slitting' || b.machine.startsWith('Slitting');
    if (stageLower.includes('cut')) return b.stage === 'Cutting' || b.machine.startsWith('Cutting');
    if (stageLower.includes('form')) return b.stage === 'Forming' || b.machine.startsWith('Forming');
    if (stageLower.includes('qc')) return b.stage === 'QC' || b.machine.startsWith('QC');
    return b.stage?.toLowerCase() === stageLower;
  });

  const rawItems: StageShiftBreakdownItem[] = [];

  // Process all batches in this stage
  batches.forEach((b, bIdx) => {
    const batchMachine = b.machine || (stageLower.includes('slit') ? 'Slitting-1' : stageLower.includes('cut') ? 'Cutting-1' : 'Forming-1');
    const batchId = b.batchId || `${stage.toUpperCase()}-${job.id}-${bIdx + 1}`;
    const batchDate = (b.startTime && b.startTime.includes('-')) ? b.startTime.split('T')[0] : jobDateFallback;

    // Check if slices exist
    if (b.slices && b.slices.length > 0) {
      let cumulativeSliceQty = 0;
      let cumulativeSliceScrapKg = 0;
      let cumulativeSliceScrapPcs = 0;
      let cumulativeSlicePieces = 0;

      b.slices.forEach((sl, sIdx) => {
        const sliceProducedQty = sl.producedQty || 0;
        const sliceLoosePcs = sl.loosePieces || 0;
        const slicePieces = sl.producedPieces || (sliceProducedQty * targetUnitPcs) + sliceLoosePcs;
        const sliceScrapKg = sl.scrapKg || (stageLower.includes('slit') || stageLower.includes('cut') ? sl.scrapQty : 0) || 0;
        const sliceScrapPcs = sl.scrapPcs || sl.rejectedPieces || (stageLower.includes('form') ? sl.scrapQty : 0) || 0;

        cumulativeSliceQty += sliceProducedQty;
        cumulativeSliceScrapKg += sliceScrapKg;
        cumulativeSliceScrapPcs += sliceScrapPcs;
        cumulativeSlicePieces += slicePieces;

        const sliceDate = sl.date || batchDate;
        const isHandover = Boolean(sl.relievedByOperator || sl.handoverConfirmed);

        const handoverMatch = (state.shiftHandovers || []).find(
          (h) => (h.batchId === b.batchId || h.jobId === job.id) &&
                 (h.outgoingOperator === sl.operator || h.relievedByOperator === sl.relievedByOperator)
        );
        const resolvedHelpers = (sl.helpers && sl.helpers.length > 0)
          ? sl.helpers
          : (handoverMatch?.helpers && handoverMatch.helpers.length > 0)
          ? handoverMatch.helpers
          : (b.helpers && b.helpers.length > 0)
          ? b.helpers
          : [];

        rawItems.push({
          id: sl.sliceId || `${batchId}-S${sIdx + 1}`,
          stage,
          machine: sl.machine || batchMachine,
          batchId,
          shift: (sl.shift || b.shift || 'DAY').toUpperCase(),
          date: sliceDate,
          startTime: sl.startTime || b.startTime,
          endTime: sl.handoverTime || 'Handover',
          operator: sl.operator || b.worker || 'Operator',
          relievedByOperator: sl.relievedByOperator,
          helpers: resolvedHelpers,
          glueKg: sl.glueUsageKg || (b.glueUsageKg && b.slices?.length === 1 ? b.glueUsageKg : undefined),
          glueBrand: sl.glueBrand || b.glueBrand,
          producedQty: sliceProducedQty,
          unitLabel,
          producedPieces: slicePieces,
          loosePieces: sliceLoosePcs,
          grossPieces: (sl.grossPieces || slicePieces) + sliceScrapPcs,
          scrapKg: sliceScrapKg,
          scrapPcs: sliceScrapPcs,
          scrapPercent: sliceProducedQty > 0 && sliceScrapKg > 0 ? Number(((sliceScrapKg / (sliceProducedQty * 20)) * 100).toFixed(1)) : undefined,
          meterReading: sl.endMeterReading || sl.strokeCount,
          notes: sl.notes || (sl.relievedByOperator ? `Handed over to ${sl.relievedByOperator}` : 'Shift Run Slice'),
          isHandover,
          status: isHandover ? 'Handed Over' : 'Completed'
        });
      });

      // Now calculate remaining portion done by final operator after handovers
      const remainingQty = Math.max(0, (b.producedQty || 0) - cumulativeSliceQty);
      const remainingPieces = Math.max(0, (b.producedPieces || (b.producedQty || 0) * targetUnitPcs) - cumulativeSlicePieces);
      const remainingScrapKg = Math.max(0, (b.scrapKg || 0) - cumulativeSliceScrapKg);
      const remainingScrapPcs = Math.max(0, (b.scrapPcs || b.rejectedPieces || 0) - cumulativeSliceScrapPcs);
      const remainingLoose = b.loosePieces || 0;

      if (remainingQty > 0 || remainingScrapKg > 0 || remainingScrapPcs > 0 || b.status === 'Running') {
        const lastHandover = b.slices[b.slices.length - 1];
        const finalHandoverMatch = (state.shiftHandovers || []).find(
          (h) => (h.batchId === b.batchId || h.jobId === job.id) &&
                 (h.relievedByOperator === b.worker || h.relievedByOperator === lastHandover.relievedByOperator)
        );
        const finalResolvedHelpers = (b.helpers && b.helpers.length > 0)
          ? b.helpers
          : (finalHandoverMatch?.helpers && finalHandoverMatch.helpers.length > 0)
          ? finalHandoverMatch.helpers
          : (lastHandover?.helpers && lastHandover.helpers.length > 0)
          ? lastHandover.helpers
          : [];

        rawItems.push({
          id: `${batchId}-FINAL`,
          stage,
          machine: batchMachine,
          batchId,
          shift: (b.shift || 'DAY').toUpperCase(),
          date: batchDate,
          startTime: lastHandover.handoverTime || b.startTime,
          endTime: b.endTime || (b.status === 'Running' ? 'Ongoing' : 'Completed'),
          operator: b.worker || lastHandover.relievedByOperator || 'Operator',
          helpers: finalResolvedHelpers,
          glueKg: b.glueUsageKg,
          glueBrand: b.glueBrand,
          producedQty: remainingQty,
          unitLabel,
          producedPieces: remainingPieces || (remainingQty * targetUnitPcs) + remainingLoose,
          loosePieces: remainingLoose,
          grossPieces: remainingPieces + remainingScrapPcs,
          scrapKg: remainingScrapKg,
          scrapPcs: remainingScrapPcs,
          meterReading: b.meterReading,
          notes: b.status === 'Running' ? 'Active Ongoing Shift' : 'Final Batch Completion Run',
          isHandover: false,
          status: b.status === 'Running' ? 'Running' : 'Completed'
        });
      }
    } else {
      // Single run (no prior handover slices)
      const bProducedQty = b.producedQty || 0;
      const bLoose = b.loosePieces || 0;
      const bPieces = b.producedPieces || (bProducedQty * targetUnitPcs) + bLoose;
      const bScrapKg = b.scrapKg || 0;
      const bScrapPcs = b.scrapPcs || b.rejectedPieces || 0;

      const mainHandoverMatch = (state.shiftHandovers || []).find(
        (h) => h.batchId === b.batchId || h.jobId === job.id
      );
      const mainResolvedHelpers = (b.helpers && b.helpers.length > 0)
        ? b.helpers
        : (mainHandoverMatch?.helpers && mainHandoverMatch.helpers.length > 0)
        ? mainHandoverMatch.helpers
        : [];

      rawItems.push({
        id: `${batchId}-MAIN`,
        stage,
        machine: batchMachine,
        batchId,
        shift: (b.shift || 'DAY').toUpperCase(),
        date: batchDate,
        startTime: b.startTime,
        endTime: b.endTime || (b.status === 'Running' ? 'Ongoing' : 'Completed'),
        operator: b.worker || 'Operator',
        helpers: mainResolvedHelpers,
        glueKg: b.glueUsageKg,
        glueBrand: b.glueBrand,
        producedQty: bProducedQty,
        unitLabel,
        producedPieces: bPieces,
        loosePieces: bLoose,
        grossPieces: bPieces + bScrapPcs,
        scrapKg: bScrapKg,
        scrapPcs: bScrapPcs,
        meterReading: b.meterReading,
        notes: b.status === 'Running' ? 'Active In-Progress Shift' : 'Full Batch Run',
        isHandover: false,
        status: b.status === 'Running' ? 'Running' : 'Completed'
      });
    }
  });

  // If no batches were found in runningBatches (e.g. older or directly completed jobs),
  // fallback to job's stage data and state.logs!
  if (rawItems.length === 0) {
    const stageLogs = (state.logs || []).filter(
      (l) => l.jobId === job.id && l.stage?.toLowerCase().includes(stageLower)
    );

    if (stageLogs.length > 0) {
      stageLogs.forEach((l, lIdx) => {
        let logQty = 0;
        let logScrapKg = 0;
        let logScrapPcs = 0;
        let logPieces = 0;

        // Extract numbers from log action text
        if (stageLower.includes('slit')) {
          const mRolls = l.action.match(/(\d+)\s*Rolls/i);
          const mScrap = l.action.match(/Scrap:\s*([\d.]+)\s*KG/i);
          logQty = mRolls ? parseInt(mRolls[1], 10) : (job.availableRolls || 0);
          logScrapKg = mScrap ? parseFloat(mScrap[1]) : (job.scrapKg || 0);
        } else if (stageLower.includes('cut')) {
          const mCrates = l.action.match(/(\d+)\s*Crates/i) || l.action.match(/(\d+)\s*Cut Crates/i);
          const mScrap = l.action.match(/Scrap:\s*([\d.]+)\s*KG/i) || l.action.match(/Paper Scrap:\s*([\d.]+)\s*KG/i);
          const mRej = l.action.match(/(\d+)\s*Rejected/i);
          logQty = mCrates ? parseInt(mCrates[1], 10) : (job.availableCuttingCrates || 0);
          logScrapKg = mScrap ? parseFloat(mScrap[1]) : (job.cuttingScrapKg || 0);
          logScrapPcs = mRej ? parseInt(mRej[1], 10) : (job.cuttingRejectedPcs || 0);
          logPieces = logQty * targetUnitPcs;
        } else if (stageLower.includes('form')) {
          const mCrates = l.action.match(/(\d+)\s*Formed Crates/i) || l.action.match(/(\d+)\s*Crates/i);
          const mScrap = l.action.match(/Defect Scrap:\s*(\d+)/i) || l.action.match(/(\d+)\s*Defect/i);
          logQty = mCrates ? parseInt(mCrates[1], 10) : (job.availableFormingCrates || 0);
          logScrapPcs = mScrap ? parseInt(mScrap[1], 10) : 0;
          logPieces = logQty * targetUnitPcs;
        }

        rawItems.push({
          id: `LOG-${stage}-${lIdx + 1}`,
          stage,
          machine: l.machine || `${stage}-1`,
          batchId: `LOT-${job.id}`,
          shift: (l.shift || 'DAY').toUpperCase(),
          date: l.rawDate || jobDateFallback,
          startTime: l.startTime,
          endTime: l.endTime || (l.timestamp?.includes(',') ? l.timestamp.split(',')[1]?.trim() : l.timestamp),
          operator: l.worker || 'Operator',
          producedQty: logQty,
          unitLabel,
          producedPieces: logPieces,
          scrapKg: logScrapKg,
          scrapPcs: logScrapPcs,
          grossPieces: logPieces + logScrapPcs,
          notes: l.action.includes('Handover') ? 'Shift Handover' : 'Stage Execution Log',
          isHandover: l.action.includes('Handover'),
          status: 'Completed'
        });
      });
    } else {
      // Fallback directly to job metrics if available
      let defQty = 0;
      let defPieces = 0;
      let defScrapKg = 0;
      let defScrapPcs = 0;

      if (stageLower.includes('slit')) {
        defQty = job.availableRolls || 0;
        defScrapKg = job.scrapKg || 0;
      } else if (stageLower.includes('cut')) {
        defQty = job.availableCuttingCrates || 0;
        defPieces = job.totalCutPieces || (defQty * targetUnitPcs);
        defScrapKg = job.cuttingScrapKg || 0;
        defScrapPcs = job.cuttingRejectedPcs || 0;
      } else if (stageLower.includes('form')) {
        defQty = job.availableFormingCrates || 0;
        defPieces = job.totalFormedPieces || (defQty * targetUnitPcs);
        defScrapPcs = job.formingLoosePcs || 0;
      }

      if (defQty > 0 || defScrapKg > 0 || defScrapPcs > 0) {
        rawItems.push({
          id: `DEF-${stage}-${job.id}`,
          stage,
          machine: `${stage}-1`,
          batchId: `${stage.toUpperCase()}-${job.id}`,
          shift: 'DAY',
          date: jobDateFallback,
          operator: 'Operator',
          producedQty: defQty,
          unitLabel,
          producedPieces: defPieces,
          grossPieces: defPieces + defScrapPcs,
          scrapKg: defScrapKg,
          scrapPcs: defScrapPcs,
          notes: 'Master Job Stock Entry',
          isHandover: false,
          status: 'Completed'
        });
      }
    }
  }

  // Calculate totals
  const totalProducedQty = rawItems.reduce((sum, item) => sum + (item.producedQty || 0), 0);
  const totalProducedPieces = rawItems.reduce((sum, item) => sum + (item.producedPieces || 0), 0);
  const totalLoosePieces = rawItems.reduce((sum, item) => sum + (item.loosePieces || 0), 0);
  const totalScrapKg = Number(rawItems.reduce((sum, item) => sum + (item.scrapKg || 0), 0).toFixed(2));
  const totalScrapPcs = rawItems.reduce((sum, item) => sum + (item.scrapPcs || 0), 0);
  const totalGrossPieces = rawItems.reduce((sum, item) => sum + (item.grossPieces || 0), 0);

  const uniqueOperators = Array.from(
    new Set(rawItems.map((item) => item.operator).filter(Boolean))
  );

  const totalGlueKg = Number(
    (
      job.glueUsageKg ||
      batches.reduce((sum, b) => sum + (b.glueUsageKg || 0), 0) ||
      rawItems.reduce((sum, item) => sum + (item.glueKg || 0), 0) ||
      0
    ).toFixed(2)
  );

  const glueBrand =
    job.glueBrand ||
    batches.find((b) => b.glueBrand)?.glueBrand ||
    rawItems.find((item) => item.glueBrand)?.glueBrand ||
    (stageLower.includes('cut') ? 'Pidilite W-10 (Food Grade Adhesive)' : undefined);

  return {
    items: rawItems,
    totalShifts: rawItems.length,
    totalProducedQty,
    totalProducedPieces,
    totalLoosePieces,
    totalScrapKg,
    totalScrapPcs,
    totalGrossPieces,
    totalGlueKg,
    glueBrand,
    uniqueOperators,
    unitLabel,
    targetUnitPcs
  };
}
