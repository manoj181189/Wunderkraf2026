import { FactoryState, Job, JobReelItem, LogEntry, PackJob, PlannedLayer, ProductionPlan, ProductType, ShiftConfig } from '../types';
import { PRODUCTS } from './constants';

export function calculateLiveStock(jobs: Job[], packJobs: PackJob[], customProducts?: string[]) {
  const allProds = customProducts && customProducts.length > 0 ? customProducts : PRODUCTS;
  const stock: Record<string, { Rolls: number; Cutting: number; Forming: number; QC: number; Packed: number }> = {};
  allProds.forEach((p) => {
    stock[p] = { Rolls: 0, Cutting: 0, Forming: 0, QC: 0, Packed: 0 };
  });

  jobs.forEach((j) => {
    if (!stock[j.product]) {
      stock[j.product] = { Rolls: 0, Cutting: 0, Forming: 0, QC: 0, Packed: 0 };
    }
    stock[j.product].Rolls += j.availableRolls || 0;
    stock[j.product].Cutting += j.availableCuttingCrates || 0;
    stock[j.product].Forming += j.availableFormingCrates || 0;
    stock[j.product].QC += j.availableQcCrates || 0;
  });

  packJobs.forEach((pj) => {
    if (pj.issuedCrates) {
      Object.keys(pj.issuedCrates).forEach((pName) => {
        if (!stock[pName]) {
          stock[pName] = { Rolls: 0, Cutting: 0, Forming: 0, QC: 0, Packed: 0 };
        }
        stock[pName].Packed += pj.issuedCrates[pName] || 0;
      });
    }
  });

  return stock;
}

export function calculateAvailableScrapKg(logs: LogEntry[], scrapSales: any[]): number {
  let totalGeneratedKg = 0;
  logs.forEach((l) => {
    if (l.action) {
      const matchScrap = l.action.match(/Scrap:\s*(\d+)\s*KG/i) || l.action.match(/Scrap:\s*(\d+)/i);
      if (matchScrap && !l.action.includes('Pieces') && !l.action.includes('Pcs')) {
        totalGeneratedKg += parseInt(matchScrap[1], 10) || 0;
      }
    }
  });

  let totalSoldKg = 0;
  (scrapSales || []).forEach((s) => (totalSoldKg += s.soldKg || s.weightKg || 0));
  return Math.max(0, totalGeneratedKg - totalSoldKg);
}

