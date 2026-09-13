import React from 'react';
import { X, Users } from 'lucide-react';
import { FactoryState } from '../types';
import { LiveFloorManpowerTracker } from './LiveFloorManpowerTracker';

interface PlantManpowerModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: FactoryState;
  onSaveState: (newState: FactoryState) => void;
}

export const PlantManpowerModal: React.FC<PlantManpowerModalProps> = ({
  isOpen,
  onClose,
  state,
  onSaveState
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-100 rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Top Close Bar */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-black tracking-wide uppercase">
              Live Plant Manpower & Helper Audit
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 overflow-y-auto flex-1">
          <LiveFloorManpowerTracker state={state} onSaveState={onSaveState} />
        </div>
      </div>
    </div>
  );
};
