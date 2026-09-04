import React, { useState } from 'react';
import { ArrowLeft, BarChart3, TrendingUp, Users, Trash2, Calendar, Plus, DollarSign } from 'lucide-react';
import { FactoryState } from '../../types';
import { calculateAvailableScrapKg } from '../../lib/utils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface AnalyticsViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
}

const COLORS = ['#2b6cb0', '#319795', '#d69e2e', '#38a169', '#805ad5', '#e53e3e'];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ state, onBackToHub, onSaveState }) => {
  const { logs, scrapSales } = state;
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  // Scrap sale form
  const [buyerName, setBuyerName] = useState('');
  const [scrapSoldKg, setScrapSoldKg] = useState('');
  const [ratePerKg, setRatePerKg] = useState('18');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0]);

  const availableScrap = calculateAvailableScrapKg(logs, scrapSales);

  // Filter logs by date range
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const filteredLogs = logs.filter((l) => {
    if (dateFilter === 'ALL') return true;
    if (!l.rawDate) return true;
    if (dateFilter === 'TODAY') return l.rawDate === todayStr;

    const logDate = new Date(l.rawDate);
    const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 3600 * 24);

    if (dateFilter === 'WEEK') return diffDays <= 7;
    if (dateFilter === 'MONTH') return diffDays <= 30;
    return true;
  });

  // Machine Output Stats
  const machineOutputMap: Record<string, number> = {};
  // Operator Output Stats
  const workerOutputMap: Record<string, number> = {};
  // Shift Output Stats
  const shiftOutputMap: Record<string, number> = { DAY: 0, NIGHT: 0 };

  filteredLogs.forEach((l) => {
    // Machine count
    if (l.machine) {
      machineOutputMap[l.machine] = (machineOutputMap[l.machine] || 0) + 1;
    }
    // Worker count
    if (l.worker) {
      workerOutputMap[l.worker] = (workerOutputMap[l.worker] || 0) + 1;
    }
    // Shift
    if (l.shift) {
      shiftOutputMap[l.shift] = (shiftOutputMap[l.shift] || 0) + 1;
    }
  });

  const machineChartData = Object.keys(machineOutputMap).map((m) => ({
    name: m,
    operations: machineOutputMap[m]
  }));

  const workerChartData = Object.keys(workerOutputMap)
    .map((w) => ({
      name: w,
      runs: workerOutputMap[w]
    }))
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 8);

  const shiftChartData = [
    { name: 'Day Shift', value: shiftOutputMap['DAY'] || 0 },
    { name: 'Night Shift', value: shiftOutputMap['NIGHT'] || 0 }
  ];

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

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5 flex-wrap gap-2">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Main Menu</span>
        </button>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-bold text-[#1a365d] uppercase tracking-wide m-0">
            Plant Performance Analytics & Scrap Desk
          </h3>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> Date Filter:
        </span>
        {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setDateFilter(filter)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              dateFilter === filter
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {filter === 'ALL'
              ? 'All-Time'
              : filter === 'TODAY'
              ? 'Today'
              : filter === 'WEEK'
              ? 'Past 7 Days'
              : 'Past 30 Days'}
          </button>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Machine Operations Chart */}
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span>Activity by Workstation (Completed Runs & Actions)</span>
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={machineChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="operations" fill="#2b6cb0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Worker Performance Leaderboard */}
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-purple-600" />
            <span>Top Operators / Technicians Leaderboard</span>
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workerChartData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="runs" fill="#805ad5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Scrap Inventory & Sales Management Section */}
      <div className="border-t border-slate-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-600" />
            <h4 className="text-sm font-bold text-slate-900 uppercase">
              Paper Scrap Management & Recycling Sales
            </h4>
          </div>
          <div className="px-3 py-1 bg-rose-100 border border-rose-300 rounded-lg text-xs font-extrabold text-rose-900">
            Available Warehouse Scrap: {availableScrap.toLocaleString()} KG
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Record Scrap Sale Form */}
          <form
            onSubmit={handleRecordScrapSale}
            className="p-4 bg-rose-50/40 border border-rose-200 rounded-xl space-y-3"
          >
            <span className="text-xs font-bold text-rose-950 uppercase block">
              Record Scrap Dispatch / Sale:
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
                  placeholder={`Max: ${availableScrap}`}
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
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
              {(scrapSales || []).length > 0 ? (
                scrapSales.map((sale) => (
                  <div key={sale.id} className="p-3 hover:bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-slate-900">{sale.partyName}</div>
                      <div className="text-[11px] text-slate-500">
                        {sale.date} | {sale.weightKg} KG @ ₹{sale.ratePerKg}/KG
                      </div>
                    </div>
                    <div className="text-right font-extrabold text-emerald-800">
                      ₹{sale.totalAmount.toLocaleString()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-400 italic">No scrap sales recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
