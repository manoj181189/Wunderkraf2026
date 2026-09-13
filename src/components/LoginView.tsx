import React, { useState } from 'react';
import { Lock, UserCheck, KeyRound, AlertCircle, Sparkles, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { UserAccount } from '../types';

interface LoginViewProps {
  users: Record<string, UserAccount>;
  brandLogoBase64?: string;
  onLogin: (username: string, pass: string) => boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, brandLogoBase64, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="max-w-md mx-auto my-10 bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
      {/* Brand Monogram */}
      <div className="w-24 h-24 mx-auto mb-5 bg-slate-50 border border-slate-200 rounded-2xl p-2 shadow-inner flex items-center justify-center overflow-hidden">
        <img 
          src={brandLogoBase64 || "/logo.png"} 
          alt="Brand Logo" 
          className="w-full h-full object-contain" 
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const nextEl = e.currentTarget.nextElementSibling as HTMLElement;
            if (nextEl) nextEl.style.display = 'flex';
          }}
        />
        <div className="items-center justify-center text-3xl font-extrabold text-[#1a365d] tracking-wider hidden w-full h-full">
          WK
        </div>
      </div>

      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-[#1a365d] m-0">Secure Workstation Login</h2>
        <p className="text-xs text-slate-500 mt-1">
          Wünderkraf Factory ERP & AI Intelligence Access Gate
        </p>
      </div>

      {/* Security Notice Banner */}
      <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="leading-snug">
          <p className="font-bold text-amber-950 m-0">Login Required Policy:</p>
          <p className="text-[11px] text-amber-800 mt-0.5 m-0">
            Voice AI Floor Dictation, Google Search Grounding, or any floor screen cannot be directly accessed without Login.
          </p>
        </div>
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
              placeholder="e.g. admin, slit_user, cut_user, qc_user..."
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
              type={showPassword ? 'text' : 'password'}
              id="login-password-input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="Enter workstation password"
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:bg-white focus:border-[#3182ce] focus:ring-2 focus:ring-blue-100 outline-none transition"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition cursor-pointer p-0.5"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Invalid login! Incorrect username or password. Please try again.</span>
          </div>
        )}

        <button
          type="submit"
          id="login-submit-btn"
          className="w-full py-3 bg-[#1a365d] hover:bg-[#2b6cb0] text-white font-bold rounded-lg text-sm transition shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
        >
          <KeyRound className="w-4 h-4" />
          <span>Login & Open Floor Hub</span>
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100 text-center">
        <p className="text-[11px] text-slate-400 m-0">
          🔒 Unauthorized access is strictly prohibited. To manage accounts or reset credentials, contact the Admin / Production Head.
        </p>
      </div>
    </div>
  );
};
