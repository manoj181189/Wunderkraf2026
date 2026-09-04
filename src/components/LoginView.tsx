import React, { useState } from 'react';
import { Lock, UserCheck, KeyRound, AlertCircle, Sparkles } from 'lucide-react';
import { UserAccount } from '../types';

interface LoginViewProps {
  users: Record<string, UserAccount>;
  brandLogoBase64?: string;
  onLogin: (username: string, pass: string) => boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, brandLogoBase64, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onLogin(username.trim().toLowerCase(), password);
    if (!success) {
      setError(true);
    }
  };

  const handleQuickSelect = (u: string) => {
    setUsername(u);
    const pass = users[u]?.pass || '';
    setPassword(pass);
    setError(false);
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
      {/* Brand Monogram */}
      <div className="w-24 h-24 mx-auto mb-5 bg-slate-50 border border-slate-200 rounded-2xl p-2 shadow-inner flex items-center justify-center overflow-hidden">
        {brandLogoBase64 ? (
          <img src={brandLogoBase64} alt="Brand Logo" className="w-full h-full object-contain" />
        ) : (
          <div className="text-3xl font-extrabold text-[#1a365d] tracking-wider">WK</div>
        )}
      </div>

      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-[#1a365d] m-0">Secure Workstation Login</h2>
        <p className="text-xs text-slate-500 mt-1">
          Select or enter your operator/desk credentials to access ERP modules
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Workstation Username
          </label>
          <div className="relative">
            <input
              type="text"
              id="login-username-input"
              list="userAutocompleteList"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(false);
              }}
              placeholder="e.g. admin, slit_user, cut_user..."
              className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:bg-white focus:border-[#3182ce] focus:ring-2 focus:ring-blue-100 outline-none transition"
              required
            />
            <datalist id="userAutocompleteList">
              {Object.keys(users).map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <UserCheck className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Private Access Password
          </label>
          <div className="relative">
            <input
              type="password"
              id="login-password-input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="Enter password"
              className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:bg-white focus:border-[#3182ce] focus:ring-2 focus:ring-blue-100 outline-none transition"
              required
            />
            <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Invalid username or password. Please re-enter credentials.</span>
          </div>
        )}

        <button
          type="submit"
          id="login-submit-btn"
          className="w-full py-3 bg-[#1a365d] hover:bg-[#2b6cb0] text-white font-bold rounded-lg text-sm transition shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
        >
          <KeyRound className="w-4 h-4" />
          <span>Login Workstation</span>
        </button>
      </form>

      {/* Quick Desk Credentials Shortcut Pills */}
      <div className="mt-6 pt-5 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Quick Switch Workstations (Demo Fast Login):</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(users).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => handleQuickSelect(u)}
              className="text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md font-medium transition cursor-pointer"
            >
              {u}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
