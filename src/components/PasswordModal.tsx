import React, { useState } from 'react';
import { Lock, X, Check } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  correctPassword: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  correctPassword,
  onClose,
  onSuccess
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPassword) {
      setError(false);
      setPin('');
      onSuccess();
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-4 text-[#1a365d]">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 m-0">Admin Security Verification</h3>
            <span className="text-[11px] text-slate-500">Enter master PIN to unlock restricted view</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Master Admin Password / PIN:
            </label>
            <input
              type="password"
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              placeholder="Enter PIN (Default: 1234)"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-600 tracking-wider"
              required
            />
          </div>

          {error && (
            <div className="text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
              ❌ Invalid PIN! Please check and try again.
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <Check className="w-4 h-4" /> Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