export function calculateTimeDifference(startStr?: string, endStr?: string): string {
  if (!startStr || !endStr || endStr === 'RUNNING' || endStr === 'HELD' || endStr === '') return 'In-Progress';
  try {
    const s = new Date('1970/01/01 ' + startStr);
    const e = new Date('1970/01/01 ' + endStr);
    let diffMs = e.getTime() - s.getTime();
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
    const diffMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs > 0 ? hrs + 'h ' : ''}${mins}m`;
  } catch (err) {
    return 'N/A';
  }
}

export function getCurrentExpectedShift(shiftConfig: ShiftConfig): 'DAY' | 'NIGHT' {
  const now = new Date();
  const curTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const ds = shiftConfig?.dayStart || '08:00';
  const de = shiftConfig?.dayEnd || '20:00';
  if (ds < de) {
    return curTime >= ds && curTime < de ? 'DAY' : 'NIGHT';
  } else {
    return curTime >= ds || curTime < de ? 'DAY' : 'NIGHT';
  }
}

export function generateDailySummaryCSV(state: FactoryState, sDate?: string, eDate?: string): string {
  const { logs, scrapSales } = state;
  const totals = {
    Spoon_Crates: 0,
    Fork_Crates: 0,
    Knife_Crates: 0,
    DessertSpoon_Crates: 0,
    Packed_Boxes: 0,
    Dispatched_Boxes: 0,
    Slit_Paper_KG: 0,
    Scrap_KG: 0
  };

  logs.forEach((l) => {
    if (!l.rawDate || (sDate && l.rawDate < sDate) || (eDate && l.rawDate > eDate)) return;
    if (!l.machine || ['ADMIN', 'MKT-ENTRY'].includes(l.machine)) return;

    if (
      l.action &&
      (l.action.includes('Finished') ||
        l.action.includes('Completed') ||
        l.action.includes('Approved') ||
        l.action.includes('Packed'))
    ) {
      if (l.stage === 'QC' || l.stage === 'Forming') {
        const matchCrate = l.action.match(/(\d+)\s*Crates/i);
        if (matchCrate) {
          const q = parseInt(matchCrate[1], 10) || 0;
          if (l.product === 'Spoon') totals.Spoon_Crates += q;
          else if (l.product === 'Fork') totals.Fork_Crates += q;
          else if (l.product === 'Knife') totals.Knife_Crates += q;
          else if (l.product === 'Dessert Spoon') totals.DessertSpoon_Crates += q;
        }
      } else if (l.stage === 'Packing') {
        const matchBox = l.action.match(/(\d+)\s*Boxes/i);
        if (matchBox) totals.Packed_Boxes += parseInt(matchBox[1], 10) || 0;
      }
      const matchKg = l.action.match(/(\d+)\s*KG/i);
      if (matchKg && l.stage === 'Slitting') totals.Slit_Paper_KG += parseInt(matchKg[1], 10) || 0;

      const matchScrap = l.action.match(/Scrap:\s*(\d+)\s*KG/i) || l.action.match(/Scrap:\s*(\d+)/i);
      if (matchScrap && !l.action.includes('Pieces') && !l.action.includes('Pcs')) {
        totals.Scrap_KG += parseInt(matchScrap[1], 10) || 0;
      }
    }
    if (l.action && l.action.includes('Dispatched')) {
      const matchDisp = l.action.match(/Dispatched\s*(\d+)\s*Boxes/);
      if (matchDisp) totals.Dispatched_Boxes += parseInt(matchDisp[1], 10) || 0;
    }
  });

  let csv = 'Category,Value,Unit\r\n';
  csv += `"Report Period","${sDate || 'All'} to ${eDate || 'Today'}","Date Range"\r\n`;
  csv += `"Total Paper Slit","${totals.Slit_Paper_KG}","KG"\r\n`;
  csv += `"Spoon QC Approved Output","${totals.Spoon_Crates}","Crates"\r\n`;
  csv += `"Fork QC Approved Output","${totals.Fork_Crates}","Crates"\r\n`;
  csv += `"Knife QC Approved Output","${totals.Knife_Crates}","Crates"\r\n`;
  csv += `"Dessert Spoon QC Approved Output","${totals.DessertSpoon_Crates}","Crates"\r\n`;
  csv += `"Total Packed Finished Goods","${totals.Packed_Boxes}","Boxes"\r\n`;
  csv += `"Total Dispatched Goods","${totals.Dispatched_Boxes}","Boxes"\r\n`;
  csv += `"Total Scrap Generated","${totals.Scrap_KG}","KG"\r\n`;
  csv += `"Current Available Scrap Stock","${calculateAvailableScrapKg(logs, scrapSales)}","KG"\r\n`;

  return csv;
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportToCSV(filename: string, data: any[]) {
  if (!data || data.length === 0) {
    downloadCSV('', filename);
    return;
  }
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => JSON.stringify(row[h] !== undefined ? row[h] : '')).join(',')
  );
  const csvContent = [headers.join(','), ...rows].join('\r\n');
  downloadCSV(csvContent, filename);
}

export function downloadJSON(data: any, filename: string) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportToJSON(filename: string, data: any) {
  downloadJSON(data, filename);
}

/**
 * Extracts all unique mother jumbo reel numbers used in a Job.
 * Inspects job.reelNumbers, job.reelsList, slitting runningBatches, and comma/slash separated job.reelNo.
 */
export function getJobAllReels(job?: Job): string[] {
  if (!job) return [];
  const reels = new Set<string>();

  // 1. From job.reelNumbers array
  if (job.reelNumbers && Array.isArray(job.reelNumbers)) {
    job.reelNumbers.forEach((r) => {
      if (r && typeof r === 'string' && r.trim()) {
        reels.add(r.trim());
      }
    });
  }

  // 2. From job.reelsList
  if (job.reelsList && Array.isArray(job.reelsList)) {
    job.reelsList.forEach((item) => {
      if (item.reelNo && typeof item.reelNo === 'string' && item.reelNo.trim()) {
        reels.add(item.reelNo.trim());
      }
    });
  }

  // 3. From runningBatches in stage 'Slitting'
  if (job.runningBatches && Array.isArray(job.runningBatches)) {
    job.runningBatches.forEach((b) => {
      if (b.stage === 'Slitting' && b.reelNo && typeof b.reelNo === 'string' && b.reelNo.trim()) {
        reels.add(b.reelNo.trim());
      }
      if (b.reelNumbers && Array.isArray(b.reelNumbers)) {
        b.reelNumbers.forEach((r) => {
          if (r && typeof r === 'string' && r.trim()) reels.add(r.trim());
        });
      }
    });
  }

  // 4. From job.reelNo (which could be comma-separated or single)
  if (job.reelNo && typeof job.reelNo === 'string' && job.reelNo.trim()) {
    const parts = job.reelNo.split(/[,+;/|]+/).map((s) => s.trim()).filter(Boolean);
    parts.forEach((p) => reels.add(p));
  }

  return Array.from(reels);
}

/**
 * Formats a clean summary of mother jumbo reels.
 * e.g. "Reel: 100" or "Reels: 100, 101, 111 (3 Jumbo Reels)"
 */
export function getJobReelsSummary(job?: Job): string {
  if (!job) return 'N/A';
  const allReels = getJobAllReels(job);
  if (allReels.length === 0) {
    return `RL-${(job.paperBrand || 'ITC').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()}-${job.id.replace(/[^0-9]/g, '').padStart(4, '0')}`;
  }
  if (allReels.length === 1) {
    return allReels[0];
  }
  return `${allReels.join(', ')} (${allReels.length} Jumbo Reels)`;
}

/**
 * Generates an itemized breakdown of each jumbo reel loaded in Slitting
 * including rolls output and weights for 100% complete traceability.
 */
export function getJobReelItemsBreakdown(job?: Job): JobReelItem[] {
  if (!job) return [];

  // If reelsList is already populated with items, return it
  if (job.reelsList && job.reelsList.length > 0) {
    return job.reelsList;
  }

  const items: JobReelItem[] = [];
  const seenReels = new Set<string>();

  // Extract from slitting running batches
  if (job.runningBatches && job.runningBatches.length > 0) {
    const slittingBatches = job.runningBatches.filter((b) => b.stage === 'Slitting');
    slittingBatches.forEach((b) => {
      const rNo = b.reelNo?.trim() || `RL-${(job.paperBrand || 'ITC').slice(0, 3).toUpperCase()}-001`;
      if (!seenReels.has(rNo)) {
        seenReels.add(rNo);
        items.push({
          reelNo: rNo,
          rolls: b.producedQty || (slittingBatches.length === 1 ? job.availableRolls : 0),
          weightKg: b.inputWeightKg || (job.inputWeightKg ? Math.round(job.inputWeightKg / slittingBatches.length) : 200),
          outputWeightKg: b.outputWeightKg,
          scrapKg: b.scrapKg,
          gsm: b.gsm || job.gsm,
          paperBrand: job.paperBrand,
          batchId: b.batchId,
          startTime: b.startTime,
          endTime: b.endTime,
          worker: b.worker
        });
      }
    });
  }

  // If still empty or some reels missing from getJobAllReels
  const allReels = getJobAllReels(job);
  allReels.forEach((rNo) => {
    if (!seenReels.has(rNo)) {
      seenReels.add(rNo);
      const shareRolls = allReels.length > 0 ? Math.floor((job.availableRolls || 0) / allReels.length) : (job.availableRolls || 0);
      const shareKg = allReels.length > 0 ? Math.round((job.inputWeightKg || 200) / allReels.length) : (job.inputWeightKg || 200);
      items.push({
        reelNo: rNo,
        rolls: shareRolls,
        weightKg: shareKg,
        gsm: job.gsm,
        paperBrand: job.paperBrand
      });
    }
  });

  if (items.length === 0) {
    const fallbackReel = `RL-${(job.paperBrand || 'ITC').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()}-${job.id.replace(/[^0-9]/g, '').padStart(4, '0')}`;
    items.push({
      reelNo: fallbackReel,
      rolls: job.availableRolls || 0,
      weightKg: job.inputWeightKg || 200,
      gsm: job.gsm || job.targetGsm || '120 GSM',
      paperBrand: job.paperBrand || 'ITC'
    });
  }

  return items;
}

/**
 * Normalizes GSM string (e.g. "120" -> "120 GSM", "120 gsm" -> "120 GSM").
 */
export function formatGsmString(rawGsm?: string | number): string {
  if (!rawGsm) return '';
  let s = String(rawGsm).trim();
  if (!s) return '';
  // Remove "Mixed GSM" or similar parenthetical notes
  s = s.replace(/\s*\(Mixed GSM\)/gi, '');
  s = s.replace(/\s*\(Mixed\)/gi, '');
  if (s.includes('+') || s.includes(',')) {
    const parts = s.split(/[,+;/|]+/).map(p => p.trim()).filter(Boolean);
    return parts.map(p => formatGsmString(p)).join(' + ');
  }
  s = s.replace(/\s*gsm$/i, '').trim();
  return `${s} GSM`;
}

/**
 * Extracts all distinct GSMs associated with a job across its mother reels,
 * batches, and gsmList for complete transparency when multiple GSMs are combined.
 */
export function getJobAllGsms(job?: Job): string[] {
  if (!job) return [];
  const gsms = new Set<string>();

  // Collect actual GSMs from slitted reels and slitting batches
  const actualGsms = new Set<string>();

  // 1. From job.reelsList (actual slitted mother reels)
  if (job.reelsList && Array.isArray(job.reelsList)) {
    job.reelsList.forEach((item) => {
      const formatted = formatGsmString(item.gsm);
      if (formatted) {
        const parts = formatted.split(/[,+;/|]+/).map((s) => s.trim().replace(/\s*gsm$/i, '')).filter(Boolean);
        parts.forEach(p => {
          const f = formatGsmString(p);
          if (f) actualGsms.add(f);
        });
      }
    });
  }

  // 2. From runningBatches in stage 'Slitting'
  if (job.runningBatches && Array.isArray(job.runningBatches)) {
    job.runningBatches.forEach((b) => {
      if (b.stage === 'Slitting' || b.stage?.startsWith('Slit')) {
        const formatted = formatGsmString(b.gsm);
        if (formatted) {
          const parts = formatted.split(/[,+;/|]+/).map((s) => s.trim().replace(/\s*gsm$/i, '')).filter(Boolean);
          parts.forEach(p => {
            const f = formatGsmString(p);
            if (f) actualGsms.add(f);
          });
        }
        if (b.gsmList && Array.isArray(b.gsmList)) {
          b.gsmList.forEach((g) => {
            const fg = formatGsmString(g);
            if (fg) actualGsms.add(fg);
          });
        }
      }
    });
  }

  // If we have actual slitted GSMs, use them exclusively!
  if (actualGsms.size > 0) {
    return Array.from(actualGsms).filter(Boolean);
  }

  // Otherwise, fall back to planned/target GSMs
  // 3. From job.gsmList
  if (job.gsmList && Array.isArray(job.gsmList)) {
    job.gsmList.forEach((g) => {
      const formatted = formatGsmString(g);
      if (formatted) gsms.add(formatted);
    });
  }

  // 4. From job.gsm
  if (job.gsm) {
    const raw = String(job.gsm).trim();
    if (raw) {
      const parts = raw.split(/[,+;/|]+/).map((s) => s.trim()).filter(Boolean);
      parts.forEach((p) => {
        const formatted = formatGsmString(p);
        if (formatted) gsms.add(formatted);
      });
    }
  }

  // 5. From job.targetGsm
  if (gsms.size === 0 && job.targetGsm) {
    const parts = String(job.targetGsm).split(/[,+;/|]+/).map((s) => s.trim()).filter(Boolean);
    parts.forEach((p) => {
      const formatted = formatGsmString(p);
      if (formatted) gsms.add(formatted);
    });
  }

  return Array.from(gsms).filter(Boolean);
}

/**
 * Formats a clean summary of GSMs used in a job.
 * e.g. "120 GSM" or "120 GSM + 140 GSM (Mixed GSM)"
 */
export function getJobGsmsSummary(job?: Job): string {
  if (!job) return '-';
  const allGsms = getJobAllGsms(job);
  if (allGsms.length === 0) return String(job.targetGsm || job.gsm || '-');
  if (allGsms.length === 1) return allGsms[0];
  return `${allGsms.join(' + ')} (Mixed GSM)`;
}

export interface LayerFulfillmentStatus {
  gsm: number | string;
  type: 'Plain' | 'Printed';
  requiredReels: number;
  actualSlitCount: number;
  isComplete: boolean;
  statusText: 'MET' | 'PENDING' | 'NOT_STARTED';
}

/**
 * Extracts pure numeric GSM value for robust matching, e.g. "120 GSM" -> 120, 120 -> 120
 */
export function parseNumericGsm(val?: string | number): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const match = String(val).match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Normalizes GSM label for display, e.g. 120 -> "120 GSM", "120 GSM" -> "120 GSM"
 */
export function normalizeGsmLabel(val?: string | number): string {
  const num = parseNumericGsm(val);
  return num > 0 ? `${num} GSM` : (val ? String(val).trim() : '');
}

/**
 * Resolves planned layers profile for a job.
 * If job.plannedLayers is present, uses it.
 * Otherwise, checks linked plan.plannedLayers.
 * If neither exists, dynamically generates a profile from targetLayers, printedLayersCount, and plannedGsms/targetGsm.
 */
export function getJobPlannedLayers(job?: Job, plan?: ProductionPlan | null): PlannedLayer[] {
  if (job?.plannedLayers && job.plannedLayers.length > 0) {
    return job.plannedLayers;
  }
  if (plan?.plannedLayers && plan.plannedLayers.length > 0) {
    return plan.plannedLayers;
  }

  // Fallback generation if not explicitly defined
  const targetLayers = job?.targetLayers || plan?.targetLayers || 0;
  if (targetLayers <= 0) return [];

  const printedRequired = job?.printedRollRequired ?? plan?.printedRollRequired ?? false;
  const printedLayers = printedRequired ? (job?.printedLayersCount ?? plan?.printedLayersCount ?? 1) : 0;
  const plainLayers = Math.max(0, targetLayers - printedLayers);

  const gsms = job?.plannedGsms && job.plannedGsms.length > 0
    ? job.plannedGsms
    : (plan?.plannedGsms && plan.plannedGsms.length > 0 ? plan.plannedGsms : (job?.targetGsm ? [job.targetGsm] : ['120 GSM']));

  const parsedGsms = gsms.map(g => parseNumericGsm(g)).filter(n => n > 0);
  const plainGsm = parsedGsms[0] || 120;
  const printedGsm = parsedGsms.length > 1 ? parsedGsms[1] : (parsedGsms[0] || 60);

  const layers: PlannedLayer[] = [];
  if (plainLayers > 0) {
    layers.push({ gsm: plainGsm, type: 'Plain', requiredReels: plainLayers });
  }
  if (printedLayers > 0) {
    layers.push({ gsm: printedGsm, type: 'Printed', requiredReels: printedLayers });
  }
  return layers;
}

/**
 * Computes live layer fulfillment matrix for a job.
 * Returns each layer requirement with actual slit rolls count, completion boolean, and status.
 */
export function calculateLayerFulfillmentMatrix(
  job: Job,
  inProgressRun?: { gsm?: string | number; isPrinted?: boolean; rollsCount: number; layerType?: 'Plain' | 'Printed' } | null,
  linkedPlan?: ProductionPlan | null
): LayerFulfillmentStatus[] {
  const planned = getJobPlannedLayers(job, linkedPlan);
  if (planned.length === 0) return [];

  const completedReels = job.reelsList && job.reelsList.length > 0 ? job.reelsList : getJobReelItemsBreakdown(job);

  return planned.map((layer) => {
    const targetGsmNum = parseNumericGsm(layer.gsm);
    const isTargetPrinted = layer.type === 'Printed';

    let actualSlitCount = 0;

    completedReels.forEach((r) => {
      const reelGsmNum = parseNumericGsm(r.gsm);
      const isReelPrinted = Boolean(r.isPrintedRoll) || r.layerType === 'Printed';

      const typeMatches = isTargetPrinted ? isReelPrinted : !isReelPrinted;
      const gsmMatches = targetGsmNum === 0 || reelGsmNum === targetGsmNum || reelGsmNum === 0;

      if (typeMatches && gsmMatches) {
        // Output rolls produced from this reel
        const rolls = (r.rolls && r.rolls > 0) ? r.rolls : (r.endTime ? 1 : 0);
        actualSlitCount += rolls;
      }
    });

    // Also include in-progress run output if provided
    if (inProgressRun && inProgressRun.rollsCount > 0) {
      const inProgGsmNum = parseNumericGsm(inProgressRun.gsm);
      const inProgIsPrinted = Boolean(inProgressRun.isPrinted) || inProgressRun.layerType === 'Printed';

      const typeMatches = isTargetPrinted ? inProgIsPrinted : !inProgIsPrinted;
      const gsmMatches = targetGsmNum === 0 || inProgGsmNum === targetGsmNum || inProgGsmNum === 0;

      if (typeMatches && gsmMatches) {
        actualSlitCount += inProgressRun.rollsCount;
      }
    }

    const isComplete = actualSlitCount >= layer.requiredReels;
    const statusText: 'MET' | 'PENDING' | 'NOT_STARTED' = isComplete
      ? 'MET'
      : actualSlitCount > 0
      ? 'PENDING'
      : 'NOT_STARTED';

    return {
      gsm: layer.gsm,
      type: layer.type,
      requiredReels: layer.requiredReels,
      actualSlitCount,
      isComplete,
      statusText
    };
  });
}

/**
 * Validates if all planned GSM layer requirements are 100% fulfilled.
 */
export function isJobLayersFullySlit(
  job: Job,
  inProgressRun?: { gsm?: string | number; isPrinted?: boolean; rollsCount: number; layerType?: 'Plain' | 'Printed' } | null,
  linkedPlan?: ProductionPlan | null
): boolean {
  const matrix = calculateLayerFulfillmentMatrix(job, inProgressRun, linkedPlan);
  if (matrix.length === 0) return true;
  return matrix.every((item) => item.isComplete);
}


