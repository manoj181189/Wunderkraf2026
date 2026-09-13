import { FactoryState, LogEntry } from '../types';

export interface NormalizedProductionEvent {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  machine: string;
  operator: string;
  stage: string;
  product: string;
  shift: 'DAY' | 'NIGHT' | string;
  crates: number;
  pieces: number;
  scrapKg: number;
  scrapPieces: number;
  action: string;
  jobId?: string;
}

export type TimeRangeOption =
  | 'TODAY'
  | '5_DAYS'
  | '8_DAYS'
  | '7_DAYS'
  | '15_DAYS'
  | '30_DAYS'
  | '90_DAYS'
  | '180_DAYS'
  | 'ALL'
  | 'CUSTOM';

export function parseAllProductionEvents(state: FactoryState): NormalizedProductionEvent[] {
  const events: NormalizedProductionEvent[] = [];
  const seenEventKeys = new Set<string>();

  const logs: LogEntry[] = state.logs || [];

  // 1. Parse from logs
  logs.forEach((log, index) => {
    if (!log.action) return;
    if (log.machine === 'ADMIN' || log.machine === 'MKT-ENTRY' || log.machine === 'RECYCLING-BAY') return;

    // Determine stage
    const stage = log.stage || 'General';
    const machine = log.machine || 'General';
    const operator = log.worker || log.user || 'Unknown';
    const product = log.product || 'Disposable Cutlery';
    const date = log.rawDate || (log.timestamp ? extractDateFromTimestamp(log.timestamp) : new Date().toISOString().split('T')[0]);
    const shift = log.shift || 'DAY';
    const action = log.action;

    let crates = 0;
    let pieces = 0;
    let scrapKg = 0;
    let scrapPieces = 0;

    // Parse crates / rolls / boxes
    const matchCrates = action.match(/(\d+(?:\.\d+)?)\s*(?:Cut\s*|Formed\s*|QC\s*)?Crates/i);
    if (matchCrates) {
      crates = parseFloat(matchCrates[1]) || 0;
    } else {
      const matchRolls = action.match(/(\d+)\s*Rolls/i);
      if (matchRolls) {
        crates = parseFloat(matchRolls[1]) || 0;
      } else {
        const matchBoxes = action.match(/(\d+)\s*Boxes/i);
        if (matchBoxes) crates = parseFloat(matchBoxes[1]) || 0;
      }
    }

    // Parse pieces
    const matchExplicitPieces = action.match(/=\s*([0-9,]+)\s*(?:Flat Blanks|3D Pieces|Finished Pieces|Pieces)/i) ||
      action.match(/([0-9,]+)\s*(?:Flat Blanks|3D Pieces|Finished Pieces|Pieces)/i);
    if (matchExplicitPieces) {
      pieces = parseInt(matchExplicitPieces[1].replace(/,/g, ''), 10) || 0;
    } else {
      // Standard conversion if not explicitly written
      if (stage === 'Cutting' && crates > 0) pieces = Math.round(crates * 10000);
      else if (stage === 'Forming' && crates > 0) pieces = Math.round(crates * 5000);
      else if (stage === 'QC' && crates > 0) pieces = Math.round(crates * 5000);
      else if (stage === 'Packing' && crates > 0) pieces = Math.round(crates * 100);
      else if (stage === 'Slitting' && crates > 0) pieces = Math.round(crates * 15); // rolls
    }

    // Parse scrap kg
    const matchScrapKg = action.match(/Scrap:\s*([0-9.]+)\s*KG/i) || action.match(/(\d+(?:\.\d+)?)\s*KG\s*Scrap/i);
    if (matchScrapKg) {
      scrapKg = parseFloat(matchScrapKg[1]) || 0;
    }

    // Parse scrap pieces / defects
    const matchDefects = action.match(/(?:Defect Pieces|Defects|Scrap Pcs|Defect):\s*([0-9]+)/i);
    if (matchDefects) {
      scrapPieces = parseInt(matchDefects[1], 10) || 0;
    }

    const key = `${date}_${machine}_${operator}_${stage}_${pieces}_${crates}_${index}`;
    if (!seenEventKeys.has(key)) {
      seenEventKeys.add(key);
      events.push({
        id: `evt-log-${index}`,
        date,
        timestamp: log.timestamp || `${date} ${log.startTime || ''}`,
        machine,
        operator,
        stage,
        product,
        shift,
        crates,
        pieces,
        scrapKg,
        scrapPieces,
        action,
        jobId: log.jobId
      });
    }
  });

  // 2. Also check slices from running batches in jobs to capture realtime split runs
  (state.jobs || []).forEach((job) => {
    (job.runningBatches || []).forEach((batch) => {
      (batch.slices || []).forEach((slice, sIdx) => {
        if (!slice.producedQty && !slice.producedPieces) return;
        const date = slice.handoverTime ? extractDateFromTimestamp(slice.handoverTime) : new Date().toISOString().split('T')[0];
        const machine = batch.machine;
        const operator = slice.operator || batch.worker || 'Unknown';
        const stage = batch.stage;
        const shift = slice.shift || batch.shift || 'DAY';
        const crates = slice.producedQty || 0;
        const pieces = slice.producedPieces || (stage === 'Cutting' ? crates * 10000 : crates * 5000);
        const scrapKg = stage === 'Cutting' ? (slice.scrapQty || 0) : 0;
        const scrapPieces = stage === 'Forming' ? (slice.scrapQty || 0) : 0;

        const key = `slice_${batch.batchId}_${slice.sliceId || sIdx}_${operator}_${date}`;
        if (!seenEventKeys.has(key)) {
          seenEventKeys.add(key);
          events.push({
            id: `evt-slice-${slice.sliceId || sIdx}`,
            date,
            timestamp: slice.handoverTime || date,
            machine,
            operator,
            stage,
            product: job.product,
            shift,
            crates,
            pieces,
            scrapKg,
            scrapPieces,
            action: `Shift Slice Handover: ${crates} Crates (${pieces.toLocaleString()} Pcs), Scrap: ${slice.scrapQty || 0}`,
            jobId: job.id
          });
        }
      });
    });
  });

  // Sort descending by date
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

function extractDateFromTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // fallback
  }
  const match = ts.match(/(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  return new Date().toISOString().split('T')[0];
}

export function filterEventsByDate(
  events: NormalizedProductionEvent[],
  range: TimeRangeOption,
  customStart?: string,
  customEnd?: string
): NormalizedProductionEvent[] {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  return events.filter((ev) => {
    if (!ev.date) return true;
    if (range === 'ALL') return true;
    if (range === 'TODAY') return ev.date === todayStr;

    if (range === 'CUSTOM') {
      if (customStart && ev.date < customStart) return false;
      if (customEnd && ev.date > customEnd) return false;
      return true;
    }

    const evDate = new Date(ev.date);
    if (isNaN(evDate.getTime())) return true;
    const diffMs = now.getTime() - evDate.getTime();
    const diffDays = diffMs / (1000 * 3600 * 24);

    if (range === '5_DAYS') return diffDays <= 5;
    if (range === '7_DAYS') return diffDays <= 7;
    if (range === '8_DAYS') return diffDays <= 8;
    if (range === '15_DAYS') return diffDays <= 15;
    if (range === '30_DAYS') return diffDays <= 30;
    if (range === '90_DAYS') return diffDays <= 90;
    if (range === '180_DAYS') return diffDays <= 180;

    return true;
  });
}

export interface AggregatedMachineStats {
  machineName: string;
  totalPieces: number;
  totalCrates: number;
  totalScrapKg: number;
  totalScrapPieces: number;
  batchCount: number;
  yieldPercent: number;
  operators: string[];
  stages: string[];
  dailyTimeline: {
    date: string;
    pieces: number;
    crates: number;
    scrapKg: number;
    scrapPieces: number;
    batches: number;
    operators: string[];
  }[];
  operatorContribution: {
    operator: string;
    pieces: number;
    crates: number;
    scrapKg: number;
    runs: number;
    sharePercent: number;
  }[];
  events: NormalizedProductionEvent[];
}

export function aggregateMachineStats(
  events: NormalizedProductionEvent[],
  selectedMachine: string // 'ALL' or machine name
): AggregatedMachineStats {
  const filtered = selectedMachine === 'ALL'
    ? events
    : events.filter((e) => e.machine.toLowerCase() === selectedMachine.toLowerCase());

  let totalPieces = 0;
  let totalCrates = 0;
  let totalScrapKg = 0;
  let totalScrapPieces = 0;
  const operatorSet = new Set<string>();
  const stageSet = new Set<string>();

  const dailyMap: Record<string, {
    date: string;
    pieces: number;
    crates: number;
    scrapKg: number;
    scrapPieces: number;
    batches: number;
    operators: Set<string>;
  }> = {};

  const opMap: Record<string, {
    operator: string;
    pieces: number;
    crates: number;
    scrapKg: number;
    runs: number;
  }> = {};

  filtered.forEach((ev) => {
    totalPieces += ev.pieces || 0;
    totalCrates += ev.crates || 0;
    totalScrapKg += ev.scrapKg || 0;
    totalScrapPieces += ev.scrapPieces || 0;

    if (ev.operator) operatorSet.add(ev.operator);
    if (ev.stage) stageSet.add(ev.stage);

    // Daily map
    if (!dailyMap[ev.date]) {
      dailyMap[ev.date] = {
        date: ev.date,
        pieces: 0,
        crates: 0,
        scrapKg: 0,
        scrapPieces: 0,
        batches: 0,
        operators: new Set()
      };
    }
    dailyMap[ev.date].pieces += ev.pieces || 0;
    dailyMap[ev.date].crates += ev.crates || 0;
    dailyMap[ev.date].scrapKg += ev.scrapKg || 0;
    dailyMap[ev.date].scrapPieces += ev.scrapPieces || 0;
    dailyMap[ev.date].batches += 1;
    if (ev.operator) dailyMap[ev.date].operators.add(ev.operator);

    // Operator map
    const op = ev.operator || 'Unknown';
    if (!opMap[op]) {
      opMap[op] = { operator: op, pieces: 0, crates: 0, scrapKg: 0, runs: 0 };
    }
    opMap[op].pieces += ev.pieces || 0;
    opMap[op].crates += ev.crates || 0;
    opMap[op].scrapKg += ev.scrapKg || 0;
    opMap[op].runs += 1;
  });

  const dailyTimeline = Object.values(dailyMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      operators: Array.from(d.operators)
    }));

  const operatorContribution = Object.values(opMap)
    .map((o) => ({
      ...o,
      sharePercent: totalPieces > 0 ? Math.round((o.pieces / totalPieces) * 100) : 0
    }))
    .sort((a, b) => b.pieces - a.pieces);

  const totalPossible = totalPieces + totalScrapPieces;
  const yieldPercent = totalPossible > 0
    ? Math.round((totalPieces / totalPossible) * 1000) / 10
    : 100;

  return {
    machineName: selectedMachine === 'ALL' ? 'All Factory Machines' : selectedMachine,
    totalPieces,
    totalCrates: Math.round(totalCrates * 10) / 10,
    totalScrapKg: Math.round(totalScrapKg * 10) / 10,
    totalScrapPieces,
    batchCount: filtered.length,
    yieldPercent,
    operators: Array.from(operatorSet),
    stages: Array.from(stageSet),
    dailyTimeline,
    operatorContribution,
    events: filtered
  };
}

