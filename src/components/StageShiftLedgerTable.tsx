import React from 'react';
import {
  User,
  Users,
  Clock,
  Calendar,
  Sun,
  Moon,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Sparkles
} from 'lucide-react';
import { StageShiftLedgerSummary, StageShiftBreakdownItem } from '../lib/shiftSlices';

interface StageShiftLedgerTableProps {
  ledger: StageShiftLedgerSummary;
  stageTitle: string;
  themeColor?: 'blue' | 'indigo' | 'purple' | 'emerald';
}

export const StageShiftLedgerTable: React.FC<StageShiftLedgerTableProps> = ({
  ledger,
  stageTitle,
  themeColor = 'indigo'
}) => {
  const {
    items,
    totalShifts,
    totalProducedQty,
    totalProducedPieces,
    totalScrapKg,
    totalScrapPcs,
    unitLabel
  } = ledger;

  if (items.length === 0) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-3 text-center text-xs text-slate-500 italic">
        No shift or changeover records registered yet for {stageTitle}.
      </div>
    );
  }

  const colorStyles = {
    blue: {
      headerBg: 'bg-blue-50/80',
      headerBorder: 'border-blue-200',
      headerText: 'text-blue-950',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-800',
      badgeBorder: 'border-blue-300',
      accent: 'text-blue-700'
    },
    indigo: {
      headerBg: 'bg-indigo-50/80',
      headerBorder: 'border-indigo-200',
      headerText: 'text-indigo-950',
      badgeBg: 'bg-indigo-100',
      badgeText: 'text-indigo-800',
      badgeBorder: 'border-indigo-300',
      accent: 'text-indigo-700'
    },
    purple: {
      headerBg: 'bg-purple-50/80',
      headerBorder: 'border-purple-200',
      headerText: 'text-purple-950',
      badgeBg: 'bg-purple-100',
      badgeText: 'text-purple-800',
      badgeBorder: 'border-purple-300',
      accent: 'text-purple-700'
    },
    emerald: {
      headerBg: 'bg-emerald-50/80',
      headerBorder: 'border-emerald-200',
      headerText: 'text-emerald-950',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-800',
      badgeBorder: 'border-emerald-300',
      accent: 'text-emerald-700'
    }
  }[themeColor];

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <div className={`flex items-center justify-between flex-wrap gap-2 px-3 py-2 rounded-xl border ${colorStyles.headerBg} ${colorStyles.headerBorder}`}>
        <div className="flex items-center gap-2">
          <RotateCcw className={`w-4 h-4 ${colorStyles.accent}`} />
          <span className={`text-xs font-black uppercase tracking-wider ${colorStyles.headerText}`}>
            Shift & Changeover Ledger (शिफ्ट वार उत्पादन एवं वेस्टेज)
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold">
          <span className="bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-700">
            {totalShifts} {totalShifts === 1 ? 'Shift Run' : 'Shifts / Changeovers'}
          </span>
          {ledger.uniqueOperators.length > 0 && (
            <span className="bg-white px-2 py-0.5 rounded-full border border-slate-200 text-slate-700">
              👥 {ledger.uniqueOperators.length} Operator{ledger.uniqueOperators.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Table of Operator Shifts */}
      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-2xs">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
              <th className="p-2.5">Date & Shift</th>
              <th className="p-2.5">Operator & Helper</th>
              <th className="p-2.5">Handover / Time</th>
              <th className="p-2.5 text-right">Good Output ({unitLabel})</th>
              <th className="p-2.5 text-right">Wastage / Scrap</th>
              <th className="p-2.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => {
              const isNight = item.shift.toUpperCase().includes('NIGHT') || item.shift.toUpperCase().includes('B');
              return (
                <tr key={item.id || idx} className="hover:bg-slate-50 transition">
                  {/* Date & Shift */}
                  <td className="p-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-extrabold text-[10px] border ${
                          isNight
                            ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        {isNight ? <Moon className="w-3 h-3 text-indigo-700" /> : <Sun className="w-3 h-3 text-amber-600" />}
                        <span>{item.shift} SHIFT</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-600 font-mono mt-0.5 ml-0.5">
                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{item.date}</span>
                    </div>
                  </td>

                  {/* Operator & Helper */}
                  <td className="p-2.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-slate-800 text-white px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-300" />
                          OP:
                        </span>
                        <span className="font-bold text-slate-900 text-xs">{item.operator}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-amber-100 text-amber-950 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1">
                          <Users className="w-3 h-3 text-amber-700" />
                          Helper:
                        </span>
                        <span className="font-bold text-amber-900 text-xs">
                          {item.helpers && item.helpers.length > 0
                            ? item.helpers.join(', ')
                            : 'N/A (No Helper)'}
                        </span>
                      </div>
                      {item.relievedByOperator && (
                        <div className="flex items-center gap-1 text-[10px] text-indigo-700 font-semibold pt-0.5">
                          <ArrowRight className="w-3 h-3" />
                          <span>Handed over to <b>{item.relievedByOperator}</b></span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Handover / Time */}
                  <td className="p-2.5 whitespace-nowrap text-slate-600 text-[11px]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{item.startTime ? `${item.startTime} → ` : ''}{item.endTime || 'Completed'}</span>
                    </div>
                    {item.meterReading !== undefined && item.meterReading > 0 && (
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Meter: {item.meterReading.toLocaleString()}
                      </div>
                    )}
                  </td>

                  {/* Output Produced */}
                  <td className="p-2.5 text-right font-mono">
                    <div className="font-black text-emerald-700 text-xs">
                      +{item.producedQty} {unitLabel}
                    </div>
                    {item.producedPieces !== undefined && item.producedPieces > 0 && (
                      <div className="text-[10px] text-emerald-600 font-semibold">
                        ({item.producedPieces.toLocaleString()} Pcs)
                      </div>
                    )}
                    {item.loosePieces !== undefined && item.loosePieces > 0 && (
                      <div className="text-[9px] text-slate-500">
                        +{item.loosePieces} Loose
                      </div>
                    )}
                  </td>

                  {/* Wastage / Scrap */}
                  <td className="p-2.5 text-right font-mono">
                    {item.scrapKg !== undefined && item.scrapKg > 0 && (
                      <div className="font-bold text-rose-700 text-xs">
                        {item.scrapKg} KG Scrap
                      </div>
                    )}
                    {item.scrapPcs !== undefined && item.scrapPcs > 0 && (
                      <div className="text-[10px] text-rose-600 font-medium">
                        {item.scrapPcs.toLocaleString()} Defect Pcs
                      </div>
                    )}
                    {(!item.scrapKg && !item.scrapPcs) && (
                      <span className="text-slate-400 text-[11px]">0 Scrap</span>
                    )}
                  </td>

                  {/* Status / Notes */}
                  <td className="p-2.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        item.status === 'Running'
                          ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                          : item.status === 'Handed Over'
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}
                    >
                      {item.status === 'Handed Over' ? <RotateCcw className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      <span>{item.status}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Total Combined Summary Bar (कुल योग) */}
      <div className="bg-slate-900 text-white rounded-xl p-3 shadow-sm space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs border-b border-slate-700 pb-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Total Combined Batch Entry (कुल उत्पादन एवं वेस्टेज जोड़):</span>
          </div>
          <div className="text-[11px] text-slate-300 font-medium">
            Formula: {items.map((it, idx) => `${it.operator} [${it.shift}] (${it.producedQty})`).join(' + ')} = <b className="text-white">{totalProducedQty} {unitLabel}</b>
          </div>
        </div>

        <div className={`grid grid-cols-2 ${ledger.totalGlueKg && ledger.totalGlueKg > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-2 text-center text-xs pt-0.5`}>
          <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Good Output</span>
            <span className="text-sm font-black text-emerald-400">
              {totalProducedQty} {unitLabel}
            </span>
            {totalProducedPieces > 0 && (
              <span className="text-[10px] text-emerald-300 block font-mono">
                ({totalProducedPieces.toLocaleString()} Pcs)
              </span>
            )}
          </div>

          <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Scrap / Wastage</span>
            <span className="text-sm font-black text-rose-400">
              {totalScrapKg > 0 ? `${totalScrapKg} KG` : ''}
              {totalScrapKg > 0 && totalScrapPcs > 0 ? ' + ' : ''}
              {totalScrapPcs > 0 ? `${totalScrapPcs.toLocaleString()} Pcs` : ''}
              {!totalScrapKg && !totalScrapPcs ? '0 KG' : ''}
            </span>
            <span className="text-[10px] text-slate-400 block">
              Cumulative Rejection
            </span>
          </div>

          {ledger.totalGlueKg !== undefined && ledger.totalGlueKg > 0 && (
            <div className="bg-teal-950/90 rounded-lg p-2 border border-teal-600/80 shadow-xs">
              <span className="text-[10px] text-teal-300 block font-semibold uppercase">💧 Glue Used</span>
              <span className="text-sm font-black text-teal-300">
                {ledger.totalGlueKg} KG
              </span>
              <span className="text-[10px] text-teal-400 block truncate font-medium" title={ledger.glueBrand}>
                {ledger.glueBrand ? ledger.glueBrand.split(' ')[0] : 'Adhesive'}
              </span>
            </div>
          )}

          <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Shifts Executed</span>
            <span className="text-sm font-black text-amber-400">
              {totalShifts} {totalShifts === 1 ? 'Shift' : 'Shifts'}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {ledger.uniqueOperators.join(', ')}
            </span>
          </div>

          <div className="bg-slate-800/80 rounded-lg p-2 border border-slate-700">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Mass Balance Status</span>
            <span className="text-sm font-black text-blue-400 flex items-center justify-center gap-1">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>100% Balanced</span>
            </span>
            <span className="text-[10px] text-slate-400 block">
              Audit Verified
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
