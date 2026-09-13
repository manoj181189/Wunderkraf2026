import React, { useState, useEffect } from 'react';
import { X, Check, Wrench, User, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { DEFAULT_MAINTENANCE_TECHNICIANS } from '../lib/constants';

interface AttendingTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineName: string;
  incidentId: string;
  reason?: string;
  currentAttendant?: string;
  availableTechnicians?: string[];
  onConfirmAttend: (technicianName: string, notes?: string) => void;
}

export const AttendingTechnicianModal: React.FC<AttendingTechnicianModalProps> = ({
  isOpen,
  onClose,
  machineName,
  incidentId,
  reason,
  currentAttendant,
  availableTechnicians = DEFAULT_MAINTENANCE_TECHNICIANS,
  onConfirmAttend
}) => {
  const allTechs = [
    'Manoj Kumar (Plant Head / Maintenance Manager)',
    ...availableTechnicians
  ];

  // Remove duplicates
  const uniqueTechs = Array.from(new Set(allTechs));

  const [selectedTech, setSelectedTech] = useState<string>(currentAttendant || uniqueTechs[0]);
  const [customTechName, setCustomTechName] = useState<string>('');
  const [attendNotes, setAttendNotes] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedTech(currentAttendant || uniqueTechs[0]);
      setCustomTechName('');
      setAttendNotes('');
    }
  }, [isOpen, currentAttendant]);

  if (!isOpen) return null;

  const effectiveTech = customTechName.trim() ? customTechName.trim() : selectedTech;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveTech) {
      alert('⚠️ Please select the name of the attending maintenance manager or technician!');
      return;
    }
    onConfirmAttend(effectiveTech, attendNotes.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide uppercase m-0 flex items-center gap-2">
                <span>Attend Breakdown</span>
              </h3>
              <p className="text-xs text-amber-100 font-medium m-0">
                Machine: <strong>{machineName}</strong> [{incidentId}]
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirm} className="p-4 sm:p-6 space-y-4">
          {/* Reason Alert */}
          {reason && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-900 block">Reported Fault:</span>
                <span className="text-amber-800">{reason}</span>
              </div>
            </div>
          )}

          {/* Technician Selection */}
          <div>
            <label className="block text-xs font-black text-slate-800 uppercase mb-1.5 flex items-center justify-between">
              <span>Select Attending Maintenance Manager / Engineer Name: *</span>
              <span className="text-[11px] font-bold text-amber-700">Required</span>
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {uniqueTechs.map((tech) => (
                <label
                  key={tech}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition cursor-pointer text-xs font-bold ${
                    selectedTech === tech && !customTechName.trim()
                      ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="attendingTech"
                    checked={selectedTech === tech && !customTechName.trim()}
                    onChange={() => {
                      setSelectedTech(tech);
                      setCustomTechName('');
                    }}
                    className="accent-amber-600 w-4 h-4"
                  />
                  <User className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{tech}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Name input if someone else */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Or Type Custom Name / External Vendor:
            </label>
            <input
              type="text"
              value={customTechName}
              onChange={(e) => setCustomTechName(e.target.value)}
              placeholder="e.g. Sanjay Patel (Maintenance Lead) or Vendor Name"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-600 focus:bg-white"
            />
          </div>

          {/* Initial observation note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Initial Inspection Note (Optional):
            </label>
            <input
              type="text"
              value={attendNotes}
              onChange={(e) => setAttendNotes(e.target.value)}
              placeholder="e.g. Started checking heater and motor voltage..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:border-amber-600 focus:bg-white"
            />
          </div>

          {/* Banner showing who will be registered */}
          <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                Will display on dashboard:
              </span>
              <span className="text-sm font-black text-emerald-950">
                👨‍🔧 {effectiveTech}
              </span>
              <span className="text-[11px] text-emerald-700 block font-medium">
                "This person is working here" status will be activated immediately.
              </span>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 shadow-md hover:shadow-lg cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>👨‍🔧 I am starting work (Confirm Attend)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
