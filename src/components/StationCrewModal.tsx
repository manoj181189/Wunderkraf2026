import React, { useState, useEffect } from 'react';
import { X, Users, UserCheck, Plus, CheckCircle2, Shield, Wrench, Sparkles } from 'lucide-react';
import { FactoryState, FloorWorker, WorkforceRole } from '../types';
import { DEFAULT_FLOOR_WORKERS } from '../lib/constants';

interface StationCrewModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: string;
  stage: string;
  shift: 'DAY' | 'NIGHT' | string;
  currentOperator: string;
  currentHelpers: string[];
  state: FactoryState;
  onConfirmCrew: (operator: string, helpers: string[]) => void;
}

export const StationCrewModal: React.FC<StationCrewModalProps> = ({
  isOpen,
  onClose,
  machine,
  stage,
  shift,
  currentOperator,
  currentHelpers,
  state,
  onConfirmCrew
}) => {
  const allWorkers: FloorWorker[] = state.floorWorkers !== undefined
    ? state.floorWorkers
    : DEFAULT_FLOOR_WORKERS;

  const [operator, setOperator] = useState(currentOperator || '');
  const [selectedHelpers, setSelectedHelpers] = useState<string[]>(currentHelpers || []);
  const [customHelperName, setCustomHelperName] = useState('');

  useEffect(() => {
    setOperator(currentOperator || '');
    setSelectedHelpers(currentHelpers || []);
  }, [currentOperator, currentHelpers, isOpen]);

  if (!isOpen) return null;

  // Filter available helpers from floor roster or matching department
  const helperPool = allWorkers
    .filter((w) => w.role === 'HELPER')
    .map((w) => w.name);

  // Filter available operators
  const operatorPool = allWorkers
    .filter((w) => w.role === 'OPERATOR')
    .map((w) => w.name);

  const toggleHelper = (name: string) => {
    if (selectedHelpers.includes(name)) {
      setSelectedHelpers(selectedHelpers.filter((h) => h !== name));
    } else {
      setSelectedHelpers([...selectedHelpers, name]);
    }
  };

  const handleAddCustomHelper = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customHelperName.trim().toUpperCase();
    if (!clean) return;
    if (!selectedHelpers.includes(clean)) {
      setSelectedHelpers([...selectedHelpers, clean]);
    }
    setCustomHelperName('');
  };

  const handleConfirm = () => {
    if (!operator.trim()) {
      alert('⚠️ Mandatory: Please specify Operator Name!');
      return;
    }
    onConfirmCrew(operator.trim().toUpperCase(), selectedHelpers);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <Users className="w-6 h-6 text-purple-200" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide uppercase m-0 flex items-center gap-2">
                <span>Machine Crew & Helper Allocation</span>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Live Manpower
                </span>
              </h3>
              <p className="text-xs text-purple-100 font-medium m-0 mt-0.5">
                Station: <strong className="text-white underline">{machine}</strong> ({stage}) | Shift: <strong>{shift}</strong>
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

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Operator Input */}
          <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3.5 space-y-2">
            <label className="font-extrabold text-purple-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <UserCheck className="w-4 h-4 text-purple-700" />
              <span>Main Machine Operator *</span>
            </label>
            <div className="flex gap-2">
              <input
                list="operator-pool"
                required
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="Type to search Operator..."
                className="flex-1 p-2.5 bg-white border-2 border-purple-300 rounded-xl font-bold text-slate-900 outline-none focus:border-purple-600 uppercase text-xs"
              />
              <datalist id="operator-pool">
                {operatorPool.map(op => <option key={op} value={op} />)}
              </datalist>
            </div>
            
          </div>

          {/* Helpers Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Assigned Helpers on this Machine</span>
              </label>
              <span className="text-[11px] font-extrabold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                {selectedHelpers.length} Helper{selectedHelpers.length !== 1 ? 's' : ''} Selected
              </span>
            </div>

            <p className="text-[11px] text-slate-500 m-0">
              As soon as the cutting/machine starts, these helpers will be visible live with the operator in the Manpower Tracker below.
            </p>

            {/* Helper Pool Chips */}
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl min-h-[50px] items-center">
              {Array.from(new Set([...helperPool, ...selectedHelpers])).map((hName) => {
                const isSelected = selectedHelpers.includes(hName);
                return (
                  <button
                    key={hName}
                    type="button"
                    onClick={() => toggleHelper(hName)}
                    className={`px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs scale-105'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span>{isSelected ? '✓' : '+'}</span>
                    <span>{hName}</span>
                  </button>
                );
              })}
            </div>

            <div className="text-[10px] text-amber-700 bg-amber-50 p-2 border border-amber-200 rounded-lg mt-2 flex items-center gap-2 font-semibold">
              <span>⚠️ Need to add a new person? Add them to the Master Directory first to maintain a single source of truth.</span>
            </div>
          </div>

          {/* Real-time Visual Deployment Preview */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-1">
            <div className="text-[11px] font-extrabold text-emerald-950 uppercase flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Floor Tracker Preview (Live Station Manpower)</span>
            </div>
            <div className="text-xs text-emerald-900 font-medium leading-relaxed">
              Operator <strong>{operator || '...'}</strong> will work on machine <strong>{machine}</strong> and with them{' '}
              <strong>{selectedHelpers.length} Helpers</strong> ({selectedHelpers.length > 0 ? selectedHelpers.join(', ') : 'None'}) will be deployed.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-black shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm Crew & Helpers (Save & Deploy)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
