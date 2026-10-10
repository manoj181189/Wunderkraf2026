import { FactoryState } from '../types';
import { MACHINES } from './constants';

export function isMatchingDate(dateStr?: string, targetDate?: string): boolean {
  if (!targetDate) return true;
  if (!dateStr) return false;
  const t = targetDate.trim();
  const d = dateStr.trim();
  if (d === t || d.startsWith(t)) return true;

  // Split target "YYYY-MM-DD"
  const tParts = t.split('-');
  if (tParts.length === 3) {
    const [y, m, dNumStr] = tParts;
    const mNum = parseInt(m, 10);
    const dNum = parseInt(dNumStr, 10);

    // If dateStr has "YYYY-MM-DD" inside
    if (d.includes(`${y}-${m}-${dNumStr}`)) return true;
    if (d.includes(`${y}/${m}/${dNumStr}`)) return true;

    // Check localized formats like "09/10/2026", "9/10/2026", "10/9/2026", "10/09/2026"
    const patterns = [
      `${dNum}/${mNum}/${y}`,
      `${dNumStr}/${m}/${y}`,
      `${mNum}/${dNum}/${y}`,
      `${m}/${dNumStr}/${y}`,
      `${y}-${mNum}-${dNum}`
    ];
    for (const pat of patterns) {
      if (d.includes(pat)) return true;
    }
  }

  // Check JavaScript Date parse if dateStr has valid date
  try {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
      const isoDate = parsed.toISOString().split('T')[0];
      if (isoDate === t) return true;
    }
  } catch {
    // ignore
  }

  return false;
}

export function isSameMachine(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const cleanA = a.toLowerCase().replace(/[\s-_]/g, '');
  const cleanB = b.toLowerCase().replace(/[\s-_]/g, '');
  return cleanA === cleanB;
}

export interface OperatorProductionSummary {
  operator: string;
  stage: string;
  machine: string;
  qty: number;
  unitLabel: string;
  pieces: number;
  scrapKg?: number;
  scrapPcs?: number;
}

export interface MachineReportItem {
  machine: string;
  stage: string;
  status: 'Running' | 'Held' | 'Breakdown' | 'Standby' | 'Completed';
  activeJobId?: string;
  product?: string;
  operators: string[];
  helpers: string[];
  producedQty: number;
  unitLabel: string;
  producedPieces: number;
  scrapKg: number;
  scrapPcs?: number;
  scrapPercent?: number;
  breakdownReason?: string;
  assignedTech?: string;
  holdReason?: string;
  jobsList?: string[];
  productsList?: string[];
  outputWeightKg?: number;
  jumboWeightKg?: number;
  reelNumbers?: string[];
  operatorBreakdown?: OperatorProductionSummary[];
}

