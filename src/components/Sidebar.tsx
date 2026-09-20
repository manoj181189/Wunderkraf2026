import React, { useState, useEffect } from 'react';
import {
  Home,
  LayoutDashboard,
  Calendar,
  Scroll,
  Scissors,
  Cog,
  SearchCheck,
  Package,
  Layers,
  ShoppingBag,
  Briefcase,
  Truck,
  ShoppingCart,
  Wrench,
  Users,
  Trash2,
  TrendingUp,
  Search,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles
} from 'lucide-react';
import { CurrentView, FactoryState } from '../types';

interface SidebarProps {
  currentView: CurrentView;
  onSelectView: (view: CurrentView) => void;
  currentUser?: { username: string; perms: string[] } | null;
  state: FactoryState;
}

interface NavItem {
  id: CurrentView;
  title: string;
  shortTitle: string;
  icon: React.ReactNode;
  perm: string;
  category: 'core' | 'production' | 'inventory' | 'operations' | 'admin';
  badge?: string | number;
  badgeColor?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  currentUser,
  state
}) => {
  // Collapsed state stored in localStorage (default to true for compact, clean icon-rail mode)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wunderkraf_sidebar_collapsed');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Mobile drawer open state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('wunderkraf_sidebar_collapsed', String(isCollapsed));
    } catch (e) {
      console.warn('Failed to save sidebar collapsed state', e);
    }
  }, [isCollapsed]);

  // Check user permissions
  const userRole = (state.users && currentUser && state.users[currentUser.username.toLowerCase()]?.role) || '';
  const isMasterAdmin =
    !currentUser ||
    currentUser.perms.includes('*') ||
    currentUser.perms.includes('Admin') ||
    currentUser.username.toLowerCase() === 'admin' ||
    userRole.toLowerCase() === 'administrator' ||
    userRole.toLowerCase() === 'admin';

  // Real-time badge indicators
  const activeBreakdowns = (state.maintenanceIncidents || []).filter(
    (i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS'
  ).length;

  const activePlansCount = (state.productionPlans || []).filter(
    (p) => p.status === 'Scheduled' || p.status === 'In-Progress'
  ).length;

  const runningJobsCount = (state.jobs || []).filter(
    (j) => (j.runningBatches || []).some((b) => b.status === 'Running')
  ).length;

  // Real-time counts for each of the 5 production desks
  const slittingPendingCount = (state.productionPlans || []).filter(
    (p) => p.status === 'Scheduled' || p.status === 'In-Progress'
  ).length;

  const cuttingPendingCount = (state.jobs || []).filter((j) => {
    const parentJob = j.parentJobId ? (state.jobs || []).find(p => p.id === j.parentJobId) : null;
    const rollsCount = parentJob ? (parentJob.availableRolls || 0) : (j.availableRolls || 0);
    const hasRolls = rollsCount > 0;
    
    if (j.parentJobId) {
      const parentIsReady = parentJob && (parentJob.status === 'READY_FOR_CUTTING' || parentJob.status === 'CUTTING_IN_PROGRESS');
      return hasRolls && parentIsReady;
    }
    
    const hasChildren = (state.jobs || []).some(child => child.parentJobId === j.id);
    if (hasChildren) {
      return false;
    }

    const isReadyOrInProgress = j.status === 'READY_FOR_CUTTING' || j.status === 'CUTTING_IN_PROGRESS';
    return hasRolls && isReadyOrInProgress;
  }).length;

  const formingPendingCount = (state.jobs || []).filter(
    (j) => (j.availableCuttingCrates || 0) > 0
  ).length;

  const qcPendingCount = (state.jobs || []).filter(
    (j) => (j.availableFormingCrates || 0) > 0
  ).length;

  const packingPendingCount = (state.jobs || []).filter(
    (j) => (j.availableQcCrates || 0) > 0
  ).length;

  // Navigation Items matching the full factory ecosystem
  const allNavItems: NavItem[] = [
    {
      id: 'HUB',
      title: 'Home (All Modules)',
      shortTitle: 'Home',
      icon: <Home className="w-5 h-5" />,
      perm: '*',
      category: 'core'
    },
    {
      id: 'DASHBOARD',
      title: 'Executive Dashboard',
      shortTitle: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      perm: 'Dashboard',
      category: 'core',
      badge: runningJobsCount > 0 ? `${runningJobsCount} Live` : undefined,
      badgeColor: 'bg-emerald-500 text-white'
    },
    // Production Stages
    {
      id: 'PLANNING',
      title: 'Planning Desk (PPC)',
      shortTitle: 'Planning',
      icon: <Calendar className="w-5 h-5" />,
      perm: 'Planning',
      category: 'production',
      badge: activePlansCount > 0 ? activePlansCount : undefined,
      badgeColor: 'bg-blue-600 text-white'
    },
    {
      id: 'SLITTING',
      title: '1. Slitting Desk',
      shortTitle: 'Slitting',
      icon: <Scroll className="w-5 h-5" />,
      perm: 'Slitting',
      category: 'production',
      badge: slittingPendingCount > 0 ? slittingPendingCount : undefined,
      badgeColor: 'bg-amber-500 text-white font-extrabold shadow-3xs'
    },
    {
      id: 'CUTTING',
      title: '2. Cutting Desk',
      shortTitle: 'Cutting',
      icon: <Scissors className="w-5 h-5" />,
      perm: 'Cutting',
      category: 'production',
      badge: cuttingPendingCount > 0 ? cuttingPendingCount : undefined,
      badgeColor: 'bg-indigo-600 text-white font-extrabold shadow-3xs'
    },
    {
      id: 'FORMING',
      title: '3. Forming Desk',
      shortTitle: 'Forming',
      icon: <Cog className="w-5 h-5" />,
      perm: 'Forming',
      category: 'production',
      badge: formingPendingCount > 0 ? formingPendingCount : undefined,
      badgeColor: 'bg-violet-600 text-white font-extrabold shadow-3xs'
    },
    {
      id: 'QC',
      title: '4. QC Desk',
      shortTitle: 'QC',
      icon: <SearchCheck className="w-5 h-5" />,
      perm: 'QC',
      category: 'production',
      badge: qcPendingCount > 0 ? qcPendingCount : undefined,
      badgeColor: 'bg-rose-500 text-white font-extrabold shadow-3xs'
    },
    {
      id: 'PACKING',
      title: '5. Packing Station',
      shortTitle: 'Packing',
      icon: <Package className="w-5 h-5" />,
      perm: 'Packing',
      category: 'production',
      badge: packingPendingCount > 0 ? packingPendingCount : undefined,
      badgeColor: 'bg-sky-600 text-white font-extrabold shadow-3xs'
    },
    // Inventory & Orders
    {
      id: 'STOCK',
      title: 'Live Stock Matrix',
      shortTitle: 'Stock',
      icon: <Layers className="w-5 h-5" />,
      perm: 'Stock',
      category: 'inventory'
    },
    {
      id: 'ORDERS',
      title: 'Customer Orders',
      shortTitle: 'Orders',
      icon: <ShoppingBag className="w-5 h-5" />,
      perm: 'Orders',
      category: 'inventory'
    },
    {
      id: 'MARKETING',
      title: 'Marketing Desk',
      shortTitle: 'Marketing',
      icon: <Briefcase className="w-5 h-5" />,
      perm: 'Marketing',
      category: 'inventory'
    },
    {
      id: 'DISPATCH',
      title: 'Multi-Item Dispatch',
      shortTitle: 'Dispatch',
      icon: <Truck className="w-5 h-5" />,
      perm: 'Dispatch',
      category: 'inventory'
    },
    // Operations & HR
    {
      id: 'PURCHASE',
      title: 'Purchase Desk',
      shortTitle: 'Purchase',
      icon: <ShoppingCart className="w-5 h-5" />,
      perm: 'Purchase',
      category: 'operations'
    },
    {
      id: 'MAINTENANCE',
      title: 'Maintenance Desk',
      shortTitle: 'Maintenance',
      icon: <Wrench className="w-5 h-5" />,
      perm: 'Maintenance',
      category: 'operations',
      badge: activeBreakdowns > 0 ? activeBreakdowns : undefined,
      badgeColor: 'bg-rose-500 text-white animate-pulse'
    },
    {
      id: 'MANPOWER',
      title: 'Manpower Desk',
      shortTitle: 'Manpower',
      icon: <Users className="w-5 h-5" />,
      perm: 'Manpower',
      category: 'operations'
    },
    {
      id: 'SCRAP',
      title: 'Scrap Management',
      shortTitle: 'Scrap',
      icon: <Trash2 className="w-5 h-5" />,
      perm: 'Scrap',
      category: 'operations'
    },
    // Analysis & Admin
    {
      id: 'ANALYTICS',
      title: 'Machine & Operator Analytics',
      shortTitle: 'Analytics',
      icon: <TrendingUp className="w-5 h-5" />,
      perm: 'Analytics',
      category: 'admin'
    },
    {
      id: 'SEARCH',
      title: 'Universal Search',
      shortTitle: 'Search',
      icon: <Search className="w-5 h-5" />,
      perm: 'Search',
      category: 'admin'
    },
    {
      id: 'AUDIT',
      title: 'Traceability & Dossier',
      shortTitle: 'Traceability',
      icon: <ShieldCheck className="w-5 h-5" />,
      perm: 'Audit',
      category: 'admin'
    },
    {
      id: 'ADMIN',
      title: 'Master Settings',
      shortTitle: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      perm: 'Admin',
      category: 'admin'
    }
  ];

  // Filter items according to active user's permissions
  const authorizedNavItems = allNavItems.filter((item) => {
    if (isMasterAdmin) return true;
    if (item.id === 'HUB') return true;
    return currentUser?.perms.some(
      (p) =>
        p === '*' ||
        p.toLowerCase() === item.perm.toLowerCase() ||
        p.toLowerCase() === item.id.toLowerCase()
    );
  });

  const handleItemClick = (viewId: CurrentView) => {
    onSelectView(viewId);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Floating Menu Opener Button (Fixed at bottom-left on small screens) */}
      <div className="md:hidden fixed bottom-4 left-4 z-40">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="w-12 h-12 rounded-2xl bg-[#1a365d] text-white shadow-xl flex items-center justify-center cursor-pointer border border-blue-400/30 hover:bg-[#2a4365] transition active:scale-95"
          title="Open Navigation Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Backdrop & Slide-out Drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-2xl border-r border-slate-200 z-50">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 bg-[#1a365d] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-black text-amber-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold m-0 leading-tight">Wünderkraf Desk</h3>
                  <p className="text-[11px] text-blue-200 m-0">Quick Switch Workspace</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {authorizedNavItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer text-left ${
                      isActive
                        ? 'bg-[#1a365d] text-white shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-blue-900'
                    }`}
                  >
                    <span className={isActive ? 'text-amber-400' : 'text-slate-500'}>
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate">{item.title}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          item.badgeColor || 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Desktop / Tablet Persistent Sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-slate-200/90 shadow-xs transition-all duration-200 ease-in-out select-none flex-shrink-0 z-30 ${
          isCollapsed ? 'w-16' : 'w-60'
        }`}
        style={{ minHeight: 'calc(100vh - 80px)' }}
      >
        {/* Sidebar Top: Collapse / Expand Header */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/70">
          {!isCollapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-xs font-extrabold text-[#1a365d] uppercase tracking-wider truncate">
                Desks ({authorizedNavItems.length})
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer ${
              isCollapsed ? 'mx-auto' : ''
            }`}
            title={isCollapsed ? 'Expand Sidebar Menu' : 'Collapse to Icon Rail'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Scrollable Icon List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1.5 scrollbar-thin">
          {authorizedNavItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center rounded-xl transition cursor-pointer ${
                    isCollapsed
                      ? 'justify-center p-2.5 h-11'
                      : 'gap-3 px-3 py-2 text-left'
                  } ${
                    isActive
                      ? 'bg-[#1a365d] text-white shadow-md'
                      : 'text-slate-600 hover:bg-blue-50 hover:text-[#1a365d]'
                  }`}
                  title={isCollapsed ? item.title : undefined}
                >
                  <span
                    className={`flex-shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-blue-700'
                    }`}
                  >
                    {item.icon}
                  </span>

                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-xs font-extrabold truncate">
                        {item.shortTitle}
                      </span>
                      {item.badge !== undefined && (
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                            item.badgeColor || 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}

                  {/* Active Indicator Bar on Collapsed View */}
                  {isCollapsed && isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-400 rounded-r-full" />
                  )}
                </button>

                {/* Floating Tooltip in Collapsed Mode */}
                {isCollapsed && (
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2.5 hidden group-hover:flex items-center z-50">
                    <div className="bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2 border border-slate-700">
                      <span>{item.title}</span>
                      {item.badge !== undefined && (
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                            item.badgeColor || 'bg-slate-700 text-white'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: Quick Status */}
        <div className="p-2 border-t border-slate-200 bg-slate-50/70 text-center">
          {isCollapsed ? (
            <div
              className="w-2.5 h-2.5 rounded-full bg-emerald-500 mx-auto"
              title="System Online & Synchronized"
            />
          ) : (
            <div className="flex items-center justify-between px-2 text-[11px] text-slate-500 font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Online</span>
              </span>
              <span className="uppercase text-[10px] font-bold text-slate-400">
                ERP v4.3
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
