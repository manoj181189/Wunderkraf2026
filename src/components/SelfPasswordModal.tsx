import React, { useState } from 'react';
import { KeyRound, Check, X } from 'lucide-react';

interface SelfPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { username: string; pass?: string } | null;
  onSavePassword: (newPass: string) => void;
}

export const SelfPasswordModal: React.FC<SelfPasswordModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSavePassword
}) => {
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !currentUser) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass.trim()) {
      setError('Please enter a new password');
      return;
    }
    onSavePassword(newPass.trim());
    setCurrentPass('');
    setNewPass('');
    setError(null);
    onClose();
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
          <KeyRound className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-bold m-0">Change Workstation Password</h3>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              Logged in User:
            </label>
            <input
              type="text"
              readOnly
              value={currentUser.username.toUpperCase()}
              className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              New Private Password:
            </label>
            <input
              type="password"
              value={newPass}
              onChange={(e) => {
                setNewPass(e.target.value);
                setError(null);
              }}
              placeholder="Enter new password"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:bg-white focus:border-blue-600"
              required
            />
          </div>

          {error && <div className="text-xs text-rose-600 font-medium">{error}</div>}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 bg-[#2f855a] hover:bg-[#276749] text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Update Password</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
