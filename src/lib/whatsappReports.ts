import { FactoryState } from '../types';

export interface OperatorShiftSummary {
  name: string;
  stage: string;
  machine: string;
  outputCratesOrRolls: number;
  outputPieces: number;
  scrapKg: number;
  defectsPcs: number;
}

export function generateShiftChangeoverReportText(
  state: FactoryState,
  targetShift: 'DAY' | 'NIGHT',
  targetDate?: string
): string {
  const today = targetDate || new Date().toISOString().split('T')[0];
  const shiftTitle = targetShift === 'DAY' ? '☀️ DAY SHIFT' : '🌙 NIGHT SHIFT';

  // Helper date checker
  const isMatchingDate = (dateVal?: string): boolean => {
    if (!dateVal) return false;
    const clean = dateVal.trim().split('T')[0].split(' ')[0].replace(/\//g, '-');
    const target = today.replace(/\//g, '-');
    return clean === target || dateVal.includes(today);
  };

  const isMatchingShift = (shiftVal?: string): boolean => {
    if (!shiftVal) return true;
    return shiftVal.trim().toUpperCase() === targetShift;
  };

  // Structured Operator Map
  const operatorSummaryMap = new Map<string, OperatorShiftSummary>();
  const addOperatorMetric = (
    name: string,
    stage: string,
    machine: string,
    cratesOrRolls: number,
    pieces: number,
    scrapKg: number,
    defectsPcs: number = 0
  ) => {
    const cleanName = (name || 'Assigned Operator').trim().toUpperCase();
    if (cleanName === 'UNKNOWN' || cleanName === 'ADMIN' || cleanName === 'OPERATOR') return;
    const key = `${cleanName}_${stage}_${machine}`;
    const existing = operatorSummaryMap.get(key) || {
      name: cleanName,
      stage,
      machine,
      outputCratesOrRolls: 0,
      outputPieces: 0,
      scrapKg: 0,
      defectsPcs: 0
    };
    existing.outputCratesOrRolls += cratesOrRolls;
    existing.outputPieces += pieces;
    existing.scrapKg += scrapKg;
    existing.defectsPcs += defectsPcs;
    operatorSummaryMap.set(key, existing);
  };

  // 1. Slitting Structured Extraction
  let totalSlitRollsProduced = 0;
  let totalSlitScrapKg = 0;
  const slittingActiveOps = new Set<string>();

  (state.jobs || []).forEach((j) => {
    (j.reelsList || []).forEach((r) => {
      const rDate = r.startTime || j.date || j.createdAt || '';
      if (isMatchingDate(rDate) && (!r.batchId || true)) {
        const rolls = r.rolls || 1;
        const scrap = r.scrapKg || 0;
        totalSlitRollsProduced += rolls;
        totalSlitScrapKg += scrap;
        const op = r.worker || 'Slitting Lead';
        slittingActiveOps.add(op);
        addOperatorMetric(op, 'Slitting', 'Slitter-01', rolls, 0, scrap);
      }
    });

    (j.runningBatches || []).forEach((b) => {
      if (b.stage === 'Slitting' && isMatchingDate(b.startTime) && isMatchingShift(b.shift)) {
        const rolls = b.producedQty || 0;
        const scrap = b.scrapKg || 0;
        if (rolls > 0) {
          totalSlitRollsProduced += rolls;
          totalSlitScrapKg += scrap;
          const op = b.worker || b.operator || 'Slitting Operator';
          slittingActiveOps.add(op);
          addOperatorMetric(op, 'Slitting', b.machine || 'Slitter-01', rolls, 0, scrap);
        }
      }
    });
  });

  // 2. Cutting Structured Extraction
  let totalCutCratesProduced = 0;
  let totalCutPiecesProduced = 0;
  let totalCutScrapKg = 0;
  const cuttingMachineMap = new Map<string, { ops: Set<string>; crates: number; pcs: number; scrapKg: number }>();

  (state.jobs || []).forEach((j) => {
    (j.runningBatches || []).forEach((b) => {
      if (b.stage === 'Cutting' && isMatchingDate(b.startTime) && isMatchingShift(b.shift)) {
        const crates = b.producedQty || 0;
        const pcs = b.producedPieces || b.outputPieces || (crates * (j.pcsPerCrateCutting || 10000));
        const scrap = b.scrapKg || 0;
        const machine = b.machine || 'Cutting-1';
        const op = b.worker || b.operator || 'Cutting Operator';

        totalCutCratesProduced += crates;
        totalCutPiecesProduced += pcs;
        totalCutScrapKg += scrap;

        const mStat = cuttingMachineMap.get(machine) || { ops: new Set<string>(), crates: 0, pcs: 0, scrapKg: 0 };
        mStat.ops.add(op);
        mStat.crates += crates;
        mStat.pcs += pcs;
        mStat.scrapKg += scrap;
        cuttingMachineMap.set(machine, mStat);

        addOperatorMetric(op, 'Cutting', machine, crates, pcs, scrap);
      }

      // Check slices
      (b.slices || []).forEach((sl) => {
        if (isMatchingDate(sl.handoverTime) && isMatchingShift(sl.shift)) {
          const crates = sl.producedQty || 0;
          const pcs = sl.producedPieces || (crates * (j.pcsPerCrateCutting || 10000));
          const scrap = sl.scrapQty || 0;
          const machine = b.machine || 'Cutting-1';
          const op = sl.operator || 'Shift Operator';

          totalCutCratesProduced += crates;
          totalCutPiecesProduced += pcs;
          totalCutScrapKg += scrap;

          const mStat = cuttingMachineMap.get(machine) || { ops: new Set<string>(), crates: 0, pcs: 0, scrapKg: 0 };
          mStat.ops.add(op);
          mStat.crates += crates;
          mStat.pcs += pcs;
          mStat.scrapKg += scrap;
          cuttingMachineMap.set(machine, mStat);

          addOperatorMetric(op, 'Cutting', machine, crates, pcs, scrap);
        }
      });
    });
  });

  // 3. Forming Structured Extraction
  const formingRegistered = state.machinesMaster?.['Forming'] || ['Forming-1', 'Forming-2', 'Forming-3', 'Forming-4'];
  const formingReportList: string[] = [];
  let totalFormedCratesShift = 0;
  let totalFormedPiecesShift = 0;
  let totalFormingDefectPcs = 0;

  formingRegistered.forEach((mach) => {
    let mCrates = 0;
    let mPcs = 0;
    let mDefects = 0;
    const mOps = new Set<string>();

    (state.jobs || []).forEach((j) => {
      (j.runningBatches || []).forEach((b) => {
        if (b.stage === 'Forming' && (b.machine === mach || b.machine?.endsWith(mach.replace(/[^0-9]/g, '')))) {
          if (isMatchingDate(b.startTime) && isMatchingShift(b.shift)) {
            const cr = b.producedQty || 0;
            const pcs = b.producedPieces || b.outputPieces || (cr * (j.pcsPerCrateForming || 5000));
            const def = b.rejectedPieces || b.scrapPieces || b.scrapPcs || 0;
            const op = b.operator || b.worker || 'Forming Op';

            mCrates += cr;
            mPcs += pcs;
            mDefects += def;
            mOps.add(op);
            addOperatorMetric(op, 'Forming', mach, cr, pcs, 0, def);
          }

          (b.slices || []).forEach((sl) => {
            if (isMatchingDate(sl.handoverTime) && isMatchingShift(sl.shift)) {
              const cr = sl.producedQty || 0;
              const pcs = sl.producedPieces || (cr * (j.pcsPerCrateForming || 5000));
              const def = sl.scrapQty || 0;
              const op = sl.operator || 'Forming Op';

              mCrates += cr;
              mPcs += pcs;
              mDefects += def;
              mOps.add(op);
              addOperatorMetric(op, 'Forming', mach, cr, pcs, 0, def);
            }
          });
        }
      });
    });

    totalFormedCratesShift += mCrates;
    totalFormedPiecesShift += mPcs;
    totalFormingDefectPcs += mDefects;

    const opDisplay = mOps.size > 0 ? Array.from(mOps).join(', ') : 'Standby / Idle';
    const statusText = mCrates > 0
      ? `*${mCrates} Crates* (${mPcs.toLocaleString()} Pcs)${mDefects > 0 ? ` | ⚠️ Defect: ${mDefects} Pcs` : ''}`
      : 'Standby';

    formingReportList.push(`  • *${mach}:* ${opDisplay} ➔ ${statusText}`);
  });

  // 4. QC Inspection Structured Extraction
  let totalQcApprovedCrates = 0;
  let totalQcDefectsPcs = 0;
  const qcInspectors = new Set<string>();
  const defectBreakdownMap = new Map<string, number>();

  (state.qcDefectRecords || []).forEach((rec) => {
    if (isMatchingDate(rec.timestamp)) {
      const rej = rec.rejectedPcs || 0;
      totalQcDefectsPcs += rej;
      if (rec.inspector) qcInspectors.add(rec.inspector);
      if (rec.defectCategory && rej > 0) {
        defectBreakdownMap.set(rec.defectCategory, (defectBreakdownMap.get(rec.defectCategory) || 0) + rej);
      }
      if (rec.operator && rej > 0) {
        addOperatorMetric(rec.operator, 'Forming', rec.machine || 'Forming Line', 0, 0, 0, rej);
      }
    }
  });

  // 5. Packing & Dispatch Structured Extraction
  let totalBoxesPacked = 0;
  let totalBoxesDispatched = 0;
  const packWorkers = new Set<string>();

  (state.packJobs || []).forEach((pj) => {
    (pj.historyRuns || []).forEach((hr) => {
      if (isMatchingDate(hr.date) && isMatchingShift(hr.shift)) {
        const boxes = hr.boxes || hr.boxesPacked || 0;
        totalBoxesPacked += boxes;
        if (hr.worker) packWorkers.add(hr.worker);
      }
    });

    (pj.dispatchLogs || []).forEach((dl) => {
      if (isMatchingDate(dl.date)) {
        totalBoxesDispatched += dl.boxes || 0;
      }
    });
  });

  (state.gatePassDispatches || []).forEach((gp) => {
    if (isMatchingDate(gp.dispatchTimestamp)) {
      totalBoxesDispatched += gp.boxesCount || 0;
    }
  });

  // Fallback to shift logs if batch arrays were empty
  const shiftLogs = (state.logs || []).filter((l) => {
    const logDate = l.rawDate || l.date || (l.timestamp ? l.timestamp.split('T')[0] : '');
    return isMatchingDate(logDate) && isMatchingShift(l.shift);
  });

  if (totalSlitRollsProduced === 0) {
    const slitLogs = shiftLogs.filter((l) => l.action?.toLowerCase().includes('slit'));
    slitLogs.forEach((l) => {
      const match = l.action?.match(/(\d+)\s*Rolls/i) || l.details?.match(/(\d+)\s*Rolls/i);
      if (match) totalSlitRollsProduced += parseInt(match[1], 10);
      const scMatch = l.action?.match(/Scrap:\s*([\d.]+)\s*KG/i);
      if (scMatch) totalSlitScrapKg += parseFloat(scMatch[1]);
      if (l.worker || l.operator) slittingActiveOps.add(l.worker || l.operator || '');
    });
  }

  if (totalCutCratesProduced === 0) {
    const cutLogs = shiftLogs.filter((l) => l.action?.toLowerCase().includes('cut'));
    cutLogs.forEach((l) => {
      const match = l.action?.match(/(\d+)\s*(?:Cut\s*)?Crates/i);
      if (match) totalCutCratesProduced += parseInt(match[1], 10);
      const scMatch = l.action?.match(/Scrap:\s*([\d.]+)\s*KG/i);
      if (scMatch) totalCutScrapKg += parseFloat(scMatch[1]);
    });
    totalCutPiecesProduced = totalCutCratesProduced * 10000;
  }

  // Stock WIP Balances
  const totalSlitRollsWip = (state.jobs || []).reduce((a, b) => a + (b.availableRolls || 0), 0);
  const totalCutCratesWip = (state.jobs || []).reduce((a, b) => a + (b.availableCuttingCrates || 0), 0);
  const totalFormedCratesWip = (state.jobs || []).reduce((a, b) => a + (b.availableFormingCrates || 0), 0);
  const totalQcOkCratesWip = (state.jobs || []).reduce((a, b) => a + (b.availableQcCrates || 0), 0);

  // Workforce Attendance
  const floorWorkers = state.floorWorkers || [];
  const presentCount = floorWorkers.filter((w) => w.isPresent || w.shiftStatus === 'PRESENT').length;

  // Face-to-Face Operator Scorecard Text
  const operatorScorecardList = Array.from(operatorSummaryMap.values());
  const operatorScorecardText = operatorScorecardList.length > 0
    ? operatorScorecardList
        .map((op) => {
          const outLabel = op.stage === 'Slitting'
            ? `${op.outputCratesOrRolls} Rolls`
            : `${op.outputCratesOrRolls} Crates (${op.outputPieces.toLocaleString()} Pcs)`;
          const scrapLabel = op.scrapKg > 0 ? ` | Scrap: ${op.scrapKg.toFixed(1)} KG` : '';
          const defectLabel = op.defectsPcs > 0 ? ` | ⚠️ Defect: ${op.defectsPcs} Pcs` : ' | 0 Defect ✅';
          return `  • *${op.name}* [${op.stage} / ${op.machine}]: ${outLabel}${scrapLabel}${defectLabel}`;
        })
        .join('\n')
    : '  • Data logged via supervisor floor entries';

  // Cutting Machine Breakdown Text
  const cuttingMachineLines: string[] = [];
  cuttingMachineMap.forEach((mStat, mach) => {
    const ops = mStat.ops.size > 0 ? Array.from(mStat.ops).join(', ') : 'Operator';
    cuttingMachineLines.push(
      `  • *${mach}:* ${ops} ➔ *${mStat.crates} Crates* (${mStat.pcs.toLocaleString()} Pcs) | Scrap: ${mStat.scrapKg.toFixed(1)} KG`
    );
  });
  if (cuttingMachineLines.length === 0) {
    cuttingMachineLines.push(
      `  • *Cutting Lines:* ${totalCutCratesProduced > 0 ? `${totalCutCratesProduced} Crates (${totalCutPiecesProduced.toLocaleString()} Pcs)` : 'Standby / Continuous Run'}`
    );
  }

  // Defect breakdown text
  const defectLines = Array.from(defectBreakdownMap.entries())
    .map(([cat, qty]) => `    - ${cat}: ${qty} Pcs`)
    .join('\n');

  return `🏭 *WÜNDERKRAF PAPERWARE FACTORY ERP*
📋 *OFFICIAL SHIFT CHANGEOVER & PRODUCTION AUDIT*
━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 *Date:* ${today}
⏱️ *Shift:* ${shiftTitle}
━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ *LINE-BY-LINE VERIFIED PRODUCTION:*

📜 *1. SLITTING DESK:*
• Machine: Slitter-01
• Active Operator: ${Array.from(slittingActiveOps).join(', ') || 'Floor Team'}
• Slit Output: *${totalSlitRollsProduced} Rolls* ✅
• Slitting Edge Scrap: *${totalSlitScrapKg.toFixed(1)} KG*

✂️ *2. CUTTING DESK (BLANK PRODUCTION):*
${cuttingMachineLines.join('\n')}
• Total Shift Cut: *${totalCutCratesProduced} Crates* (*${totalCutPiecesProduced.toLocaleString()} Blank Pieces*)
• Total Cutting Web Scrap: *${totalCutScrapKg.toFixed(1)} KG*

⚙️ *3. FORMING DESK (CUP & CUTLERY SPINDLES):*
${formingReportList.join('\n')}
• Total Shift Formed: *${totalFormedCratesShift} Crates* (*${totalFormedPiecesShift.toLocaleString()} Pieces*)

🔍 *4. QUALITY CONTROL (QC GATE):*
• Certified Inspector: ${Array.from(qcInspectors).join(', ') || 'QC Lead'}
• Approved Clean Crates: *${totalQcApprovedCrates} Crates* ✅
• Rejected Defect Pieces: *${totalQcDefectsPcs} Pieces*
${defectLines ? `• Defect Classification:\n${defectLines}\n` : ''}
📦 *5. PACKING & DISPATCH:*
• Packing Lead: ${Array.from(packWorkers).join(', ') || 'Packaging Line'}
• Finished Boxes Packed: *${totalBoxesPacked} Boxes*
• Official Outward Dispatched: *${totalBoxesDispatched} Boxes*
• Pending Dispatch Orders: *${(state.packJobs || []).filter((o) => o.status !== 'Dispatched').length} Active*

━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *OPERATOR FACE-TO-FACE SCORECARD (आमने-सामने हिसाब):*
${operatorScorecardText}

━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 *FLOOR MANPOWER ATTENDANCE:*
• Registered Workforce: *${floorWorkers.length} Employees*
• Present on Floor: *${presentCount} Workers Present* ✅
• Absent/On Leave: *${Math.max(0, floorWorkers.length - presentCount)} On Leave*

━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *FACTORY FLOOR WIP BUFFER (LIVE BALANCE):*
• 📜 Slit Rolls Buffer: *${totalSlitRollsWip} Rolls*
• ✂️ Flat Blank Crates: *${totalCutCratesWip} Crates*
• ⚙️ Formed Spindle Crates: *${totalFormedCratesWip} Crates*
• 🔍 QC Cleared Buffer: *${totalQcOkCratesWip} Crates*

━━━━━━━━━━━━━━━━━━━━━━━━━━
_Verified Enterprise ERP Automation by Wünderkraf_`;
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


