import React from 'react';
import { Cloud, KeyRound, ShieldCheck, Home, ClipboardList, LogOut, UserCheck, TrendingUp, Users, RefreshCw, RotateCcw } from 'lucide-react';

interface HeaderProps {
  currentUser?: { username: string; perms: string[] } | null;
  brandLogoBase64?: string;
  onNavigateHome?: () => void;
  onNavigateAnalytics?: () => void;
  onOpenManpowerModal?: () => void;
  manpowerCount?: number;
  onOpenPasswordModal?: () => void;
  onOpenDriveModal?: () => void;
  onOpenRequisitionModal?: () => void;
  arrivedCount?: number;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
  onSwitchUser?: () => void;
  onRefreshState?: () => void;
  isRefreshing?: boolean;
  onOpenHandoverHistory?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  brandLogoBase64,
  onNavigateHome,
  onNavigateAnalytics,
  onOpenManpowerModal,
  manpowerCount,
  onOpenPasswordModal,
  onOpenDriveModal,
  onOpenRequisitionModal,
  arrivedCount = 0,
  onOpenAdmin,
  onLogout,
  onSwitchUser,
  onRefreshState,
  isRefreshing = false,
  onOpenHandoverHistory
}) => {
  const username = currentUser?.username || 'admin';

  return (
    <header className="bg-[#1a365d] text-white px-5 py-3.5 rounded-xl mb-4.5 shadow-md flex items-center justify-between flex-wrap gap-3">
      {/* Brand Identity */}
      <div
        onClick={onNavigateHome}
        className="flex items-center gap-3.5 cursor-pointer group"
      >
        <div className="w-12 h-12 rounded-lg bg-white p-1 flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0 group-hover:scale-105 transition">
          <img 
            src={brandLogoBase64 || "/logo.png"} 
            alt="Wünderkraf Logo" 
            className="w-full h-full object-contain" 
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const nextEl = e.currentTarget.nextElementSibling as HTMLElement;
              if (nextEl) nextEl.style.display = 'flex';
            }}
          />
          <div className="items-center justify-center font-extrabold text-[#1a365d] text-xl tracking-wider hidden w-full h-full">
            WK
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white m-0 group-hover:text-blue-200 transition">
              Wünderkraf Paperware
            </h1>
            <span className="hidden sm:inline-block bg-[#2b6cb0] text-[11px] font-semibold px-2 py-0.5 rounded text-blue-100 uppercase tracking-wide">
              Enterprise v4.3
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Master Factory ERP & Production Management Suite
          </p>
        </div>
      </div>

      {/* Action Hub & Control Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {onNavigateHome && (
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-1.5 bg-[#2b6cb0] hover:bg-[#2c5282] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
            title="Home"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>
        )}

        {onNavigateAnalytics && (
          <button
            onClick={onNavigateAnalytics}
            className="flex items-center gap-1 bg-violet-700 hover:bg-violet-800 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm active:scale-95 cursor-pointer"
            title="Machine & Operator Performance Audit"
          >
            <TrendingUp className="w-3.5 h-3.5 text-violet-200" />
            <span className="hidden sm:inline">Performance</span>
          </button>
        )}

        {/* Live Plant Workforce & Helpers Button */}
        {onOpenManpowerModal && (
          <button
            id="header-manpower-btn"
            onClick={onOpenManpowerModal}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
            title="Live Plant Floor Workforce & Helpers Audit"
          >
            <Users className="w-3.5 h-3.5 text-indigo-200" />
            <span>Manpower {manpowerCount !== undefined ? `(${manpowerCount})` : ''}</span>
          </button>
        )}

        {/* Material Requisition Fast Trigger */}
        {onOpenRequisitionModal && (
          <button
            id="header-requisition-btn"
            onClick={onOpenRequisitionModal}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer relative"
            title="Material Requisition & Purchase Tracking"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Requisition</span>
            {arrivedCount > 0 && (
              <span className="bg-amber-400 text-slate-900 font-extrabold text-[10px] px-1.5 py-0.2 rounded-full animate-bounce">
                {arrivedCount}
              </span>
            )}
          </button>
        )}

        {/* Shift Handover Dossier */}
        {onOpenHandoverHistory && (
          <button
            onClick={onOpenHandoverHistory}
            className="flex items-center gap-1.5 bg-indigo-800 hover:bg-indigo-900 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm active:scale-95 cursor-pointer"
            title="Shift Handover History & Operator Signatures Dossier"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-300" />
            <span className="hidden md:inline">Handover</span>
          </button>
        )}

        {/* Global Database Re-hydration Sync / Refresh */}
        {onRefreshState && (
          <button
            onClick={onRefreshState}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 bg-slate-700/80 hover:bg-slate-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
            title="Re-hydrate & Synchronize State from IndexedDB"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-300 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        )}

        {/* Google Drive Cloud Sync */}
        {onOpenDriveModal && (
          <button
            id="header-gdrive-sync-btn"
            onClick={onOpenDriveModal}
            className="flex items-center gap-1.5 bg-[#4285F4] hover:bg-[#3367d6] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Database Backup & Export"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Backup</span>
          </button>
        )}

        {/* Admin Settings Quick Link */}
        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm active:scale-95 cursor-pointer"
            title="Master Administration & Numbering Config"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Admin</span>
          </button>
        )}

        {/* Operator Badge & Switcher */}
        <div className="flex items-center bg-[#2b6cb0]/70 border border-[#4299e1]/40 rounded-lg p-1 pl-2.5 gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              {username}
            </span>
          </div>

          {onSwitchUser && (
            <button
              onClick={onSwitchUser}
              className="text-blue-100 hover:text-white hover:bg-white/10 px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
              title="Switch Active Operator Desk"
            >
              <UserCheck className="w-3 h-3 text-emerald-300" />
              <span className="hidden md:inline">Switch</span>
            </button>
          )}

          {onOpenPasswordModal && (
            <button
              id="header-password-btn"
              onClick={onOpenPasswordModal}
              className="text-slate-200 hover:text-white hover:bg-white/10 p-1.5 rounded transition cursor-pointer"
              title="Change Password"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>
          )}

          {onLogout && (
            <button
              id="header-logout-btn"
              onClick={onLogout}
              className="flex items-center gap-1 bg-red-600/80 hover:bg-red-600 text-white px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer shadow-xs active:scale-95"
              title="Switch Operator / Logout"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
