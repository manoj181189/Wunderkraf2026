import { FactoryState, Job, LogEntry, PackJob, ProductType, ShiftConfig } from '../types';
import { PRODUCTS } from './constants';

export function calculateLiveStock(jobs: Job[], packJobs: PackJob[]) {
  const stock: Record<ProductType, { Rolls: number; Cutting: number; Forming: number; QC: number; Packed: number }> = {
    'Spoon': { Rolls: 0, Cutting: 0, Forming: 0, QC: 0, Packed: 0 },
    'Fork': { Rolls: 0, Cutting: 0, Forming: 0, QC: 0, Packed: 0 },
    'Knife': { Rolls: 0, Cutting: 0, Forming: 0, QC: 0, Packed: 0 },
    'Dessert Spoon': { Rolls: 0, Cutting: 0, Forming: 0, QC: 0, Packed: 0 }
  };

  jobs.forEach((j) => {
    if (stock[j.product]) {
      stock[j.product].Rolls += j.availableRolls || 0;
      stock[j.product].Cutting += j.availableCuttingCrates || 0;
      stock[j.product].Forming += j.availableFormingCrates || 0;
      stock[j.product].QC += j.availableQcCrates || 0;
    }
  });

  packJobs.forEach((pj) => {
    if (pj.issuedCrates) {
      Object.keys(pj.issuedCrates).forEach((pName) => {
        const prod = pName as ProductType;
        if (stock[prod]) {
          stock[prod].Packed += pj.issuedCrates[pName] || 0;
        }
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
