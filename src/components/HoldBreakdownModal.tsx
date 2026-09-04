import React, { useState } from 'react';
import { PauseCircle, AlertTriangle, Send, RefreshCw, X } from 'lucide-react';
import { MACHINES } from '../lib/constants';

interface HoldBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetMachine: string;
  onConfirmHold: (reason: string, remarks: string, sendWhatsApp: boolean) => void;
  onConfirmHoldAndReroute: (reason: string, remarks: string, targetMachine: string) => void;
}

export const HoldBreakdownModal: React.FC<HoldBreakdownModalProps> = ({
  isOpen,
  onClose,
  targetMachine,
  onConfirmHold,
  onConfirmHoldAndReroute
}) => {
  const [reason, setReason] = useState('Mechanical Heater / Tooling Issue');
  const [remarks, setRemarks] = useState('');
  const [rerouteMachine, setRerouteMachine] = useState('');

  if (!isOpen) return null;

  // Find candidate machines for rerouting
  let candidateMachines: string[] = [];
  if (targetMachine.startsWith('Cutting-')) candidateMachines = MACHINES['Cutting'];
  else if (targetMachine.startsWith('Forming-')) candidateMachines = MACHINES['Forming'];
  else if (targetMachine.startsWith('Packing-') || targetMachine.startsWith('Manual-')) candidateMachines = MACHINES['Packing'];
  else if (targetMachine.startsWith('Slitting-')) candidateMachines = MACHINES['Slitting'];

  const otherMachines = candidateMachines.filter((m) => m !== targetMachine);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border-t-6 border-orange-500 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-orange-600 mb-4">
          <PauseCircle className="w-6 h-6" />
          <h3 className="text-base font-bold m-0 text-slate-800">
            Machine Hold, Breakdown & Crate Re-routing
          </h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Target Workstation:</label>
            <input
              type="text"
              readOnly
              value={targetMachine}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Breakdown / Pause Cause:</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none"
            >
              <option value="Mechanical Heater / Tooling Issue">Mechanical Heater / Tooling Issue</option>
              <option value="Raw Paper Roll Change / Setup">Raw Paper Roll Change / Setup</option>
              <option value="Electrical / Sensor Fault">Electrical / Sensor Fault</option>
              <option value="Operator Lunch / Tea Break">Operator Lunch / Tea Break</option>
              <option value="Routine Cleaning & Maintenance">Routine Cleaning & Maintenance</option>
              <option value="Die Alignment & Sharpness Check">Die Alignment & Sharpness Check</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Remarks (Displayed on Live Card):
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Temp controller error, waiting for maintenance tech"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:bg-white focus:border-orange-500"
            />
          </div>

          {otherMachines.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
              <span className="text-xs font-bold text-blue-900 block mb-1">
                🔄 Crate Re-Routing (Transfer Running Stock):
              </span>
              <select
                value={rerouteMachine}
                onChange={(e) => setRerouteMachine(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs text-slate-800 outline-none"
              >
                <option value="">-- DO NOT RE-ROUTE (HOLD IN PLACE) --</option>
                {otherMachines.map((m) => (
                  <option key={m} value={m}>
                    Shift running batch to {m}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          <button
            onClick={() => onConfirmHold(reason, remarks, false)}
            className="py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
          >
            Pause Silently
          </button>
          <button
            onClick={() => onConfirmHold(reason, remarks, true)}
            className="py-2.5 bg-[#25D366] hover:bg-[#1ebc59] text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Alert on WhatsApp</span>
          </button>
        </div>

        {rerouteMachine && (
          <button
            onClick={() => onConfirmHoldAndReroute(reason, remarks, rerouteMachine)}
            className="w-full mt-2 py-2.5 bg-[#319795] hover:bg-[#285e61] text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Confirm Hold & Transfer Stock to {rerouteMachine}</span>
          </button>
        )}
      </div>
    </div>
  );
};
