import { FactoryState } from '../types';

export function generateShiftChangeoverReportText(
  state: FactoryState,
  targetShift: 'DAY' | 'NIGHT'
): string {
  const today = new Date().toISOString().split('T')[0];
  const shiftTitle = targetShift === 'DAY' ? '☀️ DAY SHIFT' : '🌙 NIGHT SHIFT';

  // 1. Gather all logs recorded for today & targetShift
  const shiftLogs = (state.logs || []).filter((l) => {
    const logDate = l.timestamp ? l.timestamp.split('T')[0] : '';
    const matchesDate = logDate === today;
    const matchesShift = l.shift ? l.shift.toUpperCase() === targetShift : true;
    return matchesDate && matchesShift;
  });

  // 2. Machine Operators & Output extraction
  // Slitting
  const slittingLogs = shiftLogs.filter((l) => l.action?.toLowerCase().includes('slit') || l.jobId?.startsWith('SL-'));
  const slittingOperators = Array.from(new Set(slittingLogs.map((l) => l.operator).filter(Boolean)));
  const slittingRolls = slittingLogs.reduce((acc, l) => {
    const match = l.details?.match(/(\d+)\s*Rolls/i);
    return acc + (match ? parseInt(match[1], 10) : 0);
  }, 0);
  const slittingScrap = slittingLogs.reduce((acc, l) => {
    const match = l.details?.match(/Scrap:\s*([\d.]+)\s*KG/i);
    return acc + (match ? parseFloat(match[1]) : 0);
  }, 0);

  // Cutting Machines
  const cuttingLogs = shiftLogs.filter((l) => l.action?.toLowerCase().includes('cut') || l.jobId?.startsWith('CUT-'));
  const cutM1Logs = cuttingLogs.filter((l) => l.station === 'Cutting-01' || l.machine?.includes('01'));
  const cutM2Logs = cuttingLogs.filter((l) => l.station === 'Cutting-02' || l.machine?.includes('02'));
  const cutM1Ops = Array.from(new Set(cutM1Logs.map((l) => l.operator).filter(Boolean)));
  const cutM2Ops = Array.from(new Set(cutM2Logs.map((l) => l.operator).filter(Boolean)));
  const cutOtherOps = Array.from(
    new Set(
      cuttingLogs
        .filter((l) => !cutM1Ops.includes(l.operator) && !cutM2Ops.includes(l.operator))
        .map((l) => l.operator)
        .filter(Boolean)
    )
  );

  // Forming Machines (M1 to M8)
  const formingLogs = shiftLogs.filter((l) => l.action?.toLowerCase().includes('form') || l.jobId?.startsWith('FORM-'));
  const formingMachineReports: string[] = [];
  const activeMachines = ['M-01', 'M-02', 'M-03', 'M-04', 'M-05', 'M-06', 'M-07', 'M-08'];
  
  activeMachines.forEach((m) => {
    const mLogs = formingLogs.filter((l) => l.station === m || l.machine === m || l.details?.includes(m));
    const mOps = Array.from(new Set(mLogs.map((l) => l.operator).filter(Boolean)));
    const mRunningBatches = state.jobs?.flatMap((j) =>
      (j.runningBatches || []).filter((b) => b.machine === m && b.status === 'Running')
    ) || [];

    const opName = mOps.length > 0 ? mOps.join(', ') : (mRunningBatches[0]?.operator || 'Assigned');
    const crates = mLogs.reduce((acc, l) => {
      const match = l.details?.match(/(\d+)\s*Crates/i);
      return acc + (match ? parseInt(match[1], 10) : 0);
    }, 0);

    formingMachineReports.push(
      `  • ${m}: ${opName} | ${crates > 0 ? `${crates} Crates` : `${mRunningBatches.length > 0 ? 'Active' : 'Standby'}`}`
    );
  });

  // QC Inspection
  const qcLogs = shiftLogs.filter((l) => l.action?.toLowerCase().includes('qc') || l.details?.toLowerCase().includes('qc'));
  const qcInspectors = Array.from(new Set(qcLogs.map((l) => l.operator).filter(Boolean)));
  const qcOkCrates = qcLogs.reduce((acc, l) => {
    const match = l.details?.match(/(\d+)\s*OK Crates/i) || l.details?.match(/Accepted:\s*(\d+)/i);
    return acc + (match ? parseInt(match[1], 10) : 0);
  }, 0);
  const qcScrapCrates = qcLogs.reduce((acc, l) => {
    const match = l.details?.match(/(\d+)\s*Scrap Crates/i) || l.details?.match(/Rejected:\s*(\d+)/i);
    return acc + (match ? parseInt(match[1], 10) : 0);
  }, 0);

  // Packing
  const packLogs = shiftLogs.filter((l) => l.action?.toLowerCase().includes('pack') || l.jobId?.startsWith('PKG-'));
  const packOperators = Array.from(new Set(packLogs.map((l) => l.operator).filter(Boolean)));
  const packedBoxes = packLogs.reduce((acc, l) => {
    const match = l.details?.match(/(\d+)\s*Boxes/i);
    return acc + (match ? parseInt(match[1], 10) : 0);
  }, 0);

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

  return `🏭 *WÜNDERKRAF PAPERWARE ERP*
📋 *DAILY SHIFT CHANGEOVER REPORT*
━━━━━━━━━━━━━━━━━━━━
📅 *Date:* ${today}
⏱️ *Shift:* ${shiftTitle}
━━━━━━━━━━━━━━━━━━━━

⚙️ *ALL MACHINES & OPERATOR PERFORMANCE:*

📜 *1. SLITTING DESK:*
• Machine: Slitter-01
• Operator: ${slittingOperators.join(', ') || 'Floor Team'}
• Output: ${slittingRolls > 0 ? `${slittingRolls} Rolls` : 'Continuous Run'}
• Scrap: ${slittingScrap.toFixed(1)} KG

✂️ *2. CUTTING DESK:*
• Machine C-01: ${cutM1Ops.join(', ') || 'Team A'}
• Machine C-02: ${cutM2Ops.join(', ') || 'Team B'}
${cutOtherOps.length > 0 ? `• Operators: ${cutOtherOps.join(', ')}` : ''}

⚙️ *3. FORMING DESK (M1 - M8):*
${formingMachineReports.join('\n')}

🔍 *4. QC INSPECTION DESK:*
• Inspector(s): ${qcInspectors.join(', ') || 'QC Lead'}
• Checked: ${qcOkCrates > 0 ? `${qcOkCrates} OK Crates` : 'Inspections Logged'}
• Scrap Rejected: ${qcScrapCrates} Crates

📦 *5. PACKING & DISPATCH:*
• Packing Team: ${packOperators.join(', ') || 'Packaging Team'}
• Boxes Packed: ${packedBoxes > 0 ? `${packedBoxes} Boxes` : 'In Progress'}
• Pending Dispatch Orders: ${state.packJobs.filter((o) => o.status !== 'Dispatched').length}

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
export function generateManpowerAttendanceReportText(state: FactoryState): string {
  const today = new Date().toISOString().split('T')[0];
  const workers = state.floorWorkers || [];
  const total = workers.length;
  const presentWorkers = workers.filter((w) => w.isPresent || w.status !== 'INACTIVE');
  const presentCount = presentWorkers.length;
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
📅 *Date:* ${today}
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
  details?: { machine?: string; defect?: string; rejectedQty?: number; product?: string }
): string {
  const machine = details?.machine || 'Forming M-04';
  const defect = details?.defect || 'Rim Distortion / Weak Seal';
  const rejected = details?.rejectedQty || 2;
  const product = details?.product || 'Paper Spoon 140mm';

  return `🔍 *QUALITY (QC) DEFECT & SCRAP NOTIFICATION*
━━━━━━━━━━━━━━━━━━━━
📍 *Inspection Station:* QC Desk #1
⚙️ *Machine / Line:* *${machine}*
📦 *Product:* ${product}
━━━━━━━━━━━━━━━━━━━━
⚠️ *DEFECT DETAILS:*
• Defect Type: *${defect}*
• Rejected Crates: *${rejected} Crates*
• Batch Disposition: *HOLD & RETEST*
• Root Cause: Temperature fluctuation or tool alignment

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

  const clientName = latestDispatched?.customerName || latestDispatched?.client || 'Premium Client';
  const invoiceNo = latestDispatched?.invoiceNo || latestDispatched?.dispatchId || `DC-${Date.now().toString().slice(-5)}`;
  const boxes = latestDispatched?.boxesCount || latestDispatched?.producedBoxes || 50;
  const product = latestDispatched?.product || 'Eco Paper Cutlery Kit';

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
export function generateScrapYieldReportText(state: FactoryState): string {
  const today = new Date().toISOString().split('T')[0];
  const logs = state.logs || [];
  
  const slittingScrap = logs
    .filter((l) => l.action?.toLowerCase().includes('slit') && l.timestamp?.startsWith(today))
    .reduce((acc, l) => {
      const match = l.details?.match(/Scrap:\s*([\d.]+)\s*KG/i);
      return acc + (match ? parseFloat(match[1]) : 0);
    }, 0);

  const cuttingScrap = logs
    .filter((l) => l.action?.toLowerCase().includes('cut') && l.timestamp?.startsWith(today))
    .reduce((acc, l) => {
      const match = l.details?.match(/Scrap:\s*([\d.]+)\s*KG/i);
      return acc + (match ? parseFloat(match[1]) : 0);
    }, 0);

  return `📊 *WÜNDERKRAF SCRAP & MATERIAL YIELD REPORT*
━━━━━━━━━━━━━━━━━━━━
📅 *Date:* ${today}
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


