import { FactoryState, FloorWorker, WorkforceRole } from '../types';

export function autoRegisterWorker(
  state: FactoryState,
  workerName: string,
  department: string,
  machine: string,
  shift: 'DAY' | 'NIGHT'
): { floorWorkers: FloorWorker[]; deptWorkers: Record<string, string[]> } {
  if (!workerName || !workerName.trim()) {
    return { floorWorkers: state.floorWorkers || [], deptWorkers: state.deptWorkers || {} };
  }

  const cleanName = workerName.trim().toUpperCase();
  let updatedFloorWorkers = [...(state.floorWorkers || [])];
  let updatedDeptWorkers = { ...(state.deptWorkers || {}) };
  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const existingIndex = updatedFloorWorkers.findIndex(
    (w) => w.name.toUpperCase() === cleanName
  );

  if (existingIndex === -1) {
    updatedFloorWorkers.push({
      id: `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      department: department,
      role: 'OPERATOR',
      shift: shift,
      assignedMachine: machine,
      isPresent: true,
      shiftStatus: 'PRESENT',
      inTime: nowTime
    });

    const currentDeptList = updatedDeptWorkers[department] || [];
    if (!currentDeptList.includes(cleanName)) {
      updatedDeptWorkers[department] = [...currentDeptList, cleanName];
    }
  } else {
    // PRESERVE permanent role and department! Do not overwrite an OPERATOR into a HELPER
    const existing = updatedFloorWorkers[existingIndex];
    updatedFloorWorkers[existingIndex] = {
      ...existing,
      assignedMachine: machine || existing.assignedMachine,
      isPresent: true,
      shiftStatus: 'PRESENT'
    };
  }

  return { floorWorkers: updatedFloorWorkers, deptWorkers: updatedDeptWorkers };
}

export function autoRegisterCrew(
  state: FactoryState,
  operatorName: string,
  helpers: string[],
  department: string,
  machine: string,
  shift: 'DAY' | 'NIGHT' | string
): { floorWorkers: FloorWorker[]; deptWorkers: Record<string, string[]> } {
  let updatedState = { ...state };
  let { floorWorkers, deptWorkers } = autoRegisterWorker(
    updatedState,
    operatorName,
    department,
    machine,
    shift as any
  );

  updatedState.floorWorkers = floorWorkers;
  updatedState.deptWorkers = deptWorkers;

  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  helpers.forEach((helperName) => {
    if (!helperName || !helperName.trim()) return;
    const cleanHelper = helperName.trim().toUpperCase();

    let currentFloor = [...(updatedState.floorWorkers || [])];
    let currentDept = { ...(updatedState.deptWorkers || {}) };

    const existingIndex = currentFloor.findIndex(
      (w) => w.name.toUpperCase() === cleanHelper
    );

    if (existingIndex === -1) {
      currentFloor.push({
        id: `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: cleanHelper,
        department: department,
        role: 'HELPER',
        shift: shift as any,
        assignedMachine: machine,
        pairedWithOperator: operatorName.trim().toUpperCase(),
        isPresent: true,
        shiftStatus: 'PRESENT',
        inTime: nowTime
      });

      const currentDeptList = currentDept[department] || [];
      if (!currentDeptList.includes(cleanHelper)) {
        currentDept[department] = [...currentDeptList, cleanHelper];
      }
    } else {
      // PRESERVE existing role if already defined (don't overwrite an OPERATOR to HELPER)
      const existing = currentFloor[existingIndex];
      currentFloor[existingIndex] = {
        ...existing,
        role: existing.role || 'HELPER',
        assignedMachine: machine || existing.assignedMachine,
        pairedWithOperator: operatorName.trim().toUpperCase(),
        isPresent: true,
        shiftStatus: 'PRESENT'
      };
    }

    updatedState.floorWorkers = currentFloor;
    updatedState.deptWorkers = currentDept;
  });

  return { floorWorkers: updatedState.floorWorkers, deptWorkers: updatedState.deptWorkers };
}

export interface OperatorPerformanceItem {
  id: string;
  name: string;
  role: WorkforceRole;
  department: string;
  assignedMachine: string;
  shift: string;
  attendanceStatus: 'PRESENT' | 'ON_LEAVE' | 'ABSENT';
  isDutyActive: boolean;
  totalBatches: number;
  totalPieces: number;
  totalCrates: number;
  totalRolls: number;
  totalBoxes: number;
  totalScrapKg: number;
  scrapPercent: number;
  qcDefectCount: number;
  efficiencyScore: number; // 0-100%
  ratingBadge: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION';
  helpers: string[];
  activeJobId?: string;
  currentStation?: string;
}

/**
 * Calculates real, face-to-face performance for every operator and worker
 * directly from structured batches (cutting, forming, slitting, packing) and QC logs.
 */
