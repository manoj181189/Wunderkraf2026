import React from 'react';
import { Cog, Download, X, Layers, CheckCircle2, ArrowRight } from 'lucide-react';
import { Job, PackJob } from '../types';
import { calculateTimeDifference, downloadCSV } from '../lib/utils';

interface StationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineName: string;
  jobs: Job[];
  packJobs: PackJob[];
}

export const StationDetailModal: React.FC<StationDetailModalProps> = ({
  isOpen,
  onClose,
  machineName,
  jobs,
  packJobs
}) => {
  if (!isOpen || !machineName) return null;

  interface RecordItem {
    jobId: string;
    product: string;
    worker: string;
    inputText: string;
    outputText: string;
    startTime: string;
    endTime: string;
    duration: string;
    stageStatus: string;
    loggedBy: string;
  }

  const records: RecordItem[] = [];

  if (machineName.startsWith('Packing-') || machineName.startsWith('Manual-')) {
    packJobs.forEach((pj) => {
      // Build raw material description
      let rawMatDesc = '';
      if (pj.issuedCrates && Object.keys(pj.issuedCrates).length > 0) {
        rawMatDesc = Object.entries(pj.issuedCrates)
          .map(([jId, crates]) => `${jId}: ${crates} Crates`)
          .join(', ');
      } else if (pj.tracedLots && Object.keys(pj.tracedLots).length > 0) {
        rawMatDesc = Object.entries(pj.tracedLots)
          .map(([item, lot]) => `${item}: Lot ${lot}`)
          .join(', ');
      } else {
        rawMatDesc = `${pj.kitItems ? pj.kitItems.join('+') : pj.kitType} QC Stock`;
      }

      if (pj.historyRuns && pj.historyRuns.length > 0) {
        pj.historyRuns.forEach((hr) => {
          if (!hr.machine || hr.machine === machineName) {
            const runInput = hr.issuedRawMaterial || (hr.issuedCrates ? Object.entries(hr.issuedCrates).map(([j, c]) => `${j}: ${c} Crates`).join(', ') : rawMatDesc);
            records.push({
              jobId: pj.id,
              product: pj.kitType,
              worker: hr.worker || pj.worker || 'Packing Team',
              inputText: runInput,
              outputText: `${hr.boxesPacked || hr.boxes || 0} Boxes (${((hr.boxesPacked || hr.boxes || 0) * (pj.pcsPerBox || 100)).toLocaleString()} Pcs)`,
              startTime: hr.startTime || hr.date || pj.startTime || '-',
              endTime: hr.endTime || hr.time || 'Completed',
              duration: calculateTimeDifference(hr.startTime || pj.startTime, hr.endTime || hr.time) || 'Logged',
              stageStatus: pj.status,
              loggedBy: pj.createdBy || 'SYSTEM'
            });
          }
        });
      } else if ((pj.status === 'Running' || pj.status === 'Held') && pj.machine === machineName) {
        records.push({
          jobId: pj.id,
          product: pj.kitType,
          worker: pj.worker || 'Packing Team',
          inputText: rawMatDesc,
          outputText: `${pj.packedBoxes || 0} Boxes (In-Progress)`,
          startTime: pj.startTime || '-',
          endTime: pj.status === 'Held' ? 'HELD' : 'RUNNING',
          duration: 'In-Progress',
          stageStatus: pj.status,
          loggedBy: pj.createdBy || 'SYSTEM'
        });
      }
    });
  } else {
    jobs.forEach((j) => {
      if (j.runningBatches) {
        j.runningBatches.forEach((b) => {
          if (b.machine === machineName) {
            const dur = calculateTimeDifference(b.startTime, b.endTime);
            let inStr = '';
            let outStr = '';

            if (b.stage === 'Slitting') {
              inStr = `${b.issuedQty || 1} Jumbo Reel (${j.paperBrand || 'ITC'})`;
              outStr = `${b.producedQty || 0} Slit Rolls (${b.outputWeightKg || 0} KG)`;
            } else if (b.stage === 'Cutting') {
              inStr = `${b.issuedQty || 1} Slit Rolls (${j.paperBrand || 'ITC'})`;
              outStr = `${b.producedQty || 0} Cutting Crates`;
            } else if (b.stage === 'Forming') {
              inStr = `${b.issuedQty || 1} Cutting Crates`;
              outStr = `${b.producedQty || 0} Crates (Scrap: ${b.scrapPcs || 0} Pcs)`;
            } else if (b.stage === 'QC') {
              inStr = `${b.issuedQty || 1} Forming Crates`;
              outStr = `${b.producedQty || 0} Approved Crates (Scrap: ${b.scrapKg || 0} KG)`;
            } else {
              inStr = `${b.issuedQty || 1} In-Unit`;
              outStr = `${b.producedQty || 0} Processed`;
            }

            records.push({
              jobId: j.id,
              product: `${j.product} (${j.paperBrand || 'ITC'})`,
              worker: b.worker || 'Operator',
              inputText: inStr,
              outputText: outStr,
              startTime: b.startTime || '-',
              endTime: b.endTime || (b.status === 'Held' ? 'HELD' : 'RUNNING'),
              duration: dur,
              stageStatus: `${b.stage} (${b.status})`,
              loggedBy: b.user || 'SYSTEM'
            });
          }
        });
      }
    });
  }

  const exportStationCSV = () => {
    let csv = 'Job_ID,Product_Origin,Operator_Name,Raw_Material_Issued,Output_Produced,Start_Time,End_Time,Duration,Stage_Status,Logged_By\r\n';
    records
      .slice()
      .reverse()
      .forEach((r) => {
        csv += `"${r.jobId}","${r.product}","${r.worker}","${r.inputText}","${r.outputText}","${r.startTime}","${r.endTime}","${r.duration}","${r.stageStatus}","${r.loggedBy}"\r\n`;
      });
    downloadCSV(csv, `Station_Log_${machineName}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[#1a365d]">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
              <Cog className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-base font-extrabold m-0 text-slate-900">
                Workstation Run & Reconciliation Log: <span className="text-blue-700">{machineName}</span>
              </h3>
              <p className="text-[11px] text-slate-500 m-0">
                Raw Material Issued vs. Final Output Tracking for complete traceability
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportStationCSV}
              className="flex items-center gap-1.5 bg-[#2f855a] hover:bg-[#276749] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
            No production runs logged on workstation [{machineName}] yet.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs px-1 text-slate-600">
              <span>Total Workstation Batches: <b>{records.length}</b></span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Input Issued
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> Output Processed
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2.5 text-left">Job ID / Order</th>
                    <th className="p-2.5 text-left">Product</th>
                    <th className="p-2.5 text-left">Operator</th>
                    <th className="p-2.5 text-left bg-amber-50/60 text-amber-900 border-x border-amber-200">
                      Raw Material Issued
                    </th>
                    <th className="p-2.5 text-left bg-emerald-50/60 text-emerald-900 border-r border-emerald-200">
                      Output Produced
                    </th>
                    <th className="p-2.5 text-left">Start</th>
                    <th className="p-2.5 text-left">End</th>
                    <th className="p-2.5 text-left">Duration</th>
                    <th className="p-2.5 text-left">Status</th>
                    <th className="p-2.5 text-left">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records
                    .slice()
                    .reverse()
                    .map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="p-2.5 font-bold text-blue-800 whitespace-nowrap">{r.jobId}</td>
                        <td className="p-2.5 font-medium text-slate-800">{r.product}</td>
                        <td className="p-2.5 font-medium text-slate-700">{r.worker}</td>
                        <td className="p-2.5 font-semibold text-amber-900 bg-amber-50/30 border-x border-amber-100 whitespace-nowrap">
                          {r.inputText}
                        </td>
                        <td className="p-2.5 font-extrabold text-emerald-700 bg-emerald-50/30 border-r border-emerald-100 whitespace-nowrap">
                          {r.outputText}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{r.startTime}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">{r.endTime}</td>
                        <td className="p-2.5 font-bold text-slate-700 whitespace-nowrap">{r.duration}</td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.stageStatus.includes('Held') || r.stageStatus.includes('HELD')
                                ? 'bg-orange-100 text-orange-800 border border-orange-200'
                                : r.stageStatus.includes('Running') || r.stageStatus.includes('RUNNING')
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {r.stageStatus}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-blue-700 font-semibold">{r.loggedBy}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
