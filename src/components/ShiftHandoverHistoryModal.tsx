import React, { useState } from 'react';
import {
  X,
  RotateCcw,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Printer,
  Download,
  Filter,
  ShieldCheck,
  Layers,
  Box
} from 'lucide-react';
import { FactoryState, ShiftHandoverRecord } from '../types';

interface ShiftHandoverHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: FactoryState;
  onSaveState?: (state: FactoryState) => void;
}

export const ShiftHandoverHistoryModal: React.FC<ShiftHandoverHistoryModalProps> = ({
  isOpen,
  onClose,
  state
}) => {
  const [filterDept, setFilterDept] = useState<string>('ALL');
  const [filterShift, setFilterShift] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const handovers: ShiftHandoverRecord[] = state.shiftHandovers || [];

  // Filter records
  const filtered = handovers.filter((h) => {
    if (filterDept !== 'ALL' && h.department.toUpperCase() !== filterDept.toUpperCase()) {
      return false;
    }
    if (filterShift !== 'ALL' && h.currentShift !== filterShift && h.nextShift !== filterShift) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchOperator =
        h.outgoingOperator?.toLowerCase().includes(q) ||
        h.relievedByOperator?.toLowerCase().includes(q);
      const matchMachine = h.machine?.toLowerCase().includes(q);
      const matchNotes = h.notes?.toLowerCase().includes(q);
      const matchId = h.id?.toLowerCase().includes(q);
      if (!matchOperator && !matchMachine && !matchNotes && !matchId) {
        return false;
      }
    }
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-2xl border-t-6 border-indigo-700 relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 m-0">
                Shift Handover & Operator Traceability Dossier
              </h2>
              <p className="text-xs text-slate-500 m-0">
                Operator Shift Handover Records, Production Quantities & Digital Signature Verification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
              title="Print Dossier"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search operator, machine, batch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 shrink-0">Dept:</label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Departments</option>
              <option value="SLITTING">Slitting</option>
              <option value="CUTTING">Cutting</option>
              <option value="FORMING">Forming</option>
              <option value="QC">QC Inspection</option>
              <option value="PACKING">Packing</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 shrink-0">Shift:</label>
            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Shifts (DAY & NIGHT)</option>
              <option value="DAY">☀️ DAY Shift Only</option>
              <option value="NIGHT">🌙 NIGHT Shift Only</option>
            </select>
          </div>
        </div>

        {/* Handover List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <RotateCcw className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-600">No shift handover records found</p>
              <p className="text-xs text-slate-400">
                When operators perform shift handovers on Slitting, Cutting, Forming, or QC workstations, traceable signatures appear here.
              </p>
            </div>
          ) : (
            filtered.map((record) => (
              <div
                key={record.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-indigo-300 transition"
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                      {record.id}
                    </span>
                    <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded">
                      {record.department} • {record.machine}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {record.date} {record.timestamp}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                      {record.currentShift === 'DAY' ? '☀️ DAY' : '🌙 NIGHT'} ➔ {record.nextShift === 'DAY' ? '☀️ DAY' : '🌙 NIGHT'}
                    </span>
                    {record.checklistPassed !== false ? (
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Checklist OK
                      </span>
                    ) : (
                      <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        Flagged
                      </span>
                    )}
                  </div>
                </div>

                {/* Operator Signature & Handover Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-2">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Relieved Operator
                    </span>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>{record.outgoingOperator}</span>
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Relieving Operator
                    </span>
                    <div className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{record.relievedByOperator}</span>
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Units / Crates Output
                    </span>
                    <div className="font-bold text-emerald-700 flex items-center gap-1">
                      <Box className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{record.producedQty} Crates / Units</span>
                      {record.producedPieces && (
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({record.producedPieces.toLocaleString()} pcs)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Scrap / Defect Logged
                    </span>
                    <div className="font-bold text-rose-700">
                      <span>{record.scrapQty} {record.department === 'Slitting' || record.department === 'Cutting' ? 'KG' : 'Pcs'}</span>
                    </div>
                  </div>
                </div>

                {/* Helpers & Notes */}
                {(record.helpers && record.helpers.length > 0 || record.notes) && (
                  <div className="bg-white/80 p-2 rounded-lg border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
                    {record.helpers && record.helpers.length > 0 && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="font-semibold">Helpers Paired:</span>
                        <span className="font-bold text-slate-800">{record.helpers.join(', ')}</span>
                      </div>
                    )}
                    {record.notes && (
                      <div className="text-slate-600 italic">
                        <span className="font-semibold not-italic text-slate-700">Notes:</span> "{record.notes}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Total Records: <b>{filtered.length}</b></span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