export function getMachineDailyData(
  state: FactoryState,
  machine: string,
  stage: string,
  targetShift?: 'DAY' | 'NIGHT' | 'ALL',
  targetDate?: string
): MachineReportItem {
  const today = targetDate || new Date().toISOString().split('T')[0];
  const unitLabel = stage === 'Slitting'
    ? 'Rolls'
    : stage === 'Cutting'
    ? 'Cut Crates'
    : stage === 'Forming'
    ? 'Formed Crates'
    : stage === 'QC'
    ? 'OK Crates'
    : 'Boxes';

  // Helper to convert crates to pieces based on master configuration
  const getPiecesForCrates = (crates: number, prodName?: string): number => {
    if (crates <= 0) return 0;
    const prodKey = prodName || 'Spoon';
    const cap = state.crateCapacityMaster?.[prodKey] || { cuttingPcs: 10000, formingPcs: 7000 };
    if (stage === 'Cutting') return crates * (cap.cuttingPcs || 10000);
    if (stage === 'Forming') return crates * (cap.formingPcs || 7000);
    if (stage === 'QC') return crates * (cap.formingPcs || 7000);
    if (stage === 'Packing') return crates * 1000;
    return 0;
  };

  // 1. Check for active breakdown in maintenance incidents
  const openIncident = (state.maintenanceIncidents || []).find(
    (i) => isSameMachine(i.machine, machine) && (i.status === 'OPEN' || i.status === 'IN_PROGRESS')
  );

  // 2. Check active running / held batches on this machine right now
  const allJobs = state.jobs || [];
  const activeBatchesOnMachine: Array<{ job: any; batch: any }> = [];
  allJobs.forEach((j) => {
    (j.runningBatches || []).forEach((b) => {
      if (isSameMachine(b.machine, machine) && (b.status === 'Running' || b.status === 'Held')) {
        activeBatchesOnMachine.push({ job: j, batch: b });
      }
    });
  });

  // For Packing stage, check active packJobs on machine
  const allPackJobs = state.packJobs || [];
  const activePackJob = allPackJobs.find(
    (pj) => isSameMachine(pj.machine, machine) && (pj.status === 'Packing' || pj.status === 'In-Progress' || pj.status === 'Held')
  );

  const primaryActive = activeBatchesOnMachine[0];
  const activeJobId = primaryActive?.job?.id || activePackJob?.id;
  const product = primaryActive?.job?.product || activePackJob?.kitType || activePackJob?.customer;
  const activeHoldReason = primaryActive?.batch?.holdReason || activePackJob?.holdReason;

  const operatorsSet = new Set<string>();
  const helpersSet = new Set<string>();
  const jobsSet = new Set<string>();
  const productsSet = new Set<string>();
  const reelsSet = new Set<string>();
  const countedBatchIds = new Set<string>();

  // Operator-wise summary ledger for this machine
  const opBreakdownMap: Record<string, OperatorProductionSummary> = {};
  const addOpOutput = (
    opName: string | undefined,
    qty: number,
    pcs: number,
    scrapKgVal: number = 0,
    scrapPcsVal: number = 0
  ) => {
    if (!opName) return;
    const cleanName = opName.trim();
    if (!cleanName || cleanName.toLowerCase() === 'unassigned') return;
    operatorsSet.add(cleanName);
    if (!opBreakdownMap[cleanName]) {
      opBreakdownMap[cleanName] = {
        operator: cleanName,
        stage,
        machine,
        qty: 0,
        pieces: 0,
        unitLabel,
        scrapKg: 0,
        scrapPcs: 0
      };
    }
    opBreakdownMap[cleanName].qty += qty;
    opBreakdownMap[cleanName].pieces += pcs;
    opBreakdownMap[cleanName].scrapKg = (opBreakdownMap[cleanName].scrapKg || 0) + scrapKgVal;
    opBreakdownMap[cleanName].scrapPcs = (opBreakdownMap[cleanName].scrapPcs || 0) + scrapPcsVal;
  };

  let totalProducedQty = 0;
  let totalProducedPieces = 0;
  let totalScrapKg = 0;
  let totalScrapPcs = 0;
  let totalOutputWeightKg = 0;
  let totalJumboWeightKg = 0;

  if (activeJobId) jobsSet.add(activeJobId);
  if (product) productsSet.add(product);

  // If a batch is actively running right now, register the live operator immediately
  if (primaryActive) {
    const activeOp = primaryActive.batch.worker || primaryActive.batch.operator;
    if (activeOp) addOpOutput(activeOp, 0, 0);
  }
  if (activePackJob) {
    const activePacker = activePackJob.packer || activePackJob.worker;
    if (activePacker) addOpOutput(activePacker, 0, 0);
  }

  // 3. Scan all batches & slices across all production jobs
  allJobs.forEach((j) => {
    (j.runningBatches || []).forEach((b) => {
      if (!isSameMachine(b.machine, machine)) return;

      const isCurrentlyActive = (b.status === 'Running' || b.status === 'Held');
      const batchDate =
        (b as any).date ||
        (b as any).rawDate ||
        (b.startTime && b.startTime.includes('T') ? b.startTime.split('T')[0] : '') ||
        (b.slices && b.slices.length > 0 ? b.slices.find((sl: any) => sl.date)?.date : '') ||
        j.date ||
        j.createdAt;

      const batchMatchesDate =
        (batchDate && isMatchingDate(batchDate, today)) ||
        isMatchingDate(b.startTime, today) ||
        isMatchingDate(b.endTime, today) ||
        isMatchingDate(j.date, today) ||
        isMatchingDate(j.createdAt, today) ||
        (isCurrentlyActive && today === new Date().toISOString().split('T')[0]) ||
        (b.slices || []).some((sl: any) => isMatchingDate(sl.date, today));

      if (!batchMatchesDate) return;

      const batchShift = (b.shift || 'DAY').toUpperCase();
      const batchMatchesShift = !targetShift || targetShift === 'ALL' || batchShift === targetShift;

      if (b.batchId) countedBatchIds.add(b.batchId);
      if (j.id) jobsSet.add(j.id);
      if (j.product) productsSet.add(j.product);
      if (b.reelNo) reelsSet.add(b.reelNo);
      if (b.reelNumbers) (b.reelNumbers as string[]).forEach((r) => reelsSet.add(r));

      // Scan slices (handover records within this batch)
      if (b.slices && b.slices.length > 0) {
        let slicesQtySum = 0;
        let slicesPiecesSum = 0;
        b.slices.forEach((sl: any) => {
          const sliceMatchesDate = isMatchingDate(sl.date, today);
          const sliceMatchesShift = !targetShift || targetShift === 'ALL' || !sl.shift || sl.shift.toUpperCase() === targetShift;
          if (sliceMatchesDate && sliceMatchesShift) {
            let pcs = sl.producedPieces || (sl.grossPieces || 0) || getPiecesForCrates(sl.producedQty || 0, j.product);
            if (sl.helpers) (sl.helpers as string[]).forEach((h) => helpersSet.add(h));
            totalProducedQty += sl.producedQty || 0;
            totalProducedPieces += pcs;
            totalScrapKg += sl.scrapKg || 0;
            totalScrapPcs += sl.scrapPcs || 0;
            slicesQtySum += sl.producedQty || 0;
            slicesPiecesSum += pcs;
            addOpOutput(sl.operator, sl.producedQty || 0, pcs, sl.scrapKg || 0, sl.scrapPcs || 0);
          }
        });

        // If batch is actively running today, capture live un-sliced production for the active operator
        if (isCurrentlyActive && batchMatchesShift) {
          const liveDeltaQty = Math.max(0, (b.producedQty || 0) - slicesQtySum);
          let liveDeltaPcs = Math.max(0, (b.producedPieces || 0) - slicesPiecesSum);
          if (liveDeltaPcs === 0 && liveDeltaQty > 0) {
            liveDeltaPcs = getPiecesForCrates(liveDeltaQty, j.product);
          }
          totalProducedQty += liveDeltaQty;
          totalProducedPieces += liveDeltaPcs;
          if (b.helpers) (b.helpers as string[]).forEach((h: string) => helpersSet.add(h));
          addOpOutput(b.worker || b.operator, liveDeltaQty, liveDeltaPcs);
        }
      } else if (batchMatchesShift) {
        let pcs = b.producedPieces || (b.outputPieces || 0) || (b.grossPieces || 0) || getPiecesForCrates(b.producedQty || 0, j.product);
        if (b.helpers) (b.helpers as string[]).forEach((h) => helpersSet.add(h));
        totalProducedQty += b.producedQty || 0;
        totalProducedPieces += pcs;
        totalScrapKg += b.scrapKg || 0;
        totalScrapPcs += b.scrapPcs || 0;
        addOpOutput(b.worker || b.operator, b.producedQty || 0, pcs, b.scrapKg || 0, b.scrapPcs || 0);
      }

      if (b.outputWeightKg) totalOutputWeightKg += b.outputWeightKg;
      if (b.inputWeightKg) totalJumboWeightKg += b.inputWeightKg;
    });
  });

  // 4. Scan state.shiftHandovers for this machine (explicit ShiftHandoverRecords)
  (state.shiftHandovers || []).forEach((ho) => {
    if (!isSameMachine(ho.machine, machine)) return;
    if (!isMatchingDate(ho.date, today)) return;
    const hoShift = (ho.currentShift || 'DAY').toUpperCase();
    if (targetShift && targetShift !== 'ALL' && hoShift !== targetShift) return;

    if (ho.id && countedBatchIds.has(ho.id)) return;
    if (ho.batchId && countedBatchIds.has(`ho-${ho.batchId}-${ho.outgoingOperator}`)) return;
    if (ho.id) countedBatchIds.add(ho.id);
    if (ho.batchId) countedBatchIds.add(`ho-${ho.batchId}-${ho.outgoingOperator}`);

    const hoQty = ho.producedQty || 0;
    const hoPcs = ho.producedPieces || getPiecesForCrates(hoQty);
    totalProducedQty += hoQty;
    totalProducedPieces += hoPcs;
    totalScrapKg += ho.scrapQty || 0;
    if (ho.helpers) (ho.helpers as string[]).forEach((h) => helpersSet.add(h));
    addOpOutput(ho.outgoingOperator, hoQty, hoPcs, ho.scrapQty || 0);
  });

  // 5. Scan state.wipLots for this machine (captures partial forwards & completed WIP lots)
  (state.wipLots || []).forEach((lot) => {
    if (!isSameMachine(lot.machine, machine)) return;
    if (!isMatchingDate(lot.timestamp, today)) return;
    const lotShift = (lot.shift || 'DAY').toUpperCase();
    if (targetShift && targetShift !== 'ALL' && lotShift !== targetShift) return;

    const lotKey = `lot-${lot.id}`;
    if (countedBatchIds.has(lotKey)) return;
    countedBatchIds.add(lotKey);

    const lotQty = lot.producedQty || 0;
    const lotPcs = lot.totalPieces || (lot.piecesPerCrate ? lotQty * lot.piecesPerCrate : getPiecesForCrates(lotQty, lot.product));

    // If total produced pieces on machine has not captured this lot, add it
    if ((lotQty > 0 || lotPcs > 0) && totalProducedPieces === 0) {
      totalProducedQty += lotQty;
      totalProducedPieces += lotPcs;
    }
    if (lot.producedByOperator) {
      addOpOutput(lot.producedByOperator, lotQty, lotPcs);
    }
  });

  // 6. Scan packJobs for packing stage machines
  if (stage === 'Packing') {
    allPackJobs.forEach((pj) => {
      if (!isSameMachine(pj.machine, machine)) return;

      const isPackActive = (pj.status === 'Packing' || pj.status === 'In-Progress' || pj.status === 'Held');
      const packMatchesDate =
        isMatchingDate(pj.dispatchDate, today) ||
        (isPackActive && today === new Date().toISOString().split('T')[0]) ||
        (pj.historyRuns || []).some((hr) => isMatchingDate(hr.date, today)) ||
        (pj.slices || []).some((sl) => isMatchingDate(sl.date, today));

      if (!packMatchesDate) return;

      const pjShift = (pj.shift || 'DAY').toUpperCase();
      const pjShiftMatches = !targetShift || targetShift === 'ALL' || pjShift === targetShift;

      if (pj.id) jobsSet.add(pj.id);
      if (pj.customer) productsSet.add(pj.customer);
      if (pj.helper) helpersSet.add(pj.helper);
      (pj.helpers || []).forEach((h) => helpersSet.add(h));

      if (pj.historyRuns && pj.historyRuns.length > 0) {
        pj.historyRuns.forEach((hr) => {
          const hrMatchesDate = isMatchingDate(hr.date, today);
          const hrMatchesShift = !targetShift || targetShift === 'ALL' || !hr.shift || hr.shift.toUpperCase() === targetShift;
          if (hrMatchesDate && hrMatchesShift) {
            const boxes = hr.boxesPacked || hr.boxes || 0;
            const pcs = hr.pcs || (boxes * (pj.pcsPerBox || 1000));
            totalProducedQty += boxes;
            totalProducedPieces += pcs;
            addOpOutput(hr.worker || (hr as any).packer || pj.packer, boxes, pcs);
            (hr.helpers || []).forEach((h) => helpersSet.add(h));
          }
        });
      } else if (isPackActive && pjShiftMatches) {
        const boxes = pj.packedBoxes || 0;
        const pcs = boxes * (pj.pcsPerBox || 1000);
        totalProducedQty += boxes;
        totalProducedPieces += pcs;
        addOpOutput(pj.packer || pj.worker, boxes, pcs);
      }
    });
  }

  // 7. Scan logs for this machine (including partial forwards & completed logs)
  const machineLogs = (state.logs || []).filter((l) => {
    const isThisMachine =
      isSameMachine(l.machine, machine) ||
      isSameMachine(l.station, machine) ||
      (l.details && isSameMachine(l.details, machine));
    if (!isThisMachine) return false;

    const logDate = l.rawDate || l.date || l.timestamp;
    const logMatchesDate = isMatchingDate(logDate, today);
    const logShift = (l.shift || '').toUpperCase();
    const logMatchesShift = !targetShift || targetShift === 'ALL' || !logShift || logShift === targetShift;
    return logMatchesDate && logMatchesShift;
  });

  machineLogs.forEach((l) => {
    if (l.operator || l.worker) operatorsSet.add(l.operator || l.worker);
    if (l.jobId) jobsSet.add(l.jobId);
    if (l.product) productsSet.add(l.product);

    // Extract batchId if present in log action/details to prevent double-counting
    const batchMatch = l.action?.match(/BTH-[\w-]+/) || l.details?.match(/BTH-[\w-]+/);
    const logBatchId = batchMatch ? batchMatch[0] : '';
    if (logBatchId && countedBatchIds.has(logBatchId)) {
      return; // Already counted from runningBatches
    }
    if (logBatchId) countedBatchIds.add(logBatchId);

    // Parse finished or forward batch outputs from logs if uncounted
    const isForwardOrFinishLog =
      l.action?.includes('Forward') ||
      l.action?.includes('Finished') ||
      l.action?.includes('Completed') ||
      l.action?.includes('Done') ||
      l.details?.includes('Forward') ||
      l.details?.includes('Completed');

    if (isForwardOrFinishLog || totalProducedQty === 0) {
      let logQty = 0;
      let logPcs = 0;
      let logScrapKg = 0;
      let logScrapPcs = 0;

      if (stage === 'Slitting') {
        const matchRolls = l.action?.match(/(\d+)\s*Rolls/i) || l.details?.match(/(\d+)\s*Rolls/i);
        if (matchRolls && !countedBatchIds.has(`log-slit-${l.timestamp}`)) {
          countedBatchIds.add(`log-slit-${l.timestamp}`);
          logQty = parseInt(matchRolls[1], 10);
        }
        const matchOutputKg = l.action?.match(/([\d.]+)\s*KG\s*Output/i);
        if (matchOutputKg && totalOutputWeightKg === 0) totalOutputWeightKg = parseFloat(matchOutputKg[1]);
        const matchJumboKg = l.action?.match(/Jumbo\s*In:\s*([\d.]+)\s*KG/i);
        if (matchJumboKg && totalJumboWeightKg === 0) totalJumboWeightKg = parseFloat(matchJumboKg[1]);
      } else if (stage === 'Cutting') {
        const matchCrates = l.action?.match(/(\d+)\s*(?:Cut\s*)?Crates/i) || l.details?.match(/(\d+)\s*(?:Cut\s*)?Crates/i);
        if (matchCrates) logQty = parseInt(matchCrates[1], 10);
        const matchPcs = l.action?.match(/(\d[\d,]*)\s*(?:Flat\s*Blanks|Pieces|Pcs)/i) || l.details?.match(/(\d[\d,]*)\s*(?:Flat\s*Blanks|Pieces|Pcs)/i);
        if (matchPcs) logPcs = parseInt(matchPcs[1].replace(/,/g, ''), 10);
        else if (logQty > 0) logPcs = logQty * 10000;
      } else if (stage === 'Forming') {
        const matchCrates = l.action?.match(/(\d+)\s*(?:Formed\s*)?Crates/i) || l.details?.match(/(\d+)\s*(?:Formed\s*)?Crates/i);
        if (matchCrates) logQty = parseInt(matchCrates[1], 10);
        const matchPcs = l.action?.match(/(\d[\d,]*)\s*(?:3D\s*Pieces|Pieces|Pcs)/i) || l.details?.match(/(\d[\d,]*)\s*(?:3D\s*Pieces|Pieces|Pcs)/i);
        if (matchPcs) logPcs = parseInt(matchPcs[1].replace(/,/g, ''), 10);
        else if (logQty > 0) logPcs = logQty * 7000;
        const matchRej = l.action?.match(/Defect\/Scrap:\s*(\d[\d,]*)\s*Pieces/i);
        if (matchRej) logScrapPcs = parseInt(matchRej[1].replace(/,/g, ''), 10);
      } else if (stage === 'Packing') {
        const matchBoxes = l.action?.match(/(\d+)\s*Boxes/i) || l.details?.match(/(\d+)\s*Boxes/i);
        if (matchBoxes) {
          logQty = parseInt(matchBoxes[1], 10);
          logPcs = logQty * 1000;
        }
      }

      const matchScrap = l.action?.match(/Scrap:\s*([\d.]+)\s*KG/i) || l.details?.match(/Scrap:\s*([\d.]+)\s*KG/i);
      if (matchScrap) logScrapKg = parseFloat(matchScrap[1]);

      if (logQty > 0 || logPcs > 0) {
        const logKey = `log-${l.timestamp}-${logQty}-${logPcs}`;
        if (!countedBatchIds.has(logKey)) {
          countedBatchIds.add(logKey);
          if (totalProducedQty === 0) {
            totalProducedQty += logQty;
            totalProducedPieces += logPcs;
          }
          addOpOutput(l.worker || l.operator, logQty, logPcs, logScrapKg, logScrapPcs);
        }
      }
      if (totalScrapKg === 0 && logScrapKg > 0) totalScrapKg += logScrapKg;
      if (totalScrapPcs === 0 && logScrapPcs > 0) totalScrapPcs += logScrapPcs;
    }
  });

  // Consistency attribution: If single operator is associated with machine and has 0 pieces recorded,
  // but totalProducedPieces or totalProducedQty > 0, bind the total output to that operator
  const opKeys = Object.keys(opBreakdownMap);
  if (opKeys.length === 1) {
    const singleOp = opBreakdownMap[opKeys[0]];
    if (singleOp.pieces === 0 && totalProducedPieces > 0) {
      singleOp.pieces = totalProducedPieces;
    }
    if (singleOp.qty === 0 && totalProducedQty > 0) {
      singleOp.qty = totalProducedQty;
    }
    if (singleOp.scrapKg === 0 && totalScrapKg > 0) {
      singleOp.scrapKg = totalScrapKg;
    }
    if (singleOp.scrapPcs === 0 && totalScrapPcs > 0) {
      singleOp.scrapPcs = totalScrapPcs;
    }
  }

  // Calculate scrap percentage
  let scrapPercent = 0;
  if (totalJumboWeightKg > 0 && totalScrapKg > 0) {
    scrapPercent = (totalScrapKg / totalJumboWeightKg) * 100;
  } else if (totalProducedPieces > 0 && totalScrapPcs > 0) {
    scrapPercent = (totalScrapPcs / (totalProducedPieces + totalScrapPcs)) * 100;
  }

  // Determine machine status
  let status: 'Running' | 'Held' | 'Breakdown' | 'Standby' | 'Completed' = 'Standby';
  if (openIncident) {
    status = 'Breakdown';
  } else if (primaryActive) {
    status = primaryActive.batch.status === 'Held' ? 'Held' : 'Running';
  } else if (activePackJob) {
    status = activePackJob.status === 'Held' ? 'Held' : 'Running';
  } else if (totalProducedQty > 0 || totalProducedPieces > 0) {
    status = 'Completed';
  }

  return {
    machine,
    stage,
    status,
    activeJobId,
    product,
    operators: Array.from(operatorsSet).filter(Boolean),
    helpers: Array.from(helpersSet).filter(Boolean),
    producedQty: totalProducedQty,
    unitLabel,
    producedPieces: totalProducedPieces,
    scrapKg: totalScrapKg,
    scrapPcs: totalScrapPcs,
    scrapPercent,
    breakdownReason: openIncident?.issue || openIncident?.reason,
    assignedTech: openIncident?.technicianName || openIncident?.attendedBy || (openIncident as any)?.assignedTech,
    holdReason: activeHoldReason,
    jobsList: Array.from(jobsSet).filter(Boolean),
    productsList: Array.from(productsSet).filter(Boolean),
    outputWeightKg: totalOutputWeightKg,
    jumboWeightKg: totalJumboWeightKg,
    reelNumbers: Array.from(reelsSet).filter(Boolean),
    operatorBreakdown: Object.values(opBreakdownMap)
  };
}

