import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { UserAccount } from '../types';
import { DEFAULT_USERS } from '../lib/constants';

interface LoginViewProps {
  users: Record<string, UserAccount>;
  brandLogoBase64?: string;
  onLogin: (username: string, pass: string) => boolean | Promise<boolean>;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, brandLogoBase64, onLogin }) => {
  const [allUsers, setAllUsers] = useState<Record<string, UserAccount>>(() => {
    return { ...DEFAULT_USERS, ...(users || {}) };
  });

  const [loginId, setLoginId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Fetch latest users from server on mount
  useEffect(() => {
    let isMounted = true;
    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data?.success && data?.users) {
          setAllUsers((prev) => ({ ...prev, ...data.users }));
        }
      })
      .catch((err) => {
        console.warn('Could not fetch remote users list:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Update when parent users prop changes
  useEffect(() => {
    if (users && Object.keys(users).length > 0) {
      setAllUsers((prev) => ({ ...prev, ...users }));
    }
  }, [users]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ordered list of clean user IDs (case-insensitive deduplication)
  const allUserKeys = Array.from(
    new Set([
      'admin',
      'mac',
      'manoj',
      'sandip',
      'tushar',
      'sarang',
      'kishan',
      'balu',
      'paras',
      'amish',
      'priti',
      'abhay',
      'supervisor',
      ...Object.keys(DEFAULT_USERS),
      ...Object.keys(allUsers || {})
    ])
  );

  const trimmedQuery = loginId.trim().toLowerCase();

  // ONLY filter and show suggestions when the user has actually typed at least 1 character!
  // Empty input = NO popup shown, exactly as requested by user.
  const filteredKeys = trimmedQuery.length > 0
    ? allUserKeys.filter((k) => k.toLowerCase().includes(trimmedQuery))
    : [];

  const handleSelectKey = (key: string) => {
    setLoginId(key);
    setShowSuggestions(false);
    setErrorMsg(null);
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && filteredKeys.length > 0) {
      e.preventDefault();
      handleSelectKey(filteredKeys[0]);
    } else if (e.key === 'Enter' && showSuggestions && filteredKeys.length > 0) {
      e.preventDefault();
      handleSelectKey(filteredKeys[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = loginId.trim();
    if (!cleanId) {
      setErrorMsg('Please enter Login ID');
      return;
    }
    if (!password.trim()) {
      setErrorMsg('Please enter Password');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await onLogin(cleanId, password.trim());
      if (!res) {
        setErrorMsg('Invalid Login ID or Password. Please try again.');
        setIsSubmitting(false);
      }
    } catch {
      setErrorMsg('Login failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-6 sm:my-10 bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200">
      {/* Brand Monogram */}
      <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 bg-slate-50 border border-slate-200 rounded-2xl p-2 shadow-inner flex items-center justify-center overflow-hidden">
        <img
          src={brandLogoBase64 || "logo.png"}
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
        <h2 className="text-xl font-bold text-[#1a365d] m-0">Wünderkraf Paperware</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Login ID Input with popup suggestions only when typing */}
        <div ref={containerRef} className="relative">
          <label
            htmlFor="login-id-input"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Login ID
          </label>
          <div className="relative">
            <input
              type="text"
              id="login-id-input"
              value={loginId}
              onChange={(e) => {
                setLoginId(e.target.value);
                setShowSuggestions(true);
                setErrorMsg(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Login ID"
              autoComplete="off"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:bg-white focus:border-[#3182ce] focus:ring-2 focus:ring-blue-100 outline-none transition"
              required
              autoFocus
            />
          </div>

          {/* Clean Suggestion Popup - appears strictly when typing and matches exist */}
          {showSuggestions && trimmedQuery.length > 0 && filteredKeys.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto py-1 divide-y divide-slate-100 animate-fadeIn">
              {filteredKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectKey(k);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-sm text-slate-800 font-semibold hover:bg-blue-50 hover:text-blue-700 transition cursor-pointer flex items-center justify-between"
                >
                  <span className="font-mono">{k}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Password Input */}
        <div>
          <label
            htmlFor="login-password-input"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              ref={passwordInputRef}
              type={showPassword ? 'text' : 'password'}
              id="login-password-input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="Password"
              className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:bg-white focus:border-[#3182ce] focus:ring-2 focus:ring-blue-100 outline-none transition"
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

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium animate-fadeIn">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          id="login-submit-btn"
          disabled={isSubmitting}
          className="w-full py-3 bg-[#1a365d] hover:bg-[#2b6cb0] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-lg text-sm transition shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer mt-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Logging in...</span>
            </>
          ) : (
            <>
              <KeyRound className="w-4 h-4" />
              <span>Login</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
