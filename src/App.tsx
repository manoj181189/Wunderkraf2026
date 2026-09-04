import React, { useState, useEffect } from 'react';
import { FactoryState, CurrentView, ProductType } from './types';
import { INITIAL_STATE, LOCAL_STORAGE_KEY } from './lib/constants';

// Header & Navigation Hub
import { Header } from './components/Header';
import { NavigationHub } from './components/NavigationHub';

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
import { UniversalSearchView } from './components/views/UniversalSearchView';
import { MaintenanceAuditView } from './components/views/MaintenanceAuditView';
import { AdminSettingsView } from './components/views/AdminSettingsView';
import { MaintenanceView } from './components/views/MaintenanceView';
import { PurchaseView } from './components/views/PurchaseView';

// Modals
import { VoiceTranscriberModal } from './components/VoiceTranscriberModal';
import { SearchGroundingModal } from './components/SearchGroundingModal';
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { PasswordModal } from './components/PasswordModal';
import { HoldModal } from './components/HoldModal';
import { MachineReadyNotificationModal } from './components/MachineReadyNotificationModal';
import { ChallanModal } from './components/ChallanModal';
import { OrderSpecModal } from './components/OrderSpecModal';
import { StockDetailModal } from './components/StockDetailModal';
import { StationDetailModal } from './components/StationDetailModal';
import { BatchReportModal } from './components/BatchReportModal';
import { MaterialRequisitionModal } from './components/MaterialRequisitionModal';

// ऑपरेटर लिस्ट और उनके अधिकार (Rights)
const OPERATORS_LIST = [
  { username: 'admin', role: 'Super Admin (All Access)', perms: ['Admin', 'Marketing', 'Dispatch', 'Slitting', 'Cutting', 'Forming', 'QC', 'Packing', 'Maintenance', 'Purchase'] },
  { username: 'slitting_op', role: 'Slitting Machine Desk', perms: ['Slitting'] },
  { username: 'cutting_op', role: 'Die-Cutting Desk', perms: ['Cutting'] },
  { username: 'forming_op', role: 'Thermo-Forming Desk', perms: ['Forming'] },
  { username: 'qc_inspector', role: 'QC & Hygiene Audit', perms: ['QC'] },
  { username: 'packing_op', role: 'Packing & Carton Tagging', perms: ['Packing'] },
  { username: 'dispatch_mgr', role: 'Dispatch & Gatepass Desk', perms: ['Dispatch'] },
  { username: 'maint_eng', role: 'Maintenance & Breakdown Desk', perms: ['Maintenance'] },
  { username: 'purchase_mgr', role: 'Purchase & Requisition Desk', perms: ['Purchase'] },
];