export function formatMachineReportLine(item: MachineReportItem): string {
  const opStr = item.operators.length > 0 ? item.operators.join(', ') : 'Assigned Floor Staff';
  const helperStr = item.helpers.length > 0 ? ` (Helper: ${item.helpers.join(', ')})` : '';
  const jobStr = item.activeJobId
    ? ` | [${item.activeJobId}] ${item.product || ''}`
    : item.jobsList && item.jobsList.length > 0
    ? ` | Job: ${item.jobsList.join(', ')}`
    : item.product
    ? ` | ${item.product}`
    : '';

  if (item.status === 'Breakdown') {
    return `  • *${item.machine}:* 🔴 *BREAKDOWN*\n    ↳ Issue: ${item.breakdownReason || 'Machine Stoppage'}${item.assignedTech ? ` | Tech: ${item.assignedTech}` : ''}`;
  }

  // Format an individual operator's extracted pieces and output
  const formatOpOutput = (ob: OperatorProductionSummary) => {
    if (item.stage === 'Slitting') {
      const wtStr = ob.scrapKg ? ` | Scrap: ${ob.scrapKg.toFixed(1)} KG` : '';
      return ob.qty > 0 ? `*${ob.qty} Rolls*${wtStr}` : `*0 Rolls* (स्प्लिटिंग प्रगति पर)`;
    } else if (item.stage === 'Packing') {
      const pcsStr = ob.pieces > 0 ? ` (~${ob.pieces.toLocaleString()} Pieces)` : '';
      return ob.qty > 0 ? `*${ob.qty} Boxes*${pcsStr}` : `*0 Boxes* (पैकिंग प्रगति पर)`;
    } else {
      const pcsStr = ob.pieces > 0 ? `*${ob.pieces.toLocaleString()} Pieces*` : (item.status === 'Running' ? `*0 Pieces* (बैच प्रगति पर / Run In-Progress)` : `*0 Pieces*`);
      const cratesStr = ob.qty > 0 ? ` (${ob.qty} ${item.unitLabel})` : '';
      const rejStr = ob.scrapPcs && ob.scrapPcs > 0 ? ` | Rejection: ${ob.scrapPcs} Pcs` : '';
      return `${pcsStr}${cratesStr}${rejStr}`;
    }
  };

  if (item.status === 'Held') {
    const piecesInfo = item.producedPieces > 0
      ? `\n    ↳ 🎯 *इस शिफ्ट का आउटपुट:* *${item.producedPieces.toLocaleString()} Pieces* (${item.producedQty} ${item.unitLabel})`
      : item.producedQty > 0
      ? `\n    ↳ 🎯 *इस शिफ्ट का आउटपुट:* ${item.producedQty} ${item.unitLabel}`
      : '';
    let opLine = `\n    ↳ 👤 *Operator:* ${opStr}${helperStr}`;
    if (item.operatorBreakdown && item.operatorBreakdown.length === 1) {
      opLine += `\n    ↳ 📦 *ऑपरेटर द्वारा निकाले गए पीसेस:* ${formatOpOutput(item.operatorBreakdown[0])}`;
    }
    return `  • *${item.machine}:* 🟡 *ON HOLD*${jobStr}${opLine}\n    ↳ Reason: ${item.holdReason || 'Job Suspended'}${piecesInfo}`;
  }

  if (item.status === 'Running') {
    let outDetails = '';
    if (item.stage === 'Slitting') {
      const rolls = item.producedQty > 0 ? `*${item.producedQty} Rolls*` : '*0 Rolls* (स्प्लिटिंग प्रगति पर)';
      const wt = item.outputWeightKg ? ` (${item.outputWeightKg} KG)` : '';
      const jmb = item.jumboWeightKg ? ` | Jumbo: ${item.jumboWeightKg} KG` : '';
      const scrap = item.scrapKg > 0 ? ` | Scrap: ${item.scrapKg.toFixed(1)} KG` : '';
      outDetails = `${rolls}${wt}${jmb}${scrap}`;
    } else if (item.stage === 'Cutting') {
      const pcs = item.producedPieces > 0 ? `*${item.producedPieces.toLocaleString()} Pieces*` : '*0 Pieces* (बैच प्रगति पर / Run In-Progress)';
      const crates = item.producedQty > 0 ? ` (${item.producedQty} Cut Crates)` : '';
      const scrap = item.scrapKg > 0 ? ` | Scrap: ${item.scrapKg.toFixed(1)} KG` : '';
      const rej = item.scrapPcs && item.scrapPcs > 0 ? ` (${item.scrapPcs} Rej)` : '';
      outDetails = `${pcs}${crates}${scrap}${rej}`;
    } else if (item.stage === 'Forming') {
      const pcs = item.producedPieces > 0 ? `*${item.producedPieces.toLocaleString()} Pieces*` : '*0 Pieces* (बैच प्रगति पर / Run In-Progress)';
      const crates = item.producedQty > 0 ? ` (${item.producedQty} Formed Crates)` : '';
      const rej = item.scrapPcs && item.scrapPcs > 0 ? ` | Rejection: ${item.scrapPcs} Pcs` : '';
      outDetails = `${pcs}${crates}${rej}`;
    } else if (item.stage === 'Packing') {
      const boxes = item.producedQty > 0 ? `*${item.producedQty} Boxes*` : '*0 Boxes* (पैकिंग प्रगति पर)';
      const pcs = item.producedPieces > 0 ? ` (~${item.producedPieces.toLocaleString()} Pieces)` : '';
      outDetails = `${boxes}${pcs}`;
    } else {
      outDetails = item.producedQty > 0 ? `${item.producedQty} ${item.unitLabel}` : '*0 Units* (In Progress)';
    }

    let opText = '';
    if (item.operatorBreakdown && item.operatorBreakdown.length > 1) {
      const breakdownLines = item.operatorBreakdown.map(
        (ob) => `    ↳ 👤 *Op ${ob.operator}:* ${formatOpOutput(ob)}`
      ).join('\n');
      opText = `\n    ↳ 👥 *ऑपरेटर वाइज निकाले गए पीसेस (Operator Breakdown):*\n${breakdownLines}\n    ↳ 🎯 *इस शिफ्ट का कुल आउटपुट (Total Shift Output):* ${outDetails}`;
    } else if (item.operatorBreakdown && item.operatorBreakdown.length === 1) {
      const singleOp = item.operatorBreakdown[0];
      opText = `\n    ↳ 👤 *Operator:* ${singleOp.operator}${helperStr}\n    ↳ 📦 *ऑपरेटर द्वारा निकाले गए पीसेस (Operator Output):* ${formatOpOutput(singleOp)}\n    ↳ 🎯 *इस शिफ्ट का कुल आउटपुट (Shift Output):* ${outDetails}`;
    } else {
      opText = `\n    ↳ 👤 *Operator:* ${opStr}${helperStr}\n    ↳ 🎯 *इस शिफ्ट का कुल आउटपुट (Shift Output):* ${outDetails}`;
    }

    return `  • *${item.machine}:* 🟢 *Running*${jobStr}${opText}`;
  }

  if (item.status === 'Completed' || item.producedQty > 0 || item.producedPieces > 0) {
    let outDetails = '';
    if (item.stage === 'Slitting') {
      const rolls = `*${item.producedQty} Rolls*`;
      const wt = item.outputWeightKg ? ` (${item.outputWeightKg} KG)` : '';
      const scrap = item.scrapKg > 0 ? ` | Scrap: ${item.scrapKg.toFixed(1)} KG` : '';
      const pct = item.scrapPercent ? ` (${item.scrapPercent.toFixed(1)}%)` : '';
      outDetails = `${rolls}${wt}${scrap}${pct}`;
    } else if (item.stage === 'Cutting') {
      const pcs = item.producedPieces > 0 ? `*${item.producedPieces.toLocaleString()} Pieces*` : `${item.producedQty} Crates`;
      const crates = item.producedQty > 0 && item.producedPieces > 0 ? ` (${item.producedQty} Crates)` : '';
      const scrap = item.scrapKg > 0 ? ` | Scrap: ${item.scrapKg.toFixed(1)} KG` : '';
      outDetails = `${pcs}${crates}${scrap}`;
    } else if (item.stage === 'Forming') {
      const pcs = item.producedPieces > 0 ? `*${item.producedPieces.toLocaleString()} Pieces*` : `${item.producedQty} Crates`;
      const crates = item.producedQty > 0 && item.producedPieces > 0 ? ` (${item.producedQty} Crates)` : '';
      const rej = item.scrapPcs && item.scrapPcs > 0 ? ` | Defect: ${item.scrapPcs} Pcs` : '';
      outDetails = `${pcs}${crates}${rej}`;
    } else if (item.stage === 'Packing') {
      const pcs = item.producedPieces > 0 ? ` (~${item.producedPieces.toLocaleString()} Pieces)` : '';
      outDetails = `*${item.producedQty} Boxes Packed*${pcs}`;
    } else {
      outDetails = `${item.producedQty} ${item.unitLabel}`;
    }

    let opText = '';
    if (item.operatorBreakdown && item.operatorBreakdown.length > 1) {
      const breakdownLines = item.operatorBreakdown.map(
        (ob) => `    ↳ 👤 *Op ${ob.operator}:* ${formatOpOutput(ob)}`
      ).join('\n');
      opText = `\n    ↳ 👥 *ऑपरेटर वाइज निकाले गए पीसेस (Operator Breakdown):*\n${breakdownLines}\n    ↳ 🎯 *इस शिफ्ट का कुल आउटपुट (Total Shift Output):* ${outDetails}`;
    } else if (item.operatorBreakdown && item.operatorBreakdown.length === 1) {
      const singleOp = item.operatorBreakdown[0];
      opText = `\n    ↳ 👤 *Operator:* ${singleOp.operator}${helperStr}\n    ↳ 📦 *ऑपरेटर द्वारा निकाले गए पीसेस (Operator Output):* ${formatOpOutput(singleOp)}\n    ↳ 🎯 *इस शिफ्ट का कुल आउटपुट (Total Shift Output):* ${outDetails}`;
    } else {
      opText = `\n    ↳ 👤 *Operator:* ${opStr}${helperStr}\n    ↳ 🎯 *इस शिफ्ट का कुल आउटपुट (Total Shift Output):* ${outDetails}`;
    }

    return `  • *${item.machine}:* ✅ *Shift Done*${jobStr}${opText}`;
  }

  return `  • *${item.machine}:* ⏸️ *Standby* (Ready for Allocation)`;
}

