import React, { useState } from 'react';
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
  Wrench,
  ShoppingCart,
  ClipboardList,
  Sparkles,
  Edit3,
  Check,
  Droplets,
  ArrowRight,
  Activity,
  CheckCircle2,
  Calendar,
  Users,
  Database,
  Trash2
} from 'lucide-react';
import { CurrentView, FactoryState } from '../types';
import { calculateAvailableScrapKg } from '../lib/utils';

interface NavigationHubProps {
  state?: FactoryState;
  currentUser?: { username: string; perms: string[] } | null;
  onSelectView: (view: CurrentView) => void;
  onOpenRequisitionModal?: () => void;
  onOpenManpowerModal?: () => void;
  onOpenGlueModal?: () => void;
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
  onOpenRequisitionModal,
  onOpenManpowerModal,
  onOpenGlueModal,
  onOpenAdmin
}) => {
  const username = currentUser?.username || 'admin';
  const perms = currentUser?.perms || ['*'];
  const userRole = (state?.users && state.users[username.toLowerCase()]?.role) || '';
  const isMasterAdmin =
    perms.includes('*') ||
    perms.includes('Admin') ||
    username.toLowerCase() === 'admin' ||
    userRole.toLowerCase() === 'administrator' ||
    userRole.toLowerCase() === 'admin';
  const hasAdminRole = isMasterAdmin || perms.includes('Admin');

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

  // Daily Factory Inspiration Poem State
  const DEFAULT_POEM = `With hard work and dedication, we give a new shape to every roll,
    We increase the factory\'s pride with exact measurements and pure quality.
    In every spoon, every fork, every pack lies our trust,
    Every employee\'s dear sweat is the pride of Wondercraft.`;

  const [poem, setPoem] = useState(() => {
    return localStorage.getItem('wunderkraf_daily_poem') || DEFAULT_POEM;
  });
  const [isEditingPoem, setIsEditingPoem] = useState(false);
  const [poemInput, setPoemInput] = useState(poem);

  const handleSavePoem = () => {
    const trimmed = poemInput.trim();
    if (!trimmed) return;
    setPoem(trimmed);
    localStorage.setItem('wunderkraf_daily_poem', trimmed);
    setIsEditingPoem(false);
  };

  const handleResetPoem = () => {
    setPoem(DEFAULT_POEM);
    setPoemInput(DEFAULT_POEM);
    localStorage.setItem('wunderkraf_daily_poem', DEFAULT_POEM);
    setIsEditingPoem(false);
  };

  const navItems: NavCardItem[] = [
    {
      id: 'DASHBOARD',
      title: 'Executive Dashboard',
      subtitle: 'Live Floor Pulse & Real-time Machine Status',
      icon: <BarChart3 className="w-8 h-8 text-blue-600" />,
      perm: 'Dashboard',
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
      id: 'PLANNING',
      title: 'Planning Desk (PPC)',
      subtitle: 'Production Plans, Target Layers, Mother Reels & Glue Brands',
      icon: <Calendar className="w-8 h-8 text-blue-600" />,
      perm: 'Planning',
      borderColor: 'border-blue-600',
      badge: `${state?.productionPlans?.length || 0} Plans`
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
      perm: 'Stock',
      borderColor: 'border-blue-700',
      badge: `${activeJobsCount} Jobs`
    },
    {
      id: 'ORDERS',
      title: 'Customer Orders',
      subtitle: 'Order Fulfillment, Specs & Packing Schedules',
      icon: <Package className="w-8 h-8 text-emerald-700" />,
      perm: 'Orders',
      borderColor: 'border-emerald-700'
    },
    {
      id: 'ANALYTICS',
      title: 'Machine & Operator Performance',
      subtitle: '8-Day Machine Output, 5-Day/1-Mo/6-Mo Operator Audit & Filter Reports (Machine & Operator Report)',
      icon: <TrendingUp className="w-8 h-8 text-violet-600" />,
      perm: 'Analytics',
      borderColor: 'border-violet-600',
      badge: '8-Day & Operator Audit'
    },
    {
      id: 'SCRAP',
      title: 'Scrap & Wastage Module',
      subtitle: 'Cutting, Forming, Slitting Scrap, Wastage Reports & Buyer Sales Audit',
      icon: <Trash2 className="w-8 h-8 text-rose-600" />,
      perm: 'Scrap',
      borderColor: 'border-rose-600',
      badge: `${Math.round(calculateAvailableScrapKg(state?.logs || [], state?.scrapSales || []))} KG Avail`
    },
    {
      id: 'SEARCH',
      title: 'Universal Search',
      subtitle: 'Search Job ID, Invoices, Customers & Operators',
      icon: <Search className="w-8 h-8 text-sky-600" />,
      perm: 'Search',
      borderColor: 'border-sky-600'
    },
    {
      id: 'AUDIT',
      title: 'Traceability & Batch Reports',
      subtitle: 'Box-to-Raw Material Trace, Customer Complaints & PDF Dossier',
      icon: <ShieldCheck className="w-8 h-8 text-blue-700" />,
      perm: 'Audit',
      borderColor: 'border-blue-700'
    },
    {
      id: 'MAINTENANCE',
      title: 'Maintenance Desk',
      subtitle: 'Machine Breakdowns, Spares, Downtime Logs & Ready Handover',
      icon: <Wrench className="w-8 h-8 text-amber-600" />,
      perm: 'Maintenance',
      borderColor: 'border-amber-600',
      badge: activeBreakdownsCount > 0 ? `${activeBreakdownsCount} Stopped` : 'Ready'
    },
    {
      id: 'PURCHASE',
      title: 'Purchase Desk',
      subtitle: 'Material Indents, Vendor POs & Incoming Goods (Goods Received)',
      icon: <ShoppingCart className="w-8 h-8 text-emerald-600" />,
      perm: 'Purchase',
      borderColor: 'border-emerald-600',
      badge:
        arrivedRequisitionsCount > 0
          ? `🎉 ${arrivedRequisitionsCount} Arrived`
          : pendingRequisitionsCount > 0
          ? `${pendingRequisitionsCount} Indents`
          : undefined
    },
    {
      id: 'MANPOWER',
      title: 'Manpower Desk',
      subtitle: 'HR Headcount, Attendance, Labor Cost, Productivity & Live Floor Roster',
      icon: <Users className="w-8 h-8 text-indigo-700" />,
      perm: 'Manpower',
      borderColor: 'border-indigo-700',
      badge: `${state?.floorWorkers?.length || 0} Workforce`
    },
    {
      id: 'OPENING_STOCK',
      title: 'Opening WIP & Inward Stock',
      subtitle: 'Shop Floor Opening Physical Inventory & Buffer Injection (Go-Live)',
      icon: <Database className="w-8 h-8 text-amber-600" />,
      perm: 'Admin',
      borderColor: 'border-amber-600',
      badge: 'Go-Live Module'
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

  // Exact permission matching:
  // 1. Master admin or '*' or 'Admin' role has full access to all 16 desks
  // 2. Operators have access to their explicitly granted permissions (case-insensitive)
  const visibleItems = navItems.filter((item) => {
    if (isMasterAdmin) return true;
    return perms.some(
      (p) =>
        p === '*' ||
        p.toLowerCase() === item.perm.toLowerCase() ||
        p.toLowerCase() === item.id.toLowerCase()
    );
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏠</span>
          <h2 className="text-base font-bold text-[#1a365d] uppercase tracking-wide m-0">
            Home — Select Your Workstation Module
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-bold text-[#2b6cb0]">
            Active Desk:{' '}
            <span className="uppercase text-slate-800 bg-slate-100 px-2 py-0.5 rounded font-extrabold">
              {username}
            </span>
            <span className="ml-1.5 text-[11px] text-slate-500 font-semibold">
              ({visibleItems.length} Desks Authorized)
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DAILY FACTORY INSPIRATION POEM (Daily Factory Inspiration Poem) */}
      {/* ======================================================== */}
      <div className="mb-4 bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-amber-50/80 border border-amber-200/90 rounded-xl p-3.5 shadow-2xs">
        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wide">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Factory Floor Inspiration Poem</span>
          </div>
          <div className="flex items-center gap-1.5">
            {!isEditingPoem ? (
              <button
                type="button"
                onClick={() => {
                  setPoemInput(poem);
                  setIsEditingPoem(true);
                }}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-white border border-amber-300 px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1 shadow-2xs"
              >
                <Edit3 className="w-3 h-3 text-amber-700" />
                <span>Edit Poem</span>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSavePoem}
                  className="text-[11px] font-extrabold text-white bg-amber-700 hover:bg-amber-800 px-2.5 py-0.5 rounded cursor-pointer transition flex items-center gap-1 shadow-2xs"
                >
                  <Check className="w-3 h-3" />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingPoem(false)}
                  className="text-[11px] font-bold text-slate-600 bg-white border border-slate-300 px-2 py-0.5 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetPoem}
                  className="text-[10px] font-semibold text-amber-800 underline ml-1 cursor-pointer"
                >
                  Original Poem
                </button>
              </div>
            )}
          </div>
        </div>

        {isEditingPoem ? (
          <div className="mt-2 space-y-2">
            <textarea
              rows={3}
              value={poemInput}
              onChange={(e) => setPoemInput(e.target.value)}
              className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-xs font-medium text-slate-800 outline-none leading-relaxed"
              placeholder="Write your favorite inspirational poem or factory message here..."
            />
          </div>
        ) : (
          <p className="text-xs sm:text-sm font-medium text-amber-950 leading-relaxed italic m-0 whitespace-pre-line pl-1 border-l-2 border-amber-400">
            "{poem}"
          </p>
        )}
      </div>

      {/* Quick Action Banners: Material Requisition, Plant Manpower */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {onOpenRequisitionModal && (
          <button
            onClick={onOpenRequisitionModal}
            className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 hover:border-emerald-300 rounded-xl transition shadow-xs hover:shadow group cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                  <span>Material Indent</span>
                  {arrivedRequisitionsCount > 0 ? (
                    <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded font-extrabold animate-pulse">
                      {arrivedRequisitionsCount} Arrived!
                    </span>
                  ) : (
                    <span className="bg-emerald-200 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                      Store Indents & POs
                    </span>
                  )}
                </div>
                <div className="text-xs text-emerald-700 mt-0.5">
                  Track Material & Spare Demands
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-white border border-emerald-200 px-2 py-1 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition">
              Open &rarr;
            </span>
          </button>
        )}

        {onOpenManpowerModal && (
          <button
            onClick={onOpenManpowerModal}
            className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 hover:border-amber-300 rounded-xl transition shadow-xs hover:shadow group cursor-pointer text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition text-base">
                👷‍♂️
              </div>
              <div>
                <div className="text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                  <span>Floor Manpower Tracker</span>
                  <span className="bg-amber-500 text-slate-950 text-[10px] px-1.5 py-0.5 rounded font-extrabold">
                    {state?.floorWorkers ? `${state.floorWorkers.filter((w) => w.isPresent).length} On Duty` : 'Live'}
                  </span>
                </div>
                <div className="text-xs text-amber-800 mt-0.5">
                  Operator, 2-Helper & Machine Allocation
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-900 bg-white border border-amber-300 px-2 py-1 rounded-lg group-hover:bg-amber-600 group-hover:text-white transition">
              Roster &rarr;
            </span>
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* VISUAL PROGRESS BAR & FLOWCHART FOR ACTIVE JOBS */}
      {/* ======================================================== */}
      {false && state?.jobs && state.jobs.length > 0 && (
        <div className="mb-5 bg-white border border-slate-200 text-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold uppercase tracking-wide m-0 text-slate-900 flex items-center gap-2">
                  <span>Active Production Flowchart & Progress Track</span>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">
                    {state.jobs.length} Active {state.jobs.length === 1 ? 'Job' : 'Jobs'} in Pipeline
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 m-0">
                  Live Production Progress: Slitting ➔ Cutting ➔ Forming ➔ QC ➔ Packing (Click to go direct)
                </p>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-400 font-mono">
              Live Stage Residency Indicator
            </div>
          </div>

          <div className="space-y-4">
            {state.jobs.slice(0, 3).map((job) => {
              // Calculate current stage and progress percentage
              const slitBatches = job.runningBatches?.filter((b) => b.stage === 'Slitting') || [];
              const cutBatches = job.runningBatches?.filter((b) => b.stage === 'Cutting') || [];
              const formBatches = job.runningBatches?.filter((b) => b.stage === 'Forming') || [];
              const isSlitRunning = slitBatches.some((b) => b.status === 'Running');
              const isCutRunning = cutBatches.some((b) => b.status === 'Running');
              const isFormRunning = formBatches.some((b) => b.status === 'Running');

              const hasSlitOutput = (job.availableRolls || 0) > 0 || cutBatches.length > 0;
              const hasCutOutput = (job.availableCuttingCrates || 0) > 0 || (job.totalCutPieces || 0) > 0 || formBatches.length > 0;
              const hasFormOutput = (job.availableFormingCrates || 0) > 0 || (job.totalFormedPieces || 0) > 0;
              const hasQcOutput = (job.availableQcCrates || 0) > 0 || (job.totalQcPieces || 0) > 0;

              // Estimated percentage
              let progressPct = 10;
              if (hasSlitOutput) progressPct = 30;
              if (isCutRunning) progressPct = 45;
              if (hasCutOutput) progressPct = 55;
              if (isFormRunning) progressPct = 70;
              if (hasFormOutput) progressPct = 80;
              if (hasQcOutput) progressPct = 90;

              // Define the 5 production pipeline stages
              const stages = [
                {
                  id: 'Slitting' as CurrentView,
                  name: '1. Slitting',
                  hindi: 'Slitting',
                  icon: <Scroll className="w-3.5 h-3.5" />,
                  isActive: isSlitRunning,
                  isDone: hasSlitOutput,
                  qtyText: `${job.availableRolls || 0} Rolls Ready`,
                  worker: slitBatches.find((b) => b.status === 'Running')?.worker
                },
                {
                  id: 'Cutting' as CurrentView,
                  name: '2. Cutting',
                  hindi: 'Cutting',
                  icon: <Scissors className="w-3.5 h-3.5" />,
                  isActive: isCutRunning,
                  isDone: hasCutOutput,
                  qtyText: `${job.availableCuttingCrates || 0} Crates (${(job.totalCutPieces || 0).toLocaleString()} Pcs)`,
                  worker: cutBatches.find((b) => b.status === 'Running')?.worker
                },
                {
                  id: 'Forming' as CurrentView,
                  name: '3. Forming',
                  hindi: 'Forming',
                  icon: <Cog className="w-3.5 h-3.5" />,
                  isActive: isFormRunning,
                  isDone: hasFormOutput,
                  qtyText: `${job.availableFormingCrates || 0} Crates (${(job.totalFormedPieces || 0).toLocaleString()} Pcs)`,
                  worker: formBatches.find((b) => b.status === 'Running')?.worker
                },
                {
                  id: 'QC' as CurrentView,
                  name: '4. Quality QC',
                  hindi: 'QC Inspection',
                  icon: <SearchCheck className="w-3.5 h-3.5" />,
                  isActive: (job.availableFormingCrates || 0) > 0,
                  isDone: hasQcOutput,
                  qtyText: `${job.availableQcCrates || 0} OK Crates`,
                  worker: undefined
                },
                {
                  id: 'Packing' as CurrentView,
                  name: '5. Packing',
                  hindi: 'Box Packing',
                  icon: <Package className="w-3.5 h-3.5" />,
                  isActive: (job.availableQcCrates || 0) > 0,
                  isDone: false,
                  qtyText: 'Ready to Pack',
                  worker: undefined
                }
              ];

              return (
                <div
                  key={job.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 hover:shadow-2xs transition"
                >
                  {/* Job Header info & Progress Bar */}
                  <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-800 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded text-xs">
                        {job.id}
                      </span>
                      <span className="font-extrabold text-sm text-slate-950">{job.product}</span>
                      <span className="text-xs text-slate-600 font-medium">
                        ({job.paperBrand || 'ITC'} • {job.gsm || (job.plannedGsms && job.plannedGsms.join(', ')) || job.targetGsm || 'N/A'})
                      </span>
                      {job.reelNo && (
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                          Reel: {job.reelNo}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-bold">
                        Pipeline Progress:
                      </span>
                      <div className="w-28 sm:w-36 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-black text-emerald-600 w-9 text-right">
                        {progressPct}%
                      </span>
                    </div>
                  </div>

                  {/* Flowchart 5-Node Interactive Stepper */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {stages.map((stg, sIdx) => {
                      let bgClass = 'bg-white border-slate-200 text-slate-500 hover:border-slate-300';
                      let textClass = 'text-slate-500';
                      let qtyClass = 'text-slate-400';
                      let opClass = 'text-slate-500';
                      let statusBadge = (
                        <span className="text-[9px] text-slate-400 uppercase font-semibold">Pending</span>
                      );

                      if (stg.isActive) {
                        bgClass = 'bg-emerald-50/50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs';
                        textClass = 'text-emerald-800';
                        qtyClass = 'text-emerald-700';
                        opClass = 'text-emerald-800';
                        statusBadge = (
                          <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded animate-pulse">
                            ⚡ ACTIVE
                          </span>
                        );
                      } else if (stg.isDone) {
                        bgClass = 'bg-slate-100/70 border-slate-300 text-slate-700 hover:bg-slate-100';
                        textClass = 'text-slate-800';
                        qtyClass = 'text-slate-600';
                        opClass = 'text-slate-600';
                        statusBadge = (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> DONE
                          </span>
                        );
                      }

                      return (
                        <button
                          key={stg.id}
                          type="button"
                          onClick={() => onSelectView(stg.id)}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer hover:scale-[1.02] flex flex-col justify-between group relative ${bgClass}`}
                          title={`Click to open ${stg.name} desk`}
                        >
                          <div className="flex items-center justify-between mb-1 w-full">
                            <div className={`flex items-center gap-1 font-bold text-xs ${textClass}`}>
                              {stg.icon}
                              <span>{stg.name}</span>
                            </div>
                            {statusBadge}
                          </div>

                          <div className={`text-[10px] font-medium truncate ${qtyClass}`}>
                            {stg.qtyText}
                          </div>

                          {stg.worker && (
                            <div className={`text-[9px] font-mono mt-1 font-semibold truncate ${opClass}`}>
                              Op: {stg.worker}
                            </div>
                          )}

                          {sIdx < stages.length - 1 && (
                            <span className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-slate-400 group-hover:text-emerald-600 text-xs">
                              ▶
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Module Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
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

      {visibleItems.length === 0 && (
        <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-sm font-bold text-slate-700">No workstation modules authorized for user [{username}].</p>
          <p className="text-xs text-slate-500 mt-1">Please contact Administrator to assign desk permissions.</p>
        </div>
      )}
    </div>
  );
};
