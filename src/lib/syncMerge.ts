import {
  FactoryState,
  Job,
  RunningBatch,
  ProductionPlan,
  PackJob,
  LogEntry,
  MaterialRequisition,
  CustomerComplaint,
  ShiftHandoverRecord,
  MaintenanceIncident,
  MotherReelItem,
  SeriesConfig,
  WhatsAppConfig,
  ShiftConfig
} from '../types';

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

  const baseReset = base.lastResetTimestamp || 0;
  const incReset = incoming.lastResetTimestamp || 0;
  if (incReset > baseReset) {
    return JSON.parse(JSON.stringify(incoming));
  }
  if (baseReset > incReset) {
    return JSON.parse(JSON.stringify(base));
  }

  const deletedJobIds = Array.from(new Set([...(base.deletedJobIds || []), ...(incoming.deletedJobIds || [])]));
  const deletedOrderIds = Array.from(new Set([...(base.deletedOrderIds || []), ...(incoming.deletedOrderIds || [])]));
  const deletedLogIds = Array.from(new Set([...(base.deletedLogIds || []), ...(incoming.deletedLogIds || [])]));
  const deletedPlanIds = Array.from(new Set([...(base.deletedPlanIds || []), ...(incoming.deletedPlanIds || [])]));

  // 1. Merge Production Jobs
  const jobMap = new Map<string, Job>();
  (base.jobs || []).forEach((j) => {
    if (j && j.id && !deletedJobIds.includes(j.id)) jobMap.set(j.id, { ...j });
  });

  (incoming.jobs || []).forEach((incJob) => {
    if (!incJob || !incJob.id || deletedJobIds.includes(incJob.id)) return;
    const existing = jobMap.get(incJob.id);
    if (!existing) {
      jobMap.set(incJob.id, { ...incJob });
    } else {
      // Merge runningBatches by batchId
      const batchMap = new Map<string, RunningBatch>();
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
        plannedGsms: incJob.plannedGsms || existing.plannedGsms,
        plannedLayers: incJob.plannedLayers || existing.plannedLayers,
        targetLayers: incJob.targetLayers || existing.targetLayers,
        targetLengthMeters: incJob.targetLengthMeters || existing.targetLengthMeters,
        targetGlueBrand: incJob.targetGlueBrand || existing.targetGlueBrand,
        printedRollRequired: incJob.printedRollRequired ?? existing.printedRollRequired,
        printedRollDesign: incJob.printedRollDesign || existing.printedRollDesign,
        printedRollIcon: incJob.printedRollIcon || existing.printedRollIcon,
        stage: resolvedStage,
        availableRolls: incJob.availableRolls !== undefined ? incJob.availableRolls : (existing.availableRolls || 0),
        availableCuttingCrates: incJob.availableCuttingCrates !== undefined ? incJob.availableCuttingCrates : (existing.availableCuttingCrates || 0),
        availableFormingCrates: incJob.availableFormingCrates !== undefined ? incJob.availableFormingCrates : (existing.availableFormingCrates || 0),
        availableForQcCrates: incJob.availableForQcCrates !== undefined ? incJob.availableForQcCrates : (existing.availableForQcCrates || 0),
        availableQcCrates: incJob.availableQcCrates !== undefined ? incJob.availableQcCrates : (existing.availableQcCrates || 0),
        isReadyForQcInspection: incJob.isReadyForQcInspection !== undefined ? incJob.isReadyForQcInspection : existing.isReadyForQcInspection,
        tracedLots: { ...(existing.tracedLots || {}), ...(incJob.tracedLots || {}) },
        totalCutPieces: Math.max(existing.totalCutPieces || 0, incJob.totalCutPieces || 0),
        totalFormedPieces: Math.max(existing.totalFormedPieces || 0, incJob.totalFormedPieces || 0),
        totalQcPieces: Math.max(existing.totalQcPieces || 0, incJob.totalQcPieces || 0),
        cuttingLoosePcs: Math.max(existing.cuttingLoosePcs || 0, incJob.cuttingLoosePcs || 0),
        formingLoosePcs: Math.max(existing.formingLoosePcs || 0, incJob.formingLoosePcs || 0),
        qcLoosePcs: Math.max(existing.qcLoosePcs || 0, incJob.qcLoosePcs || 0),
        runningBatches: Array.from(batchMap.values())
      });
    }
  });

  // 2. Merge Production Plans
  const planMap = new Map<string, ProductionPlan>();
  (base.productionPlans || []).forEach((p) => {
    if (p && p.id && !deletedPlanIds.includes(p.id)) {
      planMap.set(p.id, { ...p });
    }
  });
  (incoming.productionPlans || []).forEach((p) => {
    if (!p || !p.id || deletedPlanIds.includes(p.id)) return;
    const existing = planMap.get(p.id);
    if (!existing) {
      planMap.set(p.id, { ...p });
    } else {
      const isCompleted = p.status === 'Completed' || existing.status === 'Completed';
      planMap.set(p.id, {
        ...existing,
        ...p,
        plannedLayers: p.plannedLayers || existing.plannedLayers,
        plannedGsms: p.plannedGsms || existing.plannedGsms,
        printedRollRequired: p.printedRollRequired ?? existing.printedRollRequired,
        printedRollDesign: p.printedRollDesign || existing.printedRollDesign,
        printedRollIcon: p.printedRollIcon || existing.printedRollIcon,
        targetLayers: p.targetLayers || existing.targetLayers,
        targetLengthMeters: p.targetLengthMeters || existing.targetLengthMeters,
        paperBrand: p.paperBrand || existing.paperBrand,
        adhesiveBrand: p.adhesiveBrand || existing.adhesiveBrand,
        notes: p.notes || existing.notes,
        status: isCompleted ? 'Completed' : (p.status || existing.status),
        actualMetersSlit: Math.max(existing.actualMetersSlit || 0, p.actualMetersSlit || 0),
        actualLayersUsed: Math.max(existing.actualLayersUsed || 0, p.actualLayersUsed || 0),
        actualScrapKg: Math.max(existing.actualScrapKg || 0, p.actualScrapKg || 0)
      });
    }
  });

  // 3. Merge Pack Jobs
  const packMap = new Map<string, PackJob>();
  (base.packJobs || []).forEach((pj) => {
    if (pj && pj.id && !deletedOrderIds.includes(pj.id)) packMap.set(pj.id, { ...pj });
  });
  (incoming.packJobs || []).forEach((pj) => {
    if (!pj || !pj.id || deletedOrderIds.includes(pj.id)) return;
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
  const makeLogKey = (l: LogEntry) => `${l.jobId || ''}_${l.timestamp}_${l.action}_${l.stage}_${l.machine}`;
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
    const key = h.id || `${h.department}_${h.currentShift}_${h.date}`;
    handoverMap.set(key, { ...h });
  });
  (incoming.shiftHandovers || []).forEach((h) => {
    const key = h.id || `${h.department}_${h.currentShift}_${h.date}`;
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
  const mergedSeriesConfig: SeriesConfig = {
    orderSeq: Math.max(base.seriesConfig?.orderSeq || 1, incoming.seriesConfig?.orderSeq || 1),
    productSeqs: {
      ...(base.seriesConfig?.productSeqs || {}),
      ...(incoming.seriesConfig?.productSeqs || {})
    },
    numberingMaster: {
      jobSeries: {
        prefix: incoming.seriesConfig?.numberingMaster?.jobSeries?.prefix || base.seriesConfig?.numberingMaster?.jobSeries?.prefix || 'WK-LOT',
        paddingDigits: incoming.seriesConfig?.numberingMaster?.jobSeries?.paddingDigits ?? base.seriesConfig?.numberingMaster?.jobSeries?.paddingDigits ?? 3,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.jobSeries?.nextSeq || 101,
          incoming.seriesConfig?.numberingMaster?.jobSeries?.nextSeq || 101
        )
      },
      slitSeries: {
        prefix: incoming.seriesConfig?.numberingMaster?.slitSeries?.prefix || base.seriesConfig?.numberingMaster?.slitSeries?.prefix || 'SLIT',
        paddingDigits: incoming.seriesConfig?.numberingMaster?.slitSeries?.paddingDigits ?? base.seriesConfig?.numberingMaster?.slitSeries?.paddingDigits ?? 2,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.slitSeries?.nextSeq || 1,
          incoming.seriesConfig?.numberingMaster?.slitSeries?.nextSeq || 1
        )
      },
      cutSeries: {
        prefix: incoming.seriesConfig?.numberingMaster?.cutSeries?.prefix || base.seriesConfig?.numberingMaster?.cutSeries?.prefix || 'CUT',
        paddingDigits: incoming.seriesConfig?.numberingMaster?.cutSeries?.paddingDigits ?? base.seriesConfig?.numberingMaster?.cutSeries?.paddingDigits ?? 2,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.cutSeries?.nextSeq || 1,
          incoming.seriesConfig?.numberingMaster?.cutSeries?.nextSeq || 1
        )
      },
      qcSeries: {
        prefix: incoming.seriesConfig?.numberingMaster?.qcSeries?.prefix || base.seriesConfig?.numberingMaster?.qcSeries?.prefix || 'QC',
        paddingDigits: incoming.seriesConfig?.numberingMaster?.qcSeries?.paddingDigits ?? base.seriesConfig?.numberingMaster?.qcSeries?.paddingDigits ?? 2,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.qcSeries?.nextSeq || 1,
          incoming.seriesConfig?.numberingMaster?.qcSeries?.nextSeq || 1
        )
      },
      useGlobalJobPrefix: incoming.seriesConfig?.numberingMaster?.useGlobalJobPrefix ?? base.seriesConfig?.numberingMaster?.useGlobalJobPrefix
    }
  };

  // 10. Merge Mother Reel Inventory
  const reelMap = new Map<string, MotherReelItem>();
  (base.motherReelInventory || []).forEach((r) => { if (r && r.id) reelMap.set(r.id, { ...r }); });
  (incoming.motherReelInventory || []).forEach((r) => {
    if (!r || !r.id) return;
    reelMap.set(r.id, { ...(reelMap.get(r.id) || {}), ...r });
  });

  // 11. WhatsApp & Shift Configs
  const mergedWhatsappConfig: WhatsAppConfig = {
    phone: incoming.whatsappConfig?.phone || base.whatsappConfig?.phone || '',
    apiKey: incoming.whatsappConfig?.apiKey || base.whatsappConfig?.apiKey || '',
    autoSend: incoming.whatsappConfig?.autoSend ?? base.whatsappConfig?.autoSend ?? false,
    lastSentKey: incoming.whatsappConfig?.lastSentKey || base.whatsappConfig?.lastSentKey,
    webhookUrl: incoming.whatsappConfig?.webhookUrl || base.whatsappConfig?.webhookUrl,
    customMessage: incoming.whatsappConfig?.customMessage || base.whatsappConfig?.customMessage,
    dayShiftReportTime: incoming.whatsappConfig?.dayShiftReportTime || base.whatsappConfig?.dayShiftReportTime,
    nightShiftReportTime: incoming.whatsappConfig?.nightShiftReportTime || base.whatsappConfig?.nightShiftReportTime,
    autoSendShiftReportDay: incoming.whatsappConfig?.autoSendShiftReportDay ?? base.whatsappConfig?.autoSendShiftReportDay,
    autoSendShiftReportNight: incoming.whatsappConfig?.autoSendShiftReportNight ?? base.whatsappConfig?.autoSendShiftReportNight,
    lastSentDayDate: incoming.whatsappConfig?.lastSentDayDate || base.whatsappConfig?.lastSentDayDate,
    lastSentNightDate: incoming.whatsappConfig?.lastSentNightDate || base.whatsappConfig?.lastSentNightDate
  };

  const mergedShiftConfig: ShiftConfig = {
    dayStart: incoming.shiftConfig?.dayStart || base.shiftConfig?.dayStart || '08:00',
    dayEnd: incoming.shiftConfig?.dayEnd || base.shiftConfig?.dayEnd || '20:00',
    nightStart: incoming.shiftConfig?.nightStart || base.shiftConfig?.nightStart || '20:00',
    nightEnd: incoming.shiftConfig?.nightEnd || base.shiftConfig?.nightEnd || '08:00'
  };

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
    whatsappConfig: mergedWhatsappConfig,
    shiftConfig: mergedShiftConfig,
    // Keep user and master configuration lists (prune legacy demo users, retain admin)
    users: (() => {
      const combinedUsers = { ...(base.users || {}), ...(incoming.users || {}) };
      const legacyKeys = ['kavita', 'marketing', 'disp_user', 'slit_user', 'cut_user', 'form_user', 'qc_user', 'pack_user', 'maint_user', 'purchase'];
      legacyKeys.forEach((k) => delete combinedUsers[k]);
      if (!combinedUsers.admin) {
        combinedUsers.admin = { pass: 'admin123', perms: ['*'], name: 'Master Administrator', role: 'Administrator' };
      }
      combinedUsers.admin.perms = ['*'];
      return combinedUsers;
    })(),
    floorWorkers: (() => {
      const map = new Map();
      (base.floorWorkers || []).forEach(w => map.set(w.id || w.name, w));
      (incoming.floorWorkers || []).forEach(w => {
        const key = w.id || w.name;
        if (!map.has(key)) map.set(key, w);
      });
      return Array.from(map.values());
    })(),
    deptWorkers: (() => {
      const mergedDepts = { ...(base.deptWorkers || {}) };
      for (const [dept, workers] of Object.entries(incoming.deptWorkers || {})) {
        const existing = mergedDepts[dept] || [];
        mergedDepts[dept] = Array.from(new Set([...existing, ...(workers as string[])]));
      }
      return mergedDepts;
    })(),
    maintenanceContacts: incoming.maintenanceContacts !== undefined ? incoming.maintenanceContacts : base.maintenanceContacts,
    coordinationMatrix: incoming.coordinationMatrix?.length ? incoming.coordinationMatrix : base.coordinationMatrix,
    departmentHeads: incoming.departmentHeads?.length ? incoming.departmentHeads : base.departmentHeads,
    maintenanceTechniciansMaster: incoming.maintenanceTechniciansMaster?.length ? incoming.maintenanceTechniciansMaster : base.maintenanceTechniciansMaster,
    maintenanceSparePartsMaster: incoming.maintenanceSparePartsMaster?.length ? incoming.maintenanceSparePartsMaster : base.maintenanceSparePartsMaster,
    crateCapacityMaster: { ...(base.crateCapacityMaster || {}), ...(incoming.crateCapacityMaster || {}) }
  };

  return merged;
}