export function calculateOperatorPerformanceCards(state: FactoryState): OperatorPerformanceItem[] {
  const activeWorkerNames = new Set<string>();
  const activeMachineMap: Record<string, { machine: string; jobId: string }> = {};

  (state.jobs || []).forEach((j) => {
    (j.runningBatches || []).forEach((b) => {
      if (b.status === 'Running' || b.status === 'Held') {
        if (b.worker) {
          activeWorkerNames.add(b.worker.toUpperCase());
          activeMachineMap[b.worker.toUpperCase()] = { machine: b.machine, jobId: j.id };
        }
        if (b.operator) {
          activeWorkerNames.add(b.operator.toUpperCase());
          activeMachineMap[b.operator.toUpperCase()] = { machine: b.machine, jobId: j.id };
        }
        (b.helpers || []).forEach((h) => {
          activeWorkerNames.add(h.toUpperCase());
          activeMachineMap[h.toUpperCase()] = { machine: b.machine, jobId: j.id };
        });
      }
    });
  });

  (state.packJobs || []).forEach((pj) => {
    if (pj.status === 'Running' || pj.status === 'Active') {
      if (pj.packer) activeWorkerNames.add(pj.packer.toUpperCase());
      if (pj.helper) activeWorkerNames.add(pj.helper.toUpperCase());
    }
  });

  // Extract all distinct workers from state.floorWorkers (or defaults)
  const roster: FloorWorker[] = (state.floorWorkers || []).filter(
    (w) => w.status !== 'INACTIVE'
  );

  return roster.map((w) => {
    const cleanName = w.name.toUpperCase();
    const isDutyActive = activeWorkerNames.has(cleanName);
    const stationInfo = activeMachineMap[cleanName];

    let totalBatches = 0;
    let totalPieces = 0;
    let totalCrates = 0;
    let totalRolls = 0;
    let totalBoxes = 0;
    let totalScrapKg = 0;
    const helpersSet = new Set<string>();

    // 1. Scan jobs and running batches
    (state.jobs || []).forEach((job) => {
      (job.runningBatches || []).forEach((b) => {
        const isWorker =
          (b.worker && b.worker.toUpperCase() === cleanName) ||
          (b.operator && b.operator.toUpperCase() === cleanName);
        const isHelper = (b.helpers || []).some((h) => h.toUpperCase() === cleanName);

        if (isWorker || isHelper) {
          totalBatches++;
          const pcs = b.producedPieces || b.outputPieces || (b.producedQty ? b.producedQty * (b.pcsPerCrate || 1000) : 0);
          totalPieces += pcs;
          if (b.producedQty) totalCrates += b.producedQty;
          if (b.scrapKg) totalScrapKg += b.scrapKg;
          (b.helpers || []).forEach((h) => helpersSet.add(h));
        }
      });

      // Scan slitting reels list if operator matched
      (job.reelsList || []).forEach((r) => {
        if (r.worker && r.worker.toUpperCase() === cleanName) {
          totalRolls += r.rolls || 1;
          if (r.scrapKg) totalScrapKg += r.scrapKg;
        }
      });
    });

    // 2. Scan packing jobs
    (state.packJobs || []).forEach((pj) => {
      if (
        (pj.packer && pj.packer.toUpperCase() === cleanName) ||
        (pj.worker && pj.worker.toUpperCase() === cleanName)
      ) {
        totalBoxes += pj.packedBoxes || 0;
        totalPieces += (pj.packedBoxes || 0) * (pj.pcsPerBox || 1000);
      }
    });

    // 3. Scan QC defects assigned to or recorded against this operator
    let qcDefectCount = 0;
    (state.qcDefectRecords || []).forEach((qd) => {
      if (qd.operator && qd.operator.toUpperCase() === cleanName) {
        qcDefectCount += qd.rejectedPcs || 1;
      }
    });

    // 4. Real efficiency calculation
    let efficiencyScore = 95.0;
    if (totalPieces > 0 || totalRolls > 0 || totalBoxes > 0) {
      const scrapDeduction = totalPieces > 0 ? (totalScrapKg / (totalPieces / 100)) * 2 : totalScrapKg * 0.5;
      const defectDeduction = qcDefectCount * 2.5;
      efficiencyScore = Math.max(70, Math.min(99.5, 98.0 - scrapDeduction - defectDeduction));
    } else if (w.shiftStatus === 'ON_LEAVE' || w.shiftStatus === 'ABSENT') {
      efficiencyScore = 0;
    }

    const scrapPercent =
      totalPieces > 0
        ? Number(((totalScrapKg / (totalPieces * 0.005 || 1)) * 100).toFixed(2))
        : 0;

    let ratingBadge: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' = 'GOOD';
    if (efficiencyScore >= 96) ratingBadge = 'EXCELLENT';
    else if (efficiencyScore < 90 || qcDefectCount > 3) ratingBadge = 'NEEDS_ATTENTION';

    return {
      id: w.id,
      name: w.name,
      role: w.role,
      department: w.department,
      assignedMachine: stationInfo?.machine || w.assignedMachine || 'Floor',
      shift: w.shift || 'DAY',
      attendanceStatus: (w.shiftStatus as any) || (w.isPresent ? 'PRESENT' : 'ABSENT'),
      isDutyActive,
      totalBatches,
      totalPieces: Math.round(totalPieces),
      totalCrates: Math.round(totalCrates),
      totalRolls,
      totalBoxes,
      totalScrapKg: Number(totalScrapKg.toFixed(1)),
      scrapPercent: Math.min(100, scrapPercent),
      qcDefectCount,
      efficiencyScore: Number(efficiencyScore.toFixed(1)),
      ratingBadge,
      helpers: Array.from(helpersSet),
      activeJobId: stationInfo?.jobId,
      currentStation: stationInfo?.machine
    };
  });
}

