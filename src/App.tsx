import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { FactoryState, CurrentView, ProductType } from './types';
import { INITIAL_STATE, LOCAL_STORAGE_KEY, DEFAULT_USERS } from './lib/constants';
import { initializeFactoryState, persistFactoryState, forceSyncWithCentral, subscribeToSyncEvents } from './lib/storage';

// Header & Navigation Hub
import { Header } from './components/Header';
import { NavigationHub } from './components/NavigationHub';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';

// Department & Module Views
import { MasterExecutiveDashboard } from './components/views/MasterExecutiveDashboard';
import { MarketingView } from './components/views/MarketingView';
import { DispatchView } from './components/views/DispatchView';
import { SlittingView } from './components/views/SlittingView';
import { CuttingView } from './components/views/CuttingView';
import { FormingView } from './components/views/FormingView';
import { QCView } from './components/views/QCView';
import { PackingView } from './components/views/PackingView';
import { StockMatrixView } from './components/views/StockMatrixView';
import { CustomerOrdersView } from './components/views/CustomerOrdersView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { ScrapManagementView } from './components/views/ScrapManagementView';
import { UniversalSearchView } from './components/views/UniversalSearchView';
import { MaintenanceAuditView } from './components/views/MaintenanceAuditView';
import { AdminSettingsView } from './components/views/AdminSettingsView';
import { MaintenanceView } from './components/views/MaintenanceView';
import { PurchaseView } from './components/views/PurchaseView';
import { PlanningDeskView } from './components/views/PlanningDeskView';
import { ExecutiveManpowerView } from './components/views/ExecutiveManpowerView';

// Modals
import { VoiceTranscriberModal } from './components/VoiceTranscriberModal';
import { SearchGroundingModal } from './components/SearchGroundingModal';
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { PasswordModal } from './components/PasswordModal';
import { SelfPasswordModal } from './components/SelfPasswordModal';
import { HoldModal } from './components/HoldModal';
import { ShiftHandoverHistoryModal } from './components/ShiftHandoverHistoryModal';
import { MachineReadyNotificationModal } from './components/MachineReadyNotificationModal';
import { ChallanModal } from './components/ChallanModal';
import { OrderSpecModal } from './components/OrderSpecModal';
import { StockDetailModal } from './components/StockDetailModal';
import { StationDetailModal } from './components/StationDetailModal';
import { BatchReportModal } from './components/BatchReportModal';
import { MaterialRequisitionModal } from './components/MaterialRequisitionModal';
import { OpeningStockModal } from './components/OpeningStockModal';
import { PlantManpowerModal } from './components/PlantManpowerModal';
import {
  generateShiftChangeoverReportText,
  triggerWhatsAppShiftNotification
} from './lib/whatsappReports';

const LEGACY_DEFAULT_USER_KEYS = ['kavita', 'marketing', 'disp_user', 'slit_user', 'cut_user', 'form_user', 'qc_user', 'pack_user', 'maint_user', 'purchase'];

function sanitizeUsersState(users?: Record<string, any>) {
  const clean = { ...(users || DEFAULT_USERS) };
  LEGACY_DEFAULT_USER_KEYS.forEach((k) => delete clean[k]);
  if (!clean.admin) {
    clean.admin = { pass: '1811', perms: ['*'], name: 'Master Administrator', role: 'Administrator' };
  } else {
    clean.admin.perms = ['*'];
  }
  return clean;
}

