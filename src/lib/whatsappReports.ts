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
      fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  window.open(waUrl, '_blank', 'noopener,noreferrer');
}