export function generateShiftChangeoverReportText(
  state: FactoryState,
  targetShift: 'DAY' | 'NIGHT',
  targetDate?: string
): string {
  const today = targetDate || new Date().toISOString().split('T')[0];
  const shiftTitle = targetShift === 'DAY' ? '☀️ DAY SHIFT' : '🌙 NIGHT SHIFT';

  // Real Machines from state master or defaults
  const slitMachines = state.machinesMaster?.['Slitting'] || MACHINES['Slitting'] || ['Slitting-1'];
  const cutMachines = state.machinesMaster?.['Cutting'] || MACHINES['Cutting'] || ['Cutting-1', 'Cutting-2'];
  const formMachines = state.machinesMaster?.['Forming'] || MACHINES['Forming'] || ['Forming-1', 'Forming-2', 'Forming-3', 'Forming-4', 'Forming-5', 'Forming-6', 'Forming-7'];
  const packMachines = state.machinesMaster?.['Packing'] || MACHINES['Packing'] || ['Packing-1', 'Packing-2'];

  const slitData = slitMachines.map(m => getMachineDailyData(state, m, 'Slitting', targetShift, today));
  const cutData = cutMachines.map(m => getMachineDailyData(state, m, 'Cutting', targetShift, today));
  const formData = formMachines.map(m => getMachineDailyData(state, m, 'Forming', targetShift, today));
  const packData = packMachines.map(m => getMachineDailyData(state, m, 'Packing', targetShift, today));

  // QC Inspection
  const qcLogs = (state.logs || []).filter((l) => {
    const isQc = l.stage === 'QC' || l.action?.toLowerCase().includes('qc') || l.details?.toLowerCase().includes('qc');
    const logDate = l.rawDate || l.date || l.timestamp;
    return isQc && isMatchingDate(logDate, today) && (!l.shift || l.shift.toUpperCase() === targetShift);
  });
  const qcInspectors = Array.from(new Set(qcLogs.map((l) => l.operator || l.worker).filter(Boolean)));
  const qcOkCrates = qcLogs.reduce((acc, l) => {
    const match = l.action?.match(/(\d+)\s*OK Crates/i) || l.action?.match(/Accepted:\s*(\d+)/i) || l.details?.match(/(\d+)\s*OK Crates/i) || l.details?.match(/Accepted:\s*(\d+)/i);
    return acc + (match ? parseInt(match[1], 10) : 0);
  }, 0);
  const qcScrapCrates = qcLogs.reduce((acc, l) => {
    const match = l.action?.match(/(\d+)\s*Scrap Crates/i) || l.action?.match(/Rejected:\s*(\d+)/i) || l.details?.match(/(\d+)\s*Scrap Crates/i) || l.details?.match(/Rejected:\s*(\d+)/i);
    return acc + (match ? parseInt(match[1], 10) : 0);
  }, 0);

  // Packing & Boxes
  const packedBoxes = packData.reduce((acc, p) => acc + p.producedQty, 0);

  // WIP Stock Balance
  const totalSlitRolls = state.jobs.reduce((a, b) => a + (b.availableRolls || 0), 0);
  const totalCutCrates = state.jobs.reduce((a, b) => a + (b.availableCuttingCrates || 0), 0);
  const totalFormedCrates = state.jobs.reduce((a, b) => a + (b.availableFormingCrates || 0), 0);
  const totalQcOkCrates = state.jobs.reduce((a, b) => a + (b.availableQcCrates || 0), 0);
  const openBreakdowns = (state.maintenanceIncidents || []).filter(
    (i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS'
  );

  // Workforce Attendance
  const floorWorkers = state.floorWorkers || [];
  const totalWorkersCount = floorWorkers.length;
  const presentWorkersCount = floorWorkers.filter((w) => w.isPresent || w.shiftStatus === 'PRESENT').length;

  // Build consolidated operator piece summary across all machines
  const allItems = [...slitData, ...cutData, ...formData, ...packData];
  const opSummaryMap: Record<string, { stage: string; machine: string; pieces: number; crates: number; unitLabel: string }> = {};
  allItems.forEach((item) => {
    (item.operatorBreakdown || []).forEach((ob) => {
      const key = `${ob.operator} (${item.machine})`;
      if (!opSummaryMap[key]) {
        opSummaryMap[key] = {
          stage: item.stage,
          machine: item.machine,
          pieces: ob.pieces,
          crates: ob.qty,
          unitLabel: item.unitLabel
        };
      } else {
        opSummaryMap[key].pieces += ob.pieces;
        opSummaryMap[key].crates += ob.qty;
      }
    });
  });

  const opSummaryLines = Object.entries(opSummaryMap).map(([opKey, data]) => {
    if (data.stage === 'Slitting') {
      const rollsStr = data.crates > 0 ? `*${data.crates} Rolls*` : `*0 Rolls* (स्प्लिटिंग प्रगति पर)`;
      return `  • 👤 ${opKey}: ${rollsStr}`;
    } else if (data.stage === 'Packing') {
      const boxesStr = data.crates > 0 ? `*${data.crates} Boxes* (~${data.pieces.toLocaleString()} Pieces)` : `*0 Boxes* (पैकिंग प्रगति पर)`;
      return `  • 👤 ${opKey}: ${boxesStr}`;
    } else {
      const pcsStr = data.pieces > 0 ? `*${data.pieces.toLocaleString()} Pieces*` : `*0 Pieces* (बैच प्रगति पर / Run In-Progress)`;
      const cratesStr = data.crates > 0 ? ` (${data.crates} ${data.unitLabel})` : '';
      return `  • 👤 ${opKey}: ${pcsStr}${cratesStr}`;
    }
  });

  return `🏭 *WÜNDERKRAF PAPERWARE ERP*
📋 *DAILY SHIFT CHANGEOVER REPORT*
━━━━━━━━━━━━━━━━━━━━
📅 *Date:* ${today}
⏱️ *Shift:* ${shiftTitle}
━━━━━━━━━━━━━━━━━━━━

⚙️ *ALL MACHINES & OPERATOR PERFORMANCE:*

📜 *1. SLITTING DESK:*
${slitData.map(formatMachineReportLine).join('\n')}

✂️ *2. CUTTING DESK:*
${cutData.map(formatMachineReportLine).join('\n')}

⚙️ *3. FORMING DESK (${formMachines.length} MACHINES):*
${formData.map(formatMachineReportLine).join('\n')}

🔍 *4. QC INSPECTION DESK:*
  • Inspector(s): ${qcInspectors.join(', ') || 'QC Lead'}
  • Checked: ${qcOkCrates > 0 ? `${qcOkCrates} OK Crates` : 'Inspections Logged'}
  • Scrap Rejected: ${qcScrapCrates} Crates

📦 *5. PACKING & DISPATCH:*
${packData.map(formatMachineReportLine).join('\n')}
  • Boxes Packed Today: ${packedBoxes > 0 ? `${packedBoxes} Boxes` : 'In Progress'}
  • Pending Dispatch Orders: ${state.packJobs.filter((o) => o.status !== 'Dispatched').length}

━━━━━━━━━━━━━━━━━━━━
👥 *OPERATOR-WISE SHIFT PRODUCTION (ऑपरेटर वाइज कुल पीसेस):*
${opSummaryLines.length > 0 ? opSummaryLines.join('\n') : '  • No operators logged production yet'}

━━━━━━━━━━━━━━━━━━━━
👥 *DAILY WORKFORCE ATTENDANCE:*
• Total Registered Employees: ${totalWorkersCount} Workers
• Present On Floor Today: *${presentWorkersCount} Workers Present* ✅
• On Leave/Absent: ${totalWorkersCount - presentWorkersCount} On Leave

━━━━━━━━━━━━━━━━━━━━
📊 *FACTORY FLOOR WIP STOCK BALANCE:*
• 📜 Slit Rolls: ${totalSlitRolls} Rolls
• ✂️ Cut Crates: ${totalCutCrates} Crates
• ⚙️ Formed Crates: ${totalFormedCrates} Crates
• 🔍 QC OK Crates: ${totalQcOkCrates} Crates

🛠️ *MAINTENANCE STATUS:*
${
  openBreakdowns.length === 0
    ? '✅ All Machines Operational (Zero Breakdowns)'
    : `⚠️ ${openBreakdowns.length} Machine(s) Under Maintenance:\n` +
      openBreakdowns.map((b) => `  • ${b.machine}: ${b.issue} (${b.priority || 'Normal'})`).join('\n')
}
━━━━━━━━━━━━━━━━━━━━
_Auto-generated by Wünderkraf Factory ERP_`;
}

export function generateMachineWiseDailyReportText(
  state: FactoryState,
  targetShift: 'DAY' | 'NIGHT' | 'ALL' = 'DAY',
  targetDate?: string
): string {
  const today = targetDate || new Date().toISOString().split('T')[0];
  const shiftTitle =
    targetShift === 'DAY'
      ? '☀️ DAY SHIFT'
      : targetShift === 'NIGHT'
      ? '🌙 NIGHT SHIFT'
      : '🔄 FULL DAY (ALL SHIFTS)';

  const slitMachines = state.machinesMaster?.['Slitting'] || MACHINES['Slitting'] || ['Slitting-1'];
  const cutMachines = state.machinesMaster?.['Cutting'] || MACHINES['Cutting'] || ['Cutting-1', 'Cutting-2'];
  const formMachines = state.machinesMaster?.['Forming'] || MACHINES['Forming'] || ['Forming-1', 'Forming-2', 'Forming-3', 'Forming-4', 'Forming-5', 'Forming-6', 'Forming-7'];
  const packMachines = state.machinesMaster?.['Packing'] || MACHINES['Packing'] || ['Packing-1', 'Packing-2'];

  const shiftFilter = targetShift === 'ALL' ? undefined : targetShift;
  const slitData = slitMachines.map(m => getMachineDailyData(state, m, 'Slitting', shiftFilter, today));
  const cutData = cutMachines.map(m => getMachineDailyData(state, m, 'Cutting', shiftFilter, today));
  const formData = formMachines.map(m => getMachineDailyData(state, m, 'Forming', shiftFilter, today));
  const packData = packMachines.map(m => getMachineDailyData(state, m, 'Packing', shiftFilter, today));

  const allItems = [...slitData, ...cutData, ...formData, ...packData];
  const runningCount = allItems.filter(i => i.status === 'Running').length;
  const standbyCount = allItems.filter(i => i.status === 'Standby').length;
  const heldCount = allItems.filter(i => i.status === 'Held').length;
  const breakdownCount = allItems.filter(i => i.status === 'Breakdown').length;
  const completedCount = allItems.filter(i => i.status === 'Completed').length;
  const utilizedCount = runningCount + completedCount;
  const utilizationPct = allItems.length > 0 ? Math.round((utilizedCount / allItems.length) * 100) : 0;

  // Aggregate totals
  const totalSlitRolls = slitData.reduce((acc, i) => acc + i.producedQty, 0);
  const totalSlitWeight = slitData.reduce((acc, i) => acc + (i.outputWeightKg || 0), 0);
  const totalCutCrates = cutData.reduce((acc, i) => acc + i.producedQty, 0);
  const totalCutPieces = cutData.reduce((acc, i) => acc + i.producedPieces, 0);
  const totalFormedCrates = formData.reduce((acc, i) => acc + i.producedQty, 0);
  const totalFormedPieces = formData.reduce((acc, i) => acc + i.producedPieces, 0);
  const totalPackedBoxes = packData.reduce((acc, i) => acc + i.producedQty, 0);
  const totalScrapKg = allItems.reduce((acc, i) => acc + i.scrapKg, 0);

  // Build operator summary list
  const opSummaryMap: Record<string, { stage: string; machine: string; pieces: number; crates: number; unitLabel: string }> = {};
  allItems.forEach((item) => {
    (item.operatorBreakdown || []).forEach((ob) => {
      const key = `${ob.operator} (${item.machine})`;
      if (!opSummaryMap[key]) {
        opSummaryMap[key] = {
          stage: item.stage,
          machine: item.machine,
          pieces: ob.pieces,
          crates: ob.qty,
          unitLabel: item.unitLabel
        };
      } else {
        opSummaryMap[key].pieces += ob.pieces;
        opSummaryMap[key].crates += ob.qty;
      }
    });
  });

  const opSummaryLines = Object.entries(opSummaryMap).map(([opKey, data]) => {
    if (data.stage === 'Slitting') {
      const rollsStr = data.crates > 0 ? `*${data.crates} Rolls*` : `*0 Rolls* (स्प्लिटिंग प्रगति पर)`;
      return `  • 👤 ${opKey}: ${rollsStr}`;
    } else if (data.stage === 'Packing') {
      const boxesStr = data.crates > 0 ? `*${data.crates} Boxes* (~${data.pieces.toLocaleString()} Pieces)` : `*0 Boxes* (पैकिंग प्रगति पर)`;
      return `  • 👤 ${opKey}: ${boxesStr}`;
    } else {
      const pcsStr = data.pieces > 0 ? `*${data.pieces.toLocaleString()} Pieces*` : `*0 Pieces* (बैच प्रगति पर / Run In-Progress)`;
      const cratesStr = data.crates > 0 ? ` (${data.crates} ${data.unitLabel})` : '';
      return `  • 👤 ${opKey}: ${pcsStr}${cratesStr}`;
    }
  });

  return `🏭 *WÜNDERKRAF PAPERWARE ERP*
⚙️ *MACHINE-WISE DAILY PRODUCTION REPORT*
━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 *Date:* ${today}
⏱️ *Shift:* ${shiftTitle}
━━━━━━━━━━━━━━━━━━━━━━━━━━

📜 *1. SLITTING SECTION (${slitMachines.length} Machine${slitMachines.length > 1 ? 's' : ''}):*
${slitData.map(formatMachineReportLine).join('\n')}

✂️ *2. CUTTING SECTION (${cutMachines.length} Machines):*
${cutData.map(formatMachineReportLine).join('\n')}

⚙️ *3. FORMING SECTION (${formMachines.length} Machines):*
${formData.map(formatMachineReportLine).join('\n')}

📦 *4. PACKING SECTION (${packMachines.length} Lines):*
${packData.map(formatMachineReportLine).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 *OPERATOR-WISE SHIFT PRODUCTION (ऑपरेटर वाइज कुल पीसेस):*
${opSummaryLines.length > 0 ? opSummaryLines.join('\n') : '  • No operators logged production yet'}

━━━━━━━━━━━━━━━━━━━━
📊 *SECTION-WISE PRODUCTION TOTALS:*
• 📜 Total Slit Rolls: *${totalSlitRolls} Rolls* ${totalSlitWeight > 0 ? `(${totalSlitWeight.toFixed(1)} KG)` : ''}
• ✂️ Total Cut Crates: *${totalCutCrates} Crates* (~${totalCutPieces.toLocaleString()} Flat Blanks)
• ⚙️ Total Formed Crates: *${totalFormedCrates} Crates* (~${totalFormedPieces.toLocaleString()} 3D Pieces)
• 📦 Total Packed Boxes: *${totalPackedBoxes} Boxes*
• ♻️ Total Factory Scrap: *${totalScrapKg.toFixed(1)} KG*

⚡ *MACHINE UTILIZATION SUMMARY:*
• 🟢 Running: *${runningCount} Units*
• ⏸️ Standby: *${standbyCount} Units*
• 🟡 On Hold: *${heldCount} Units*
• 🔴 Breakdown: *${breakdownCount} Units*
• 📈 Active Utilization: *${utilizationPct}%*
━━━━━━━━━━━━━━━━━━━━━━━━━━
_Auto-generated by Wünderkraf Factory ERP_`;
}

export function triggerWhatsAppShiftNotification(
  phone: string,
  text: string,
  webhookUrl?: string
) {
  // Send via Webhook if configured
  if (webhookUrl && webhookUrl.trim().startsWith('http')) {
    try {
      const url = webhookUrl.trim();
      const isGoogleScript = url.includes('script.google.com');
      fetch(url, {
        method: 'POST',
        mode: isGoogleScript ? 'no-cors' : 'cors',
        headers: isGoogleScript ? {} : { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.replace(/[^0-9+]/g, ''),
          message: text,
          timestamp: new Date().toISOString()
        })
      }).catch((e) => console.warn('[WhatsApp Webhook Error]', e));
    } catch (e) {
      console.warn('[WhatsApp Webhook Dispatch Failed]', e);
    }
  }

  // Open WhatsApp Web / App link
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(text);
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  if (typeof window !== 'undefined' && window.open) {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }
}

