import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Trash2,
  Scissors,
  Cog,
  Scroll,
  SearchCheck,
  TrendingDown,
  DollarSign,
  Download,
  Printer,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  User,
  Factory,
  Eye,
  X,
  Droplets,
  Percent
} from 'lucide-react';
import { FactoryState, ScrapSale } from '../../types';
import { calculateAvailableScrapKg, exportToCSV } from '../../lib/utils';
import { parseAllProductionEvents, NormalizedProductionEvent } from '../../lib/productionAudit';

interface ScrapManagementViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
}

export const ScrapManagementView: React.FC<ScrapManagementViewProps> = ({ state, onBackToHub, onSaveState }) => {
  const [filterStage, setFilterStage] = useState<string>('ALL');
  const [filterProduct, setFilterProduct] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const deletedJobIdsSet = new Set(state.deletedJobIds || []);
  const activeJobs = (state.jobs || []).filter((j) => !deletedJobIdsSet.has(j.id));

  // Dynamic raw material, glue and scrap calculations
  const totalGlueConsumed = useMemo(() => {
    return (state.glueUsageLogs || []).reduce((sum, g) => sum + (g.quantityKg || 0), 0);
  }, [state.glueUsageLogs]);

  const glueByBrand = useMemo(() => {
    const brands: Record<string, number> = {};
    (state.glueUsageLogs || []).forEach((g) => {
      if (g.glueBrand) {
        brands[g.glueBrand] = (brands[g.glueBrand] || 0) + (g.quantityKg || 0);
      }
    });
    return brands;
  }, [state.glueUsageLogs]);

  const slittingScrap = useMemo(() => {
    return activeJobs.reduce((sum, j) => sum + (j.scrapKg || 0), 0);
  }, [activeJobs]);

  const totalPaperInput = useMemo(() => {
    return activeJobs.reduce((sum, j) => sum + (j.inputWeightKg || 0), 0);
  }, [activeJobs]);

  // Selected scrap event for detail inspection modal
  const [selectedScrapEvent, setSelectedScrapEvent] = useState<NormalizedProductionEvent | null>(null);

  // Scrap Sale form state
  const [partyName, setPartyName] = useState<string>('');
  const [scrapSoldKg, setScrapSoldKg] = useState<string>('');
  const [ratePerKg, setRatePerKg] = useState<string>('18');
  const [saleDate, setSaleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const logs = state.logs || [];
  const scrapSales: ScrapSale[] = state.scrapSales || [];

  // Parse all production events
  const allEvents = useMemo(() => parseAllProductionEvents(state), [state]);

  // Extract scrap records from events
  const scrapEvents = useMemo(() => {
    return allEvents.filter((e) => e.scrapKg > 0);
  }, [allEvents]);

  // Total Scrap metrics
  const totalCuttingScrapKg = useMemo(() => {
    return scrapEvents
      .filter((e) => e.stage.toLowerCase() === 'cutting')
      .reduce((sum, e) => sum + e.scrapKg, 0);
  }, [scrapEvents]);

  const totalFormingScrapKg = useMemo(() => {
    return scrapEvents
      .filter((e) => e.stage.toLowerCase() === 'forming')
      .reduce((sum, e) => sum + e.scrapKg, 0);
  }, [scrapEvents]);

  const totalSlittingScrapKg = useMemo(() => {
    return scrapEvents
      .filter((e) => e.stage.toLowerCase() === 'slitting')
      .reduce((sum, e) => sum + e.scrapKg, 0);
  }, [scrapEvents]);

  const totalQcScrapKg = useMemo(() => {
    return scrapEvents
      .filter((e) => e.stage.toLowerCase() === 'qc' || e.stage.toLowerCase() === 'packing')
      .reduce((sum, e) => sum + e.scrapKg, 0);
  }, [scrapEvents]);

  const totalScrapGenerated = totalCuttingScrapKg + totalFormingScrapKg + totalSlittingScrapKg + totalQcScrapKg;
  const netAvailableScrap = calculateAvailableScrapKg(logs, scrapSales, state.deletedJobIds);

  const cuttingScrap = totalCuttingScrapKg;
  const formingScrap = totalFormingScrapKg;
  const cumulativeScrap = totalScrapGenerated;

  const overallWastagePct = useMemo(() => {
    const denom = totalPaperInput + cumulativeScrap;
    return denom > 0 ? Number(((cumulativeScrap / denom) * 100).toFixed(1)) : 0;
  }, [cumulativeScrap, totalPaperInput]);

  // Filtered scrap list for table
  const filteredScrapEvents = useMemo(() => {
    let list = scrapEvents;
    if (filterStage !== 'ALL') {
      list = list.filter((e) => e.stage.toLowerCase() === filterStage.toLowerCase());
    }
    if (filterProduct !== 'ALL') {
      list = list.filter((e) => e.product.toLowerCase() === filterProduct.toLowerCase());
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (e) =>
          (e.jobId || '').toLowerCase().includes(q) ||
          e.machine.toLowerCase().includes(q) ||
          e.operator.toLowerCase().includes(q) ||
          e.product.toLowerCase().includes(q)
      );
    }
    if (startDate) {
      list = list.filter((e) => e.date >= startDate);
    }
    if (endDate) {
      list = list.filter((e) => e.date <= endDate);
    }
    return list;
  }, [scrapEvents, filterStage, filterProduct, searchTerm, startDate, endDate]);

  const handleRecordScrapSale = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(scrapSoldKg);
    const r = parseFloat(ratePerKg);
    if (!partyName.trim() || isNaN(w) || w <= 0 || isNaN(r) || r <= 0) {
      alert('⚠️ Please enter valid Party Name, Quantity (KG), and Rate per KG!');
      return;
    }
    if (w > netAvailableScrap + 10) {
      if (!window.confirm(`⚠️ Sold quantity (${w} KG) exceeds available net scrap (${netAvailableScrap.toFixed(1)} KG). Proceed anyway?`)) {
        return;
      }
    }

    const newSale: ScrapSale = {
      partyName: partyName.trim(),
      weightKg: w,
      soldKg: w,
      ratePerKg: r,
      totalAmount: w * r,
      date: saleDate || new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      user: 'admin'
    };

    const updatedSales = [newSale, ...scrapSales];
    onSaveState({
      ...state,
      scrapSales: updatedSales
    });

    setPartyName('');
    setScrapSoldKg('');
    alert(`✅ Scrap sale of ${w} KG to ${newSale.partyName} recorded successfully! Total: ₹${(newSale.totalAmount || 0).toLocaleString()}`);
  };

  const handleDeleteScrapSale = (index: number) => {
    if (!window.confirm('Are you sure you want to delete this scrap dispatch entry?')) return;
    const updatedSales = scrapSales.filter((_, i) => i !== index);
    onSaveState({
      ...state,
      scrapSales: updatedSales
    });
  };

  const handleExportCSV = () => {
    const rows = filteredScrapEvents.map((e) => ({
      Date: e.date,
      Time: e.timestamp,
      JobId: e.jobId || '',
      Product: e.product,
      Stage: e.stage,
      Machine: e.machine,
      Operator: e.operator,
      'Scrap (KG)': e.scrapKg,
      Action: e.action || ''
    }));
    exportToCSV(`scrap_audit_report_${new Date().toISOString().split('T')[0]}.csv`, rows);
  };

  const handleExportSalesCSV = () => {
    const rows = scrapSales.map((s, idx) => ({
      No: idx + 1,
      Date: s.date || '',
      Time: s.time || '',
      'Party Name': s.partyName || '',
      'Quantity (KG)': s.weightKg || s.soldKg || 0,
      'Rate (₹/KG)': s.ratePerKg || 0,
      'Total Amount (₹)': s.totalAmount || ((s.weightKg || s.soldKg || 0) * (s.ratePerKg || 0))
    }));
    exportToCSV(`scrap_sales_dispatches_${new Date().toISOString().split('T')[0]}.csv`, rows);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 text-white shadow-md px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHub}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight m-0 flex items-center gap-2">
                <span>Scrap Management & Wastage Audit Module</span>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Live Audit
                </span>
              </h1>
              <p className="text-xs text-slate-400 m-0">
                Detailed source tracking for Cutting, Forming, Slitting, and QC Scrap & Wastage
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div 
            onClick={() => { setFilterStage('ALL'); setFilterProduct('ALL'); }}
            className={`rounded-2xl p-4 shadow-sm border flex flex-col justify-between hover:scale-[1.02] hover:shadow-md cursor-pointer transition-all duration-200 ${filterStage === 'ALL' && filterProduct === 'ALL' ? 'border-slate-900 bg-slate-50/50' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide">Total Scrap Generated</span>
              <Trash2 className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {totalScrapGenerated.toLocaleString()} <span className="text-xs font-semibold text-slate-500">KG</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 m-0">Combined from all stages (Click to reset)</p>
          </div>

          <div 
            onClick={() => { setFilterStage('Cutting'); }}
            className={`rounded-2xl p-4 shadow-sm border flex flex-col justify-between hover:scale-[1.02] hover:shadow-md cursor-pointer transition-all duration-200 ${filterStage === 'Cutting' ? 'border-purple-600 bg-purple-50/20' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide">Cutting Scrap</span>
              <Scissors className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-700">
              {totalCuttingScrapKg.toLocaleString()} <span className="text-xs font-semibold text-slate-500">KG</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 m-0">Cutting trim & edge waste (Click to filter)</p>
          </div>

          <div 
            onClick={() => { setFilterStage('Forming'); }}
            className={`rounded-2xl p-4 shadow-sm border flex flex-col justify-between hover:scale-[1.02] hover:shadow-md cursor-pointer transition-all duration-200 ${filterStage === 'Forming' ? 'border-amber-600 bg-amber-50/20' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide">Forming Scrap</span>
              <Cog className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-700">
              {totalFormingScrapKg.toLocaleString()} <span className="text-xs font-semibold text-slate-500">KG</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 m-0">Forming rejection & setup waste (Click to filter)</p>
          </div>

          <div 
            onClick={() => { setFilterStage('QC'); }}
            className={`rounded-2xl p-4 shadow-sm border flex flex-col justify-between hover:scale-[1.02] hover:shadow-md cursor-pointer transition-all duration-200 ${filterStage === 'QC' ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide">Slitting & QC Scrap</span>
              <Scroll className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-indigo-700">
              {(totalSlittingScrapKg + totalQcScrapKg).toLocaleString()} <span className="text-xs font-semibold text-slate-500">KG</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 m-0">Jumbo core & QC rejects (Click to filter)</p>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-800 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide">Net Available Scrap</span>
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-900">
              {netAvailableScrap.toLocaleString()} <span className="text-xs font-semibold text-emerald-700">KG</span>
            </div>
            <p className="text-[11px] text-emerald-700 mt-1 m-0">Ready for sale / recycling</p>
          </div>
        </div>

        {/* Cumulative Raw Material (Glue/Scrap) Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-200">
          
          {/* Column 1: Adhesive Glue Consumption & Auditing */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 m-0">
                    Adhesive Glue Consumption
                  </h3>
                  <p className="text-[11px] text-slate-500 m-0">Live adhesive brand consumption & log audit</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50/40 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-blue-800 font-extrabold uppercase tracking-wider block">Cumulative Glue Consumed</span>
                    <span className="text-3xl font-black text-blue-950">{totalGlueConsumed.toFixed(1)} <span className="text-sm font-bold text-slate-500">KG</span></span>
                  </div>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-1 rounded">
                    Audit Tracked
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase block">Consumption Breakdown by Brand:</span>
                  {Object.keys(glueByBrand).length === 0 ? (
                    <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                      No adhesive glue entries logged yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(glueByBrand).map(([brand, qty]) => (
                        <div key={brand} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                          <span className="text-[10px] text-slate-400 font-bold uppercase truncate">{brand}</span>
                          <span className="text-xs font-black text-slate-800 mt-1">{qty.toFixed(1)} KG</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Cumulative Raw Material Process Scrap & Wastage */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 m-0">
                    Raw Material Wastage & Efficiency
                  </h3>
                  <p className="text-[11px] text-slate-500 m-0">Overall paper processing yield & waste ratios</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-rose-50/40 border border-rose-100 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-rose-800 font-extrabold uppercase tracking-wider block">Overall Wastage Rate</span>
                    <span className="text-3xl font-black text-rose-950">{overallWastagePct}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Process Scrap</span>
                    <b className="text-rose-700 text-sm font-black">{cumulativeScrap.toFixed(1)} KG</b>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Slitting</span>
                    <span className="text-slate-800 font-black">{slittingScrap.toFixed(1)} KG</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Cutting</span>
                    <span className="text-slate-800 font-black">{cuttingScrap.toFixed(1)} KG</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Forming</span>
                    <span className="text-slate-800 font-black">{formingScrap.toFixed(1)} KG</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Section 2: Scrap Sale & Buyer Management */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide m-0 flex items-center gap-2">
                <span>Record Scrap Sale / Dispatch</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Revenue Recovery
                </span>
              </h2>
              <p className="text-xs text-slate-500 m-0">Sell accumulated scrap KG to scrap buyers and update inventory balance</p>
            </div>
          </div>

          <form onSubmit={handleRecordScrapSale} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1 uppercase">Party / Vendor Name *</label>
              <input
                type="text"
                required
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="e.g. Balaji Traders"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1 uppercase">Quantity (KG) *</label>
              <input
                type="number"
                step="0.1"
                required
                value={scrapSoldKg}
                onChange={(e) => setScrapSoldKg(e.target.value)}
                placeholder="e.g. 500"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1 uppercase">Rate (₹ / KG) *</label>
              <input
                type="number"
                step="0.5"
                required
                value={ratePerKg}
                onChange={(e) => setRatePerKg(e.target.value)}
                placeholder="18"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1 uppercase">Sale Date *</label>
              <input
                type="date"
                required
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <DollarSign className="w-4 h-4" />
                <span>Record Sale (₹ {((parseFloat(scrapSoldKg) || 0) * (parseFloat(ratePerKg) || 0)).toLocaleString()})</span>
              </button>
            </div>
          </form>

          {/* Recent Sales History */}
          {scrapSales.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide m-0">Recent Scrap Dispatches</h3>
                <button
                  onClick={handleExportSalesCSV}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Sales CSV</span>
                </button>
              </div>
              <div className="overflow-x-auto max-h-48 border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0">
                    <tr>
                      <th className="p-2.5 font-bold">Date</th>
                      <th className="p-2.5 font-bold">Party Name</th>
                      <th className="p-2.5 font-bold text-right">Quantity (KG)</th>
                      <th className="p-2.5 font-bold text-right">Rate (₹/KG)</th>
                      <th className="p-2.5 font-bold text-right">Total Amount</th>
                      <th className="p-2.5 font-bold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {scrapSales.map((sale, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono text-slate-600">{sale.date}</td>
                        <td className="p-2.5 font-bold text-slate-900">{sale.partyName || 'Scrap Buyer'}</td>
                        <td className="p-2.5 text-right font-bold text-slate-800">{(sale.weightKg || sale.soldKg || 0).toLocaleString()} KG</td>
                        <td className="p-2.5 text-right text-slate-600">₹{sale.ratePerKg || 0}</td>
                        <td className="p-2.5 text-right font-extrabold text-emerald-700">₹{(sale.totalAmount || ((sale.weightKg || sale.soldKg || 0) * (sale.ratePerKg || 0))).toLocaleString()}</td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => handleDeleteScrapSale(index)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                            title="Delete Dispatch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Detailed Scrap Records Table */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide m-0">
                Detailed Scrap Source Breakdown & Logs ({filteredScrapEvents.length} Records)
              </h2>
              <p className="text-xs text-slate-500 m-0">Click any row to inspect exact wastage source, machine, and operator history</p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 outline-none"
              >
                <option value="ALL">All Stages</option>
                <option value="Cutting">Cutting</option>
                <option value="Forming">Forming</option>
                <option value="Slitting">Slitting</option>
                <option value="QC">QC / Packing</option>
              </select>

              <select
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 outline-none"
              >
                <option value="ALL">All Products</option>
                <option value="Spoon">Spoons</option>
                <option value="Fork">Forks</option>
                <option value="Knife">Knives</option>
              </select>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search job, machine, operator..."
                className="p-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none w-48"
              />

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[500px] border border-slate-200 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-900 text-white sticky top-0">
                <tr>
                  <th className="p-3 font-bold">Date & Time</th>
                  <th className="p-3 font-bold">Stage / Dept</th>
                  <th className="p-3 font-bold">Machine</th>
                  <th className="p-3 font-bold">Job ID & Product</th>
                  <th className="p-3 font-bold">Operator</th>
                  <th className="p-3 font-bold text-right">Scrap Quantity (KG)</th>
                  <th className="p-3 font-bold">Production Action</th>
                  <th className="p-3 font-bold text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredScrapEvents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">
                      No scrap records found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredScrapEvents.map((ev, index) => (
                    <tr
                      key={index}
                      onClick={() => setSelectedScrapEvent(ev)}
                      className="hover:bg-amber-50/60 transition cursor-pointer"
                    >
                      <td className="p-3 text-slate-600 font-mono">
                        <div>{ev.date}</div>
                        <div className="text-[10px] text-slate-400">{ev.timestamp}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            ev.stage.toLowerCase() === 'cutting'
                              ? 'bg-purple-100 text-purple-800'
                              : ev.stage.toLowerCase() === 'forming'
                              ? 'bg-amber-100 text-amber-800'
                              : ev.stage.toLowerCase() === 'slitting'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-cyan-100 text-cyan-800'
                          }`}
                        >
                          {ev.stage}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">{ev.machine}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{ev.jobId || 'N/A'}</div>
                        <div className="text-[10px] text-slate-500">{ev.product}</div>
                      </td>
                      <td className="p-3 font-semibold text-slate-700">{ev.operator}</td>
                      <td className="p-3 text-right">
                        <div className="font-black text-rose-600 text-sm">{ev.scrapKg.toLocaleString()} KG</div>
                        {ev.scrapPieces > 0 && (
                          <div className="text-[10px] text-slate-400 font-bold">({ev.scrapPieces.toLocaleString()} Pcs)</div>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 italic text-[11px] truncate max-w-xs">{ev.action}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedScrapEvent(ev);
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Detailed Scrap Inspection Modal */}
      {selectedScrapEvent && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 m-0">Scrap & Wastage Audit Source</h3>
                  <p className="text-xs text-slate-500 m-0">Detailed breakdown of wastage event</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedScrapEvent(null)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">Stage / Department</span>
                  <span className="font-extrabold text-slate-900 uppercase">{selectedScrapEvent.stage}</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">Machine ID</span>
                  <span className="font-extrabold text-slate-900">{selectedScrapEvent.machine}</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">Job ID</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedScrapEvent.jobId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">Product Name</span>
                  <span className="font-bold text-slate-900">{selectedScrapEvent.product}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">Assigned Operator</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    {selectedScrapEvent.operator}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block">Timestamp</span>
                  <span className="font-mono font-bold text-slate-700">{selectedScrapEvent.date} {selectedScrapEvent.timestamp}</span>
                </div>
              </div>

              <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-extrabold text-rose-800 uppercase tracking-wide block">Scrap Wastage Generated</span>
                  <span className="text-2xl font-black text-rose-700">{selectedScrapEvent.scrapKg} KG</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wide block">Shift</span>
                  <span className="text-sm font-bold text-rose-900 uppercase">{selectedScrapEvent.shift}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide block mb-1">Exact Production Log Action</span>
                <div className="p-3 bg-slate-900 text-slate-100 font-mono text-xs rounded-xl overflow-x-auto">
                  {selectedScrapEvent.action}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedScrapEvent(null)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
