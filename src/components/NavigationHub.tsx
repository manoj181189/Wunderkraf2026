import React from 'react';
import {
  FileText,
  Truck,
  BarChart3,
  Scroll,
  Scissors,
  Cog,
  SearchCheck,
  Package,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  Layers,
  Globe,
  Mic,
  Wrench,
  ShoppingCart,
  ClipboardList
} from 'lucide-react';
import { CurrentView, FactoryState } from '../types';

interface NavigationHubProps {
  state?: FactoryState;
  currentUser?: { username: string; perms: string[] } | null;
  onSelectView: (view: CurrentView) => void;
  onOpenVoiceModal?: () => void;
  onOpenSearchModal?: () => void;
  onOpenRequisitionModal?: () => void;
  onOpenAdmin?: () => void;
}

interface NavCardItem {
  id: CurrentView;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  perm: string;
  badge?: string;
  borderColor: string;
}

export const NavigationHub: React.FC<NavigationHubProps> = ({
  state,
  currentUser,
  onSelectView,
  onOpenVoiceModal,
  onOpenSearchModal,
  onOpenRequisitionModal,
  onOpenAdmin
}) => {
  const username = currentUser?.username || 'Admin';
  const perms = currentUser?.perms || [
    'Admin',
    'Marketing',
    'Dispatch',
    'Slitting',
    'Cutting',
    'Forming',
    'QC',
    'Packing'
  ];
  const isAdmin = perms.includes('Admin');

  // Compute live stats for badges if state is available
  const activeJobsCount = state?.jobs?.length || 0;
  const activeOrdersCount = state?.packJobs?.length || 0;
  const activeBatchesCount =
    state?.jobs?.reduce(
      (acc, j) => acc + (j.runningBatches?.filter((b) => b.status === 'Running').length || 0),
      0
    ) || 0;
  const activeBreakdownsCount =
    state?.maintenanceIncidents?.filter((i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS').length || 0;
  const pendingRequisitionsCount =
    state?.materialRequisitions?.filter((r) => r.status === 'PENDING').length || 0;
  const arrivedRequisitionsCount =
    state?.materialRequisitions?.filter((r) => r.status === 'RECEIVED' && !r.acknowledgedByRequester).length || 0;

  const navItems: NavCardItem[] = [
    {
      id: 'DASHBOARD',
      title: 'Executive Dashboard',
      subtitle: 'Live Floor Pulse & Real-time Machine Status',
      icon: <BarChart3 className="w-8 h-8 text-blue-600" />,
      perm: 'Admin',
      borderColor: 'border-blue-600',
      badge: activeBatchesCount > 0 ? `${activeBatchesCount} Running` : 'Live 360°'
    },
    {
      id: 'MARKETING',
      title: 'Marketing Orders',
      subtitle: 'Customer Orders, Kit Builder & Target Dates',
      icon: <FileText className="w-8 h-8 text-emerald-600" />,
      perm: 'Marketing',
      borderColor: 'border-emerald-600',
      badge: activeOrdersCount > 0 ? `${activeOrdersCount} Orders` : undefined
    },
    {
      id: 'DISPATCH',
      title: 'Multi-Item Dispatch',
      subtitle: 'Invoicing, Gatepass Challan & Vehicle Tracking',
      icon: <Truck className="w-8 h-8 text-teal-600" />,
      perm: 'Dispatch',
      borderColor: 'border-teal-600'
    },
    {
      id: 'SLITTING',
      title: '1. Slitting Desk',
      subtitle: 'Raw Paper Rolls Slitting, Output KG & Re-open',
      icon: <Scroll className="w-8 h-8 text-indigo-600" />,
      perm: 'Slitting',
      borderColor: 'border-indigo-600'
    },
    {
      id: 'CUTTING',
      title: '2. Cutting Desk',
      subtitle: 'Rolls to Cut Crates, Scrap KG & Re-routing',
      icon: <Scissors className="w-8 h-8 text-purple-600" />,
      perm: 'Cutting',
      borderColor: 'border-purple-600'
    },
    {
      id: 'FORMING',
      title: '3. Forming Desk',
      subtitle: 'Cut Pieces to Formed Products & Same-Job Top-up',
      icon: <Cog className="w-8 h-8 text-amber-600" />,
      perm: 'Forming',
      borderColor: 'border-amber-600'
    },
    {
      id: 'QC',
      title: '4. QC Desk',
      subtitle: 'Quality Inspection, Scrap Rejected & Approvals',
      icon: <SearchCheck className="w-8 h-8 text-cyan-600" />,
      perm: 'QC',
      borderColor: 'border-cyan-600'
    },
    {
      id: 'PACKING',
      title: '5. Packing Station',
      subtitle: 'Kit Packaging, Traceable QC Crates & Finished WH',
      icon: <Package className="w-8 h-8 text-rose-600" />,
      perm: 'Packing',
      borderColor: 'border-rose-600'
    },
    {
      id: 'STOCK',
      title: 'Live Stock Matrix',
      subtitle: 'Real-time Rolls, Crates, WIP, and Scrap Balance',
      icon: <Layers className="w-8 h-8 text-blue-700" />,
      perm: 'Any',
      borderColor: 'border-blue-700',
      badge: `${activeJobsCount} Jobs`
    },
    {
      id: 'ORDERS',
      title: 'Customer Orders',
      subtitle: 'Order Fulfillment, Specs & Packing Schedules',
      icon: <Package className="w-8 h-8 text-emerald-700" />,
      perm: 'Any',
      borderColor: 'border-emerald-700'
    },
    {
      id: 'ANALYTICS',
      title: 'Efficiency Analytics',
      subtitle: 'Output Trends, Scrap Economics & Shift Telemetry',
      icon: <TrendingUp className="w-8 h-8 text-violet-600" />,
      perm: 'Admin',
      borderColor: 'border-violet-600'
    },
    {
      id: 'SEARCH',
      title: 'Universal Search',
      subtitle: 'Search Job ID, Invoices, Customers & Operators',
      icon: <Search className="w-8 h-8 text-sky-600" />,
      perm: 'Any',
      borderColor: 'border-sky-600'
    },
    {
      id: 'AUDIT',
      title: 'Traceability & Batch Reports',
      subtitle: 'Box-to-Raw Material Trace, Customer Complaints & PDF Dossier',
      icon: <ShieldCheck className="w-8 h-8 text-blue-700" />,
      perm: 'Any',
      borderColor: 'border-blue-700'
    },
    {
      id: 'MAINTENANCE',
      title: 'Maintenance Desk',
      subtitle: 'Machine Breakdowns, Spares, Downtime Logs & Ready Handover',
      icon: <Wrench className="w-8 h-8 text-amber-600" />,
      perm: 'Any',
      borderColor: 'border-amber-600',
      badge: activeBreakdownsCount > 0 ? `${activeBreakdownsCount} Stopped` : 'Ready'
    },
    {
      id: 'PURCHASE',
      title: 'Purchase Desk',
      subtitle: 'Material Indents, Vendor POs & Incoming Goods (माल प्राप्ति)',
      icon: <ShoppingCart className="w-8 h-8 text-emerald-600" />,
      perm: 'Any',
      borderColor: 'border-emerald-600',
      badge:
        arrivedRequisitionsCount > 0
          ? `🎉 ${arrivedRequisitionsCount} Arrived`
          : pendingRequisitionsCount > 0
          ? `${pendingRequisitionsCount} Indents`
          : undefined
    },
    {
      id: 'ADMIN',
      title: 'Master Settings',
      subtitle: 'Admin PIN, Numbering Sequences & Shift Timings',
      icon: <Settings className="w-8 h-8 text-slate-800" />,
      perm: 'Admin',
      borderColor: 'border-slate-800'
    }
  ];

  const visibleItems = navItems.filter((item) => {
    if (isAdmin) return true;
    if (item.perm === 'Any') return true;
    return perms.includes(item.perm);
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎛️</span>
          <h2 className="text-base font-bold text-[#1a365d] uppercase tracking-wide m-0">
            Navigation Hub — Select Your Workstation Module
          </h2>
        </div>
        <div className="text-xs font-bold text-[#2b6cb0]">
          Operator Desk:{' '}
          <span className="uppercase text-slate-800 bg-slate-100 px-2 py-0.5 rounded font-extrabold">
            {username}
          </span>
        </div>
      </div>

      {/* Quick Tools & Floor Utilities Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {onOpenVoiceModal && (
          <button
            onClick={onOpenVoiceModal}
            className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 hover:border-purple-300 rounded-xl text-left transition shadow-xs hover:shadow group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition">
              <Mic className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                <span>Voice AI Floor Dictation</span>
                <span className="bg-purple-200 text-purple-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                  gemini-3.5-transcribe
                </span>
              </div>
              <div className="text-xs text-purple-700 mt-0.5">
                Dictate breakdown causes, job notes, or remarks
              </div>
            </div>
          </button>
        )}

        {onOpenSearchModal && (
          <button
            onClick={onOpenSearchModal}
            className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 hover:border-teal-300 rounded-xl text-left transition shadow-xs hover:shadow group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-teal-900 uppercase tracking-wide flex items-center gap-1.5">
                <span>Google Search Grounding Hub</span>
                <span className="bg-teal-200 text-teal-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                  gemini-3.5-flash
                </span>
              </div>
              <div className="text-xs text-teal-700 mt-0.5">
                Live Paper Mill rates (ITC, Century) & GSM norms
              </div>
            </div>
          </button>
        )}

        {onOpenRequisitionModal && (
          <button
            onClick={onOpenRequisitionModal}
            className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 hover:border-emerald-300 rounded-xl text-left transition shadow-xs hover:shadow group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                <span>Material Requisition (इंडेन्ट)</span>
                {arrivedRequisitionsCount > 0 ? (
                  <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded font-extrabold animate-pulse">
                    {arrivedRequisitionsCount} Arrived!
                  </span>
                ) : (
                  <span className="bg-emerald-200 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                    Fast Indent
                  </span>
                )}
              </div>
              <div className="text-xs text-emerald-700 mt-0.5">
                मटेरियल / स्पेयर पार्ट डिमांड भरें और स्टेटस ट्रैक करें
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Main Module Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectView(item.id)}
            className={`bg-white border-2 border-slate-200 border-t-4 ${item.borderColor} hover:border-[#3182ce] hover:shadow-md hover:-translate-y-1 rounded-xl p-3.5 text-center transition-all flex flex-col items-center justify-between min-h-[145px] group cursor-pointer`}
          >
            <div className="transition group-hover:scale-110 mb-1.5">{item.icon}</div>
            <div>
              <h3 className="text-xs font-bold text-[#1a365d] uppercase tracking-wide m-0">
                {item.title}
              </h3>
              <p className="text-[10.5px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                {item.subtitle}
              </p>
            </div>
            <div className="mt-2 w-full flex justify-center">
              {item.badge ? (
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded uppercase">
                  {item.badge}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-semibold group-hover:text-blue-600 transition">
                  Open Desk &rarr;
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