export const App: React.FC = () => {
  // Load State from LocalStorage or Fallback to Initial Prototype State
  const [state, setState] = useState<FactoryState>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not read state from localStorage', e);
    }
    return INITIAL_STATE;
  });

  // User Authentication State (LocalStorage से याद रखेगा ताकि रिफ्रेश पर लॉगआउट न हो)
  const [currentUser, setCurrentUser] = useState<{ username: string; perms: string[] } | null>(() => {
    try {
      const savedUser = localStorage.getItem('wunderkraf_logged_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [selectedUsername, setSelectedUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

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

  // Material Requisition Modal state
  const [isRequisitionModalOpen, setIsRequisitionModalOpen] = useState(false);
  const [requisitionDefaultDept, setRequisitionDefaultDept] = useState<string | undefined>(undefined);

  // Arrived goods notifications
  const arrivedRequisitions = (state.materialRequisitions || []).filter(
    (r) => r.status === 'RECEIVED' && !r.acknowledgedByRequester
  );
  const arrivedCount = arrivedRequisitions.length;

  // Persistence effect
  const handleSaveState = (nextState: FactoryState) => {
    setState(nextState);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextState));
    } catch (e) {
      console.error('Failed to persist factory state', e);
    }
  };

  // Login Handler
  const handleDoLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const op = OPERATORS_LIST.find((u) => u.username === selectedUsername);
    if (!op) {
      setLoginError('कृपया यूज़र / डेस्क चुनें!');
      return;
    }

    if (op.username === 'admin') {
      const correctPass = state.adminPassword || '1234';
      if (loginPassword !== correctPass) {
        setLoginError('गलत एडमिन पासवर्ड! (डिफ़ॉल्ट 1234)');
        return;
      }
    }

    const userData = { username: op.username, perms: op.perms };
    setCurrentUser(userData);
    localStorage.setItem('wunderkraf_logged_user', JSON.stringify(userData));
    setLoginError('');
    setLoginPassword('');
  };

  // Logout Handler
  const handleDoLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('wunderkraf_logged_user');
    setCurrentView('HUB');
  };

  // View Navigation with Protection
  const handleNavigate = (view: CurrentView) => {
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

  const handleOpenVoiceForTarget = (callback: (text: string) => void) => {
    setVoiceTargetCallback(() => callback);
    setIsVoiceOpen(true);
  };

  const handleVoiceTranscribed = (text: string) => {
    if (voiceTargetCallback) {
      voiceTargetCallback(text);
      setVoiceTargetCallback(null);
    }
  };

  // 1. अगर कोई यूज़र लॉगिन नहीं है तो सीधे लॉगिन स्क्रीन दिखाना
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-white">
          <div className="text-center mb-6">
            <div className="inline-block p-3 bg-slate-900 rounded-full mb-3 border border-slate-700">
              <span className="text-3xl">🏭</span>
            </div>
            <h1 className="text-2xl font-black text-amber-400 tracking-wide">WÜNDERKRAF ERP</h1>
            <p className="text-xs text-slate-400 mt-1">Shop Floor & Factory Station Access</p>
          </div>

          <form onSubmit={handleDoLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">डेस्क / ऑपरेटर चुनें (Select Desk):</label>
              <select
                value={selectedUsername}
                onChange={(e) => {
                  setSelectedUsername(e.target.value);
                  setLoginError('');
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-amber-400"
                required
              >
                <option value="">-- ऑपरेटर या डेस्क चुनें --</option>
                {OPERATORS_LIST.map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.role}
                  </option>
                ))}
              </select>
            </div>

            {selectedUsername === 'admin' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Admin Password:</label>
                <input
                  type="password"
                  placeholder="Enter admin password (Default: 1234)"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
            )}

            {loginError && <p className="text-xs text-rose-400 font-bold bg-rose-950/50 p-2.5 rounded-lg border border-rose-800">{loginError}</p>}

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-lg transition shadow-lg cursor-pointer text-sm uppercase tracking-wider"
            >
              लॉगिन करें (Access Desk)
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. जब यूज़र लॉगिन हो, तब मेन फ़ैक्ट्री ऐप लोड होगी
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-blue-200">
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        brandLogoBase64={state.brandLogoBase64}
        onNavigateHome={() => setCurrentView('HUB')}
        onOpenVoiceModal={() => {
          setVoiceTargetCallback(null);
          setIsVoiceOpen(true);
        }}
        onOpenSearchModal={() => setIsSearchGroundingOpen(true)}
        onOpenDriveModal={() => setIsDriveOpen(true)}
        onOpenRequisitionModal={() => {
          setRequisitionDefaultDept(undefined);
          setIsRequisitionModalOpen(true);
        }}
        arrivedCount={arrivedCount}
        onOpenAdmin={() => handleNavigate('ADMIN')}
      />

      {/* Logout Bar & User Details */}
      <div className="bg-slate-800 text-slate-300 px-4 py-1.5 flex items-center justify-between text-xs border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Logged Desk: <strong className="text-amber-400 font-bold uppercase">{currentUser.username}</strong></span>
          <span className="text-slate-500 hidden sm:inline">| Rights: {currentUser.perms.join(', ')}</span>
        </div>
        <button
          onClick={handleDoLogout}
          className="bg-rose-600/80 hover:bg-rose-600 text-white font-bold px-2.5 py-0.5 rounded transition cursor-pointer"
        >
          Logout (बाहर निकलें)
        </button>
      </div>

      {/* Real-time Material Arrival Announcement Strip */}
      {arrivedCount > 0 && (
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white px-4 py-2.5 shadow-md flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 font-bold">
            <span className="text-base animate-bounce">📦</span>
            <span>
              {arrivedCount} Material{arrivedCount > 1 ? 's' : ''} Received at Factory Store (माल आ गया है)!
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {currentView === 'HUB' && (
          <NavigationHub
            state={state}
            currentUser={currentUser}
            onSelectView={handleNavigate}
            onOpenVoiceModal={() => {
              setVoiceTargetCallback(null);
              setIsVoiceOpen(true);
            }}
            onOpenSearchModal={() => setIsSearchGroundingOpen(true)}
            onOpenRequisitionModal={() => {
              setRequisitionDefaultDept(undefined);
              setIsRequisitionModalOpen(true);
            }}
            onOpenAdmin={() => handleNavigate('ADMIN')}
          />
        )}

        {currentView === 'DASHBOARD' && (
          <MasterExecutiveDashboard
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onOpenStationModal={(m) => setStationDetailMachine(m)}
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

        {currentView === 'SLITTING' && (
          <SlittingView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenHoldModal={(m) => setHoldModalStation(m)}
            onOpenVoiceModalForTarget={handleOpenVoiceForTarget}
          />
        )}

        {currentView === 'CUTTING' && (
          <CuttingView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenHoldModal={(m) => setHoldModalStation(m)}
          />
        )}

        {currentView === 'FORMING' && (
          <FormingView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenHoldModal={(m) => setHoldModalStation(m)}
          />
        )}

        {currentView === 'QC' && (
          <QCView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
            onOpenHoldModal={(m) => setHoldModalStation(m)}
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

        {currentView === 'ADMIN' && (
          <AdminSettingsView
            state={state}
            onBackToHub={() => setCurrentView('HUB')}
            onSaveState={handleSaveState}
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
      </main>

      {/* Floating Modals */}
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

      <VoiceTranscriberModal
        isOpen={isVoiceOpen}
        onClose={() => {
          setIsVoiceOpen(false);
          setVoiceTargetCallback(null);
        }}
        onApplyTranscription={handleVoiceTranscribed}
      />

      <SearchGroundingModal
        isOpen={isSearchGroundingOpen}
        onClose={() => setIsSearchGroundingOpen(false)}
      />

      <GoogleDriveModal
        isOpen={isDriveOpen}
        onClose={() => setIsDriveOpen(false)}
        factoryState={state}
        onRestoreState={handleSaveState}
      />

      <PasswordModal
        isOpen={isPasswordModalOpen}
        correctPassword={state.adminPassword || '1234'}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setPendingProtectedView(null);
        }}
        onSuccess={handlePasswordSuccess}
      />

      {holdModalStation && (
        <HoldModal
          isOpen={Boolean(holdModalStation)}
          stationName={holdModalStation}
          state={state}
          onClose={() => setHoldModalStation(null)}
          onSaveState={handleSaveState}
        />
      )}

      {activeChallanData && (
        <ChallanModal
          isOpen={Boolean(activeChallanData)}
          data={activeChallanData}
          onClose={() => setActiveChallanData(null)}
        />
      )}

      {orderSpecId && (
        <OrderSpecModal
          isOpen={Boolean(orderSpecId)}
          order={state.packJobs.find(p => p.id === orderSpecId) || null}
          onClose={() => setOrderSpecId(null)}
        />
      )}

      {stockDetailParams && (
        <StockDetailModal
          isOpen={Boolean(stockDetailParams)}
          product={stockDetailParams.product}
          stage={stockDetailParams.stageKey as any}
          jobs={state.jobs}
          onClose={() => setStockDetailParams(null)}
        />
      )}

      {stationDetailMachine && (
        <StationDetailModal
          isOpen={Boolean(stationDetailMachine)}
          machineName={stationDetailMachine}
          jobs={state.jobs}
          packJobs={state.packJobs}
          onClose={() => setStationDetailMachine(null)}
        />
      )}

      {batchReportId && (
        <BatchReportModal
          isOpen={Boolean(batchReportId)}
          initialSelectionId={batchReportId}
          state={state}
          onClose={() => setBatchReportId(null)}
        />
      )}

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
    </div>
  );
};

export default App;