export interface AggregatedOperatorStats {
  operatorName: string;
  totalPieces: number;
  totalCrates: number;
  totalScrapKg: number;
  totalScrapPieces: number;
  runCount: number;
  avgPiecesPerRun: number;
  scrapRatePercent: number;
  shifts: {
    dayRuns: number;
    nightRuns: number;
  };
  machinesOperated: string[];
  stages: string[];
  machineBreakdown: {
    machine: string;
    pieces: number;
    crates: number;
    scrapKg: number;
    runs: number;
  }[];
  dailyTimeline: {
    date: string;
    pieces: number;
    crates: number;
    scrapKg: number;
    scrapPieces: number;
    runs: number;
  }[];
  events: NormalizedProductionEvent[];
}

export function aggregateOperatorStats(
  events: NormalizedProductionEvent[],
  selectedOperator: string // 'ALL' or operator name
): AggregatedOperatorStats {
  const filtered = selectedOperator === 'ALL'
    ? events
    : events.filter((e) => e.operator.toLowerCase() === selectedOperator.toLowerCase());

  let totalPieces = 0;
  let totalCrates = 0;
  let totalScrapKg = 0;
  let totalScrapPieces = 0;
  let dayRuns = 0;
  let nightRuns = 0;
  const machineSet = new Set<string>();
  const stageSet = new Set<string>();

  const dailyMap: Record<string, {
    date: string;
    pieces: number;
    crates: number;
    scrapKg: number;
    scrapPieces: number;
    runs: number;
  }> = {};

  const machMap: Record<string, {
    machine: string;
    pieces: number;
    crates: number;
    scrapKg: number;
    runs: number;
  }> = {};

  filtered.forEach((ev) => {
    totalPieces += ev.pieces || 0;
    totalCrates += ev.crates || 0;
    totalScrapKg += ev.scrapKg || 0;
    totalScrapPieces += ev.scrapPieces || 0;

    if (ev.shift === 'NIGHT') nightRuns += 1;
    else dayRuns += 1;

    if (ev.machine) machineSet.add(ev.machine);
    if (ev.stage) stageSet.add(ev.stage);

    // Daily map
    if (!dailyMap[ev.date]) {
      dailyMap[ev.date] = {
        date: ev.date,
        pieces: 0,
        crates: 0,
        scrapKg: 0,
        scrapPieces: 0,
        runs: 0
      };
    }
    dailyMap[ev.date].pieces += ev.pieces || 0;
    dailyMap[ev.date].crates += ev.crates || 0;
    dailyMap[ev.date].scrapKg += ev.scrapKg || 0;
    dailyMap[ev.date].scrapPieces += ev.scrapPieces || 0;
    dailyMap[ev.date].runs += 1;

    // Machine map
    const m = ev.machine || 'General';
    if (!machMap[m]) {
      machMap[m] = { machine: m, pieces: 0, crates: 0, scrapKg: 0, runs: 0 };
    }
    machMap[m].pieces += ev.pieces || 0;
    machMap[m].crates += ev.crates || 0;
    machMap[m].scrapKg += ev.scrapKg || 0;
    machMap[m].runs += 1;
  });

  const dailyTimeline = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  const machineBreakdown = Object.values(machMap).sort((a, b) => b.pieces - a.pieces);

  const totalHandled = totalPieces + totalScrapPieces;
  const scrapRatePercent = totalHandled > 0
    ? Math.round((totalScrapPieces / totalHandled) * 1000) / 10
    : 0;

  const avgPiecesPerRun = filtered.length > 0 ? Math.round(totalPieces / filtered.length) : 0;

  return {
    operatorName: selectedOperator === 'ALL' ? 'All Operators' : selectedOperator,
    totalPieces,
    totalCrates: Math.round(totalCrates * 10) / 10,
    totalScrapKg: Math.round(totalScrapKg * 10) / 10,
    totalScrapPieces,
    runCount: filtered.length,
    avgPiecesPerRun,
    scrapRatePercent,
    shifts: { dayRuns, nightRuns },
    machinesOperated: Array.from(machineSet),
    stages: Array.from(stageSet),
    machineBreakdown,
    dailyTimeline,
    events: filtered
  };
}