// =========================================================================
// 1. MAINTENANCE BREAKDOWN & MACHINE STOPPAGE ALERT
// =========================================================================
export function generateBreakdownAlertText(
  state: FactoryState,
  incident?: any
): string {
  const activeIncidents = (state.maintenanceIncidents || []).filter(
    (i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS'
  );
  const target = incident || activeIncidents[0];

  if (!target) {
    return `🏭 *WÜNDERKRAF FACTORY MAINTENANCE FLASH*
━━━━━━━━━━━━━━━━━━━━
✅ *STATUS: ALL SYSTEMS OPERATIONAL*
• Active Breakdowns: 0 Machines
• Production Line: Slitting, Cutting, Forming 100% Running
• Preventive Check: Normal
📅 *Timestamp:* ${new Date().toLocaleTimeString()}
━━━━━━━━━━━━━━━━━━━━
_Wünderkraf Paperware ERP Maintenance Desk_`;
  }

  return `🚨 *CRITICAL MAINTENANCE BREAKDOWN ALERT*
━━━━━━━━━━━━━━━━━━━━
⚙️ *Machine:* *${target.machine || 'Production Unit'}*
📍 *Stage / Area:* ${target.stage || 'Shop Floor'}
⚠️ *Priority:* *${(target.priority || 'CRITICAL').toUpperCase()}*
⏱️ *Reported At:* ${target.reportedAt || new Date().toLocaleTimeString()}
👤 *Reported By:* ${target.reportedBy || 'Shift Operator'}
━━━━━━━━━━━━━━━━━━━━
🛑 *ISSUE / SYMPTOM:*
${target.issue || target.reason || 'Unexpected Machine Stoppage'}

👨‍🔧 *ASSIGNED ACTION:*
• Lead Technician: *${target.assignedTech || 'Unassigned / Urgent'}*
• Current Status: ${target.status === 'OPEN' ? '🔴 OPEN (Awaiting Repair)' : '🟡 IN PROGRESS'}
• Action Needed: Immediate inspection and downtime minimization

━━━━━━━━━━━━━━━━━━━━
_Immediate Attention Required | Wünderkraf Factory ERP_`;
}

// =========================================================================
// 2. DAILY MANPOWER & ATTENDANCE REPORT
// =========================================================================
// =========================================================================
// 2. DAILY MANPOWER & ATTENDANCE REPORT
// =========================================================================
export function generateManpowerAttendanceReportText(state: FactoryState, targetDate?: string): string {
  const selectedDate = targetDate || new Date().toISOString().split('T')[0];
  const workers = state.floorWorkers || [];
  const total = workers.length;
  
  // Try to find historical log of attendance for selectedDate
  const historicalAttendanceLog = (state.logs || []).find(
    (l) => l.stage === 'Admin Master' && l.rawDate === selectedDate && l.action?.includes('Attendance Saved')
  );

  let presentCount = workers.filter((w) => w.isPresent || w.status !== 'INACTIVE').length;
  if (historicalAttendanceLog) {
    const presentMatch = historicalAttendanceLog.action.match(/(\d+)\s*Present/i);
    if (presentMatch) presentCount = parseInt(presentMatch[1], 10);
  }

  const absentCount = total - presentCount;
  const presentPct = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  // Dept distribution
  const deptCounts: Record<string, { total: number; present: number }> = {};
  workers.forEach((w) => {
    const d = w.department || 'Production';
    if (!deptCounts[d]) deptCounts[d] = { total: 0, present: 0 };
    deptCounts[d].total += 1;
    if (w.isPresent || w.status !== 'INACTIVE') deptCounts[d].present += 1;
  });

  const deptLines = Object.keys(deptCounts).map(
    (d) => `• ${d}: ${deptCounts[d].present}/${deptCounts[d].total} Present`
  );

  return `👥 *WÜNDERKRAF DAILY WORKFORCE ATTENDANCE*
━━━━━━━━━━━━━━━━━━━━
📅 *Date:* ${selectedDate}
🕒 *Shift Time:* Morning 08:00 AM Roll Call
━━━━━━━━━━━━━━━━━━━━
📊 *SUMMARY:*
• 🟢 Total Present: *${presentCount} Workers* (${presentPct}%)
• 🔴 Absent / On Leave: *${absentCount} Workers*
• 📋 Total Registered Roster: ${total} Staff

🏢 *DEPARTMENT STRENGTH:*
${deptLines.join('\n') || '• Slitting & Cutting: 100%\n• Forming & Packing: 100%'}

━━━━━━━━━━━━━━━━━━━━
_Auto-generated by Manpower & HR Desk | Wünderkraf ERP_`;
}

// =========================================================================
// 3. QUALITY (QC) DEFECT & REJECTION ALERT
// =========================================================================
export function generateQcDefectAlertText(
  state: FactoryState,
  detailsOrTimestamp?: any
): string {
  let machine = 'Forming M-04';
  let defect = 'Rim Distortion / Weak Seal';
  let rejected = 2;
  let product = 'Paper Spoon 140mm';
  let inspector = 'QC Lead';
  let dateStr = new Date().toISOString().split('T')[0];

  if (detailsOrTimestamp && typeof detailsOrTimestamp === 'object') {
    machine = detailsOrTimestamp.machine || machine;
    defect = detailsOrTimestamp.defect || defect;
    rejected = detailsOrTimestamp.rejectedQty || rejected;
    product = detailsOrTimestamp.product || product;
  } else if (detailsOrTimestamp && typeof detailsOrTimestamp === 'string') {
    // Search in state.logs for the log matching the timestamp
    const matchedLog = (state.logs || []).find((l) => l.timestamp === detailsOrTimestamp);
    if (matchedLog) {
      machine = matchedLog.machine || matchedLog.station || machine;
      product = matchedLog.product || 'Premium Eco Cultery';
      defect = matchedLog.details || matchedLog.action || defect;
      inspector = matchedLog.worker || matchedLog.operator || 'QC Desk';
      dateStr = matchedLog.rawDate || dateStr;

      // Extract rejected crates count from log details
      const countMatch = matchedLog.details?.match(/(\d+)\s*Crates/i) || matchedLog.action?.match(/(\d+)/);
      rejected = countMatch ? parseInt(countMatch[1], 10) : rejected;
    }
  }

  return `🔍 *QUALITY (QC) DEFECT & SCRAP NOTIFICATION*
━━━━━━━━━━━━━━━━━━━━
📍 *Inspection Station:* QC Desk #1
⚙️ *Machine / Line:* *${machine}*
📦 *Product:* ${product}
📅 *Date:* *${dateStr}*
━━━━━━━━━━━━━━━━━━━━
⚠️ *DEFECT DETAILS:*
• Defect Type: *${defect}*
• Rejected/Hold Qty: *${rejected} Crates*
• Batch Disposition: *HOLD & QUARANTINE* ⚠️
• Inspector: *${inspector}*

🛡️ *CORRECTIVE ACTION INITIATED:*
1. Machine operator notified for parameter correction
2. Preceding crates quarantined for 100% sort
3. Maintenance notified if mechanical adjustment needed

━━━━━━━━━━━━━━━━━━━━
_Wünderkraf Quality Assurance Desk_`;
}

// =========================================================================
// 4. DISPATCH & GATE PASS DELIVERY NOTE
// =========================================================================
export function generateDispatchDeliveryNoteText(
  state: FactoryState,
  job?: any
): string {
  const packJobs = state.packJobs || [];
  const latestDispatched = job || packJobs.find((j) => j.status === 'Dispatched') || packJobs[0];

  const clientName = latestDispatched?.customerName || latestDispatched?.client || latestDispatched?.customer || 'Premium Client';
  const invoiceNo = latestDispatched?.invoiceNo || latestDispatched?.dispatchId || `DC-${Date.now().toString().slice(-5)}`;
  const boxes = latestDispatched?.boxesCount || latestDispatched?.producedBoxes || latestDispatched?.dispatchedBoxes || 50;
  const product = latestDispatched?.product || latestDispatched?.packType || 'Eco Paper Cutlery Kit';

  return `🚚 *WÜNDERKRAF DISPATCH & SHIPMENT ALERT*
━━━━━━━━━━━━━━━━━━━━
📄 *Delivery Challan / Invoice:* *${invoiceNo}*
🏢 *Customer / Client:* *${clientName}*
📦 *Product:* ${product}
📦 *Dispatched Quantity:* *${boxes} Master Cartons*
━━━━━━━━━━━━━━━━━━━━
🚛 *LOGISTICS & VEHICLE:*
• Status: *DISPATCHED / OUT FOR DELIVERY* ✅
• Vehicle No: ${latestDispatched?.vehicleNo || 'MH-12-RN-4821'}
• Transporter: ${latestDispatched?.transporter || 'SafeExpress Logistics'}
• Gate Pass Stamp: Authorized & Loaded

━━━━━━━━━━━━━━━━━━━━
_Thank you for partnering with Wünderkraf Paperware!_`;
}

export function generateConsolidatedDispatchReportText(
  state: FactoryState,
  dateStr: string
): string {
  const packJobs = state.packJobs || [];
  const dispatches: Array<{
    customer: string;
    product: string;
    invoiceNo: string;
    gtNo: string;
    boxes: number;
    pcs: number;
  }> = [];

  packJobs.forEach((pj) => {
    (pj.dispatchLogs || []).forEach((log) => {
      if (log.date === dateStr) {
        dispatches.push({
          customer: pj.customer,
          product: pj.packType,
          invoiceNo: log.invoiceNo,
          gtNo: log.gtNo,
          boxes: log.boxes,
          pcs: log.pcs
        });
      }
    });
  });

  if (dispatches.length === 0) {
    return `🚚 *WÜNDERKRAF DISPATCH SUMMARY REPORT*
━━━━━━━━━━━━━━━━━━━━
📅 *Date:* ${dateStr}
━━━━━━━━━━━━━━━━━━━━
⚠️ *No dispatches found on this date.*
कृपया कोई अन्य तिथि चुनें या पहले डिस्पैच दर्ज करें।`;
  }

  const totalBoxes = dispatches.reduce((acc, d) => acc + d.boxes, 0);
  const totalPcs = dispatches.reduce((acc, d) => acc + d.pcs, 0);

  let text = `🚚 *WÜNDERKRAF CONSOLIDATED DISPATCH REPORT*
━━━━━━━━━━━━━━━━━━━━
📅 *Dispatch Date:* *${dateStr}*
📦 *Total Volume:* *${totalBoxes} Boxes* (${totalPcs.toLocaleString()} Pcs)
━━━━━━━━━━━━━━━━━━━━

📋 *DELIVERY BREAKDOWN:*
`;

  dispatches.forEach((d, idx) => {
    text += `\n*${idx + 1}. Customer:* *${d.customer}*
• 📦 Product: ${d.product}
• 📦 Qty: *${d.boxes} Boxes* (${d.pcs.toLocaleString()} Pcs)
• 📄 Bill/Invoice: *${d.invoiceNo}*
• 🚛 Vehicle No: *${d.gtNo}*
━━━━━━━━━━━━━━━━━━━━`;
  });

  text += `\n_Consolidated Warehouse Dispatch Note_`;
  return text;
}

export function generateDispatchByInvoiceText(
  state: FactoryState,
  invoiceNo: string
): string {
  const packJobs = state.packJobs || [];
  let matchedLog: any = null;
  let matchedJob: any = null;

  for (const pj of packJobs) {
    const foundLog = (pj.dispatchLogs || []).find((l) => l.invoiceNo === invoiceNo);
    if (foundLog) {
      matchedLog = foundLog;
      matchedJob = pj;
      break;
    }
  }

  if (!matchedLog) {
    return `🚚 *WÜNDERKRAF DISPATCH SHIPMENT ALERT*
━━━━━━━━━━━━━━━━━━━━
⚠️ *Invoice No. [${invoiceNo}] Not Found*
कृपया सही बिल नंबर चुनें।`;
  }

  return `🚚 *WÜNDERKRAF DISPATCH & SHIPMENT ALERT*
━━━━━━━━━━━━━━━━━━━━
📄 *Delivery Challan / Invoice:* *${matchedLog.invoiceNo}*
🏢 *Customer / Client:* *${matchedJob.customer}*
📦 *Product:* ${matchedJob.packType}
📦 *Dispatched Quantity:* *${matchedLog.boxes} Master Cartons* (${matchedLog.pcs.toLocaleString()} Pcs)
━━━━━━━━━━━━━━━━━━━━
🚛 *LOGISTICS & VEHICLE:*
• Status: *DISPATCHED / OUT FOR DELIVERY* ✅
• Vehicle / GT No: *${matchedLog.gtNo}*
• Dispatch Date: *${matchedLog.date}*
• Gate Pass Stamp: Authorized & Loaded

━━━━━━━━━━━━━━━━━━━━
_Thank you for partnering with Wünderkraf Paperware!_`;
}

// =========================================================================
// 5. MATERIAL REQUISITION & URGENT INDENT ALERT
// =========================================================================
export function generatePurchaseIndentAlertText(
  state: FactoryState,
  req?: any
): string {
  const reqs = state.materialRequisitions || [];
  const targetReq = req || reqs.find((r) => r.status === 'PENDING') || reqs[0];

  const reqId = targetReq?.id || `MR-${Date.now().toString().slice(-4)}`;
  const item = targetReq?.item || targetReq?.spareName || 'Forming Hydraulic Seal Ring';
  const qty = targetReq?.qty || 4;
  const dept = targetReq?.department || 'Maintenance';
  const urgency = targetReq?.urgency || 'CRITICAL_BREAKDOWN';

  return `🛒 *URGENT PURCHASE REQUISITION ALERT*
━━━━━━━━━━━━━━━━━━━━
📋 *Indent ID:* *${reqId}*
🏢 *Requesting Dept:* *${dept}*
⚡ *Urgency Level:* *${urgency}*
━━━━━━━━━━━━━━━━━━━━
📦 *MATERIAL REQUIRED:*
• Item: *${item}*
• Required Qty: *${qty} Units*
• Reason: Prevent machine downtime / Low buffer stock

⚠️ *PROCUREMENT ACTION:*
Purchase team please issue Purchase Order (PO) immediately.

━━━━━━━━━━━━━━━━━━━━
_Wünderkraf Factory Stores & Purchase Desk_`;
}

// =========================================================================
// 6. SCRAP & YIELD AUDIT FLASH
// =========================================================================
export function generateScrapYieldReportText(state: FactoryState, targetDate?: string): string {
  const selectedDate = targetDate || new Date().toISOString().split('T')[0];
  const logs = state.logs || [];
  
  const slittingScrap = logs
    .filter((l) => l.action?.toLowerCase().includes('slit') && (l.rawDate === selectedDate || l.timestamp?.startsWith(selectedDate)))
    .reduce((acc, l) => {
      const match = l.action?.match(/Scrap:\s*([\d.]+)\s*KG/i) || l.details?.match(/Scrap:\s*([\d.]+)\s*KG/i);
      return acc + (match ? parseFloat(match[1]) : 0);
    }, 0);

  const cuttingScrap = logs
    .filter((l) => l.action?.toLowerCase().includes('cut') && (l.rawDate === selectedDate || l.timestamp?.startsWith(selectedDate)))
    .reduce((acc, l) => {
      const match = l.action?.match(/Scrap:\s*([\d.]+)\s*KG/i) || l.details?.match(/Scrap:\s*([\d.]+)\s*KG/i);
      return acc + (match ? parseFloat(match[1]) : 0);
    }, 0);

  return `📊 *WÜNDERKRAF SCRAP & MATERIAL YIELD REPORT*
━━━━━━━━━━━━━━━━━━━━
📅 *Date:* ${selectedDate}
━━━━━━━━━━━━━━━━━━━━
♻️ *GENERATED SCRAP SUMMARY:*
• 📜 Slitting Edge Trims: *${slittingScrap.toFixed(1)} KG*
• ✂️ Cutting Web Wastage: *${cuttingScrap.toFixed(1)} KG*
• ⚙️ Total Daily Scrap: *${(slittingScrap + cuttingScrap).toFixed(1)} KG*

🎯 *BENCHMARK & EFFICIENCY:*
• Target Yield Threshold: 94.5%
• Current Floor Status: *WITHIN PERMISSIBLE LIMITS* ✅

━━━━━━━━━━━━━━━━━━━━
_Wünderkraf Scrap Management & Sustainability Audit_`;
}

// =========================================================================
// 7. JOB PRODUCTION PROGRESS & LIVE STATUS REPORT
// =========================================================================
export function generateJobStatusReportText(
  state: FactoryState,
  targetJobId?: string
): string {
  const jobs = state.jobs || [];
  const targetJob = targetJobId
    ? jobs.find((j) => j.id === targetJobId)
    : jobs.find((j) => j.status !== 'COMPLETED') || jobs[0];

  if (!targetJob) {
    return `📋 *WÜNDERKRAF JOB STATUS REPORT*\n━━━━━━━━━━━━━━━━━━━━\n⚠️ *Status:* No active production jobs in queue currently.\n━━━━━━━━━━━━━━━━━━━━\n_Plant Coordination Desk_`;
  }

  const statusEmojis: Record<string, string> = {
    PLANNING: '📝 PLANNING',
    SLITTING: '📜 SLITTING IN PROGRESS',
    READY_FOR_CUTTING: '✂️ READY FOR CUTTING',
    CUTTING: '✂️ CUTTING IN PROGRESS',
    READY_FOR_FORMING: '☕ READY FOR FORMING',
    FORMING: '⚙️ FORMING RUNNING',
    PENDING_QC: '🔍 PENDING QC INSPECTION',
    PACKING: '📦 PACKING & BATCHING',
    READY_FOR_DISPATCH: '🚚 READY FOR DISPATCH',
    COMPLETED: '✅ PRODUCTION COMPLETED',
    ON_HOLD: '⚠️ ON HOLD'
  };

  const statusDisplay = statusEmojis[targetJob.status || ''] || targetJob.status || targetJob.stage || 'ACTIVE';
  const runningBatches = targetJob.runningBatches || [];
  const activeOps = runningBatches.map((b) => `${b.machine} (${b.operator || 'Assigned'})`).join(', ');

  const totalCut = targetJob.totalCutPieces || 0;
  const totalFormed = targetJob.totalFormedPieces || 0;

  return `📋 *WÜNDERKRAF JOB PROGRESS & STATUS REPORT*
━━━━━━━━━━━━━━━━━━━━
🆔 *Job ID:* *${targetJob.id}*
📦 *Product:* *${targetJob.product || 'Paper Cutlery'}*
🏷️ *Paper Spec:* ${targetJob.gsm || 210} GSM ${targetJob.paperBrand ? `| ${targetJob.paperBrand}` : ''}
${totalFormed > 0 ? `🎯 *Formed Output:* *${totalFormed.toLocaleString()} Pcs*\n` : totalCut > 0 ? `🎯 *Cut Output:* *${totalCut.toLocaleString()} Pcs*\n` : ''}━━━━━━━━━━━━━━━━━━━━
📊 *CURRENT STAGE & WIP BALANCE:*
• Current Stage: *${statusDisplay}*
• Available Slit Rolls: *${targetJob.availableRolls || 0} Rolls*
• Cut WIP Crates: *${targetJob.availableCuttingCrates || 0} Crates*
• Formed Crates: *${targetJob.availableFormingCrates || 0} Crates*
• QC Approved Crates: *${targetJob.availableQcCrates || 0} Crates*
${activeOps ? `• Active Stations: *${activeOps}*\n` : ''}
⚡ *STATUS UPDATE:*
Job is progressing as per factory SOP. Real-time updates synchronized across all recording stations.

━━━━━━━━━━━━━━━━━━━━
_Wünderkraf Production Planning & Control (PPC)_`;
}

// =========================================================================
// 8. RELIABLE SERVER-PROXIED WHATSAPP DISPATCH
// =========================================================================
export async function dispatchWhatsAppNotificationViaServer(
  phone: string,
  message: string,
  webhookUrl?: string,
  category: string = 'GENERAL',
  sender: string = 'Wünderkraf ERP',
  apiKey?: string
): Promise<{ success: boolean; error?: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { success: false, error: 'Webhook URL not configured' };
  }

  try {
    // 1. Dispatch via server proxy endpoint to follow Google Apps Script 302 redirects and bypass CORS
    const res = await fetch('/api/whatsapp/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl,
        phone,
        message,
        category,
        sender,
        apiKey
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true };
    }
    throw new Error(data.error || 'Server proxy returned error');
  } catch (err: any) {
    console.warn('Server proxy failed, trying direct browser fallback:', err);
    // 2. Direct browser fallback
    try {
      const isGoogleScript = webhookUrl.includes('script.google.com');
      await fetch(webhookUrl, {
        method: 'POST',
        mode: isGoogleScript ? 'no-cors' : 'cors',
        headers: isGoogleScript ? {} : { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.replace(/[^0-9+]/g, ''),
          message,
          category,
          sender,
          timestamp: new Date().toISOString()
        })
      });
      return { success: true };
    } catch (fallbackErr: any) {
      return { success: false, error: fallbackErr.message };
    }
  }
}

