import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Users,
  Trash2,
  Calendar,
  DollarSign,
  Download,
  Printer,
  Award,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Filter,
  Activity,
  UserCheck,
  ChevronRight
} from 'lucide-react';
import { FactoryState } from '../../types';
import { calculateAvailableScrapKg, exportToCSV } from '../../lib/utils';
import {
  parseAllProductionEvents,
  filterEventsByDate,
  aggregateMachineStats,
  aggregateOperatorStats,
  generateOperatorLeaderboard,
  TimeRangeOption,
  NormalizedProductionEvent
} from '../../lib/productionAudit';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

interface AnalyticsViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ state, onBackToHub, onSaveState }) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'MACHINE' | 'OPERATOR' | 'LEADERBOARD' | 'SCRAP' | 'TELEMETRY'>('MACHINE');

  // Machine Audit Filters
  const [selectedMachine, setSelectedMachine] = useState<string>('ALL');
  const [machineTimeRange, setMachineTimeRange] = useState<TimeRangeOption>('8_DAYS');
  const [machineCustomStart, setMachineCustomStart] = useState<string>('');
  const [machineCustomEnd, setMachineCustomEnd] = useState<string>('');

  // Operator Audit Filters
  const [selectedOperator, setSelectedOperator] = useState<string>('ALL');
  const [operatorDept, setOperatorDept] = useState<string>('ALL');
  const [operatorTimeRange, setOperatorTimeRange] = useState<TimeRangeOption>('5_DAYS');
  const [operatorCustomStart, setOperatorCustomStart] = useState<string>('');
  const [operatorCustomEnd, setOperatorCustomEnd] = useState<string>('');

  // Scrap Sale Form State
  const [buyerName, setBuyerName] = useState('');
  const [scrapSoldKg, setScrapSoldKg] = useState('');
  const [ratePerKg, setRatePerKg] = useState('18');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0]);

  const logs = state.logs || [];
  const scrapSales = state.scrapSales || [];
  const availableScrap = calculateAvailableScrapKg(logs, scrapSales);

  // 1. Normalized Raw Production Events
  const allEvents = useMemo(() => parseAllProductionEvents(state), [state]);

  // Distinct Lists for Dropdowns
  const machineList = useMemo(() => {
    const set = new Set<string>();
    allEvents.forEach((e) => {
      if (e.machine && !['ADMIN', 'MKT-ENTRY', 'RECYCLING-BAY'].includes(e.machine)) {
        set.add(e.machine);
      }
    });
    // Ensure standard machines are present in dropdown
    ['Cutting-1', 'Cutting-2', 'Forming-1', 'Forming-2', 'Forming-3', 'Slitting-1', 'QC-Desk', 'Packing-1'].forEach(
      (m) => set.add(m)
    );
    return Array.from(set).sort();
  }, [allEvents]);

  const operatorList = useMemo(() => {
    const set = new Set<string>();
    allEvents.forEach((e) => {
      if (e.operator && e.operator !== 'Unknown') set.add(e.operator);
    });
    // Add known operators from state/defaults
    ['CUT_OP1', 'CUT_OP2', 'VIKRAM_CUT', 'FORM_OP1', 'FORM_OP2', 'FORM_OP3', 'RAMESH_SLIT', 'SURESH_SLIT', 'QC_RAMESH', 'PACK_SURESH', 'PACK_MAHESH'].forEach(
      (op) => set.add(op)
    );
    return Array.from(set).sort();
  }, [allEvents]);

  // 2. Filtered Events for Machine Tab
  const filteredMachineEvents = useMemo(() => {
    return filterEventsByDate(allEvents, machineTimeRange, machineCustomStart, machineCustomEnd);
  }, [allEvents, machineTimeRange, machineCustomStart, machineCustomEnd]);

  const machineStats = useMemo(() => {
    return aggregateMachineStats(filteredMachineEvents, selectedMachine);
  }, [filteredMachineEvents, selectedMachine]);

  // 3. Filtered Events for Operator Tab
  const filteredOperatorEvents = useMemo(() => {
    let list = filterEventsByDate(allEvents, operatorTimeRange, operatorCustomStart, operatorCustomEnd);
    if (operatorDept !== 'ALL') {
      list = list.filter((e) => e.stage.toLowerCase() === operatorDept.toLowerCase());
    }
    return list;
  }, [allEvents, operatorTimeRange, operatorCustomStart, operatorCustomEnd, operatorDept]);

  const operatorStats = useMemo(() => {
    return aggregateOperatorStats(filteredOperatorEvents, selectedOperator);
  }, [filteredOperatorEvents, selectedOperator]);

  // 4. Leaderboard Data
  const leaderboardEvents = useMemo(() => {
    return filterEventsByDate(allEvents, operatorTimeRange, operatorCustomStart, operatorCustomEnd);
  }, [allEvents, operatorTimeRange, operatorCustomStart, operatorCustomEnd]);

  const leaderboardList = useMemo(() => {
    return generateOperatorLeaderboard(leaderboardEvents);
  }, [leaderboardEvents]);

  // 5. Shift & Telemetry Data
  const shiftTelemetry = useMemo(() => {
    let dayPieces = 0;
    let nightPieces = 0;
    const stageMap: Record<string, number> = {};

    filteredMachineEvents.forEach((ev) => {
      if (ev.shift === 'NIGHT') nightPieces += ev.pieces || 0;
      else dayPieces += ev.pieces || 0;

      const stg = ev.stage || 'Floor';
      stageMap[stg] = (stageMap[stg] || 0) + (ev.pieces || 0);
    });

    const stageChartData = Object.keys(stageMap).map((k) => ({
      stage: k,
      pieces: stageMap[k]
    }));

    return { dayPieces, nightPieces, stageChartData };
  }, [filteredMachineEvents]);

  // Handlers
  const handleRecordScrapSale = (e: React.FormEvent) => {
    e.preventDefault();
    const kg = parseInt(scrapSoldKg, 10) || 0;
    const rate = parseFloat(ratePerKg) || 0;
    if (!buyerName.trim() || kg <= 0) {
      alert('Please enter Buyer Name and Scrap Quantity!');
      return;
    }

    if (kg > availableScrap) {
      alert(`Cannot sell more than available scrap (${availableScrap} KG)!`);
      return;
    }

    const saleId = 'SCR-' + Math.floor(1000 + Math.random() * 9000);
    const totalAmt = kg * rate;

    const newSale = {
      id: saleId,
      partyName: buyerName.trim().toUpperCase(),
      weightKg: kg,
      ratePerKg: rate,
      totalAmount: totalAmt,
      date: saleDate,
      user: 'admin'
    };

    const newAuditLog = {
      jobId: saleId,
      product: 'Paper Scrap',
      stage: 'Scrap Sale',
      machine: 'RECYCLING-BAY',
      action: `♻️ Sold ${kg} KG Scrap to ${buyerName.toUpperCase()} @ ₹${rate}/KG (₹${totalAmt.toLocaleString()})`,
      user: 'admin',
      rawDate: saleDate,
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      scrapSales: [...(state.scrapSales || []), newSale],
      logs: [...state.logs, newAuditLog]
    });

    setBuyerName('');
    setScrapSoldKg('');
    alert(`✅ Scrap Sale [${saleId}] Recorded: ${kg} KG sold for ₹${totalAmt.toLocaleString()}!`);
  };

  const handleExportMachineCSV = () => {
    const csvRows = machineStats.events.map((e) => ({
      Date: e.date,
      Machine: e.machine,
      Stage: e.stage,
      Product: e.product,
      Operator: e.operator,
      Shift: e.shift,
      Crates_Units: e.crates,
      Pieces_Produced: e.pieces,
      Scrap_KG: e.scrapKg,
      Defect_Pieces: e.scrapPieces,
      Job_ID: e.jobId || 'N/A',
      Summary: e.action
    }));
    exportToCSV(`Machine_Audit_${selectedMachine}_${machineTimeRange}.csv`, csvRows);
  };

  const handleExportOperatorCSV = () => {
    const csvRows = operatorStats.events.map((e) => ({
      Date: e.date,
      Operator: e.operator,
      Machine: e.machine,
      Stage: e.stage,
      Product: e.product,
      Shift: e.shift,
      Crates_Units: e.crates,
      Pieces_Produced: e.pieces,
      Scrap_KG: e.scrapKg,
      Defect_Pieces: e.scrapPieces,
      Job_ID: e.jobId || 'N/A',
      Summary: e.action
    }));
    exportToCSV(`Operator_Audit_${selectedOperator}_${operatorTimeRange}.csv`, csvRows);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm mb-6 max-w-7xl mx-auto">
      {/* Top Header & Navigation Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHub}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Main Menu</span>
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1a365d] flex items-center gap-2 m-0">
              <TrendingUp className="w-5 h-5 text-violet-600" />
              <span>Machine & Operator Performance Audit</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium m-0">
              Machine & Operator Production Report (8-day Machine Audit, 5-day/1-month/6-month Operator Performance)
            </p>
          </div>
        </div>

        {/* Action Buttons: Export & Print */}
        <div className="flex items-center gap-2">
          <button
            onClick={activeTab === 'OPERATOR' ? handleExportOperatorCSV : handleExportMachineCSV}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            title="Download CSV Audit Report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            title="Print Report"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Main Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('MACHINE')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'MACHINE'
              ? 'bg-blue-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 text-blue-300" />
          <span>🏭 Machine Performance (8-Day Audit)</span>
        </button>

        <button
          onClick={() => setActiveTab('OPERATOR')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'OPERATOR'
              ? 'bg-violet-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-violet-300" />
          <span>👷 Operator Productivity (5-day / 1-month / 6-month)</span>
        </button>

        <button
          onClick={() => setActiveTab('LEADERBOARD')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'LEADERBOARD'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Award className="w-4 h-4 text-amber-200" />
          <span>🏆 Operator Leaderboard (Ranking Table)</span>
        </button>

        <button
          onClick={() => setActiveTab('SCRAP')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'SCRAP'
              ? 'bg-rose-800 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Trash2 className="w-4 h-4 text-rose-300" />
          <span>♻️ Scrap Recycling Desk</span>
        </button>

        <button
          onClick={() => setActiveTab('TELEMETRY')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'TELEMETRY'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-300" />
          <span>📈 Plant Shift Telemetry</span>
        </button>
      </div>

      {/* ========================================================================================= */}
      {/* TAB 1: MACHINE PERFORMANCE AUDIT (8-DAY PRODUCTION & FILTER AUDIT)                       */}
      {/* ========================================================================================= */}
      {activeTab === 'MACHINE' && (
        <div className="space-y-6">
          {/* Machine Filter Control Strip */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Machine Selection Dropdown */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-blue-950 uppercase flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-blue-700" /> Select Machine:
                </span>
                <select
                  value={selectedMachine}
                  onChange={(e) => setSelectedMachine(e.target.value)}
                  className="bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xs outline-none cursor-pointer"
                >
                  <option value="ALL">All Machines</option>
                  <optgroup label="Cutting Machines">
                    {machineList.filter((m) => m.toLowerCase().includes('cut')).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Forming Machines">
                    {machineList.filter((m) => m.toLowerCase().includes('form')).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Slitting & QC & Packing">
                    {machineList.filter((m) => !m.toLowerCase().includes('cut') && !m.toLowerCase().includes('form')).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Date Filter Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-blue-950 uppercase flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-700" /> Period:
                </span>
                {/* 8-Day Production Button Highlighted */}
                <button
                  onClick={() => setMachineTimeRange('8_DAYS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    machineTimeRange === '8_DAYS'
                      ? 'bg-blue-900 text-white ring-2 ring-blue-400 shadow-sm'
                      : 'bg-white text-blue-900 border border-blue-300 hover:bg-blue-100'
                  }`}
                >
                  ⚡ 8 Days Output (8 Day Production)
                </button>

                <button
                  onClick={() => setMachineTimeRange('TODAY')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    machineTimeRange === 'TODAY'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Today
                </button>

                <button
                  onClick={() => setMachineTimeRange('5_DAYS')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    machineTimeRange === '5_DAYS'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  5 Days
                </button>

                <button
                  onClick={() => setMachineTimeRange('7_DAYS')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    machineTimeRange === '7_DAYS'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  7 Days
                </button>

                <button
                  onClick={() => setMachineTimeRange('30_DAYS')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    machineTimeRange === '30_DAYS'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  1 Month
                </button>

                <button
                  onClick={() => setMachineTimeRange('180_DAYS')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    machineTimeRange === '180_DAYS'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  6 Months
                </button>

                <button
                  onClick={() => setMachineTimeRange('ALL')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    machineTimeRange === 'ALL'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All-Time
                </button>

                <button
                  onClick={() => setMachineTimeRange('CUSTOM')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    machineTimeRange === 'CUSTOM'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  📅 Custom
                </button>
              </div>
            </div>

            {/* Custom Date Range Pickers (if selected) */}
            {machineTimeRange === 'CUSTOM' && (
              <div className="mt-3 pt-3 border-t border-blue-200 flex items-center gap-3 flex-wrap text-xs">
                <span className="font-bold text-blue-950">From Date:</span>
                <input
                  type="date"
                  value={machineCustomStart}
                  onChange={(e) => setMachineCustomStart(e.target.value)}
                  className="bg-white border border-blue-300 rounded-md px-2 py-1 font-bold text-slate-800"
                />
                <span className="font-bold text-blue-950">To Date:</span>
                <input
                  type="date"
                  value={machineCustomEnd}
                  onChange={(e) => setMachineCustomEnd(e.target.value)}
                  className="bg-white border border-blue-300 rounded-md px-2 py-1 font-bold text-slate-800"
                />
              </div>
            )}
          </div>

          {/* Machine Performance KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">
                Total Pieces Produced
              </span>
              <div className="text-2xl font-black text-blue-950 mt-1">
                {machineStats.totalPieces.toLocaleString()}{' '}
                <span className="text-xs font-bold text-blue-700">Pcs / Blanks</span>
              </div>
              <div className="text-[11px] text-blue-700 font-semibold mt-1">
                Over {machineTimeRange === '8_DAYS' ? 'Past 8 Days' : machineTimeRange} • {machineStats.batchCount} Production Runs
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                Total Crates / Units
              </span>
              <div className="text-2xl font-black text-emerald-950 mt-1">
                {machineStats.totalCrates.toLocaleString()}{' '}
                <span className="text-xs font-bold text-emerald-700">Crates / Units</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                Machine Output Volume
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">
                Machine Scrap & Defects
              </span>
              <div className="text-2xl font-black text-rose-950 mt-1">
                {machineStats.totalScrapKg} <span className="text-xs font-bold text-rose-700">KG</span>
                {machineStats.totalScrapPieces > 0 && (
                  <span className="text-xs font-bold text-rose-700 ml-1">
                    / {machineStats.totalScrapPieces} Pcs
                  </span>
                )}
              </div>
              <div className="text-[11px] text-rose-700 font-semibold mt-1">
                Yield: {machineStats.yieldPercent}% Good Output
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wide">
                Operators on this Machine
              </span>
              <div className="text-2xl font-black text-purple-950 mt-1">
                {machineStats.operators.length}{' '}
                <span className="text-xs font-bold text-purple-700">Operators</span>
              </div>
              <div className="text-[11px] text-purple-700 font-semibold truncate mt-1">
                {machineStats.operators.join(', ') || 'None'}
              </div>
            </div>
          </div>

          {/* Machine Daily Production Timeline Bar Chart */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-700" />
                <span>
                  {selectedMachine === 'ALL' ? 'Fleet-wide' : selectedMachine} Daily Production Output (
                  {machineTimeRange === '8_DAYS' ? '8-Day Production Breakdown' : machineTimeRange})
                </span>
              </h4>
              <span className="text-[11px] font-bold text-slate-500">Output in Pieces</span>
            </div>

            {machineStats.dailyTimeline.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={machineStats.dailyTimeline}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: number) => [`${val.toLocaleString()} Pcs`, 'Production']}
                      labelFormatter={(lbl) => `Date: ${lbl}`}
                    />
                    <Bar dataKey="pieces" fill="#2b6cb0" radius={[4, 4, 0, 0]} name="Output Pieces" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-400 italic text-xs">
                No production logs found for the selected machine and date range.
              </div>
            )}
          </div>

          {/* Operator Contribution & Machine Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Operator Contribution on this Machine */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-violet-600" />
                <span>Operator Output on {selectedMachine === 'ALL' ? 'Factory Machines' : selectedMachine}</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2">Operator</th>
                      <th className="p-2 text-right">Output Pieces</th>
                      <th className="p-2 text-right">Crates/Units</th>
                      <th className="p-2 text-right">Scrap (KG)</th>
                      <th className="p-2 text-right">Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {machineStats.operatorContribution.length > 0 ? (
                      machineStats.operatorContribution.map((op, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600" />
                            {op.operator}
                          </td>
                          <td className="p-2 text-right font-extrabold text-blue-900">
                            {op.pieces.toLocaleString()}
                          </td>
                          <td className="p-2 text-right">{op.crates}</td>
                          <td className="p-2 text-right text-rose-700">{op.scrapKg} KG</td>
                          <td className="p-2 text-right font-bold text-slate-700">{op.sharePercent}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                          No operator records for this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Production Summary Table */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Day-by-Day Machine Production Summary</span>
              </h4>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr className="text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2">Date</th>
                      <th className="p-2 text-right">Pieces</th>
                      <th className="p-2 text-right">Crates</th>
                      <th className="p-2 text-right">Scrap</th>
                      <th className="p-2">Operators</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {machineStats.dailyTimeline.length > 0 ? (
                      machineStats.dailyTimeline.map((d, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900 whitespace-nowrap">{d.date}</td>
                          <td className="p-2 text-right font-extrabold text-emerald-900">
                            {d.pieces.toLocaleString()}
                          </td>
                          <td className="p-2 text-right">{d.crates}</td>
                          <td className="p-2 text-right text-rose-700">{d.scrapKg} KG</td>
                          <td className="p-2 text-slate-600 truncate max-w-[120px]">{d.operators.join(', ')}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                          No daily data found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detailed Batch Run Log for Selected Machine */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="p-3.5 bg-slate-100 font-bold text-xs text-slate-900 uppercase flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-700" />
                <span>
                  Chronological Production Run Log ({machineStats.events.length} Completed Batches / Slices)
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-semibold">
                Filter: {selectedMachine} • {machineTimeRange}
              </span>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Machine</th>
                    <th className="p-2.5">Stage</th>
                    <th className="p-2.5">Operator</th>
                    <th className="p-2.5">Shift</th>
                    <th className="p-2.5 text-right">Crates / Units</th>
                    <th className="p-2.5 text-right">Output Pieces</th>
                    <th className="p-2.5 text-right">Scrap</th>
                    <th className="p-2.5">Action Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {machineStats.events.length > 0 ? (
                    machineStats.events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-blue-50/40">
                        <td className="p-2.5 text-slate-600 whitespace-nowrap">{ev.timestamp}</td>
                        <td className="p-2.5 font-bold text-slate-900">{ev.machine}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900">
                            {ev.stage}
                          </span>
                        </td>
                        <td className="p-2.5 font-semibold text-slate-800">{ev.operator}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              ev.shift === 'NIGHT'
                                ? 'bg-indigo-900 text-white'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {ev.shift}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">{ev.crates}</td>
                        <td className="p-2.5 text-right font-extrabold text-blue-950">
                          {ev.pieces.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-rose-700">
                          {ev.scrapKg > 0 ? `${ev.scrapKg} KG` : ev.scrapPieces > 0 ? `${ev.scrapPieces} Pcs` : '-'}
                        </td>
                        <td className="p-2.5 text-slate-600 truncate max-w-[240px]" title={ev.action}>
                          {ev.action}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-slate-400 italic">
                        No production runs logged under this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* TAB 2: OPERATOR PERFORMANCE AUDIT (5-DAY, 1-MONTH, 6-MONTH AUDIT)                       */}
      {/* ========================================================================================= */}
      {activeTab === 'OPERATOR' && (
        <div className="space-y-6">
          {/* Operator Filter Control Strip */}
          <div className="bg-violet-50/70 border border-violet-200 rounded-xl p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Operator and Department Selectors */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-violet-950 uppercase flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-violet-700" /> Select Operator:
                </span>
                <select
                  value={selectedOperator}
                  onChange={(e) => setSelectedOperator(e.target.value)}
                  className="bg-white border border-violet-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xs outline-none cursor-pointer"
                >
                  <option value="ALL">All Operators</option>
                  {operatorList.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>

                <span className="text-xs font-bold text-violet-950 uppercase ml-2">Dept:</span>
                <select
                  value={operatorDept}
                  onChange={(e) => setOperatorDept(e.target.value)}
                  className="bg-white border border-violet-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-xs outline-none cursor-pointer"
                >
                  <option value="ALL">All Departments</option>
                  <option value="Slitting">Slitting</option>
                  <option value="Cutting">Cutting</option>
                  <option value="Forming">Forming</option>
                  <option value="QC">QC</option>
                  <option value="Packing">Packing</option>
                </select>
              </div>

              {/* Date Filter Buttons (Directly matching user prompt: 5 days, 8 days, 1 month, 6 months!) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-violet-950 uppercase flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-violet-700" /> Timeframe:
                </span>

                {/* 5-Day Operator Button Highlighted */}
                <button
                  onClick={() => setOperatorTimeRange('5_DAYS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    operatorTimeRange === '5_DAYS'
                      ? 'bg-violet-900 text-white ring-2 ring-violet-400 shadow-sm'
                      : 'bg-white text-violet-900 border border-violet-300 hover:bg-violet-100'
                  }`}
                >
                  ⚡ 5 Days Output
                </button>

                <button
                  onClick={() => setOperatorTimeRange('8_DAYS')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    operatorTimeRange === '8_DAYS'
                      ? 'bg-violet-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  8 Days
                </button>

                {/* 1 Month Button Highlighted */}
                <button
                  onClick={() => setOperatorTimeRange('30_DAYS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    operatorTimeRange === '30_DAYS'
                      ? 'bg-violet-900 text-white ring-2 ring-violet-400 shadow-sm'
                      : 'bg-white text-violet-900 border border-violet-300 hover:bg-violet-100'
                  }`}
                >
                  📅 1 Month
                </button>

                {/* 6 Months Button Highlighted */}
                <button
                  onClick={() => setOperatorTimeRange('180_DAYS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    operatorTimeRange === '180_DAYS'
                      ? 'bg-violet-900 text-white ring-2 ring-violet-400 shadow-sm'
                      : 'bg-white text-violet-900 border border-violet-300 hover:bg-violet-100'
                  }`}
                >
                  📅 6 Months
                </button>

                <button
                  onClick={() => setOperatorTimeRange('ALL')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    operatorTimeRange === 'ALL'
                      ? 'bg-violet-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All-Time
                </button>

                <button
                  onClick={() => setOperatorTimeRange('CUSTOM')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    operatorTimeRange === 'CUSTOM'
                      ? 'bg-violet-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  📅 Custom
                </button>
              </div>
            </div>

            {/* Custom Date Range Pickers (if selected) */}
            {operatorTimeRange === 'CUSTOM' && (
              <div className="mt-3 pt-3 border-t border-violet-200 flex items-center gap-3 flex-wrap text-xs">
                <span className="font-bold text-violet-950">From Date:</span>
                <input
                  type="date"
                  value={operatorCustomStart}
                  onChange={(e) => setOperatorCustomStart(e.target.value)}
                  className="bg-white border border-violet-300 rounded-md px-2 py-1 font-bold text-slate-800"
                />
                <span className="font-bold text-violet-950">To Date:</span>
                <input
                  type="date"
                  value={operatorCustomEnd}
                  onChange={(e) => setOperatorCustomEnd(e.target.value)}
                  className="bg-white border border-violet-300 rounded-md px-2 py-1 font-bold text-slate-800"
                />
              </div>
            )}
          </div>

          {/* Operator Performance KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-violet-800 uppercase tracking-wide">
                Total Operator Output
              </span>
              <div className="text-2xl font-black text-violet-950 mt-1">
                {operatorStats.totalPieces.toLocaleString()}{' '}
                <span className="text-xs font-bold text-violet-700">Pieces</span>
              </div>
              <div className="text-[11px] text-violet-700 font-semibold mt-1">
                Total Units: {operatorStats.totalCrates} Crates / Boxes
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">
                Average Output Per Run / Shift
              </span>
              <div className="text-2xl font-black text-blue-950 mt-1">
                {operatorStats.avgPiecesPerRun.toLocaleString()}{' '}
                <span className="text-xs font-bold text-blue-700">Pcs / Run</span>
              </div>
              <div className="text-[11px] text-blue-700 font-semibold mt-1">
                {operatorStats.runCount} Total Shifts / Slices Worked
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">
                Scrap & Defect Rate %
              </span>
              <div className="text-2xl font-black text-rose-950 mt-1">
                {operatorStats.scrapRatePercent}%
              </div>
              <div className="text-[11px] text-rose-700 font-semibold mt-1">
                Total Scrap: {operatorStats.totalScrapKg} KG {operatorStats.totalScrapPieces > 0 ? `• ${operatorStats.totalScrapPieces} Pcs` : ''}
              </div>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-4">
              <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wide">
                Shift Slices & Machines
              </span>
              <div className="text-lg font-black text-teal-950 mt-1">
                {operatorStats.shifts.dayRuns} Day • {operatorStats.shifts.nightRuns} Night
              </div>
              <div className="text-[11px] text-teal-700 font-semibold truncate mt-1">
                Machines: {operatorStats.machinesOperated.join(', ') || 'N/A'}
              </div>
            </div>
          </div>

          {/* Operator Daily Productivity Trend Chart */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-violet-700" />
                <span>
                  {selectedOperator === 'ALL' ? 'Factory-wide' : selectedOperator} Production Timeline (
                  {operatorTimeRange === '5_DAYS'
                    ? '5-Day Performance'
                    : operatorTimeRange === '30_DAYS'
                    ? '1-Month Performance'
                    : operatorTimeRange === '180_DAYS'
                    ? '6-Month Historical Performance'
                    : operatorTimeRange})
                </span>
              </h4>
              <span className="text-[11px] font-bold text-slate-500">Output in Pieces</span>
            </div>

            {operatorStats.dailyTimeline.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operatorStats.dailyTimeline}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: number) => [`${val.toLocaleString()} Pcs`, 'Production']}
                      labelFormatter={(lbl) => `Date: ${lbl}`}
                    />
                    <Bar dataKey="pieces" fill="#805ad5" radius={[4, 4, 0, 0]} name="Operator Output Pieces" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-400 italic text-xs">
                No production records found for the selected operator in this date range.
              </div>
            )}
          </div>

          {/* Machine-wise Output Breakdown for this Operator */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Machine-wise Output Breakdown for {selectedOperator}</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-2.5">Machine Name</th>
                    <th className="p-2.5 text-right">Pieces Produced</th>
                    <th className="p-2.5 text-right">Crates / Units</th>
                    <th className="p-2.5 text-right">Scrap (KG)</th>
                    <th className="p-2.5 text-right">Runs / Batches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {operatorStats.machineBreakdown.length > 0 ? (
                    operatorStats.machineBreakdown.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-violet-600" />
                          {m.machine}
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-violet-950">
                          {m.pieces.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right">{m.crates}</td>
                        <td className="p-2.5 text-right text-rose-700">{m.scrapKg} KG</td>
                        <td className="p-2.5 text-right font-bold text-slate-700">{m.runs}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                        No machine output records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shift-Wise Run Log Table for this Operator */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="p-3.5 bg-slate-100 font-bold text-xs text-slate-900 uppercase flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-700" />
                <span>Operator Shift Logs & Production History ({operatorStats.events.length} Records)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-semibold">
                Timeframe: {operatorTimeRange}
              </span>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Operator</th>
                    <th className="p-2.5">Machine</th>
                    <th className="p-2.5">Stage</th>
                    <th className="p-2.5">Shift</th>
                    <th className="p-2.5 text-right">Crates / Units</th>
                    <th className="p-2.5 text-right">Output Pieces</th>
                    <th className="p-2.5 text-right">Scrap</th>
                    <th className="p-2.5">Summary / Job</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {operatorStats.events.length > 0 ? (
                    operatorStats.events.map((ev) => (
                      <tr key={ev.id} className="hover:bg-violet-50/40">
                        <td className="p-2.5 text-slate-600 whitespace-nowrap">{ev.timestamp}</td>
                        <td className="p-2.5 font-bold text-violet-950">{ev.operator}</td>
                        <td className="p-2.5 font-bold text-slate-900">{ev.machine}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-900">
                            {ev.stage}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              ev.shift === 'NIGHT'
                                ? 'bg-indigo-900 text-white'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {ev.shift}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">{ev.crates}</td>
                        <td className="p-2.5 text-right font-extrabold text-violet-950">
                          {ev.pieces.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-rose-700">
                          {ev.scrapKg > 0 ? `${ev.scrapKg} KG` : ev.scrapPieces > 0 ? `${ev.scrapPieces} Pcs` : '-'}
                        </td>
                        <td className="p-2.5 text-slate-600 truncate max-w-[240px]" title={ev.action}>
                          {ev.action}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-slate-400 italic">
                        No shift logs logged for this operator.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* TAB 3: OPERATOR LEADERBOARD & RANKING TABLE                                              */}
      {/* ========================================================================================= */}
      {activeTab === 'LEADERBOARD' && (
        <div className="space-y-6">
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-black text-amber-950 flex items-center gap-2 m-0">
                <Award className="w-5 h-5 text-amber-600" />
                <span>Operator Productivity & Yield Leaderboard</span>
              </h3>
              <p className="text-xs text-amber-800 font-medium m-0 mt-0.5">
                Ranking based on pieces produced, scrap discipline, and shift consistency.
              </p>
            </div>
            <div className="text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300">
              Active Period: {operatorTimeRange === '5_DAYS' ? '5-Day View' : operatorTimeRange}
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3 text-center w-12">Rank</th>
                    <th className="p-3">Operator Name</th>
                    <th className="p-3">Primary Station / Department</th>
                    <th className="p-3 text-right">Total Output (Pieces)</th>
                    <th className="p-3 text-right">Total Crates</th>
                    <th className="p-3 text-right">Batches / Shifts</th>
                    <th className="p-3 text-right">Avg Pcs / Shift</th>
                    <th className="p-3 text-right">Scrap Rate</th>
                    <th className="p-3 text-right">Efficiency Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {leaderboardList.length > 0 ? (
                    leaderboardList.map((item) => (
                      <tr key={item.operator} className="hover:bg-amber-50/40">
                        <td className="p-3 text-center font-black">
                          {item.rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-slate-900 shadow-xs">
                              🥇
                            </span>
                          ) : item.rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-900 shadow-xs">
                              🥈
                            </span>
                          ) : item.rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white shadow-xs">
                              🥉
                            </span>
                          ) : (
                            <span className="text-slate-500 font-bold">#{item.rank}</span>
                          )}
                        </td>
                        <td className="p-3 font-extrabold text-slate-900">{item.operator}</td>
                        <td className="p-3 text-slate-600">{item.department}</td>
                        <td className="p-3 text-right font-black text-blue-950">
                          {item.totalPieces.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-800">{item.totalCrates}</td>
                        <td className="p-3 text-right text-slate-700">{item.runCount}</td>
                        <td className="p-3 text-right text-slate-700">
                          {item.avgPiecesPerRun.toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-semibold text-rose-700">
                          {item.scrapRatePercent}%
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                              item.efficiencyScore >= 95
                                ? 'bg-emerald-100 text-emerald-900'
                                : item.efficiencyScore >= 85
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {item.efficiencyScore}% ⭐
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-slate-400 italic">
                        No operators logged in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* TAB 4: SCRAP RECYCLING DESK & SALES MANAGEMENT                                           */}
      {/* ========================================================================================= */}
      {activeTab === 'SCRAP' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" />
              <h4 className="text-sm font-bold text-slate-900 uppercase">
                Paper Scrap Management & Recycling Sales
              </h4>
            </div>
            <div className="px-3 py-1 bg-rose-100 border border-rose-300 rounded-lg text-xs font-extrabold text-rose-900">
              Available Warehouse Scrap: {(availableScrap ?? 0).toLocaleString()} KG
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Record Scrap Sale Form */}
            <form
              onSubmit={handleRecordScrapSale}
              className="p-4 bg-rose-50/40 border border-rose-200 rounded-xl space-y-3"
            >
              <span className="text-xs font-bold text-rose-950 uppercase block">
                Record Scrap Dispatch / Sale to Recycling Mill:
              </span>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Recycling Mill / Party Name:
                </label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="e.g. SHREE PAPER RECYCLERS LTD"
                  className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-bold uppercase text-slate-800 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Weight (KG):
                  </label>
                  <input
                    type="number"
                    value={scrapSoldKg}
                    onChange={(e) => setScrapSoldKg(e.target.value)}
                    placeholder={`Max: ${availableScrap || 0}`}
                    className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Rate per KG (₹):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={ratePerKg}
                    onChange={(e) => setRatePerKg(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Sale Date:</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <DollarSign className="w-4 h-4" />
                <span>Record Scrap Sale Transaction</span>
              </button>
            </form>

            {/* Past Scrap Sales History Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-3 bg-slate-100 font-bold text-xs text-slate-800 uppercase border-b border-slate-200">
                Recent Scrap Sales Log
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                {(scrapSales || []).length > 0 ? (
                  scrapSales.map((sale, idx) => {
                    const party = sale.partyName || sale.buyerNote || 'Recycling Partner';
                    const weight = sale.weightKg ?? sale.soldKg ?? 0;
                    const rate = sale.ratePerKg ?? (sale.totalAmount && weight ? Math.round(sale.totalAmount / weight) : 18);
                    const total = sale.totalAmount ?? (weight * rate);
                    return (
                      <div key={sale.id || idx} className="p-3 hover:bg-slate-50 flex items-center justify-between">
                        <div>
                          <div className="font-extrabold text-slate-900">{party}</div>
                          <div className="text-[11px] text-slate-500">
                            {sale.date || 'Recent'} {sale.time ? `| ${sale.time}` : ''} | {(weight ?? 0).toLocaleString()} KG @ ₹{rate}/KG
                          </div>
                        </div>
                        <div className="text-right font-extrabold text-emerald-800">
                          ₹{(total ?? 0).toLocaleString()}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-slate-400 italic">No scrap sales recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* TAB 5: PLANT SHIFT & WORKSTATION TELEMETRY                                               */}
      {/* ========================================================================================= */}
      {activeTab === 'TELEMETRY' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-900 uppercase">Day Shift Output</span>
                <div className="text-2xl font-black text-amber-950 mt-1">
                  {shiftTelemetry.dayPieces.toLocaleString()} Pcs
                </div>
              </div>
              <span className="text-3xl">🌞</span>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-900 uppercase">Night Shift Output</span>
                <div className="text-2xl font-black text-indigo-950 mt-1">
                  {shiftTelemetry.nightPieces.toLocaleString()} Pcs
                </div>
              </div>
              <span className="text-3xl">🌙</span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span>Production Volume by Process Stage</span>
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shiftTelemetry.stageChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(val: number) => [`${val.toLocaleString()} Pcs`, 'Output']} />
                  <Bar dataKey="pieces" fill="#319795" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
