import { FactoryState, Job, ProductionPlan, PackJob, LogEntry, MaterialRequisition, CustomerComplaint, ShiftHandoverRecord, MaintenanceIncident, FloorWorker, MaintenanceContact, CoordinationMatrixItem } from '../types';

/**
 * Intelligently merges two FactoryState objects without losing any device's recorded production.
 * Ensures planning, slitting, cutting, forming, QC, packing, and logs from multiple devices converge safely.
 */
export function mergeFactoryStates(base: FactoryState | null | undefined, incoming: FactoryState): FactoryState {
  if (!base || !base.jobs) {
    return JSON.parse(JSON.stringify(incoming));
  }
  if (!incoming || !incoming.jobs) {
    return JSON.parse(JSON.stringify(base));
  }

  // 1. Merge Production Jobs
  const jobMap = new Map<string, Job>();
  (base.jobs || []).forEach((j) => {
    if (j && j.id) jobMap.set(j.id, { ...j });
  });

  (incoming.jobs || []).forEach((incJob) => {
    if (!incJob || !incJob.id) return;
    const existing = jobMap.get(incJob.id);
    if (!existing) {
      jobMap.set(incJob.id, { ...incJob });
    } else {
      // Merge runningBatches by batchId
      const batchMap = new Map<string, any>();
      (existing.runningBatches || []).forEach((b) => {
        const key = b.batchId || `${b.stage}_${b.machine}_${b.startTime}`;
        batchMap.set(key, { ...b });
      });
      (incJob.runningBatches || []).forEach((b) => {
        const key = b.batchId || `${b.stage}_${b.machine}_${b.startTime}`;
        const prevBatch = batchMap.get(key);
        if (!prevBatch) {
          batchMap.set(key, { ...b });
        } else {
          // Prefer completed or higher produced counts
          const isIncCompleted = b.status === 'Completed' || !!b.endTime;
          const isPrevCompleted = prevBatch.status === 'Completed' || !!prevBatch.endTime;
          if (isIncCompleted && !isPrevCompleted) {
            batchMap.set(key, { ...prevBatch, ...b });
          } else {
            batchMap.set(key, {
              ...prevBatch,
              ...b,
              producedQty: Math.max(prevBatch.producedQty || 0, b.producedQty || 0),
              producedPieces: Math.max(prevBatch.producedPieces || 0, b.producedPieces || 0),
              loosePieces: Math.max(prevBatch.loosePieces || 0, b.loosePieces || 0)
            });
          }
        }
      });

      // Merge slices
      const sliceMap = new Map<string, any>();
      (existing.slices || []).forEach((s) => {
        const key = s.sliceId || `${s.operator}_${s.handoverTime}`;
        sliceMap.set(key, { ...s });
      });
      (incJob.slices || []).forEach((s) => {
        const key = s.sliceId || `${s.operator}_${s.handoverTime}`;
        sliceMap.set(key, { ...(sliceMap.get(key) || {}), ...s });
      });

      // Stage progression priority
      const stagePriority: Record<string, number> = {
        'Slitting': 1,
        'Cutting': 2,
        'Forming': 3,
        'QC': 4,
        'Packing': 5,
        'Completed': 6
      };
      const existingPrio = stagePriority[existing.stage] || 0;
      const incPrio = stagePriority[incJob.stage] || 0;
      const resolvedStage = incPrio >= existingPrio ? incJob.stage : existing.stage;

      jobMap.set(incJob.id, {
        ...existing,
        ...incJob,
        stage: resolvedStage,
        // Maximize known production counts so progress is never reduced by an older device
        producedSlitRolls: Math.max(existing.producedSlitRolls || 0, incJob.producedSlitRolls || 0),
        cutBlankPieces: Math.max(existing.cutBlankPieces || 0, incJob.cutBlankPieces || 0),
        formedPieces: Math.max(existing.formedPieces || 0, incJob.formedPieces || 0),
        qcApprovedPieces: Math.max(existing.qcApprovedPieces || 0, incJob.qcApprovedPieces || 0),
        runningBatches: Array.from(batchMap.values()),
        slices: Array.from(sliceMap.values()),
        // If one device logged cutting / forming crates, preserve them
        totalCutCrates: Math.max(existing.totalCutCrates || 0, incJob.totalCutCrates || 0),
        totalFormedCrates: Math.max(existing.totalFormedCrates || 0, incJob.totalFormedCrates || 0)
      });
    }
  });

  // 2. Merge Production Plans
  const planMap = new Map<string, ProductionPlan>();
  (base.productionPlans || []).forEach((p) => {
    if (p && (p.id || p.planNo)) {
      planMap.set(p.id || p.planNo, { ...p });
    }
  });
  (incoming.productionPlans || []).forEach((p) => {
    if (!p || (!p.id && !p.planNo)) return;
    const key = p.id || p.planNo;
    const existing = planMap.get(key);
    if (!existing) {
      planMap.set(key, { ...p });
    } else {
      const isCompleted = p.status === 'Completed' || existing.status === 'Completed';
      planMap.set(key, {
        ...existing,
        ...p,
        status: isCompleted ? 'Completed' : (p.status || existing.status),
        producedQty: Math.max(existing.producedQty || 0, p.producedQty || 0),
        producedCrates: Math.max(existing.producedCrates || 0, p.producedCrates || 0)
      });
    }
  });

  // 3. Merge Pack Jobs
  const packMap = new Map<string, PackJob>();
  (base.packJobs || []).forEach((pj) => {
    if (pj && pj.id) packMap.set(pj.id, { ...pj });
  });
  (incoming.packJobs || []).forEach((pj) => {
    if (!pj || !pj.id) return;
    const existing = packMap.get(pj.id);
    if (!existing) {
      packMap.set(pj.id, { ...pj });
    } else {
      // Merge history runs
      const historyRuns = [...(existing.historyRuns || []), ...(pj.historyRuns || [])];
      const uniqueRuns = Array.from(new Map(historyRuns.map(r => [r.runId || `${r.date}_${r.time}_${r.worker}`, r])).values());

      packMap.set(pj.id, {
        ...existing,
        ...pj,
        packedBoxes: Math.max(existing.packedBoxes || 0, pj.packedBoxes || 0),
        dispatchedBoxes: Math.max(existing.dispatchedBoxes || 0, pj.dispatchedBoxes || 0),
        historyRuns: uniqueRuns,
        status: pj.status === 'Completed' || existing.status === 'Completed' ? 'Completed' : (pj.status || existing.status)
      });
    }
  });

  // 4. Merge Audit Logs
  const logMap = new Map<string, LogEntry>();
  const makeLogKey = (l: LogEntry) => l.id || `${l.jobId}_${l.timestamp}_${l.action}_${l.stage}_${l.machine}`;
  (base.logs || []).forEach((l) => {
    if (l) logMap.set(makeLogKey(l), l);
  });
  (incoming.logs || []).forEach((l) => {
    if (l) logMap.set(makeLogKey(l), l);
  });
  const mergedLogs = Array.from(logMap.values()).sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeB - timeA; // Descending
  });

  // 5. Merge Material Requisitions
  const reqMap = new Map<string, MaterialRequisition>();
  (base.materialRequisitions || []).forEach((r) => { if (r && r.id) reqMap.set(r.id, { ...r }); });
  (incoming.materialRequisitions || []).forEach((r) => {
    if (!r || !r.id) return;
    const ex = reqMap.get(r.id);
    if (!ex) reqMap.set(r.id, { ...r });
    else reqMap.set(r.id, { ...ex, ...r });
  });

  // 6. Merge Customer Complaints
  const complaintMap = new Map<string, CustomerComplaint>();
  (base.customerComplaints || []).forEach((c) => { if (c && c.id) complaintMap.set(c.id, { ...c }); });
  (incoming.customerComplaints || []).forEach((c) => {
    if (!c || !c.id) return;
    complaintMap.set(c.id, { ...(complaintMap.get(c.id) || {}), ...c });
  });

  // 7. Merge Shift Handovers
  const handoverMap = new Map<string, ShiftHandoverRecord>();
  (base.shiftHandovers || []).forEach((h) => {
    const key = h.id || `${h.department}_${h.shift}_${h.date}`;
    handoverMap.set(key, { ...h });
  });
  (incoming.shiftHandovers || []).forEach((h) => {
    const key = h.id || `${h.department}_${h.shift}_${h.date}`;
    handoverMap.set(key, { ...(handoverMap.get(key) || {}), ...h });
  });

  // 8. Merge Maintenance Incidents
  const incidentMap = new Map<string, MaintenanceIncident>();
  (base.maintenanceIncidents || []).forEach((i) => { if (i && i.id) incidentMap.set(i.id, { ...i }); });
  (incoming.maintenanceIncidents || []).forEach((i) => {
    if (!i || !i.id) return;
    incidentMap.set(i.id, { ...(incidentMap.get(i.id) || {}), ...i });
  });

  // 9. Merge Numbering Series Counters (Take MAXIMUM to avoid collisions across devices)
  const mergedSeriesConfig = {
    ...base.seriesConfig,
    ...incoming.seriesConfig,
    jobPrefix: incoming.seriesConfig?.jobPrefix || base.seriesConfig?.jobPrefix || 'WK-LOT',
    currentJobSeq: Math.max(base.seriesConfig?.currentJobSeq || 1, incoming.seriesConfig?.currentJobSeq || 1),
    nextLotNo: Math.max(base.seriesConfig?.nextLotNo || 101, incoming.seriesConfig?.nextLotNo || 101),
    nextSlitNo: Math.max(base.seriesConfig?.nextSlitNo || 1, incoming.seriesConfig?.nextSlitNo || 1),
    nextCutNo: Math.max(base.seriesConfig?.nextCutNo || 1, incoming.seriesConfig?.nextCutNo || 1),
    nextQcNo: Math.max(base.seriesConfig?.nextQcNo || 1, incoming.seriesConfig?.nextQcNo || 1),
    numberingMaster: {
      ...(base.seriesConfig?.numberingMaster || {}),
      ...(incoming.seriesConfig?.numberingMaster || {}),
      jobSeries: {
        prefix: incoming.seriesConfig?.numberingMaster?.jobSeries?.prefix || base.seriesConfig?.numberingMaster?.jobSeries?.prefix || 'WK-LOT',
        paddingDigits: incoming.seriesConfig?.numberingMaster?.jobSeries?.paddingDigits || 3,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.jobSeries?.nextSeq || 101,
          incoming.seriesConfig?.numberingMaster?.jobSeries?.nextSeq || 101
        )
      },
      slitSeries: {
        prefix: incoming.seriesConfig?.numberingMaster?.slitSeries?.prefix || base.seriesConfig?.numberingMaster?.slitSeries?.prefix || 'SLIT',
        paddingDigits: incoming.seriesConfig?.numberingMaster?.slitSeries?.paddingDigits || 2,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.slitSeries?.nextSeq || 1,
          incoming.seriesConfig?.numberingMaster?.slitSeries?.nextSeq || 1
        )
      },
      cutSeries: {
        prefix: incoming.seriesConfig?.numberingMaster?.cutSeries?.prefix || base.seriesConfig?.numberingMaster?.cutSeries?.prefix || 'CUT',
        paddingDigits: incoming.seriesConfig?.numberingMaster?.cutSeries?.paddingDigits || 2,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.cutSeries?.nextSeq || 1,
          incoming.seriesConfig?.numberingMaster?.cutSeries?.nextSeq || 1
        )
      },
      qcSeries: {
        prefix: incoming.seriesConfig?.numberingMaster?.qcSeries?.prefix || base.seriesConfig?.numberingMaster?.qcSeries?.prefix || 'QC',
        paddingDigits: incoming.seriesConfig?.numberingMaster?.qcSeries?.paddingDigits || 2,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.qcSeries?.nextSeq || 1,
          incoming.seriesConfig?.numberingMaster?.qcSeries?.nextSeq || 1
        )
      }
    }
  };

  // 10. Merge Mother Reel Inventory
  const reelMap = new Map<string, any>();
  (base.motherReelInventory || []).forEach((r) => { if (r && r.reelNo) reelMap.set(r.reelNo, { ...r }); });
  (incoming.motherReelInventory || []).forEach((r) => {
    if (!r || !r.reelNo) return;
    reelMap.set(r.reelNo, { ...(reelMap.get(r.reelNo) || {}), ...r });
  });

  // Assemble final consolidated state
  const merged: FactoryState = {
    ...base,
    ...incoming,
    jobs: Array.from(jobMap.values()),
    productionPlans: Array.from(planMap.values()),
    packJobs: Array.from(packMap.values()),
    logs: mergedLogs,
    materialRequisitions: Array.from(reqMap.values()),
    customerComplaints: Array.from(complaintMap.values()),
    shiftHandovers: Array.from(handoverMap.values()),
    maintenanceIncidents: Array.from(incidentMap.values()),
    motherReelInventory: Array.from(reelMap.values()),
    seriesConfig: mergedSeriesConfig,
    // Keep most recent user and master configuration lists
    users: { ...(base.users || {}), ...(incoming.users || {}) },
    floorWorkers: incoming.floorWorkers?.length ? incoming.floorWorkers : base.floorWorkers,
    maintenanceContacts: incoming.maintenanceContacts?.length ? incoming.maintenanceContacts : base.maintenanceContacts,
    coordinationMatrix: incoming.coordinationMatrix?.length ? incoming.coordinationMatrix : base.coordinationMatrix,
    departmentHeads: incoming.departmentHeads?.length ? incoming.departmentHeads : base.departmentHeads,
    maintenanceTechniciansMaster: incoming.maintenanceTechniciansMaster?.length ? incoming.maintenanceTechniciansMaster : base.maintenanceTechniciansMaster,
    maintenanceSparePartsMaster: incoming.maintenanceSparePartsMaster?.length ? incoming.maintenanceSparePartsMaster : base.maintenanceSparePartsMaster,
    crateCapacityMaster: { ...(base.crateCapacityMaster || {}), ...(incoming.crateCapacityMaster || {}) },
    whatsappConfig: { ...(base.whatsappConfig || {}), ...(incoming.whatsappConfig || {}) },
    shiftConfig: { ...(base.shiftConfig || {}), ...(incoming.shiftConfig || {}) }
  };

  return merged;
}
