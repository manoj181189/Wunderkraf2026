import React, { useState } from 'react';
import {
  RotateCcw,
  User,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ChevronRight,
  Layers,
  X,
  Gauge,
  Package,
  Plus,
  Trash2,
  Sparkles
} from 'lucide-react';
import { RunningBatch, Job, OperatorRunSlice } from '../types';

export interface ShiftHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: RunningBatch;
  job: Job;
  machine: string;
  stageName: 'Slitting' | 'Cutting' | 'Forming' | 'QC' | 'Packing' | string;
  availableWorkers: string[];
  availableHelpers?: string[];
  unitLabel?: string; // e.g. "Cut Crates", "Formed Crates", "Slit Rolls", "Packed Boxes"
  piecesPerUnit?: number; // e.g. 10000 for cutting, 7000 for forming
  initialProducedQty?: number;
  initialLoosePieces?: number;
  initialScrapQty?: number;
  initialMeterReading?: number;
  initialHelpers?: string[];
  onConfirmHandover: (handoverData: {
    relievedByOperator: string;
    nextShift: 'DAY' | 'NIGHT' | string;
    handoverTime: string;
    meterReading: number;
    sliceProducedQty: number; // Crates / Units
    sliceLoosePieces?: number; // Loose pieces
    sliceProducedPieces?: number; // (Crates * piecesPerUnit) + loose pieces
    sliceScrapQty: number; // Scrap Kg or Defect Pcs
    handoverNotes: string;
    helpers?: string[];
  }) => void;
}

