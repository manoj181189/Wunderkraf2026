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
  const deletedWorkerIds = Array.from(new Set([...(base.deletedWorkerIds || []), ...(incoming.deletedWorkerIds || [])]));
  const deletedHandoverIds = Array.from(new Set([...(base.deletedHandoverIds || []), ...(incoming.deletedHandoverIds || [])]));

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
      const isMasterEdit = Boolean(
        incJob.isAuthoritativeMasterEdit ||
        (incJob.updatedAt && (!existing.updatedAt || incJob.updatedAt >= existing.updatedAt))
      );

      if (isMasterEdit) {
        jobMap.set(incJob.id, {
          ...existing,
          ...incJob
        });
        return;
      }

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
      
      const allBatches = Array.from(batchMap.values());
      const hasActiveSlittingRun = allBatches.some(
        (b) => b.stage === 'Slitting' && (b.status === 'Running' || b.status === 'Held')
      );
      
      // If there is an active running/held slitting run or incoming stage was explicitly re-opened to Slitting, honor Slitting
      let resolvedStage = incPrio >= existingPrio ? incJob.stage : existing.stage;
      if (hasActiveSlittingRun || incJob.stage === 'Slitting' || incJob.status === 'SLITTING_IN_PROGRESS') {
        resolvedStage = 'Slitting';
      }

      // Merge reelsList by batchId or reelNo so no loaded jumbo reels are ever lost
      const reelMap = new Map<string, any>();
      (existing.reelsList || []).forEach((r) => {
        const key = r.batchId || r.reelNo || Math.random().toString();
        reelMap.set(key, { ...r });
      });
      (incJob.reelsList || []).forEach((r) => {
        const key = r.batchId || r.reelNo || Math.random().toString();
        const prev = reelMap.get(key);
        reelMap.set(key, { ...prev, ...r });
      });
      const resolvedReelsList = Array.from(reelMap.values());

      const resolvedReelNumbers = Array.from(new Set([...(existing.reelNumbers || []), ...(incJob.reelNumbers || [])]));
      const resolvedReelNo = resolvedReelNumbers.length > 0 ? resolvedReelNumbers.join(', ') : (incJob.reelNo || existing.reelNo);

      jobMap.set(incJob.id, {
        ...existing,
        ...incJob,
        reelNo: resolvedReelNo,
        reelNumbers: resolvedReelNumbers,
        reelsList: resolvedReelsList,
        inputWeightKg: Math.max(existing.inputWeightKg || 0, incJob.inputWeightKg || 0),
        outputWeightKg: Math.max(existing.outputWeightKg || 0, incJob.outputWeightKg || 0),
        scrapKg: Math.max(existing.scrapKg || 0, incJob.scrapKg || 0),
        status: hasActiveSlittingRun ? 'SLITTING_IN_PROGRESS' : (incJob.status || existing.status),
        plannedGsms: incJob.plannedGsms || existing.plannedGsms,
        plannedLayers: incJob.plannedLayers || existing.plannedLayers,
        targetLayers: incJob.targetLayers || existing.targetLayers,
        targetLengthMeters: incJob.targetLengthMeters || existing.targetLengthMeters,
        targetGlueBrand: incJob.targetGlueBrand || existing.targetGlueBrand,
        printedRollRequired: incJob.printedRollRequired ?? existing.printedRollRequired,
        printedRollDesign: incJob.printedRollDesign || existing.printedRollDesign,
        printedRollIcon: incJob.printedRollIcon || existing.printedRollIcon,
        stage: resolvedStage,
        availableRolls: Math.max(existing.availableRolls || 0, incJob.availableRolls || 0),
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
      const isMasterEdit = Boolean(
        p.isAuthoritativeMasterEdit ||
        (p.updatedAt && (!existing.updatedAt || p.updatedAt >= existing.updatedAt))
      );
      if (isMasterEdit) {
        planMap.set(p.id, { ...existing, ...p });
        return;
      }

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
      const isMasterEdit = Boolean(
        pj.isAuthoritativeMasterEdit ||
        (pj.updatedAt && (!existing.updatedAt || pj.updatedAt >= existing.updatedAt))
      );
      if (isMasterEdit) {
        packMap.set(pj.id, { ...existing, ...pj });
        return;
      }

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
  const makeLogKey = (l: LogEntry) => `${l.jobId || ''}_${l.timestamp || ''}_${l.action || ''}_${l.stage || ''}_${l.machine || ''}`;
  const deletedLogKeys = new Set(deletedLogIds);
  (base.logs || []).forEach((l) => {
    if (l) {
      const key = makeLogKey(l);
      if (!deletedLogKeys.has(key)) {
        logMap.set(key, l);
      }
    }
  });
  (incoming.logs || []).forEach((l) => {
    if (l) {
      const key = makeLogKey(l);
      if (!deletedLogKeys.has(key)) {
        logMap.set(key, l);
      }
    }
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
  const deletedHandoverIdsSet = new Set(deletedHandoverIds);
  (base.shiftHandovers || []).forEach((h) => {
    if (h && h.id && !deletedHandoverIdsSet.has(h.id)) {
      const key = h.id || `${h.department}_${h.currentShift}_${h.date}`;
      handoverMap.set(key, { ...h });
    }
  });
  (incoming.shiftHandovers || []).forEach((h) => {
    if (h && h.id && !deletedHandoverIdsSet.has(h.id)) {
      const key = h.id || `${h.department}_${h.currentShift}_${h.date}`;
      handoverMap.set(key, { ...(handoverMap.get(key) || {}), ...h });
    }
  });

  // 8. Merge Maintenance Incidents
  const incidentMap = new Map<string, MaintenanceIncident>();
  (base.maintenanceIncidents || []).forEach((i) => { if (i && i.id) incidentMap.set(i.id, { ...i }); });
  (incoming.maintenanceIncidents || []).forEach((i) => {
    if (!i || !i.id) return;
    incidentMap.set(i.id, { ...(incidentMap.get(i.id) || {}), ...i });
  });

  // 9. Merge Numbering Series Counters (Take MAXIMUM to avoid collisions across devices)
  const baseTime = base.lastUpdated ? new Date(base.lastUpdated).getTime() : 0;
  const incTime = incoming.lastUpdated ? new Date(incoming.lastUpdated).getTime() : 0;
  const incomingIsNewer = incTime > baseTime;

  const mergedSeriesConfig: SeriesConfig = {
    orderSeq: Math.max(base.seriesConfig?.orderSeq || 1, incoming.seriesConfig?.orderSeq || 1),
    productSeqs: {
      ...(base.seriesConfig?.productSeqs || {}),
      ...(incoming.seriesConfig?.productSeqs || {})
    },
    numberingMaster: {
      jobSeries: {
        prefix:
          (incomingIsNewer ? incoming.seriesConfig?.numberingMaster?.jobSeries?.prefix?.trim() : base.seriesConfig?.numberingMaster?.jobSeries?.prefix?.trim()) ||
          base.seriesConfig?.numberingMaster?.jobSeries?.prefix?.trim() ||
          incoming.seriesConfig?.numberingMaster?.jobSeries?.prefix?.trim() ||
          'WK-LOT',
        paddingDigits:
          (incomingIsNewer ? incoming.seriesConfig?.numberingMaster?.jobSeries?.paddingDigits : base.seriesConfig?.numberingMaster?.jobSeries?.paddingDigits) ??
          base.seriesConfig?.numberingMaster?.jobSeries?.paddingDigits ??
          incoming.seriesConfig?.numberingMaster?.jobSeries?.paddingDigits ??
          3,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.jobSeries?.nextSeq || 101,
          incoming.seriesConfig?.numberingMaster?.jobSeries?.nextSeq || 101
        )
      },
      slitSeries: {
        prefix:
          (incomingIsNewer ? incoming.seriesConfig?.numberingMaster?.slitSeries?.prefix?.trim() : base.seriesConfig?.numberingMaster?.slitSeries?.prefix?.trim()) ||
          base.seriesConfig?.numberingMaster?.slitSeries?.prefix?.trim() ||
          incoming.seriesConfig?.numberingMaster?.slitSeries?.prefix?.trim() ||
          'SLIT',
        paddingDigits:
          (incomingIsNewer ? incoming.seriesConfig?.numberingMaster?.slitSeries?.paddingDigits : base.seriesConfig?.numberingMaster?.slitSeries?.paddingDigits) ??
          base.seriesConfig?.numberingMaster?.slitSeries?.paddingDigits ??
          incoming.seriesConfig?.numberingMaster?.slitSeries?.paddingDigits ??
          2,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.slitSeries?.nextSeq || 1,
          incoming.seriesConfig?.numberingMaster?.slitSeries?.nextSeq || 1
        )
      },
      cutSeries: {
        prefix:
          (incomingIsNewer ? incoming.seriesConfig?.numberingMaster?.cutSeries?.prefix?.trim() : base.seriesConfig?.numberingMaster?.cutSeries?.prefix?.trim()) ||
          base.seriesConfig?.numberingMaster?.cutSeries?.prefix?.trim() ||
          incoming.seriesConfig?.numberingMaster?.cutSeries?.prefix?.trim() ||
          'CUT',
        paddingDigits:
          (incomingIsNewer ? incoming.seriesConfig?.numberingMaster?.cutSeries?.paddingDigits : base.seriesConfig?.numberingMaster?.cutSeries?.paddingDigits) ??
          base.seriesConfig?.numberingMaster?.cutSeries?.paddingDigits ??
          incoming.seriesConfig?.numberingMaster?.cutSeries?.paddingDigits ??
          2,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.cutSeries?.nextSeq || 1,
          incoming.seriesConfig?.numberingMaster?.cutSeries?.nextSeq || 1
        )
      },
      qcSeries: {
        prefix:
          (incomingIsNewer ? incoming.seriesConfig?.numberingMaster?.qcSeries?.prefix?.trim() : base.seriesConfig?.numberingMaster?.qcSeries?.prefix?.trim()) ||
          base.seriesConfig?.numberingMaster?.qcSeries?.prefix?.trim() ||
          incoming.seriesConfig?.numberingMaster?.qcSeries?.prefix?.trim() ||
          'QC',
        paddingDigits:
          (incomingIsNewer ? incoming.seriesConfig?.numberingMaster?.qcSeries?.paddingDigits : base.seriesConfig?.numberingMaster?.qcSeries?.paddingDigits) ??
          base.seriesConfig?.numberingMaster?.qcSeries?.paddingDigits ??
          incoming.seriesConfig?.numberingMaster?.qcSeries?.paddingDigits ??
          2,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.qcSeries?.nextSeq || 1,
          incoming.seriesConfig?.numberingMaster?.qcSeries?.nextSeq || 1
        )
      },
      planSeries: {
        prefix:
          (incomingIsNewer ? incoming.seriesConfig?.numberingMaster?.planSeries?.prefix?.trim() : base.seriesConfig?.numberingMaster?.planSeries?.prefix?.trim()) ||
          base.seriesConfig?.numberingMaster?.planSeries?.prefix?.trim() ||
          incoming.seriesConfig?.numberingMaster?.planSeries?.prefix?.trim() ||
          'PLAN',
        paddingDigits:
          (incomingIsNewer ? incoming.seriesConfig?.numberingMaster?.planSeries?.paddingDigits : base.seriesConfig?.numberingMaster?.planSeries?.paddingDigits) ??
          base.seriesConfig?.numberingMaster?.planSeries?.paddingDigits ??
          incoming.seriesConfig?.numberingMaster?.planSeries?.paddingDigits ??
          3,
        nextSeq: Math.max(
          base.seriesConfig?.numberingMaster?.planSeries?.nextSeq || 1,
          incoming.seriesConfig?.numberingMaster?.planSeries?.nextSeq || 1
        )
      },
      useGlobalJobPrefix:
        incomingIsNewer
          ? (incoming.seriesConfig?.numberingMaster?.useGlobalJobPrefix ?? base.seriesConfig?.numberingMaster?.useGlobalJobPrefix ?? false)
          : (base.seriesConfig?.numberingMaster?.useGlobalJobPrefix ?? incoming.seriesConfig?.numberingMaster?.useGlobalJobPrefix ?? false)
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
    lastSentNightDate: incoming.whatsappConfig?.lastSentNightDate || base.whatsappConfig?.lastSentNightDate,
    autoNotifyMaintenanceBreakdown: incoming.whatsappConfig?.autoNotifyMaintenanceBreakdown ?? base.whatsappConfig?.autoNotifyMaintenanceBreakdown ?? true,
    autoNotifyCriticalQcDefect: incoming.whatsappConfig?.autoNotifyCriticalQcDefect ?? base.whatsappConfig?.autoNotifyCriticalQcDefect ?? true,
    autoNotifyDispatchCompletion: incoming.whatsappConfig?.autoNotifyDispatchCompletion ?? base.whatsappConfig?.autoNotifyDispatchCompletion ?? true,
    autoNotifyDailyManpower: incoming.whatsappConfig?.autoNotifyDailyManpower ?? base.whatsappConfig?.autoNotifyDailyManpower ?? true,
    autoNotifyLowStockRequisition: incoming.whatsappConfig?.autoNotifyLowStockRequisition ?? base.whatsappConfig?.autoNotifyLowStockRequisition ?? true,
    autoNotifyScrapSpike: incoming.whatsappConfig?.autoNotifyScrapSpike ?? base.whatsappConfig?.autoNotifyScrapSpike ?? false,
    managementContacts: incoming.whatsappConfig?.managementContacts || base.whatsappConfig?.managementContacts || [],
    userRights: { ...(base.whatsappConfig?.userRights || {}), ...(incoming.whatsappConfig?.userRights || {}) },
    dispatchLogs: [
      ...(incoming.whatsappConfig?.dispatchLogs || []),
      ...(base.whatsappConfig?.dispatchLogs || []).filter(
        b => !(incoming.whatsappConfig?.dispatchLogs || []).some(inc => inc.id === b.id)
      )
    ].slice(0, 50)
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
    deletedWorkerIds,
    deletedHandoverIds,
    floorWorkers: (() => {
      const map = new Map();
      (base.floorWorkers || []).forEach(w => {
        if (w && !deletedWorkerIds.includes(w.id)) map.set(w.id || w.name, w);
      });
      (incoming.floorWorkers || []).forEach(w => {
        if (!w) return;
        const key = w.id || w.name;
        if (!deletedWorkerIds.includes(w.id) && !map.has(key)) map.set(key, w);
      });
      return Array.from(map.values());
    })(),
    deptWorkers: (() => {
      const updatedDeptWorkers: Record<string, string[]> = {};
      const mergedFloorWorkers = (() => {
        const map = new Map();
        (base.floorWorkers || []).forEach(w => {
          if (w && !deletedWorkerIds.includes(w.id)) map.set(w.id || w.name, w);
        });
        (incoming.floorWorkers || []).forEach(w => {
          if (!w) return;
          const key = w.id || w.name;
          if (!deletedWorkerIds.includes(w.id) && !map.has(key)) map.set(key, w);
        });
        return Array.from(map.values());
      })();

      mergedFloorWorkers.forEach(w => {
        if (!w || !w.department) return;
        if (!updatedDeptWorkers[w.department]) updatedDeptWorkers[w.department] = [];
        if (!updatedDeptWorkers[w.department].includes(w.name)) {
          updatedDeptWorkers[w.department].push(w.name);
        }
      });
      return updatedDeptWorkers;
    })(),
    lastUpdated: incomingIsNewer ? incoming.lastUpdated : (base.lastUpdated || new Date().toISOString()),
    targetGsmMaster: Array.from(new Set([
      ...(base.targetGsmMaster || []),
      ...(incoming.targetGsmMaster || [])
    ])),
    targetLayersMaster: Array.from(new Set([
      ...(base.targetLayersMaster || []),
      ...(incoming.targetLayersMaster || [])
    ])),
    products: Array.from(new Set([
      ...(base.products || []),
      ...(incoming.products || [])
    ])),
    paperBrands: Array.from(new Set([
      ...(base.paperBrands || []),
      ...(incoming.paperBrands || [])
    ])),
    glueBrands: Array.from(new Set([
      ...(base.glueBrands || []),
      ...(incoming.glueBrands || [])
    ])),
    productPrefixMap: {
      ...(base.productPrefixMap || {}),
      ...(incoming.productPrefixMap || {})
    },
    machinesMaster: {
      ...(base.machinesMaster || {}),
      ...(incoming.machinesMaster || {})
    },
    pcsPerKgMaster: {
      ...(base.pcsPerKgMaster || {}),
      ...(incoming.pcsPerKgMaster || {})
    },
    scrapLimitsMaster: {
      ...(base.scrapLimitsMaster || {}),
      ...(incoming.scrapLimitsMaster || {})
    },
    scrapToleranceKgMaster: Array.from(new Set([
      ...(base.scrapToleranceKgMaster || []),
      ...(incoming.scrapToleranceKgMaster || [])
    ])),
    maintenanceContacts: incoming.maintenanceContacts !== undefined ? incoming.maintenanceContacts : base.maintenanceContacts,
    coordinationMatrix: incoming.coordinationMatrix?.length ? incoming.coordinationMatrix : base.coordinationMatrix,
    departmentHeads: incoming.departmentHeads?.length ? incoming.departmentHeads : base.departmentHeads,
    maintenanceTechniciansMaster: incoming.maintenanceTechniciansMaster?.length ? incoming.maintenanceTechniciansMaster : base.maintenanceTechniciansMaster,
    maintenanceSparePartsMaster: incoming.maintenanceSparePartsMaster?.length ? incoming.maintenanceSparePartsMaster : base.maintenanceSparePartsMaster,
    crateCapacityMaster: { ...(base.crateCapacityMaster || {}), ...(incoming.crateCapacityMaster || {}) }
  };

  return merged;
}