export interface OperatorLeaderboardItem {
  rank: number;
  operator: string;
  department: string;
  totalPieces: number;
  totalCrates: number;
  totalScrapKg: number;
  totalScrapPieces: number;
  runCount: number;
  avgPiecesPerRun: number;
  scrapRatePercent: number;
  efficiencyScore: number;
}

export function generateOperatorLeaderboard(
  events: NormalizedProductionEvent[]
): OperatorLeaderboardItem[] {
  const opMap: Record<string, {
    operator: string;
    stages: Set<string>;
    totalPieces: number;
    totalCrates: number;
    totalScrapKg: number;
    totalScrapPieces: number;
    runCount: number;
  }> = {};

  events.forEach((ev) => {
    const op = ev.operator || 'Unknown';
    if (!opMap[op]) {
      opMap[op] = {
        operator: op,
        stages: new Set(),
        totalPieces: 0,
        totalCrates: 0,
        totalScrapKg: 0,
        totalScrapPieces: 0,
        runCount: 0
      };
    }
    opMap[op].totalPieces += ev.pieces || 0;
    opMap[op].totalCrates += ev.crates || 0;
    opMap[op].totalScrapKg += ev.scrapKg || 0;
    opMap[op].totalScrapPieces += ev.scrapPieces || 0;
    opMap[op].runCount += 1;
    if (ev.stage) opMap[op].stages.add(ev.stage);
  });

  const list = Object.values(opMap).map((item) => {
    const totalHandled = item.totalPieces + item.totalScrapPieces;
    const scrapRate = totalHandled > 0 ? (item.totalScrapPieces / totalHandled) * 100 : 0;
    const efficiency = Math.max(70, Math.min(100, Math.round(100 - scrapRate * 3)));
    return {
      rank: 0,
      operator: item.operator,
      department: Array.from(item.stages).join(', ') || 'Floor Operations',
      totalPieces: item.totalPieces,
      totalCrates: Math.round(item.totalCrates * 10) / 10,
      totalScrapKg: Math.round(item.totalScrapKg * 10) / 10,
      totalScrapPieces: item.totalScrapPieces,
      runCount: item.runCount,
      avgPiecesPerRun: item.runCount > 0 ? Math.round(item.totalPieces / item.runCount) : 0,
      scrapRatePercent: Math.round(scrapRate * 10) / 10,
      efficiencyScore: efficiency
    };
  });

  // Sort descending by total pieces
  list.sort((a, b) => b.totalPieces - a.totalPieces);

  return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
}