export const ShiftHandoverModal: React.FC<ShiftHandoverModalProps> = ({
  isOpen,
  onClose,
  batch,
  job,
  machine,
  stageName,
  availableWorkers,
  availableHelpers = ['SUNIL_HELPER', 'DINESH_HELPER', 'MUKESH_HELPER', 'PRAKASH_HELPER', 'BABLU_HELPER', 'CHANDAN_HELPER', 'SANTOSH_HELPER', 'RAJU_HELPER'],
  unitLabel = 'Crates',
  piecesPerUnit = 0,
  initialProducedQty,
  initialLoosePieces,
  initialScrapQty,
  initialMeterReading,
  initialHelpers,
  onConfirmHandover
}) => {
  if (!isOpen) return null;

  const currentShift = (batch.shift || 'DAY').toUpperCase();
  const suggestedNextShift = currentShift === 'DAY' ? 'NIGHT' : 'DAY';

  const [relievingOperator, setRelievingOperator] = useState<string>('');
  const [customWorkerInput, setCustomWorkerInput] = useState<string>('');
  const [nextShift, setNextShift] = useState<'DAY' | 'NIGHT' | string>(suggestedNextShift);

  // Meter / Stroke reading at handover
  const defaultMeter = initialMeterReading !== undefined ? initialMeterReading : (batch.meterReading || batch.totalStrokes || '');
  const [meterReadingInput, setMeterReadingInput] = useState<string>(String(defaultMeter));

  // Units / Crates produced by current operator during their shift
  const defaultProduced = initialProducedQty !== undefined && initialProducedQty > 0
    ? initialProducedQty
    : (batch.producedQty || 0);
  const [sliceProducedQtyInput, setSliceProducedQtyInput] = useState<string>(String(defaultProduced));

  // Loose pieces produced during this shift (especially for Cutting & Forming)
  const defaultLoose = initialLoosePieces !== undefined && initialLoosePieces > 0
    ? initialLoosePieces
    : (batch.loosePieces || 0);
  const [sliceLoosePiecesInput, setSliceLoosePiecesInput] = useState<string>(String(defaultLoose));

  // Scrap / Rejection produced during this shift
  const fallbackScrap = stageName === 'Slitting' || stageName === 'Cutting' ? (batch.scrapKg || 0) : (batch.scrapPcs || 0);
  const defaultScrap = initialScrapQty !== undefined ? initialScrapQty : fallbackScrap;
  const [sliceScrapQtyInput, setSliceScrapQtyInput] = useState<string>(String(defaultScrap));

  // Helpers for incoming operator
  const existingHelpers = initialHelpers || batch.helpers || [];
  const [incomingHelpers, setIncomingHelpers] = useState<string[]>(existingHelpers);
  const [newHelperInput, setNewHelperInput] = useState<string>('');

  // Handover checklist notes
  const [handoverNotes, setHandoverNotes] = useState<string>('');
  const [handoverConfirmed, setHandoverConfirmed] = useState<boolean>(true);

  // Current time
  const nowTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const parsedProduced = parseFloat(sliceProducedQtyInput) || 0;
  const parsedLoose = parseInt(sliceLoosePiecesInput, 10) || 0;
  const calculatedPieces = piecesPerUnit > 0
    ? Math.round(parsedProduced * piecesPerUnit) + parsedLoose
    : (parsedLoose > 0 ? parsedLoose : undefined);
  const parsedScrap = parseFloat(sliceScrapQtyInput) || 0;
  const parsedMeter = parseFloat(meterReadingInput) || 0;

  const finalRelievingOperator = (customWorkerInput.trim() || relievingOperator || '').toUpperCase();

  const handleAddHelper = (helperName: string) => {
    const trimmed = helperName.trim().toUpperCase();
    if (!trimmed) return;
    if (!incomingHelpers.includes(trimmed)) {
      setIncomingHelpers([...incomingHelpers, trimmed]);
    }
    setNewHelperInput('');
  };

  const handleRemoveHelper = (helperName: string) => {
    setIncomingHelpers(incomingHelpers.filter((h) => h !== helperName));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!finalRelievingOperator) {
      alert('Please select or enter the incoming relieving operator.');
      return;
    }

    if (finalRelievingOperator.toLowerCase() === batch.worker.trim().toLowerCase()) {
      alert('Incoming relieving operator must be different from the current operator.');
      return;
    }

    if (!handoverConfirmed) {
      alert('Please accept the shift handover verification checkbox.');
      return;
    }

    onConfirmHandover({
      relievedByOperator: finalRelievingOperator,
      nextShift,
      handoverTime: nowTime,
      meterReading: parsedMeter,
      sliceProducedQty: parsedProduced,
      sliceLoosePieces: parsedLoose,
      sliceProducedPieces: calculatedPieces,
      sliceScrapQty: parsedScrap,
      handoverNotes: handoverNotes.trim(),
      helpers: incomingHelpers
    });

    onClose();
  };

  const existingSlices: OperatorRunSlice[] = batch.slices || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-4 sm:p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300">
              <RotateCcw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-wide m-0">
                  {stageName === 'Cutting'
                    ? 'Cutting Desk Shift Handover'
                    : `Continuous Shift Handover (${stageName} Shift Handover)`}
                </h3>
                <span className="text-[10px] font-extrabold bg-blue-500 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {stageName} Desk
                </span>
              </div>
              <p className="text-xs text-blue-200/90 mt-0.5 m-0">
                {stageName === 'Slitting'
                  ? "Lock Operator A's production (slit rolls, length meters & scrap kg) without stopping the machine and handover the batch to Operator B."
                  : stageName === 'Packing'
                  ? "Lock Operator A's production (packed boxes & scrap) without stopping the machine and handover the batch to Operator B."
                  : "Lock Operator A's production (crates, loose pieces & scrap) without stopping the machine and handover the batch to Operator B."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-800">
          {/* Active Job & Batch Summary Header */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Workstation:</span>
              <span className="font-extrabold text-blue-900">{machine}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Job / Lot ID:</span>
              <span className="font-mono font-extrabold text-indigo-900">{job.id}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Product:</span>
              <span className="font-bold text-slate-800">{job.product}</span>
            </div>
            <div>
              {stageName === 'Slitting' ? (
                <>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Length:</span>
                  <span className="font-bold text-emerald-800">
                    {job.planId ? '1200 Meters' : 'Standard Length'}
                  </span>
                </>
              ) : stageName === 'Packing' ? (
                <>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Boxes:</span>
                  <span className="font-bold text-emerald-800">
                    {job.targetLayers || 'Standard'} Boxes
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Crate Capacity:</span>
                  <span className="font-bold text-emerald-800">
                    {piecesPerUnit > 0 ? `${piecesPerUnit.toLocaleString()} Pcs/Crate` : 'Standard'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Slices History Timeline (if multi-shift run) */}
          {existingSlices.length > 0 && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Prior Shift Slices on this Ongoing Batch ({existingSlices.length}):</span>
                </span>
                <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                  Cumulative Continuous Run
                </span>
              </div>
              <div className="divide-y divide-indigo-100 max-h-32 overflow-y-auto">
                {existingSlices.map((slice, idx) => (
                  <div key={slice.sliceId || idx} className="py-1.5 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-indigo-900">
                        Shift {idx + 1} ({slice.shift}):
                      </span>
                      <span className="font-bold text-slate-800">{slice.operator}</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-500">{slice.relievedByOperator}</span>
                      {slice.helpers && slice.helpers.length > 0 && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                          +{slice.helpers.length} Helpers
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs">
                      {stageName === 'Slitting' ? (
                        <span className="font-bold text-emerald-800">
                          {slice.producedQty} Rolls @ {slice.endMeterReading || slice.strokeCount || '-'} Meters
                        </span>
                      ) : stageName === 'Packing' ? (
                        <span className="font-bold text-emerald-800">
                          {slice.producedQty} Boxes
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-800">
                          {slice.producedQty} {unitLabel}
                          {slice.loosePieces ? ` + ${slice.loosePieces} Loose` : ''}
                        </span>
                      )}
                      {slice.scrapQty > 0 && (
                        <span className="text-rose-700 ml-1.5">
                          ({slice.scrapQty}{stageName === 'Forming' ? ' Pcs' : 'kg'} Scrap)
                        </span>
                      )}
                      <span className="text-slate-400 text-[10px] ml-1.5">@{slice.handoverTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: Outgoing Operator Snapshot (Operator A) */}
          <div className="border border-amber-300 bg-amber-50/50 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                  A
                </div>
                <div>
                  <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide m-0">
                    Outgoing Operator A - Production & Scrap Lock
                  </h4>
                  <span className="text-[11px] text-amber-800 font-medium">
                    Enter accurate production to be credited to this operator\'s account
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-extrabold text-amber-950 bg-amber-200/80 border border-amber-400 px-2.5 py-1 rounded-lg inline-block">
                  👨‍🔧 <b>{batch.worker}</b> ({currentShift} Shift)
                </span>
                {batch.helpers && batch.helpers.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-600 block mt-0.5">
                    🤝 {batch.helpers.length} Helper{batch.helpers.length > 1 ? 's' : ''}: {batch.helpers.join(', ')}
                  </span>
                )}
              </div>
            </div>

            {stageName === 'Slitting' ? (
              <>
                {/* Slitting-Specific Production & Rejection Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Rolls Produced */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-emerald-900 uppercase mb-1 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Produced Slit Rolls (Rolls):</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={sliceProducedQtyInput}
                      onChange={(e) => setSliceProducedQtyInput(e.target.value)}
                      placeholder="e.g. 8 Rolls"
                      className="w-full px-3 py-2 bg-white border border-emerald-400 rounded-lg text-sm font-black text-emerald-950 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                    <span className="text-[10px] text-emerald-700 font-bold mt-0.5 block">
                      Number of finished slit rolls produced
                    </span>
                  </div>

                  {/* Slit Length (Meters) */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-indigo-900 uppercase mb-1 flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Actual Slit Length (Meters):</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={meterReadingInput}
                      onChange={(e) => setMeterReadingInput(e.target.value)}
                      placeholder="e.g. 1200 M"
                      className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-sm font-black text-indigo-950 outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                    <span className="text-[10px] text-indigo-700 font-bold mt-0.5 block">
                      Length of the slitted paper run in meters
                    </span>
                  </div>

                  {/* Trim / Scrap Weight (KG) */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-rose-900 uppercase mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Trim / Scrap Weight (KG):</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={sliceScrapQtyInput}
                      onChange={(e) => setSliceScrapQtyInput(e.target.value)}
                      placeholder="e.g. 5.5 KG"
                      className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-sm font-black text-rose-950 outline-none focus:ring-2 focus:ring-rose-500"
                      required
                    />
                    <span className="text-[10px] text-rose-700 font-bold mt-0.5 block">
                      Wastage or trim weight in KG
                    </span>
                  </div>
                </div>

                {/* Handover Remarks & Core notes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Handover Remarks / Notes:</span>
                  </label>
                  <input
                    type="text"
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="e.g. Blade sharpness is perfect, core tension adjusted."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Blade condition, raw material or special note</span>
                </div>

                {/* Locked Data Card Notice */}
                <div className="bg-amber-100/90 border border-amber-300 text-amber-950 p-2.5 rounded-lg text-xs flex items-center gap-2">
                  <span className="text-base">🔒</span>
                  <div>
                    <b>Record Lock Notice:</b> Upon submission, against operator <b>{batch.worker}</b>'s name{' '}
                    <span className="font-bold underline">
                      {parsedProduced} Slit Rolls ({parsedMeter} Meters Length)
                    </span>{' '}
                    and <span className="font-bold underline">{parsedScrap} kg trim scrap</span> will be permanently recorded.
                  </div>
                </div>
              </>
            ) : stageName === 'Packing' ? (
              <>
                {/* Packing-Specific Production & Rejection Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Packed Boxes */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-emerald-900 uppercase mb-1 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Packed Boxes (Boxes):</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={sliceProducedQtyInput}
                      onChange={(e) => setSliceProducedQtyInput(e.target.value)}
                      placeholder="e.g. 50 Boxes"
                      className="w-full px-3 py-2 bg-white border border-emerald-400 rounded-lg text-sm font-black text-emerald-950 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                    <span className="text-[10px] text-emerald-700 font-bold mt-0.5 block">
                      Number of fully packed boxes
                    </span>
                  </div>

                  {/* Scrap / Defect pieces or kg */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-rose-900 uppercase mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Rejection Scrap (KG or Pcs):</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={sliceScrapQtyInput}
                      onChange={(e) => setSliceScrapQtyInput(e.target.value)}
                      placeholder="e.g. 0"
                      className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-sm font-black text-rose-950 outline-none focus:ring-2 focus:ring-rose-500"
                      required
                    />
                    <span className="text-[10px] text-rose-700 font-bold mt-0.5 block">
                      Defects or rejected boxes/packing scrap
                    </span>
                  </div>
                </div>

                {/* Handover Remarks */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Handover Remarks / Notes:</span>
                  </label>
                  <input
                    type="text"
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="e.g. Label printer rolls replaced, packing boxes stacked."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Tape, stickers, shrink film or machine setup note</span>
                </div>

                {/* Locked Data Card Notice */}
                <div className="bg-amber-100/90 border border-amber-300 text-amber-950 p-2.5 rounded-lg text-xs flex items-center gap-2">
                  <span className="text-base">🔒</span>
                  <div>
                    <b>Record Lock Notice:</b> Upon submission, against operator <b>{batch.worker}</b>'s name{' '}
                    <span className="font-bold underline">
                      {parsedProduced} Packed Boxes
                    </span>{' '}
                    and <span className="font-bold underline">{parsedScrap} kg/pcs scrap</span> will be permanently recorded.
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Default Grid (Cutting & Forming) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Crates Produced */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-emerald-900 uppercase mb-1 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Cut Crates ({unitLabel}):</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={sliceProducedQtyInput}
                      onChange={(e) => setSliceProducedQtyInput(e.target.value)}
                      placeholder={`e.g. 5 ${unitLabel}`}
                      className="w-full px-3 py-2 bg-white border border-emerald-400 rounded-lg text-sm font-black text-emerald-950 outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                    <span className="text-[10px] text-emerald-700 font-bold mt-0.5 block">
                      Number of fully prepared crates
                    </span>
                  </div>

                  {/* Loose Pieces */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-indigo-900 uppercase mb-1 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Open / Loose Pieces (Loose Pcs):</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={sliceLoosePiecesInput}
                      onChange={(e) => setSliceLoosePiecesInput(e.target.value)}
                      placeholder="e.g. 500"
                      className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-sm font-black text-indigo-950 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[10px] text-indigo-700 font-bold mt-0.5 block">
                      Extra open pieces (e.g. 500 pieces)
                    </span>
                  </div>

                  {/* Scrap / Rejection */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-rose-900 uppercase mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>
                        {stageName === 'Slitting' || stageName === 'Cutting'
                          ? 'Rejection Scrap (Scrap in KG):'
                          : 'Defect Pieces:'}
                      </span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={sliceScrapQtyInput}
                      onChange={(e) => setSliceScrapQtyInput(e.target.value)}
                      placeholder="e.g. 1.0"
                      className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-sm font-black text-rose-950 outline-none focus:ring-2 focus:ring-rose-500"
                      required
                    />
                    <span className="text-[10px] text-rose-700 font-bold mt-0.5 block">
                      {stageName === 'Slitting' || stageName === 'Cutting'
                        ? 'Cutting Scrap Weight (in KG)'
                        : 'Defective / Rejected Pieces'}
                    </span>
                  </div>
                </div>

                {/* Live Calculation Card */}
                <div className="bg-emerald-100/70 border border-emerald-300 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-950">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <b>Total Produced Flat Blanks:</b>{' '}
                      <span className="font-mono font-bold">
                        {parsedProduced} Crates × {piecesPerUnit > 0 ? piecesPerUnit.toLocaleString() : 0} + {parsedLoose} Loose =
                      </span>
                    </span>
                  </div>
                  <div className="font-mono text-sm font-black text-emerald-900 bg-white px-3 py-1 rounded-lg border border-emerald-300 shadow-xs">
                    {(calculatedPieces ?? 0).toLocaleString()} Pieces
                  </div>
                </div>

                {/* Optional Stroke / Meter Counter & Remarks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-blue-600" />
                      <span>Machine Stroke / Meter Counter (Stroke Count):</span>
                    </label>
                    <input
                      type="number"
                      value={meterReadingInput}
                      onChange={(e) => setMeterReadingInput(e.target.value)}
                      placeholder="e.g. 50500"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Machine stroke counter at handover time</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Handover Remarks / Notes:</span>
                    </label>
                    <input
                      type="text"
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      placeholder="e.g. 5 Crates + 500 loose pieces ready, 1 kg scrap, blade edge is fine."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-indigo-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Blade condition, raw material or special note</span>
                  </div>
                </div>

                {/* Locked Data Card Notice */}
                <div className="bg-amber-100/90 border border-amber-300 text-amber-950 p-2.5 rounded-lg text-xs flex items-center gap-2">
                  <span className="text-base">🔒</span>
                  <div>
                    <b>Record Lock Notice:</b> Upon submission, against operator <b>{batch.worker}</b>'s name{' '}
                    <span className="font-bold underline">
                      {parsedProduced} Crates + {parsedLoose} loose pieces ({calculatedPieces?.toLocaleString()} pieces)
                    </span>{' '}
                    and <span className="font-bold underline">{parsedScrap} kg scrap</span> will be permanently recorded.
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Section 2: Incoming Operator Assignment (Operator B) */}
          <div className="border border-blue-300 bg-blue-50/50 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                  B
                </div>
                <div>
                  <h4 className="text-xs font-black text-blue-950 uppercase tracking-wide m-0">
                    Incoming Relieving Operator B
                  </h4>
                  <span className="text-[11px] text-blue-800 font-medium">
                    Operator taking charge and helpers assigned with them
                  </span>
                </div>
              </div>
              <span className="text-xs font-extrabold text-blue-900 bg-blue-100 border border-blue-300 px-2.5 py-1 rounded-lg">
                Handover Time: <b>{nowTime}</b>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>Select Relieving Operator:</span>
                </label>
                <select
                  value={relievingOperator}
                  onChange={(e) => {
                    setRelievingOperator(e.target.value);
                    if (e.target.value) setCustomWorkerInput('');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="">-- Select Operator --</option>
                  {availableWorkers
                    .filter((w) => w.trim().toLowerCase() !== batch.worker.trim().toLowerCase())
                    .map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Or type new name below</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Incoming Shift (Relieving Shift):</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNextShift('DAY')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition border cursor-pointer ${
                      nextShift === 'DAY'
                        ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    ☀️ DAY SHIFT
                  </button>
                  <button
                    type="button"
                    onClick={() => setNextShift('NIGHT')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition border cursor-pointer ${
                      nextShift === 'NIGHT'
                        ? 'bg-indigo-950 text-indigo-100 border-indigo-800 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    🌙 NIGHT SHIFT
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Operator Name input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Any other operator (Type Custom Operator Name if not in list):
              </label>
              <input
                type="text"
                value={customWorkerInput}
                onChange={(e) => {
                  setCustomWorkerInput(e.target.value);
                  if (e.target.value) setRelievingOperator('');
                }}
                placeholder="e.g. RAJESH_CUTTING"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 uppercase outline-none focus:border-blue-500"
              />
            </div>

            {/* Assigned Helpers for incoming operator */}
            <div className="bg-white p-3 rounded-xl border border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-slate-800 uppercase flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>Helpers with incoming operator (Assigned Helpers):</span>
                </label>
                <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {incomingHelpers.length} {incomingHelpers.length === 1 ? 'Helper' : 'Helpers'} Assigned
                </span>
              </div>

              {/* Helper chips */}
              <div className="flex flex-wrap gap-1.5 min-h-7 items-center">
                {incomingHelpers.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No helper selected (Single operator)</span>
                ) : (
                  incomingHelpers.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-1 rounded-md text-xs font-bold"
                    >
                      <span>🤝 {h}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHelper(h)}
                        className="hover:text-rose-600 transition cursor-pointer"
                        title="Remove helper"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Quick Add Helper buttons */}
              <div className="flex flex-wrap gap-1 pt-1">
                {availableHelpers
                  .filter((h) => !incomingHelpers.includes(h))
                  .slice(0, 5)
                  .map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleAddHelper(h)}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded border border-slate-300 transition cursor-pointer flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      {h}
                    </button>
                  ))}
              </div>

              {/* Custom Helper Input */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newHelperInput}
                  onChange={(e) => setNewHelperInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddHelper(newHelperInput);
                    }
                  }}
                  placeholder="Type other helper name and press +..."
                  className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddHelper(newHelperInput)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>

          {/* Handover Verification Checkbox */}
          <div className="border border-slate-200 bg-slate-50 p-3.5 rounded-xl space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={handoverConfirmed}
                onChange={(e) => setHandoverConfirmed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
              />
              <span className="text-xs text-slate-700 leading-snug">
                <b>Handover Physical Verification Acceptance:</b> I have physically verified the machine condition, and operator{' '}
                {stageName === 'Slitting' ? (
                  <>
                    <b>{batch.worker}</b> prepared <b>{parsedProduced} Slit Rolls ({parsedMeter} Meters Length)</b> and{' '}
                    <b>{parsedScrap} kg scrap</b> and handing over the new charge to operator <b>{finalRelievingOperator || '[Selected Operator]'}</b>.
                  </>
                ) : stageName === 'Packing' ? (
                  <>
                    <b>{batch.worker}</b> prepared <b>{parsedProduced} Packed Boxes</b> and{' '}
                    <b>{parsedScrap} kg/pcs scrap</b> and handing over the new charge to operator <b>{finalRelievingOperator || '[Selected Operator]'}</b>.
                  </>
                ) : (
                  <>
                    <b>{batch.worker}</b> prepared <b>{parsedProduced} Crates + {parsedLoose} Loose Pieces ({calculatedPieces?.toLocaleString()} Total Pieces)</b> and{' '}
                    <b>{parsedScrap} kg scrap</b> and handing over the new charge to operator <b>{finalRelievingOperator || '[Selected Operator]'}</b>.
                  </>
                )}
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Secure Handover (Lock Output & Confirm Handover)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
