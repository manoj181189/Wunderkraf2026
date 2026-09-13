import React, { useState, useEffect } from 'react';
import { X, Droplets, CheckCircle2, AlertCircle, Sparkles, Building2, Layers, User, Calendar, Clock, Tag } from 'lucide-react';
import { FactoryState, GlueUsageEntry, LogEntry } from '../types';
import { GLUE_BRANDS, ALL_MACHINES_LIST } from '../lib/constants';

interface GlueUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: FactoryState;
  onSaveState: (newState: FactoryState) => void;
  defaultMachine?: string;
  defaultStage?: string;
  defaultJobId?: string;
  defaultBatchId?: string;
  defaultOperator?: string;
}

export const GlueUsageModal: React.FC<GlueUsageModalProps> = ({
  isOpen,
  onClose,
  state,
  onSaveState,
  defaultMachine,
  defaultStage,
  defaultJobId,
  defaultBatchId,
  defaultOperator
}) => {
  const glueBrands = state.glueBrands && state.glueBrands.length > 0 ? state.glueBrands : GLUE_BRANDS;

  const [selectedBrand, setSelectedBrand] = useState<string>(glueBrands[0] || 'Pidilite W-10 (Food Grade Adhesive)');
  const [quantityKg, setQuantityKg] = useState<string>('');
  const [selectedMachine, setSelectedMachine] = useState<string>(defaultMachine || 'Cutting-1');
  const [selectedStage, setSelectedStage] = useState<string>(defaultStage || 'Cutting');
  const [jobIdInput, setJobIdInput] = useState<string>(defaultJobId || '');
  const [batchIdInput, setBatchIdInput] = useState<string>(defaultBatchId || '');
  const [operatorInput, setOperatorInput] = useState<string>(defaultOperator || '');
  const [lotOrDrumNo, setLotOrDrumNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [shift, setShift] = useState<'DAY' | 'NIGHT'>('DAY');

  useEffect(() => {
    if (defaultMachine) setSelectedMachine(defaultMachine);
    if (defaultStage) setSelectedStage(defaultStage);
    if (defaultJobId) setJobIdInput(defaultJobId);
    if (defaultBatchId) setBatchIdInput(defaultBatchId);
    if (defaultOperator) setOperatorInput(defaultOperator);
  }, [defaultMachine, defaultStage, defaultJobId, defaultBatchId, defaultOperator, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantityKg);
    if (isNaN(qty) || qty <= 0) {
      alert('⚠️ Please enter a valid glue quantity (KG / Litres)!');
      return;
    }
    if (!selectedBrand) {
      alert('⚠️ Please select a Glue Brand!');
      return;
    }
    if (!operatorInput.trim()) {
      alert('⚠️ Operator name is mandatory!');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newEntry: GlueUsageEntry = {
      id: `GLUE-${Date.now()}`,
      date: dateStr,
      time: timeStr,
      shift,
      machine: selectedMachine,
      stage: selectedStage,
      jobId: jobIdInput.trim() ? jobIdInput.trim().toUpperCase() : undefined,
      batchId: batchIdInput.trim() ? batchIdInput.trim().toUpperCase() : undefined,
      product: undefined,
      glueBrand: selectedBrand,
      quantityKg: qty,
      operator: operatorInput.trim().toUpperCase(),
      lotOrDrumNo: lotOrDrumNo.trim() ? lotOrDrumNo.trim().toUpperCase() : undefined,
      notes: notes.trim() || undefined,
      user: 'operator',
      createdAt: now.toISOString()
    };

    // Also update any active running batch if matched
    let updatedJobs = [...(state.jobs || [])];
    if (batchIdInput || selectedMachine) {
      updatedJobs = updatedJobs.map((j) => {
        if (!j.runningBatches) return j;
        return {
          ...j,
          glueUsageKg: (j.glueUsageKg || 0) + qty,
          glueBrand: selectedBrand,
          runningBatches: j.runningBatches.map((b) => {
            if (
              (batchIdInput && b.batchId === batchIdInput) ||
              (!batchIdInput && b.machine === selectedMachine && (b.status === 'Running' || b.status === 'Held'))
            ) {
              return {
                ...b,
                glueBrand: selectedBrand,
                glueUsageKg: (b.glueUsageKg || 0) + qty
              };
            }
            return b;
          })
        };
      });
    }

    const newLog: LogEntry = {
      jobId: jobIdInput.trim() ? jobIdInput.trim().toUpperCase() : undefined,
      stage: selectedStage,
      machine: selectedMachine,
      shift,
      action: `💧 Adhesive Glue Issued: ${qty} KG [${selectedBrand}] on ${selectedMachine} by ${operatorInput.toUpperCase()}${lotOrDrumNo ? ` (Drum #${lotOrDrumNo})` : ''}`,
      worker: operatorInput.toUpperCase(),
      user: 'operator',
      rawDate: dateStr,
      timestamp: now.toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      glueUsageLogs: [newEntry, ...(state.glueUsageLogs || [])],
      logs: [newLog, ...(state.logs || [])]
    });

    alert(`✅ Adhesive Glue Recorded Successfully!\n• Brand: ${selectedBrand}\n• Quantity: ${qty} KG\n• Machine: ${selectedMachine}\n• Operator: ${operatorInput.toUpperCase()}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <Droplets className="w-6 h-6 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide uppercase m-0 flex items-center gap-2">
                <span>Adhesive Glue Usage Entry</span>
                <span className="text-[10px] bg-cyan-400 text-slate-950 font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Adhesive Tracker
                </span>
              </h3>
              <p className="text-xs text-blue-100/90 font-medium m-0 mt-0.5">
                Record Adhesive / Glue consumption per machine and job
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Glue Brand Selection (Admin Managed) */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-blue-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Tag className="w-4 h-4 text-blue-700" />
                <span>Adhesive Glue Brand *</span>
              </label>
              <span className="text-[10px] font-bold text-blue-700 bg-white border border-blue-300 px-2 py-0.5 rounded-md">
                Admin Approved
              </span>
            </div>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full p-2.5 bg-white border-2 border-blue-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-600 shadow-2xs"
            >
              {glueBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <p className="text-[10.5px] text-blue-800 m-0">
              ℹ️ Admin controls available brands in Master Settings &gt; Adhesive Glue Brands.
            </p>
          </div>

          {/* Quantity and Shift */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Glue Quantity (KG / Litres) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.05"
                  min="0.01"
                  required
                  value={quantityKg}
                  onChange={(e) => setQuantityKg(e.target.value)}
                  placeholder="e.g. 3.5"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-600 text-sm"
                />
                <span className="absolute right-3 top-2.5 font-bold text-slate-400 text-xs">KG</span>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Shift *
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as 'DAY' | 'NIGHT')}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-600 text-xs"
              >
                <option value="DAY">☀️ DAY SHIFT</option>
                <option value="NIGHT">🌙 NIGHT SHIFT</option>
              </select>
            </div>
          </div>

          {/* Machine & Stage Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Machine / Station *
              </label>
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-600 text-xs"
              >
                {ALL_MACHINES_LIST.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Department / Stage *
              </label>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-600 text-xs"
              >
                <option value="Cutting">Cutting Desk</option>
                <option value="Forming">Forming Desk</option>
                <option value="Slitting">Slitting Desk</option>
                <option value="Packing">Packing Station</option>
              </select>
            </div>
          </div>

          {/* Operator Name & Lot/Drum No */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Operator Name *
              </label>
              <input
                type="text"
                required
                value={operatorInput}
                onChange={(e) => setOperatorInput(e.target.value)}
                placeholder="e.g. CUT_OP1"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:border-blue-600 uppercase text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Drum / Lot No.
              </label>
              <input
                type="text"
                value={lotOrDrumNo}
                onChange={(e) => setLotOrDrumNo(e.target.value)}
                placeholder="e.g. DRUM-991"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 outline-none focus:border-blue-600 uppercase text-xs"
              />
            </div>
          </div>

          {/* Associated Job / Batch ID (Optional) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Job ID (Optional)
              </label>
              <input
                type="text"
                value={jobIdInput}
                onChange={(e) => setJobIdInput(e.target.value)}
                placeholder="e.g. JOB-SPN-101"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 outline-none focus:border-blue-600 uppercase text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Batch ID (Optional)
              </label>
              <input
                type="text"
                value={batchIdInput}
                onChange={(e) => setBatchIdInput(e.target.value)}
                placeholder="e.g. B-1042"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 outline-none focus:border-blue-600 uppercase text-xs"
              />
            </div>
          </div>

          {/* Remarks / Notes */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Purpose / Remarks
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paper ply bonding on knife roll"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 outline-none focus:border-blue-600 text-xs"
            />
          </div>

          {/* Submit Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Glue Usage Entry</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