export const App: React.FC = () => {
  // User Authentication / Current Operator Desk — Locked without valid login
  const [currentUser, setCurrentUser] = useState<{ username: string; perms: string[] } | null>(() => {
    try {
      const saved = sessionStorage.getItem('wunderkraf_active_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.username) {
          const u = parsed.username.toLowerCase();
          const defaultUser = DEFAULT_USERS[u];
          if (u === 'admin') {
            return { username: 'admin', perms: ['*'] };
          }
          if (defaultUser) {
            return { username: u, perms: defaultUser.perms || parsed.perms || [] };
          }
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Could not read user from sessionStorage', e);
    }
    return null;
  });

  const [isSelfPasswordOpen, setIsSelfPasswordOpen] = useState(false);

  // Load State from LocalStorage or Fallback to Initial Prototype State
  const [state, setState] = useState<FactoryState>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.users = sanitizeUsersState(parsed.users);
        parsed.glueBrands = ['Pidilite FS35'];
        return parsed;
      }
    } catch (e) {
      console.warn('Could not read state from localStorage', e);
    }
    return {
      ...INITIAL_STATE,
      glueBrands: ['Pidilite FS35'],
      users: sanitizeUsersState(INITIAL_STATE.users)
    };
  });

  // Asynchronous IndexedDB + Central Sync Bridge hydration on app start
  useEffect(() => {
    let isMounted = true;
    initializeFactoryState()
      .then((loadedState) => {
        if (isMounted && loadedState) {
          loadedState.users = sanitizeUsersState(loadedState.users);
          setState(loadedState);
        }
      })
      .catch((err) => {
        console.warn('[Storage] Could not initialize state:', err);
      });

    // Listen for live updates from other devices / tabs via Central Sync Bridge bus
    const unsubscribe = subscribeToSyncEvents((syncedState) => {
      if (isMounted && syncedState && Array.isArray(syncedState.jobs)) {
        setState((prev) => {
          syncedState.users = sanitizeUsersState(syncedState.users);
          return syncedState;
        });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Keep active user's permissions synchronized with latest state.users
  useEffect(() => {
    if (currentUser?.username) {
      const cleanUser = currentUser.username.toLowerCase();
      const allUsers = state.users || DEFAULT_USERS;
      const userObj = allUsers[cleanUser];
      if (userObj) {
        const isMaster =
          cleanUser === 'admin' ||
          userObj.perms?.includes('*') ||
          userObj.perms?.includes('Admin') ||
          userObj.role?.toLowerCase() === 'administrator' ||
          userObj.role?.toLowerCase() === 'admin';
        const freshPerms = isMaster ? ['*'] : (userObj.perms || []);
        const currentPermsStr = JSON.stringify(currentUser.perms || []);
        const freshPermsStr = JSON.stringify(freshPerms);
        if (currentPermsStr !== freshPermsStr) {
          const updated = { username: cleanUser, perms: freshPerms };
          setCurrentUser(updated);
          try {
            sessionStorage.setItem('wunderkraf_active_user', JSON.stringify(updated));
          } catch (e) {
            console.warn(e);
          }
        }
      }
    }
  }, [state.users]);

  // Current active view
  const [currentView, setCurrentView] = useState<CurrentView>('HUB');

  // Modals state
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voiceTargetCallback, setVoiceTargetCallback] = useState<((text: string) => void) | null>(null);

  const [isSearchGroundingOpen, setIsSearchGroundingOpen] = useState(false);
  const [isDriveOpen, setIsDriveOpen] = useState(false);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingProtectedView, setPendingProtectedView] = useState<CurrentView | null>(null);

  const [holdModalStation, setHoldModalStation] = useState<string | null>(null);
  const [activeChallanData, setActiveChallanData] = useState<any | null>(null);
  const [orderSpecId, setOrderSpecId] = useState<string | null>(null);

  const [stockDetailParams, setStockDetailParams] = useState<{
    title: string;
    product: ProductType;
    stageKey: string;
  } | null>(null);

  const [stationDetailMachine, setStationDetailMachine] = useState<string | null>(null);
  const [batchReportId, setBatchReportId] = useState<string | null>(null);
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // Planning & Shift Handover History states
  const [preSelectedPlanId, setPreSelectedPlanId] = useState<string | undefined>(undefined);
  const [isHandoverHistoryOpen, setIsHandoverHistoryOpen] = useState(false);
  const [isRefreshingState, setIsRefreshingState] = useState(false);
  const [refreshToast, setRefreshToast] = useState<string | null>(null);

  // Material Requisition Modal state
  const [isRequisitionModalOpen, setIsRequisitionModalOpen] = useState(false);
  const [requisitionDefaultDept, setRequisitionDefaultDept] = useState<string | undefined>(undefined);

  // Plant Manpower & Helper Allocation Modal state
  const [isManpowerModalOpen, setIsManpowerModalOpen] = useState(false);

  // Arrived goods notifications (requester alert: material store me aa gaya hai)
  const arrivedRequisitions = (state.materialRequisitions || []).filter(
    (r) => r.status === 'RECEIVED' && !r.acknowledgedByRequester
  );
  const arrivedCount = arrivedRequisitions.length;

  // Shift Changeover Auto Notification State
  const [shiftChangeoverAlert, setShiftChangeoverAlert] = useState<{
    shift: 'DAY' | 'NIGHT';
    text: string;
    triggerTime: string;
  } | null>(null);

  // Background Shift Changeover Auto Check Timer (every 30 seconds)
  useEffect(() => {
    const checkShiftTimer = () => {
      const waConfig = state.whatsappConfig;
      if (!waConfig) return;

      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMins = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMins}`;
      const todayStr = now.toISOString().split('T')[0];

      // Day Shift Check
      const dayTarget = waConfig.dayShiftReportTime || '20:00';
      const isDayAutoEnabled = waConfig.autoSendShiftReportDay ?? waConfig.autoSend ?? true;
      if (isDayAutoEnabled && currentTimeStr === dayTarget && waConfig.lastSentDayDate !== todayStr) {
        const reportText = generateShiftChangeoverReportText(state, 'DAY');
        setShiftChangeoverAlert({
          shift: 'DAY',
          text: reportText,
          triggerTime: currentTimeStr
        });

        // Trigger webhook if configured
        if (waConfig.webhookUrl) {
          const handoverContacts = (state.coordinationMatrix || [])
            .filter((item) => item.isActive && item.alertCategories.productionHandover);
          if (handoverContacts.length > 0) {
            handoverContacts.forEach((contact) => {
              triggerWhatsAppShiftNotification(contact.phone, reportText, waConfig.webhookUrl);
            });
          } else {
            triggerWhatsAppShiftNotification(waConfig.phone, reportText, waConfig.webhookUrl);
          }
        }

        // Update lastSentDayDate
        const updatedConfig = {
          ...waConfig,
          lastSentDayDate: todayStr
        };
        handleSaveState({ ...state, whatsappConfig: updatedConfig });
      }

      // Night Shift Check
      const nightTarget = waConfig.nightShiftReportTime || '08:00';
      const isNightAutoEnabled = waConfig.autoSendShiftReportNight ?? waConfig.autoSend ?? true;
      if (isNightAutoEnabled && currentTimeStr === nightTarget && waConfig.lastSentNightDate !== todayStr) {
        const reportText = generateShiftChangeoverReportText(state, 'NIGHT');
        setShiftChangeoverAlert({
          shift: 'NIGHT',
          text: reportText,
          triggerTime: currentTimeStr
        });

        // Trigger webhook if configured
        if (waConfig.webhookUrl) {
          const handoverContacts = (state.coordinationMatrix || [])
            .filter((item) => item.isActive && item.alertCategories.productionHandover);
          if (handoverContacts.length > 0) {
            handoverContacts.forEach((contact) => {
              triggerWhatsAppShiftNotification(contact.phone, reportText, waConfig.webhookUrl);
            });
          } else {
            triggerWhatsAppShiftNotification(waConfig.phone, reportText, waConfig.webhookUrl);
          }
        }

        // Update lastSentNightDate
        const updatedConfig = {
          ...waConfig,
          lastSentNightDate: todayStr
        };
        handleSaveState({ ...state, whatsappConfig: updatedConfig });
      }
    };

    const intervalId = setInterval(checkShiftTimer, 30000);
    return () => clearInterval(intervalId);
  }, [state]);

  // Persistence effect: Writes to high-capacity IndexedDB and mirrors safely with auto-pruning to localStorage
  const handleSaveState = async (nextState: FactoryState) => {
    setState(nextState);
    const result = await persistFactoryState(nextState, state);
    if (result.mergedState) {
      setState(result.mergedState);
    }
  };

  // Re-hydrate and synchronize state across all devices via Central Sync Bridge & IndexedDB
  const handleRefreshState = async () => {
    if (!confirm("⚠️ WARNING: This will sync with the Central Sync Bridge. If the server is empty, it may overwrite local data. Are you sure?")) return;
    try {
      const syncResult = await forceSyncWithCentral(state);
      if (syncResult && syncResult.syncedState) {
        if (syncResult.syncedState.users?.admin && !syncResult.syncedState.users.admin.perms?.includes('*')) {
          syncResult.syncedState.users.admin.perms = ['*'];
        }
        setState(syncResult.syncedState);
        setRefreshToast(syncResult.message);
        setTimeout(() => setRefreshToast(null), 3500);
      }
    } catch (err) {
      console.warn('[Storage] Refresh error from Central Bridge:', err);
      // Fallback local hydration
      const localState = await initializeFactoryState();
      if (localState) {
        setState(localState);
      }
    } finally {
      setTimeout(() => {
        setIsRefreshingState(false);
      }, 600);
    }
  };

  // Login handler
  const handleLogin = (username: string, pass: string): boolean => {
    const allUsers = state.users || DEFAULT_USERS;
    const cleanUser = username.trim().toLowerCase();
    const userObj = allUsers[cleanUser];

    if (userObj && userObj.pass === pass) {
      const isMaster =
        cleanUser === 'admin' ||
        userObj.perms?.includes('*') ||
        userObj.perms?.includes('Admin') ||
        userObj.role?.toLowerCase() === 'administrator' ||
        userObj.role?.toLowerCase() === 'admin';
      const active = {
        username: cleanUser,
        perms: isMaster ? ['*'] : (userObj.perms || [])
      };
      setCurrentUser(active);
      try {
        sessionStorage.setItem('wunderkraf_active_user', JSON.stringify(active));
      } catch (e) {
        console.warn('Failed to save to sessionStorage', e);
      }
      setCurrentView('HUB');
      return true;
    }
    return false;
  };

  // Logout handler
  const handleLogout = () => {
    try {
      sessionStorage.removeItem('wunderkraf_active_user');
    } catch (e) {
      console.warn(e);
    }
    setCurrentUser(null);
    setCurrentView('HUB');
    setIsVoiceOpen(false);
    setIsSearchGroundingOpen(false);
    setIsDriveOpen(false);
    setIsPasswordModalOpen(false);
    setIsSelfPasswordOpen(false);
  };

  // View Navigation with strict Permission Verification and PIN Gate for Admin
  const handleNavigate = (view: CurrentView) => {
    if (!currentUser) return;
    if (view === 'HUB') {
      setCurrentView('HUB');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const userRole = (state.users && state.users[currentUser.username.toLowerCase()]?.role) || '';
    const isMasterAdmin =
      currentUser.perms.includes('*') ||
      currentUser.perms.includes('Admin') ||
      currentUser.username.toLowerCase() === 'admin' ||
      userRole.toLowerCase() === 'administrator' ||
      userRole.toLowerCase() === 'admin';

    // Required permission mapping per desk
    const viewPermMap: Partial<Record<CurrentView, string>> = {
      DASHBOARD: 'Dashboard',
      MARKETING: 'Marketing',
      DISPATCH: 'Dispatch',
      PLANNING: 'Planning',
      SLITTING: 'Slitting',
      CUTTING: 'Cutting',
      FORMING: 'Forming',
      QC: 'QC',
      PACKING: 'Packing',
      STOCK: 'Stock',
      ORDERS: 'Orders',
      ANALYTICS: 'Analytics',
      SCRAP: 'Scrap',
      SEARCH: 'Search',
      AUDIT: 'Audit',
      MAINTENANCE: 'Maintenance',
      PURCHASE: 'Purchase',
      MANPOWER: 'Manpower',
      OPENING_STOCK: 'Admin',
      ADMIN: 'Admin'
    };

    const reqPerm = viewPermMap[view];

    if (!isMasterAdmin && reqPerm) {
      const hasDirectPerm = currentUser.perms.some(
        (p) =>
          p === '*' ||
          p.toLowerCase() === reqPerm.toLowerCase() ||
          p.toLowerCase() === view.toLowerCase()
      );

      if (!hasDirectPerm) {
        alert(
          `⛔ Access Restricted: Operator [${currentUser.username}] is not assigned the "${reqPerm}" desk permission.\n\nPlease contact Admin to grant rights in Admin Settings.`
        );
        return;
      }
    }

    if (view === 'ADMIN') {
      setPendingProtectedView('ADMIN');
      setIsPasswordModalOpen(true);
      return;
    }

    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePasswordSuccess = () => {
    if (pendingProtectedView) {
      setCurrentView(pendingProtectedView);
      setPendingProtectedView(null);
    }
  };

  // Voice dictation opener for arbitrary inputs - requires logged in user
  const handleOpenVoiceForTarget = (callback: (text: string) => void) => {
    if (!currentUser) return;
    setVoiceTargetCallback(() => callback);
    setIsVoiceOpen(true);
  };

  const handleVoiceTranscribed = (text: string) => {
    if (voiceTargetCallback) {
      voiceTargetCallback(text);
      setVoiceTargetCallback(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-blue-200">
      {/* Universal Top Header */}
      <Header
        currentUser={currentUser}
        brandLogoBase64={state.brandLogoBase64}
        onNavigateHome={() => {
          if (!currentUser) return;
          setCurrentView('HUB');
        }}
        onNavigateAnalytics={currentUser ? () => handleNavigate('ANALYTICS') : undefined}
        onOpenDriveModal={currentUser ? () => setIsDriveOpen(true) : undefined}
        onOpenRequisitionModal={
          currentUser
            ? () => {
                setRequisitionDefaultDept(undefined);
                setIsRequisitionModalOpen(true);
              }
            : undefined
        }
        onOpenPasswordModal={currentUser ? () => setIsSelfPasswordOpen(true) : undefined}
        onOpenManpowerModal={currentUser ? () => setIsManpowerModalOpen(true) : undefined}
        onLogout={currentUser ? handleLogout : undefined}
        onSwitchUser={currentUser ? handleLogout : undefined}
        arrivedCount={currentUser ? arrivedCount : 0}
        onOpenAdmin={currentUser ? () => handleNavigate('ADMIN') : undefined}
        onRefreshState={currentUser ? handleRefreshState : undefined}
        isRefreshing={isRefreshingState}
        onOpenHandoverHistory={currentUser ? () => setIsHandoverHistoryOpen(true) : undefined}
      />

      {/* Global Refresh Notification Toast */}
      {refreshToast && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md transition animate-fadeIn">
          <span>✓ {refreshToast}</span>
          <button
            onClick={() => setRefreshToast(null)}
            className="text-white/80 hover:text-white text-xs underline font-normal"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Shift Changeover WhatsApp Auto Notification Alert Banner */}
      {shiftChangeoverAlert && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-[#1a365d] text-white px-4 py-3 shadow-lg flex items-center justify-between flex-wrap gap-3 text-xs border-b border-indigo-400 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {shiftChangeoverAlert.shift === 'DAY' ? '☀️' : '🌙'}
            </span>
            <div>
              <div className="font-extrabold flex items-center gap-2">
                <span>{shiftChangeoverAlert.shift} Shift Changeover Time Reached ({shiftChangeoverAlert.triggerTime})!</span>
                <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded">
                  All Machine & Operator Reports Ready
                </span>
              </div>
              <p className="text-[11px] text-indigo-200 m-0">
                Daily machine breakdown, operator names, crates output and WIP stock compiled for WhatsApp dispatch.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const handoverContacts = (state.coordinationMatrix || [])
                  .filter((item) => item.isActive && item.alertCategories.productionHandover);
                const webhookUrl = state.whatsappConfig?.webhookUrl;
                
                if (handoverContacts.length > 0) {
                  handoverContacts.forEach((contact) => {
                    triggerWhatsAppShiftNotification(
                      contact.phone,
                      shiftChangeoverAlert.text,
                      webhookUrl
                    );
                  });
                  alert(`📢 Shift changeover dispatch initiated for ${handoverContacts.length} subscribed contacts in the matrix: ${handoverContacts.map(c => c.contactName).join(', ')}`);
                } else {
                  triggerWhatsAppShiftNotification(
                    state.whatsappConfig?.phone || '',
                    shiftChangeoverAlert.text,
                    webhookUrl
                  );
                  alert('📢 Shift changeover dispatch sent to primary configured contact number.');
                }
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3.5 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>📱 Send Shift WhatsApp Now</span>
            </button>
            <button
              onClick={() => setShiftChangeoverAlert(null)}
              className="bg-indigo-950/80 hover:bg-indigo-950 text-indigo-200 px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
            >
              ✕ Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Real-time Material Arrival Announcement Strip (Material Received at Factory Store) - Only for logged-in operators */}
      {currentUser && arrivedCount > 0 && (
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white px-4 py-2.5 shadow-md flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-base animate-bounce">📦</span>
            <span>
              {arrivedCount} Material{arrivedCount > 1 ? 's' : ''} Received at Factory Store!
            </span>
            <span className="bg-emerald-900/60 text-emerald-100 px-2 py-0.5 rounded font-normal hidden sm:inline">
              {arrivedRequisitions.map((r) => `${r.itemName} (${r.department})`).join(', ')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRequisitionDefaultDept(undefined);
                setIsRequisitionModalOpen(true);
              }}
              className="bg-white text-emerald-800 font-extrabold px-3 py-1 rounded-md shadow-xs hover:bg-emerald-50 transition cursor-pointer"
            >
              Track / Confirm Receipt
            </button>
            <button
              onClick={() => setCurrentView('PURCHASE')}
              className="bg-emerald-900 hover:bg-emerald-950 text-white font-bold px-2.5 py-1 rounded-md transition cursor-pointer"
            >
              Purchase Desk
            </button>
          </div>
        </div>
      )}

      {/* Main Factory View Canvas */}
      {!currentUser ? (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
          <LoginView
            users={state.users || DEFAULT_USERS}
            brandLogoBase64={state.brandLogoBase64}
            onLogin={handleLogin}
          />
        </main>
      ) : (
        <div className="flex-1 flex w-full relative min-h-0">
          <Sidebar
            currentView={currentView}
            onSelectView={handleNavigate}
            currentUser={currentUser}
            state={state}
          />
          <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-5 lg:p-6">
            <div className="max-w-7xl w-full mx-auto">
              {currentView === 'HUB' && (
                <NavigationHub
                  state={state}
                  currentUser={currentUser}
                  onSelectView={handleNavigate}
                  onOpenRequisitionModal={() => {
                    setRequisitionDefaultDept(undefined);
                    setIsRequisitionModalOpen(true);
                  }}
                  onOpenManpowerModal={() => setIsManpowerModalOpen(true)}
                  onOpenAdmin={() => handleNavigate('ADMIN')}
                />
              )}

        {currentView === 'DASHBOARD' && (
          <MasterExecutiveDashboard
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onOpenStationModal={(m) => setStationDetailMachine(m)}
            onNavigateAnalytics={() => handleNavigate('ANALYTICS')}
            onNavigateToTraceability={(q) => {
              setAuditSearchQuery(q);
              setCurrentView('AUDIT');
            }}
            onSaveState={handleSaveState}
          />
        )}

        {currentView === 'MARKETING' && (
          <MarketingView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenVoiceModalForTarget={handleOpenVoiceForTarget}
          />
        )}

        {currentView === 'DISPATCH' && (
          <DispatchView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenChallanModal={(data) => setActiveChallanData(data)}
          />
        )}

        {currentView === 'PLANNING' && (
          <PlanningDeskView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onSelectPlanForSlitting={(plan) => {
              setPreSelectedPlanId(plan.id);
              setCurrentView('SLITTING');
            }}
          />
        )}

        {currentView === 'SLITTING' && (
          <SlittingView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenHoldModal={(m) => setHoldModalStation(m)}
            onOpenVoiceModalForTarget={handleOpenVoiceForTarget}
            preSelectedPlanId={preSelectedPlanId}
            onNavigateToTraceability={(q) => {
              setAuditSearchQuery(q);
              setCurrentView('AUDIT');
            }}
          />
        )}

        {currentView === 'CUTTING' && (
          <CuttingView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenHoldModal={(m) => setHoldModalStation(m)}
            onNavigateToTraceability={(q) => {
              setAuditSearchQuery(q);
              setCurrentView('AUDIT');
            }}
          />
        )}

        {currentView === 'FORMING' && (
          <FormingView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenHoldModal={(m) => setHoldModalStation(m)}
            onNavigateToTraceability={(q) => {
              setAuditSearchQuery(q);
              setCurrentView('AUDIT');
            }}
          />
        )}

        {currentView === 'QC' && (
          <QCView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenHoldModal={(m) => setHoldModalStation(m)}
            onNavigateToTraceability={(q) => {
              setAuditSearchQuery(q);
              setCurrentView('AUDIT');
            }}
          />
        )}

        {currentView === 'PACKING' && (
          <PackingView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenHoldModal={(m) => setHoldModalStation(m)}
            onOpenOrderSpecModal={(ordId) => setOrderSpecId(ordId)}
          />
        )}

        {currentView === 'STOCK' && (
          <StockMatrixView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onOpenStockDetailModal={(title, product, stageKey) =>
              setStockDetailParams({ title, product, stageKey })
            }
            onSaveState={handleSaveState}
          />
        )}

        {currentView === 'ORDERS' && (
          <CustomerOrdersView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onOpenOrderSpecModal={(ordId) => setOrderSpecId(ordId)}
          />
        )}

        {currentView === 'ANALYTICS' && (
          <AnalyticsView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
          />
        )}

        {currentView === 'SCRAP' && (
          <ScrapManagementView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
          />
        )}

        {currentView === 'SEARCH' && (
          <UniversalSearchView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onOpenOrderSpecModal={(ordId) => setOrderSpecId(ordId)}
            onOpenBatchReportModal={(id) => setBatchReportId(id)}
            onNavigateToTraceability={(q) => {
              setAuditSearchQuery(q);
              setCurrentView('AUDIT');
            }}
          />
        )}

        {currentView === 'AUDIT' && (
          <MaintenanceAuditView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            initialSearchQuery={auditSearchQuery}
          />
        )}

        {currentView === 'OPENING_STOCK' && (
          <div className="space-y-4 max-w-4xl mx-auto p-4">
            <button
              onClick={() => setCurrentView('HUB')}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Main Menu</span>
            </button>
            <OpeningStockModal
              state={state}
              onSaveState={handleSaveState}
              isEmbedded={true}
              isOpen={true}
            />
          </div>
        )}

        {currentView === 'ADMIN' && (
          <AdminSettingsView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            currentUser={currentUser}
          />
        )}

        {currentView === 'MAINTENANCE' && (
          <MaintenanceView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenRequisitionModal={(dept) => {
              setRequisitionDefaultDept(dept || 'Maintenance');
              setIsRequisitionModalOpen(true);
            }}
          />
        )}

        {currentView === 'PURCHASE' && (
          <PurchaseView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenRequisitionModal={(dept) => {
              setRequisitionDefaultDept(dept);
              setIsRequisitionModalOpen(true);
            }}
          />
        )}

        {currentView === 'MANPOWER' && (
          <ExecutiveManpowerView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onNavigateToView={(view) => setCurrentView(view)}
          />
        )}
            </div>
          </main>
        </div>
      )}

      {/* Universal Floating Modals - Locked unless user is logged in */}
      {currentUser && (
        <>
          {/* Shift Handover History Dossier Modal */}
          {isHandoverHistoryOpen && (
            <ShiftHandoverHistoryModal
              isOpen={isHandoverHistoryOpen}
              onClose={() => setIsHandoverHistoryOpen(false)}
              state={state}
              onSaveState={handleSaveState}
            />
          )}
          {/* Machine Ready Handover Notification Modal (User requested: Popup when marked OK from Maintenance side) */}
          {state.machineReadyAlerts && state.machineReadyAlerts.length > 0 && (
            <MachineReadyNotificationModal
              isOpen={Boolean(state.machineReadyAlerts.find((a) => a.active))}
              alertData={state.machineReadyAlerts.find((a) => a.active) || null}
              state={state}
              onClose={() => {
                const firstAlert = state.machineReadyAlerts?.find((a) => a.active);
                if (firstAlert) {
                  const updated = state.machineReadyAlerts?.filter((a) => a.incidentId !== firstAlert.incidentId) || [];
                  handleSaveState({ ...state, machineReadyAlerts: updated });
                }
              }}
              onSaveState={handleSaveState}
              onOpenMaintenanceDesk={() => setCurrentView('MAINTENANCE')}
            />
          )}

          {/* Gemini AI Voice Transcriber Modal */}
          <VoiceTranscriberModal
            isOpen={isVoiceOpen}
            onClose={() => {
              setIsVoiceOpen(false);
              setVoiceTargetCallback(null);
            }}
            onApplyTranscription={handleVoiceTranscribed}
          />

          {/* Gemini AI Google Search Grounding Modal */}
          <SearchGroundingModal
            isOpen={isSearchGroundingOpen}
            onClose={() => setIsSearchGroundingOpen(false)}
          />

          {/* Google Drive Real-Time Cloud Backup Modal */}
          <GoogleDriveModal
            isOpen={isDriveOpen}
            onClose={() => setIsDriveOpen(false)}
            factoryState={state}
            onRestoreState={handleSaveState}
          />

          {/* Admin Password Gatekeeper Modal */}
          <PasswordModal
            isOpen={isPasswordModalOpen}
            correctPassword={state.adminPassword || '1234'}
            onClose={() => {
              setIsPasswordModalOpen(false);
              setPendingProtectedView(null);
            }}
            onSuccess={handlePasswordSuccess}
          />

          {/* Self Password Change Modal */}
          <SelfPasswordModal
            isOpen={isSelfPasswordOpen}
            currentUser={currentUser}
            onClose={() => setIsSelfPasswordOpen(false)}
            onSavePassword={(newPass) => {
              if (!currentUser) return;
              const allUsers = { ...(state.users || DEFAULT_USERS) };
              if (allUsers[currentUser.username]) {
                allUsers[currentUser.username] = {
                  ...allUsers[currentUser.username],
                  pass: newPass
                };
                handleSaveState({ ...state, users: allUsers });
              }
            }}
          />

          {/* Station Pause & Maintenance Reason Modal */}
          {holdModalStation && (
            <HoldModal
              isOpen={Boolean(holdModalStation)}
              stationName={holdModalStation}
              state={state}
              onClose={() => setHoldModalStation(null)}
              onSaveState={handleSaveState}
            />
          )}

          {/* Printable Dispatch Challan & Gatepass Modal */}
          {activeChallanData && (
            <ChallanModal
              isOpen={Boolean(activeChallanData)}
              data={activeChallanData}
              onClose={() => setActiveChallanData(null)}
            />
          )}

          {/* Customer Packing Order Full Spec Sheet Modal */}
          {orderSpecId && (
            <OrderSpecModal
              isOpen={Boolean(orderSpecId)}
              order={state.packJobs.find(p => p.id === orderSpecId) || null}
              onClose={() => setOrderSpecId(null)}
            />
          )}

          {/* Stock Matrix Job Drilldown Modal */}
          {stockDetailParams && (
            <StockDetailModal
              isOpen={Boolean(stockDetailParams)}
              title={stockDetailParams.title}
              product={stockDetailParams.product}
              stage={stockDetailParams.stageKey}
              jobs={state.jobs}
              packJobs={state.packJobs}
              onOpenBatchReport={(jobId) => {
                setStockDetailParams(null);
                setBatchReportId(jobId);
              }}
              onClose={() => setStockDetailParams(null)}
            />
          )}

          {/* Station Live History & Activity Audit Modal */}
          {stationDetailMachine && (
            <StationDetailModal
              isOpen={Boolean(stationDetailMachine)}
              machineName={stationDetailMachine}
              jobs={state.jobs}
              packJobs={state.packJobs}
              onClose={() => setStationDetailMachine(null)}
            />
          )}

          {/* Batch Comprehensive Production Report & Certificate Modal */}
          {batchReportId && (
            <BatchReportModal
              isOpen={Boolean(batchReportId)}
              initialSelectionId={batchReportId}
              state={state}
              onClose={() => setBatchReportId(null)}
            />
          )}

          {/* Material Requisition & Indent Modal (Universal for all departments) */}
          <MaterialRequisitionModal
            isOpen={isRequisitionModalOpen}
            state={state}
            defaultDepartment={requisitionDefaultDept}
            onClose={() => {
              setIsRequisitionModalOpen(false);
              setRequisitionDefaultDept(undefined);
            }}
            onSaveState={handleSaveState}
            onOpenPurchaseDesk={() => {
              setIsRequisitionModalOpen(false);
              setCurrentView('PURCHASE');
            }}
          />

          {/* Plant Floor Live Manpower & Helper Allocation Modal */}
          <PlantManpowerModal
            isOpen={isManpowerModalOpen}
            onClose={() => setIsManpowerModalOpen(false)}
            state={state}
            onSaveState={handleSaveState}
          />
        </>
      )}
    </div>
  );
};

export default App;