// =========================================================================
// 9. AUTOMATED TWO-WAY QUERY BOT ENGINE ("मुझे इसका स्टॉक चाहिए")
// =========================================================================

/**
 * Generates an automated, structured live inventory reply formatted for WhatsApp
 * when a user asks for stock (all items or a specific cutlery product).
 */
export function generateWhatsAppStockQueryReply(
  state: FactoryState,
  queryText: string = ''
): string {
  const query = (queryText || '').toLowerCase().trim();
  const today = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const time = new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit'
  });

  const allProducts = state.products && state.products.length > 0
    ? state.products
    : ['Spoon', 'Fork', 'Knife', 'Dessert Spoon'];

  // Check if a specific product was mentioned (in English or Hindi)
  let matchedProduct: string | null = null;
  if (query.includes('spoon') || query.includes('चम्मच') || query.includes('स्पून') || query.includes('spn')) {
    matchedProduct = allProducts.find((p) => p.toLowerCase().includes('spoon') && !p.toLowerCase().includes('dessert')) || 'Spoon';
  } else if (query.includes('fork') || query.includes('कांटा') || query.includes('काटा') || query.includes('फोर्क') || query.includes('frk')) {
    matchedProduct = allProducts.find((p) => p.toLowerCase().includes('fork')) || 'Fork';
  } else if (query.includes('knife') || query.includes('चाकू') || query.includes('छुरी') || query.includes('नाइफ') || query.includes('knf')) {
    matchedProduct = allProducts.find((p) => p.toLowerCase().includes('knife')) || 'Knife';
  } else if (query.includes('dessert') || query.includes('मीठा') || query.includes('छोटा चम्मच') || query.includes('डेजर्ट')) {
    matchedProduct = allProducts.find((p) => p.toLowerCase().includes('dessert')) || 'Dessert Spoon';
  } else {
    matchedProduct = allProducts.find((p) => query.includes(p.toLowerCase())) || null;
  }

  const jobs = state.jobs || [];
  const packJobs = state.packJobs || [];
  const motherReels = state.motherReelInventory || [];
  const availableReels = motherReels.filter((r) => r.status === 'Available');
  const totalReelWeightKg = availableReels.reduce((sum, r) => sum + (Number(r.weightKg) || 0), 0);

  // If specific product matched: Return high-detail item WIP & finished report
  if (matchedProduct) {
    const isMainSpoon = matchedProduct.toLowerCase() === 'spoon';
    const pJobs = jobs.filter((j) => {
      const prod = (j.product || '').toLowerCase();
      if (isMainSpoon) return prod.includes('spoon') && !prod.includes('dessert');
      return prod.includes(matchedProduct!.toLowerCase());
    });
    const slitRolls = pJobs.reduce((s, j) => s + (Number(j.availableRolls) || 0), 0);
    const cutCrates = pJobs.reduce((s, j) => s + (Number(j.availableCuttingCrates) || 0), 0);
    const formCrates = pJobs.reduce((s, j) => s + (Number(j.availableFormingCrates) || 0), 0);
    const qcCrates = pJobs.reduce((s, j) => s + (Number(j.availableQcCrates) || 0), 0);

    const pPacks = packJobs.filter((pj) => {
      const pProd = (pj.kitType || (pj as any).product || '').toLowerCase();
      if (isMainSpoon) return (pProd.includes('spoon') && !pProd.includes('dessert')) || (pj.kitItems && pj.kitItems.includes('Spoon'));
      return pProd.includes(matchedProduct!.toLowerCase()) || (pj.kitItems && pj.kitItems.includes(matchedProduct!));
    });
    const packedBoxes = pPacks.reduce(
      (s, pj) => s + Math.max(0, (Number(pj.packedBoxes) || 0) - (Number(pj.dispatchedBoxes) || 0)),
      0
    );

    const pcsPerCrate = matchedProduct === 'Fork' ? 6500 : matchedProduct === 'Knife' ? 7500 : 7000;
    const estFormedPieces = formCrates * pcsPerCrate;

    return `🏭 *WÜNDERKRAF LIVE STOCK REPORT*
📦 *Product:* *${matchedProduct.toUpperCase()} (चम्मच / स्पून)*
📅 *Audit Date:* ${today} | ⏱️ *Time:* ${time}
━━━━━━━━━━━━━━━━━━━━
📊 *LIVE FLOOR WIP & PACKED STOCK:*
• 📜 Stage 1 (Slit Rolls): *${slitRolls.toLocaleString()} Rolls*
• ✂️ Stage 2 (Cut WIP Crates): *${cutCrates.toLocaleString()} Crates*
• ⚙️ Stage 3 (Formed Crates): *${formCrates.toLocaleString()} Crates* (~${estFormedPieces.toLocaleString()} Pcs)
• 🔍 Stage 4 (QC Approved): *${qcCrates.toLocaleString()} Crates*
• 📦 Stage 5 (Ready Packed): *${packedBoxes.toLocaleString()} Master Boxes*

⚡ *FLOOR STATUS:*
Active production jobs running on forming & slitting lines. Stock updated in real-time.

💡 *Next Actions (WhatsApp Commands):*
• Type *ALL STOCK* for full plant inventory
• Type *REPORT* for today's shift handover
• Type *HELP* for command options
━━━━━━━━━━━━━━━━━━━━
_Wünderkraf Paperware ERP Central System_`;
  }

  // Entire Factory Aggregate Stock Matrix
  const totalSlitRolls = jobs.reduce((s, j) => s + (Number(j.availableRolls) || 0), 0);
  const totalCutCrates = jobs.reduce((s, j) => s + (Number(j.availableCuttingCrates) || 0), 0);
  const totalFormedCrates = jobs.reduce((s, j) => s + (Number(j.availableFormingCrates) || 0), 0);
  const totalQcCrates = jobs.reduce((s, j) => s + (Number(j.availableQcCrates) || 0), 0);
  const totalPackedBoxes = packJobs.reduce(
    (s, pj) => s + Math.max(0, (Number(pj.packedBoxes) || 0) - (Number(pj.dispatchedBoxes) || 0)),
    0
  );

  const productBreakdownLines = allProducts.map((prod) => {
    const pJobs = jobs.filter((j) => j.product?.toLowerCase() === prod.toLowerCase());
    const pForm = pJobs.reduce((s, j) => s + (Number(j.availableFormingCrates) || 0), 0);
    const pQc = pJobs.reduce((s, j) => s + (Number(j.availableQcCrates) || 0), 0);
    const pPacks = packJobs.filter(
      (pj) => pj.kitType === prod || (pj.kitItems && pj.kitItems.includes(prod))
    );
    const pBoxes = pPacks.reduce(
      (s, pj) => s + Math.max(0, (Number(pj.packedBoxes) || 0) - (Number(pj.dispatchedBoxes) || 0)),
      0
    );
    return `• *${prod}:* Formed: ${pForm} Crates | QC OK: ${pQc} | Packed: *${pBoxes} Boxes*`;
  }).join('\n');

  return `🏭 *WÜNDERKRAF PAPERWARE ERP*
📋 *REAL-TIME FACTORY STOCK AUDIT*
📅 *Audit Date:* ${today} | ⏱️ ${time}
━━━━━━━━━━━━━━━━━━━━
📜 *RAW MATERIAL (PAPER MOTHER REELS):*
• Available Reels in Store: *${availableReels.length} Reels*
• Total Paper Weight: *${totalReelWeightKg > 0 ? `${totalReelWeightKg.toLocaleString()} KG` : 'Allocated / Normal'}*

📊 *TOTAL FACTORY WIP STAGE BALANCES:*
• 📜 Slit Rolls (Stage 1): *${totalSlitRolls.toLocaleString()} Rolls*
• ✂️ Cut Blank Crates (Stage 2): *${totalCutCrates.toLocaleString()} Crates*
• ⚙️ Formed Crates (Stage 3): *${totalFormedCrates.toLocaleString()} Crates*
• 🔍 QC Approved Crates (Stage 4): *${totalQcCrates.toLocaleString()} Crates*
• 📦 Ready Finished Packed (Stage 5): *${totalPackedBoxes.toLocaleString()} Boxes*

📦 *PRODUCT-WISE READY STOCK:*
${productBreakdownLines}

━━━━━━━━━━━━━━━━━━━━
💡 *QUICK COMMANDS (WhatsApp में भेजें):*
• *SPOON* or *चम्मच* - चम्मच का स्टॉक
• *FORK* or *कांटा* - कांटे का स्टॉक
• *REPORT* or *रिपोर्ट* - दैनिक शिफ्ट रिपोर्ट
• *JOB* or *जॉब* - रनिंग जॉब्स का स्टेटस
• *BREAKDOWN* or *मशीन* - मशीन स्टॉपेज अलर्ट
• *HELP* or *मदद* - सभी कमांड्स की लिस्ट
━━━━━━━━━━━━━━━━━━━━
_Wünderkraf Central Inventory Bridge (Auto-Generated)_`;
}

