import React from 'react';
import { Mic, Globe, Cloud, KeyRound, ShieldCheck, Home, ClipboardList } from 'lucide-react';

interface HeaderProps {
  currentUser?: { username: string; perms: string[] } | null;
  brandLogoBase64?: string;
  onNavigateHome?: () => void;
  onOpenPasswordModal?: () => void;
  onOpenVoiceModal?: () => void;
  onOpenDriveModal?: () => void;
  onOpenSearchModal?: () => void;
  onOpenRequisitionModal?: () => void;
  arrivedCount?: number;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  brandLogoBase64,
  onNavigateHome,
  onOpenPasswordModal,
  onOpenVoiceModal,
  onOpenDriveModal,
  onOpenSearchModal,
  onOpenRequisitionModal,
  arrivedCount = 0,
  onOpenAdmin,
  onLogout
}) => {
  return (
    <header className="bg-[#1a365d] text-white px-5 py-3.5 rounded-xl mb-4.5 shadow-md flex items-center justify-between flex-wrap gap-3">
      {/* Brand Identity */}
      <div
        onClick={onNavigateHome}
        className="flex items-center gap-3.5 cursor-pointer group"
      >
        <div className="w-12 h-12 rounded-lg bg-white p-1 flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0 group-hover:scale-105 transition">
          {brandLogoBase64 ? (
            <img src={brandLogoBase64} alt="Wünderkraf Logo" className="w-full h-full object-contain" />
          ) : (
            <div className="flex items-center justify-center font-extrabold text-[#1a365d] text-xl tracking-wider">
              WK
            </div>
          )}
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
            Master Factory ERP & AI Production Intelligence Suite
          </p>
        </div>
      </div>

      {/* Action Hub & Control Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {onNavigateHome && (
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-1 bg-[#2b6cb0] hover:bg-[#2c5282] text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm active:scale-95 cursor-pointer"
            title="Main Navigation Hub"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hub</span>
          </button>
        )}

        {/* Material Requisition Fast Trigger */}
        {onOpenRequisitionModal && (
          <button
            id="header-requisition-btn"
            onClick={onOpenRequisitionModal}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer relative"
            title="Material Requisition & Purchase Tracking (मटेरियल इंडेन्ट)"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">इंडेन्ट (Requisition)</span>
            {arrivedCount > 0 && (
              <span className="bg-amber-400 text-slate-900 font-extrabold text-[10px] px-1.5 py-0.2 rounded-full animate-bounce">
                {arrivedCount}
              </span>
            )}
          </button>
        )}

        {/* AI Voice Floor Dictation */}
        {onOpenVoiceModal && (
          <button
            id="header-voice-mic-btn"
            onClick={onOpenVoiceModal}
            className="flex items-center gap-1.5 bg-[#805ad5] hover:bg-[#6b46c1] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Voice Transcribe with Gemini AI Transcribe"
          >
            <Mic className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden md:inline">Voice AI</span>
          </button>
        )}

        {/* AI Grounded Search Intelligence */}
        {onOpenSearchModal && (
          <button
            id="header-search-grounding-btn"
            onClick={onOpenSearchModal}
            className="flex items-center gap-1.5 bg-[#319795] hover:bg-[#285e61] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Live Market & Standards Intelligence (Gemini + Google Search)"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Paper AI</span>
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

        {/* Operator Badge */}
        {currentUser && (
          <div className="flex items-center bg-[#2b6cb0]/70 border border-[#4299e1]/40 rounded-lg p-1 pl-2.5 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                {currentUser.username}
              </span>
            </div>

            {onOpenPasswordModal && (
              <button
                id="header-password-btn"
                onClick={onOpenPasswordModal}
                className="text-slate-200 hover:text-white hover:bg-white/10 p-1.5 rounded transition cursor-pointer"
                title="Change Workstation Password"
              >
                <KeyRound className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