/**
 * Intelligent incoming WhatsApp command processor.
 * Routes user queries (English/Hindi) to the proper ERP reply.
 */
export function processWhatsAppIncomingQuery(
  state: FactoryState,
  incomingMessage: string
): { reply: string; category: string; matchedKeyword: string } {
  const clean = (incomingMessage || '').toLowerCase().trim();

  // 1. Stock Queries ("मुझे इसका स्टॉक चाहिए", "स्पून", "stock", "स्टॉक", "inventory", "maal", "balance", etc.)
  if (
    clean.includes('stock') ||
    clean.includes('स्टॉक') ||
    clean.includes('माल') ||
    clean.includes('inventory') ||
    clean.includes('balance') ||
    clean.includes('kitna') ||
    clean.includes('कितना') ||
    clean.includes('spoon') ||
    clean.includes('स्पून') ||
    clean.includes('चम्मच') ||
    clean.includes('fork') ||
    clean.includes('फोर्क') ||
    clean.includes('कांटा') ||
    clean.includes('knife') ||
    clean.includes('नाइफ') ||
    clean.includes('चाकू') ||
    clean.includes('छुरी') ||
    clean.includes('dessert') ||
    clean.includes('डेजर्ट') ||
    clean.includes('reels') ||
    clean.includes('boxes')
  ) {
    return {
      reply: generateWhatsAppStockQueryReply(state, clean),
      category: 'STOCK_QUERY',
      matchedKeyword: 'stock'
    };
  }

  // 2. Day Shift Report ("report", "रिपोर्ट", "shift", "day", "डे रिपोर्ट")
  if (
    clean.includes('shift') ||
    clean.includes('report') ||
    clean.includes('रिपोर्ट') ||
    clean.includes('day') ||
    clean.includes('दिन')
  ) {
    return {
      reply: generateShiftChangeoverReportText(state, 'DAY'),
      category: 'SHIFT_REPORT',
      matchedKeyword: 'report'
    };
  }

  // 3. Night Shift Report
  if (clean.includes('night') || clean.includes('नाइट') || clean.includes('रात')) {
    return {
      reply: generateShiftChangeoverReportText(state, 'NIGHT'),
      category: 'SHIFT_REPORT',
      matchedKeyword: 'night'
    };
  }

  // 4. Job Production Status ("job", "जॉब", "order", "ऑर्डर", "status", "stage")
  if (
    clean.includes('job') ||
    clean.includes('जॉब') ||
    clean.includes('order') ||
    clean.includes('ऑर्डर') ||
    clean.includes('status') ||
    clean.includes('प्रोग्रेस')
  ) {
    return {
      reply: generateJobStatusReportText(state),
      category: 'JOB_STATUS',
      matchedKeyword: 'job'
    };
  }

  // 5. Machine Breakdown ("breakdown", "ब्रेकडाउन", "machine", "मशीन", "repair", "stoppage", "खराब")
  if (
    clean.includes('breakdown') ||
    clean.includes('ब्रेकडाउन') ||
    clean.includes('machine') ||
    clean.includes('मशीन') ||
    clean.includes('stoppage') ||
    clean.includes('खराब') ||
    clean.includes('band')
  ) {
    return {
      reply: generateBreakdownAlertText(state),
      category: 'MAINTENANCE_ALERT',
      matchedKeyword: 'breakdown'
    };
  }

  // 6. Manpower / Attendance ("attendance", "हाजिरी", "manpower", "worker", "कर्मचारी")
  if (
    clean.includes('attendance') ||
    clean.includes('हाजिरी') ||
    clean.includes('manpower') ||
    clean.includes('worker') ||
    clean.includes('वर्कर') ||
    clean.includes('staff')
  ) {
    return {
      reply: generateManpowerAttendanceReportText(state),
      category: 'MANPOWER_ATTENDANCE',
      matchedKeyword: 'attendance'
    };
  }

  // 7. Help & Command Guide ("help", "मदद", "menu", "कमांड", "hi", "hello", "नमस्ते")
  return {
    reply: `👋 *नमस्ते! WÜNDERKRAF ERP WHATSAPP ASSISTANT*
━━━━━━━━━━━━━━━━━━━━
आप मुझे नीचे दिए गए किसी भी शब्द को भेजकर तुरंत लाइव रिपोर्ट पा सकते हैं:

📦 *1. स्टॉक रिपोर्ट:*
• टाइप करें: *STOCK* या *स्टॉक*
• उत्पाद अनुसार: *SPOON* (चम्मच), *FORK* (कांटा), *KNIFE* (चाकू)

📋 *2. फैक्ट्री रिपोर्ट्स:*
• *REPORT* - दैनिक शिफ्ट चेंजओवर रिपोर्ट
• *NIGHT* - नाइट शिफ्ट रिपोर्ट
• *JOB* - रनिंग प्रोडक्शन जॉब्स का लाइव स्टेटस
• *MACHINE* - मशीन ब्रेकडाउन व मेंटेनेंस अलर्ट
• *STAFF* - दैनिक अटेंडेंस व रोल कॉल

━━━━━━━━━━━━━━━━━━━━
🔒 _एंटी-बैन सुरक्षित: सभी रिप्लाई केवल आपके मैसेज करने पर ही भेजे जाते हैं।_
_Wünderkraf Paperware ERP System_`,
    category: 'HELP_MENU',
    matchedKeyword: 'help'
  };
}


