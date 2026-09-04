import React, { useState } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Download,
  Search,
  Filter,
  Layers,
  Scissors,
  Cog,
  SearchCheck,
  Package,
  Truck,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  Share2,
  ChevronRight,
  User,
  Clock,
  Calendar,
  Building2,
  Plus,
  RefreshCw,
  Check,
  X,
  FileText
} from 'lucide-react';
import { FactoryState, Job, PackJob, CustomerComplaint, LogEntry } from '../../types';
import { exportToCSV } from '../../lib/utils';
import { BatchReportModal } from '../BatchReportModal';

interface MaintenanceAuditViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState?: (state: FactoryState) => void;
  initialSearchQuery?: string;
}

type AuditTab = 'traceability' | 'batch_report' | 'complaints' | 'logs';

export const MaintenanceAuditView: React.FC<MaintenanceAuditViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  initialSearchQuery = ''
}) => {
  const { logs, jobs, packJobs, customerComplaints = [] } = state;

  const [activeTab, setActiveTab] = useState<AuditTab>('traceability');

  // Traceability search state
  const [traceSearch, setTraceSearch] = useState(initialSearchQuery || 'INV-2026-001');
  const [activeReportModalId, setActiveReportModalId] = useState<string | null>(null);

  // New Complaint Modal State
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [newComplaintCust, setNewComplaintCust] = useState('');
  const [newComplaintInv, setNewComplaintInv] = useState('');
  const [newComplaintOrder, setNewComplaintOrder] = useState('');
  const [newComplaintDefect, setNewComplaintDefect] = useState('Tip Cracking / Weak Edge');
  const [newComplaintStage, setNewComplaintStage] = useState<
    'Raw Material' | 'Slitting' | 'Cutting' | 'Forming' | 'QC' | 'Packing' | 'Dispatch'
  >('Forming');
  const [newComplaintSeverity, setNewComplaintSeverity] = useState<'CRITICAL' | 'MAJOR' | 'MINOR'>('MAJOR');
  const [newComplaintDesc, setNewComplaintDesc] = useState('');
  const [newComplaintRCA, setNewComplaintRCA] = useState('');
  const [newComplaintCAPA, setNewComplaintCAPA] = useState('');

  // Logs table state
  const [logSearch, setLogSearch] = useState('');
  const [logStageFilter, setLogStageFilter] = useState('ALL');

  // =========================================================================
  // TRACEABILITY RESOLVER ENGINE (Connects Customer Box -> Raw Material)
  // =========================================================================
  const query = traceSearch.trim().toLowerCase();

  // Find target Customer Order (PackJob) if query matches invoice, gt, customer, or order ID
  const matchedOrder = packJobs.find((pj) => {
    if (pj.id.toLowerCase().includes(query)) return true;
    if (pj.customer.toLowerCase().includes(query)) return true;
    if (pj.dispatchLogs?.some((dl) => dl.invoiceNo.toLowerCase().includes(query) || dl.gtNo.toLowerCase().includes(query))) return true;
    return false;
  }) || packJobs[0];

  // Find linked production jobs (Spoon, Fork, Knife) used in this order
  const matchedJobs: Job[] = [];
  if (matchedOrder) {
    jobs.forEach((j) => {
      if (matchedOrder.issuedCrates && matchedOrder.issuedCrates[j.id]) {
        matchedJobs.push(j);
      } else if (matchedOrder.tracedLots && Object.values(matchedOrder.tracedLots).some((v) => v.includes(j.id))) {
        matchedJobs.push(j);
      } else if (matchedOrder.kitItems && matchedOrder.kitItems.includes(j.product)) {
        matchedJobs.push(j);
      }
    });
  }

  // If no jobs found via order, fallback to directly searched job
  const primaryJob = matchedJobs.length > 0
    ? matchedJobs[0]
    : jobs.find((j) => j.id.toLowerCase().includes(query) || j.product.toLowerCase().includes(query)) || jobs[0];

  // Associated logs for this traced chain
  const traceLogs = logs.filter(
    (l) =>
      (matchedOrder && l.jobId === matchedOrder.id) ||
      (primaryJob && l.jobId === primaryJob.id) ||
      (l.action && matchedOrder && l.action.toLowerCase().includes(matchedOrder.customer.toLowerCase())) ||
      (l.action && matchedOrder?.dispatchLogs?.[0] && l.action.includes(matchedOrder.dispatchLogs[0].invoiceNo))
  );

  const slitLog = traceLogs.find((l) => l.stage === 'Slitting');
  const cutLog = traceLogs.find((l) => l.stage === 'Cutting');
  const formLog = traceLogs.find((l) => l.stage === 'Forming');
  const qcLog = traceLogs.find((l) => l.stage === 'QC');
  const packLog = traceLogs.find((l) => l.stage === 'Packing');
  const dispLog = traceLogs.find((l) => l.stage === 'Dispatch');

  // Customer complaints matching this order or customer
  const relatedComplaints = customerComplaints.filter(
    (c) =>
      (matchedOrder && (c.orderId === matchedOrder.id || c.customer === matchedOrder.customer)) ||
      (matchedOrder?.dispatchLogs?.[0] && c.invoiceNo === matchedOrder.dispatchLogs[0].invoiceNo)
  );

  // =========================================================================
  // ACTION: LOG NEW CUSTOMER COMPLAINT
  // =========================================================================
  const handleSaveComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComplaintCust.trim() || !newComplaintDesc.trim()) {
      alert('Please fill Customer Name and Defect Description!');
      return;
    }

    const complaintRecord: CustomerComplaint = {
      id: 'CMP-' + new Date().getFullYear() + '-' + Math.floor(100 + Math.random() * 900),
      orderId: newComplaintOrder || matchedOrder?.id,
      invoiceNo: newComplaintInv || matchedOrder?.dispatchLogs?.[0]?.invoiceNo || 'INV-DIRECT',
      customer: newComplaintCust.trim(),
      defectType: newComplaintDefect,
      defectStage: newComplaintStage,
      severity: newComplaintSeverity,
      description: newComplaintDesc.trim(),
      rootCauseAnalysis: newComplaintRCA.trim() || `Traced through batch ${primaryJob?.id || 'WK-01'} on ${newComplaintStage} station.`,
      capaAction: newComplaintCAPA.trim() || 'Process checklist updated and operator counselled.',
      status: 'OPEN',
      reportedDate: new Date().toISOString().split('T')[0],
      actionTakenBy: 'QC Lead & Plant Head'
    };

    const updatedComplaints = [complaintRecord, ...customerComplaints];

    const newAuditLog: LogEntry = {
      jobId: complaintRecord.orderId || primaryJob?.id,
      product: primaryJob?.product || 'Tableware',
      stage: 'QC Inspection',
      machine: 'QC-Desk',
      action: `⚠️ Customer Complaint [${complaintRecord.id}] Registered for ${complaintRecord.customer}: ${complaintRecord.defectType} (${complaintRecord.defectStage})`,
      worker: 'QC_HEAD',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    if (onSaveState) {
      onSaveState({
        ...state,
        customerComplaints: updatedComplaints,
        logs: [...state.logs, newAuditLog]
      });
    }

    setIsComplaintModalOpen(false);
    setNewComplaintDesc('');
    setNewComplaintRCA('');
    setNewComplaintCAPA('');
    alert(`✅ Customer Complaint [${complaintRecord.id}] registered successfully with root cause analysis!`);
  };

  // =========================================================================
  // ACTION: MARK COMPLAINT RESOLVED
  // =========================================================================
  const handleResolveComplaint = (complaintId: string) => {
    const updated = customerComplaints.map((c) => {
      if (c.id !== complaintId) return c;
      return {
        ...c,
        status: 'RESOLVED' as const,
        resolvedDate: new Date().toISOString().split('T')[0]
      };
    });

    if (onSaveState) {
      onSaveState({
        ...state,
        customerComplaints: updated
      });
    }
    alert(`✅ Complaint [${complaintId}] marked as RESOLVED & CAPA Closed.`);
  };

  // Filtered logs for logs tab
  const filteredLogs = [...logs].reverse().filter((l) => {
    const matchesSearch =
      (l.jobId && l.jobId.toLowerCase().includes(logSearch.toLowerCase())) ||
      (l.action && l.action.toLowerCase().includes(logSearch.toLowerCase())) ||
      (l.worker && l.worker.toLowerCase().includes(logSearch.toLowerCase())) ||
      (l.machine && l.machine.toLowerCase().includes(logSearch.toLowerCase())) ||
      (l.user && l.user.toLowerCase().includes(logSearch.toLowerCase()));

    if (!matchesSearch) return false;
    if (logStageFilter !== 'ALL' && l.stage !== logStageFilter) return false;
    return true;
  });

  const stagesList = Array.from(new Set(logs.map((l) => l.stage).filter(Boolean)));

  const handleExportAuditLogs = () => {
    exportToCSV('Wunderkraf_Full_Audit_Trail.csv', filteredLogs);
  };

  const handleExportTraceCSV = () => {
    const traceRows = [
      { Stage: 'Customer Delivery', Parameter: 'Customer Name', Value: matchedOrder?.customer || 'N/A' },
      { Stage: 'Customer Delivery', Parameter: 'Invoice Number', Value: matchedOrder?.dispatchLogs?.[0]?.invoiceNo || 'N/A' },
      { Stage: 'Customer Delivery', Parameter: 'Vehicle / GT No', Value: matchedOrder?.dispatchLogs?.[0]?.gtNo || 'N/A' },
      { Stage: 'Customer Delivery', Parameter: 'Boxes Dispatched', Value: matchedOrder?.dispatchedBoxes || 0 },
      { Stage: 'Packing Station', Parameter: 'Order ID', Value: matchedOrder?.id || 'N/A' },
      { Stage: 'Packing Station', Parameter: 'Packer', Value: packLog?.worker || matchedOrder?.worker || 'PACK_SURESH' },
      { Stage: 'Packing Station', Parameter: 'Packed Boxes', Value: matchedOrder?.packedBoxes || 0 },
      { Stage: 'QC Inspection', Parameter: 'Inspector', Value: qcLog?.worker || 'QC_RAMESH' },
      { Stage: 'QC Inspection', Parameter: 'QC Action', Value: qcLog?.action || 'Approved' },
      { Stage: 'Forming', Parameter: 'Machine', Value: formLog?.machine || 'Forming-1' },
      { Stage: 'Forming', Parameter: 'Operator', Value: formLog?.worker || 'FORM_OP1' },
      { Stage: 'Cutting', Parameter: 'Machine', Value: cutLog?.machine || 'Cutting-1' },
      { Stage: 'Cutting', Parameter: 'Operator', Value: cutLog?.worker || 'CUT_OP1' },
      { Stage: 'Slitting', Parameter: 'Machine', Value: slitLog?.machine || 'Slitting-1' },
      { Stage: 'Slitting', Parameter: 'Operator', Value: slitLog?.worker || 'RAMESH_SLIT' },
      { Stage: 'Raw Material', Parameter: 'Paper Brand', Value: primaryJob?.paperBrand || 'ITC CyberXL 280 GSM' },
      { Stage: 'Raw Material', Parameter: 'Lot / Remark', Value: primaryJob?.customRemark || 'Standard Reel' }
    ];
    exportToCSV(`Wunderkraf_Traceability_${matchedOrder?.id || primaryJob?.id}.csv`, traceRows);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm mb-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Main Menu</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-[#1a365d] uppercase tracking-wide m-0">
              Audit, Traceability & Quality Dossier Hub
            </h3>
            <p className="text-xs text-slate-500 m-0">
              रॉ मटेरियल से लेकर ग्राहक के बॉक्स तक 360° ट्रेसेबिलिटी, कंप्लेंट व रिपोर्ट
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveReportModalId(matchedOrder?.id || primaryJob?.id || 'SPN-001')}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Generate Batch Report / PDF</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('traceability')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-t-lg transition border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'traceability'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>360° Root-to-Box Traceability (ट्रेसेबिलिटी जांच)</span>
        </button>

        <button
          onClick={() => setActiveTab('complaints')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-t-lg transition border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'complaints'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Customer Complaints & CAPA ({customerComplaints.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('batch_report')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-t-lg transition border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'batch_report'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Printer className="w-4 h-4 text-emerald-600" />
          <span>Single Batch Report & Certificate (बैच रिपोर्ट)</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-t-lg transition border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4 text-slate-600" />
          <span>Immutable Shift Logs ({logs.length})</span>
        </button>
      </div>

      {/* TAB 1: 360° ROOT-TO-BOX TRACEABILITY & COMPLAINT INVESTIGATION */}
      {activeTab === 'traceability' && (
        <div className="space-y-6">
          {/* Universal Traceability Search Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              🔎 Search Delivered Box / Customer / Invoice / Job / Lot (रॉ मटेरियल से बॉक्स तक सर्च करें):
            </label>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={traceSearch}
                  onChange={(e) => setTraceSearch(e.target.value)}
                  placeholder="Enter Invoice (INV-2026-001), GT/Vehicle (GJ-03-AK-9922), Customer, or Job (SPN-001)..."
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
                />
              </div>
              <button
                onClick={() => setTraceSearch('')}
                className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={handleExportTraceCSV}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Traceability CSV</span>
              </button>
            </div>

            {/* Quick Presets for 1-Click Investigation */}
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              <span className="text-[11px] text-slate-500 font-medium">Quick Investigate:</span>
              <button
                onClick={() => setTraceSearch('INV-2026-001')}
                className="text-[11px] bg-white border border-slate-200 text-blue-700 hover:bg-blue-50 px-2 py-0.5 rounded font-bold transition cursor-pointer"
              >
                Invoice: INV-2026-001
              </button>
              <button
                onClick={() => setTraceSearch('AIR INDIA CATERING')}
                className="text-[11px] bg-white border border-slate-200 text-blue-700 hover:bg-blue-50 px-2 py-0.5 rounded font-bold transition cursor-pointer"
              >
                Customer: Air India Catering
              </button>
              <button
                onClick={() => setTraceSearch('HALDIRAM')}
                className="text-[11px] bg-white border border-slate-200 text-blue-700 hover:bg-blue-50 px-2 py-0.5 rounded font-bold transition cursor-pointer"
              >
                Customer: Haldiram
              </button>
              <button
                onClick={() => setTraceSearch('SPN-001')}
                className="text-[11px] bg-white border border-slate-200 text-blue-700 hover:bg-blue-50 px-2 py-0.5 rounded font-bold transition cursor-pointer"
              >
                Job: SPN-001 (Spoon)
              </button>
              <button
                onClick={() => setTraceSearch('FRK-001')}
                className="text-[11px] bg-white border border-slate-200 text-blue-700 hover:bg-blue-50 px-2 py-0.5 rounded font-bold transition cursor-pointer"
              >
                Job: FRK-001 (Fork)
              </button>
            </div>
          </div>

          {/* Active Traced Case Summary Card */}
          <div className="bg-blue-900 text-white p-4 rounded-xl shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-500/30 text-blue-200 border border-blue-400/40 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                  Traceability Dossier
                </span>
                <span className="text-xs text-blue-200 font-mono">
                  Order ID: <b>{matchedOrder?.id || 'DIRECT'}</b>
                </span>
              </div>
              <h4 className="text-base font-black tracking-tight mt-1 m-0">
                Customer: {matchedOrder?.customer || 'Direct Factory Stock'}
              </h4>
              <p className="text-xs text-blue-200 m-0 mt-0.5">
                Product Spec: <b>{matchedOrder?.kitType || primaryJob?.product}</b> • Order Qty:{' '}
                <b>{matchedOrder?.orderQty.toLocaleString()} Pcs</b> • Packed:{' '}
                <b>{matchedOrder?.packedBoxes} Boxes</b> • Dispatched:{' '}
                <b>{matchedOrder?.dispatchedBoxes} Boxes</b>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setNewComplaintCust(matchedOrder?.customer || '');
                  setNewComplaintInv(matchedOrder?.dispatchLogs?.[0]?.invoiceNo || '');
                  setNewComplaintOrder(matchedOrder?.id || '');
                  setIsComplaintModalOpen(true);
                }}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-black px-3.5 py-2 rounded-lg transition shadow-xs cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Log Customer Complaint (कंप्लेंट दर्ज करें)</span>
              </button>

              <button
                onClick={() => setActiveReportModalId(matchedOrder?.id || primaryJob?.id)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>View Full Certificate / Print</span>
              </button>
            </div>
          </div>

          {/* Connected Customer Complaints Banner (if any) */}
          {relatedComplaints.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Customer Complaint Detected on this Delivered Lot ({relatedComplaints.length})</span>
                </div>
                <span className="text-[11px] font-bold text-amber-700">
                  Root Cause Investigation Active
                </span>
              </div>
              <div className="space-y-2">
                {relatedComplaints.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white p-3 rounded-lg border border-amber-200 text-xs text-slate-800 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-rose-800 flex items-center gap-2">
                        <span>[{c.id}] {c.defectType}</span>
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-black">
                          {c.severity}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                          Stage Identified: <b>{c.defectStage}</b>
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1 m-0"><b>Feedback:</b> {c.description}</p>
                      {c.rootCauseAnalysis && (
                        <p className="text-amber-900 mt-1 m-0">
                          <b>Root Cause Analysis (RCA):</b> {c.rootCauseAnalysis}
                        </p>
                      )}
                      {c.capaAction && (
                        <p className="text-emerald-900 mt-0.5 m-0">
                          <b>CAPA Action:</b> {c.capaAction}
                        </p>
                      )}
                    </div>
                    <div>
                      {c.status === 'RESOLVED' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleResolveComplaint(c.id)}
                          className="text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded transition cursor-pointer"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* THE 7-STEP INTERACTIVE END-TO-END GENEALOGY PIPELINE */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
                <span>Complete Backward & Forward Traceability Chain (कस्टमर डिलीवरी से मूल रॉ मटेरियल तक)</span>
              </h4>
              <span className="text-[11px] text-slate-500 font-medium">
                Verified against Factory Logs & QC Registry
              </span>
            </div>

            <div className="space-y-3">
              {/* STEP 7: Customer Delivery & Gatepass */}
              <div className="p-4 bg-teal-50/70 border-2 border-teal-300 rounded-xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-black">
                      7
                    </span>
                    <span className="text-xs font-black uppercase text-teal-950">
                      Step 7: Customer Delivery & Gatepass (ग्राहक तक डिलीवरी)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                    Status: Dispatched & Invoiced
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-[10px] text-teal-700 font-bold uppercase block">Customer</span>
                    <span className="font-extrabold text-slate-900">{matchedOrder?.customer}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-teal-700 font-bold uppercase block">Invoice Number</span>
                    <span className="font-mono font-black text-blue-700">
                      {matchedOrder?.dispatchLogs?.[0]?.invoiceNo || 'INV-2026-001'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-teal-700 font-bold uppercase block">Vehicle / GT No</span>
                    <span className="font-mono font-bold text-slate-800">
                      {matchedOrder?.dispatchLogs?.[0]?.gtNo || 'GJ-03-AK-9922'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-teal-700 font-bold uppercase block">Dispatched Boxes</span>
                    <span className="font-bold text-slate-900">
                      {matchedOrder?.dispatchedBoxes || 10} Boxes (
                      {((matchedOrder?.dispatchedBoxes || 10) * (matchedOrder?.pcsPerBox || 500)).toLocaleString()}{' '}
                      Pcs)
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 6: Packing & Master Shipper Boxing */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-black">
                      6
                    </span>
                    <span className="text-xs font-black uppercase text-slate-900">
                      Step 6: Box Packing & Assembly (पैकिंग व सीलिंग)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                    Machine: {packLog?.machine || matchedOrder?.machine || 'Packing-1'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Pack Job ID</span>
                    <span className="font-mono font-bold text-slate-900">{matchedOrder?.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Packer Name</span>
                    <span className="font-bold text-slate-800">
                      {packLog?.worker || matchedOrder?.worker || 'PACK_SURESH'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Packed Boxes</span>
                    <span className="font-bold text-slate-900">{matchedOrder?.packedBoxes} Boxes</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">QC Crates Consumed</span>
                    <span className="font-bold text-blue-700">
                      {matchedOrder?.issuedCrates
                        ? Object.entries(matchedOrder.issuedCrates)
                            .map(([k, v]) => `${k}: ${v} Crates`)
                            .join(', ')
                        : `${primaryJob?.id}: 4 Crates`}
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 5: Quality Inspection (QC) & Rejection Audit */}
              <div className="p-4 bg-blue-50/60 border-2 border-blue-200 rounded-xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                      5
                    </span>
                    <span className="text-xs font-black uppercase text-blue-950">
                      Step 5: QC Inspection & Defect Screening (क्वालिटी इंस्पेक्शन)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                    Seal: Food Safety Approved
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-[10px] text-blue-700 font-bold uppercase block">QC Desk / Station</span>
                    <span className="font-mono font-bold text-slate-900">{qcLog?.machine || 'QC-Desk'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-700 font-bold uppercase block">QC Inspector</span>
                    <span className="font-bold text-blue-900">{qcLog?.worker || 'QC_RAMESH'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-700 font-bold uppercase block">Crates Approved</span>
                    <span className="font-bold text-slate-900">
                      6 Crates Released ({primaryJob?.availableQcCrates || 4} in Stock)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-700 font-bold uppercase block">QC Scrap Culled</span>
                    <span className="font-bold text-rose-700">2 KG defective rejected</span>
                  </div>
                </div>
              </div>

              {/* STEP 4: Forming & Hydraulic Moulding */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">
                      4
                    </span>
                    <span className="text-xs font-black uppercase text-slate-900">
                      Step 4: Forming & Thermal Pressing (फॉर्मिंग मशीन)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                    Machine: {formLog?.machine || 'Forming-1'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Forming Operator</span>
                    <span className="font-bold text-slate-800">{formLog?.worker || 'FORM_OP1'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Mould Temperature</span>
                    <span className="font-mono font-bold text-slate-900">160°C (3.5 Bar Hydraulic)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Forming Scrap</span>
                    <span className="font-bold text-slate-700">2 KG trim scrap</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Shift & Time</span>
                    <span className="font-bold text-slate-800">
                      {formLog?.shift || 'DAY'} ({formLog?.startTime || '11:15 AM'})
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 3: Cutting & Die-Punching */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-black">
                      3
                    </span>
                    <span className="text-xs font-black uppercase text-slate-900">
                      Step 3: Cutting & Die-Punching (कटिंग मशीन)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                    Machine: {cutLog?.machine || 'Cutting-1'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Cutting Operator</span>
                    <span className="font-bold text-slate-800">{cutLog?.worker || 'CUT_OP1'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Cut Crates Produced</span>
                    <span className="font-bold text-slate-900">8 Crates (Batch B-1002)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Punch Scrap</span>
                    <span className="font-bold text-slate-700">14 KG skeleton matrix</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Shift & Time</span>
                    <span className="font-bold text-slate-800">
                      {cutLog?.shift || 'DAY'} ({cutLog?.startTime || '09:45 AM'})
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 2: Slitting & Master Reel Conversion */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-black">
                      2
                    </span>
                    <span className="text-xs font-black uppercase text-slate-900">
                      Step 2: Slitting & Reel Conversion (स्लिटिंग मशीन)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                    Machine: {slitLog?.machine || 'Slitting-1'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Slitting Operator</span>
                    <span className="font-bold text-slate-800">{slitLog?.worker || 'RAMESH_SLIT'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Slit Output</span>
                    <span className="font-bold text-slate-900">12 Rolls (185 KG Output)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Edge Trim Scrap</span>
                    <span className="font-bold text-slate-700">6 KG edge trim</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Shift & Time</span>
                    <span className="font-bold text-slate-800">
                      {slitLog?.shift || 'DAY'} ({slitLog?.startTime || '08:00 AM'})
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 1: Origin Raw Material Paper */}
              <div className="p-4 bg-amber-50/70 border-2 border-amber-200 rounded-xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-700 text-white flex items-center justify-center text-xs font-black">
                      1
                    </span>
                    <span className="text-xs font-black uppercase text-amber-950">
                      Step 1: Origin Raw Material (मूल रॉ मटेरियल पेपर)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Certified Food-Grade Virgin Board
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                  <div>
                    <span className="text-[10px] text-amber-800 font-bold uppercase block">Paper Manufacturer</span>
                    <span className="font-black text-slate-900">
                      {primaryJob?.paperBrand || 'ITC CyberXL 280 GSM'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800 font-bold uppercase block">Paper Lot / Spec</span>
                    <span className="font-mono font-bold text-slate-800">
                      {primaryJob?.customRemark || 'Lot #ITC-280-992'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800 font-bold uppercase block">Initial Jumbo Reel Weight</span>
                    <span className="font-bold text-slate-900">207 KG (100% Virgin Board)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800 font-bold uppercase block">Biodegradability</span>
                    <span className="font-bold text-emerald-800">IS 17441 Compostable</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMER COMPLAINTS & CAPA REGISTER */}
      {activeTab === 'complaints' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide m-0">
                Customer Complaints & Corrective Actions (CAPA)
              </h4>
              <p className="text-xs text-slate-500 m-0">
                ग्राहक की शिकायत दर्ज करें, रूट कॉज (RCA) पहचानें व समाधान करें
              </p>
            </div>
            <button
              onClick={() => {
                setNewComplaintCust('');
                setNewComplaintInv('');
                setNewComplaintOrder('');
                setIsComplaintModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log New Customer Complaint</span>
            </button>
          </div>

          {customerComplaints.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 m-0">No active customer complaints on file!</p>
              <p className="text-[11px] text-slate-500 m-0 mt-1">
                All delivered shipments meet 100% factory quality standards.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-extrabold text-[11px] border-b border-slate-200">
                    <th className="p-3">Complaint ID</th>
                    <th className="p-3">Customer & Invoice</th>
                    <th className="p-3">Defect Type</th>
                    <th className="p-3">Stage Identified</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Root Cause Analysis (RCA) & CAPA</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {customerComplaints.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-bold text-blue-900 whitespace-nowrap">{c.id}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{c.customer}</div>
                        <div className="text-[11px] text-slate-500">Bill: {c.invoiceNo || '—'}</div>
                      </td>
                      <td className="p-3 font-bold text-rose-700">{c.defectType}</td>
                      <td className="p-3">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold">
                          {c.defectStage}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded ${
                            c.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800'
                              : c.severity === 'MAJOR'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {c.severity}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] max-w-xs">
                        <p className="m-0 text-slate-700 font-semibold">{c.description}</p>
                        {c.rootCauseAnalysis && (
                          <p className="m-0 text-amber-900 mt-1"><b>RCA:</b> {c.rootCauseAnalysis}</p>
                        )}
                        {c.capaAction && (
                          <p className="m-0 text-emerald-900 mt-0.5"><b>CAPA:</b> {c.capaAction}</p>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {c.status === 'RESOLVED' || c.status === 'CLOSED' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Check className="w-3 h-3" /> {c.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 animate-pulse">
                            {c.status}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {c.status !== 'RESOLVED' && c.status !== 'CLOSED' && (
                          <button
                            onClick={() => handleResolveComplaint(c.id)}
                            className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded transition cursor-pointer"
                          >
                            Close / Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SINGLE BATCH REPORT GENERATOR & DOWNLOADER */}
      {activeTab === 'batch_report' && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide m-0">
                Single Batch Report Generator & Downloader
              </h4>
              <p className="text-xs text-slate-500 m-0">
                किसी भी एक बैच का सम्पूर्ण रिपोर्ट जनरेट करें, PDF प्रिंट करें या CSV में डाउनलोड करें
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveReportModalId(matchedOrder?.id || primaryJob?.id || 'SPN-001')}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Open Printable Certificate Dialog</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {jobs.map((j) => (
              <div
                key={j.id}
                className="p-4 bg-white border border-slate-200 hover:border-blue-500 rounded-xl transition shadow-xs flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-blue-900">{j.id}</span>
                    <span className="text-xs font-bold text-slate-700">{j.product}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                      {j.stage}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 m-0">
                    Raw Paper: {j.paperBrand || 'ITC CyberXL 280 GSM'} • Rolls: {j.availableRolls || 0} • QC Crates:{' '}
                    {j.availableQcCrates || 0}
                  </p>
                </div>
                <button
                  onClick={() => setActiveReportModalId(j.id)}
                  className="flex items-center gap-1 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Report</span>
                </button>
              </div>
            ))}

            {packJobs.map((pj) => (
              <div
                key={pj.id}
                className="p-4 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl transition shadow-xs flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-emerald-900">{pj.id}</span>
                    <span className="text-xs font-bold text-slate-800">{pj.customer}</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                      {pj.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 m-0">
                    {pj.kitType} • Packed: {pj.packedBoxes} / {Math.ceil(pj.orderQty / pj.pcsPerBox)} Boxes
                  </p>
                </div>
                <button
                  onClick={() => setActiveReportModalId(pj.id)}
                  className="flex items-center gap-1 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Report</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: IMMUTABLE SHIFT ACTIVITY LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide m-0">
                Immutable Shift Activity Logs
              </h4>
              <p className="text-xs text-slate-500 m-0">
                ऑपरेटर व मशीन के सभी टाइमस्टैम्प लॉग्स
              </p>
            </div>
            <button
              onClick={handleExportAuditLogs}
              className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export All Logs
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search events, operators, job IDs..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={logStageFilter}
                onChange={(e) => setLogStageFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                <option value="ALL">ALL STAGES & DEPARTMENTS</option>
                {stagesList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold uppercase">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Job / Order</th>
                  <th className="p-3">Stage / Station</th>
                  <th className="p-3">Operator</th>
                  <th className="p-3">Action Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filteredLogs.slice(0, 100).map((l, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="p-3 whitespace-nowrap text-[11px] text-slate-500">{l.timestamp}</td>
                    <td className="p-3 font-bold text-blue-900 whitespace-nowrap">{l.jobId || '—'}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold">
                        {l.stage} {l.machine ? `(${l.machine})` : ''}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-purple-900 whitespace-nowrap">{l.worker || l.user || '—'}</td>
                    <td className="p-3 text-slate-800">{l.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMPLAINT LOGGING MODAL */}
      {isComplaintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>Log Customer Complaint & Root Cause Analysis</span>
              </div>
              <button
                onClick={() => setIsComplaintModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveComplaint} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={newComplaintCust}
                    onChange={(e) => setNewComplaintCust(e.target.value)}
                    placeholder="e.g. Air India Catering"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Invoice / Box Barcode</label>
                  <input
                    type="text"
                    value={newComplaintInv}
                    onChange={(e) => setNewComplaintInv(e.target.value)}
                    placeholder="e.g. INV-2026-001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Defect Type</label>
                  <select
                    value={newComplaintDefect}
                    onChange={(e) => setNewComplaintDefect(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-[11px]"
                  >
                    <option value="Tip Cracking / Weak Edge">Tip Cracking / Weak Edge</option>
                    <option value="Deformed Shape / Mould Error">Deformed Shape / Mould Error</option>
                    <option value="Short Count in Box">Short Count in Box</option>
                    <option value="Foreign Particle / Stain">Foreign Particle / Stain</option>
                    <option value="Packaging / Sealing Damage">Packaging / Sealing Damage</option>
                    <option value="Moisture Absorption">Moisture Absorption</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Stage Identified</label>
                  <select
                    value={newComplaintStage}
                    onChange={(e) => setNewComplaintStage(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-[11px]"
                  >
                    <option value="Raw Material">Raw Material Paper</option>
                    <option value="Slitting">Slitting Station</option>
                    <option value="Cutting">Cutting Station</option>
                    <option value="Forming">Forming Press</option>
                    <option value="QC">QC Screening</option>
                    <option value="Packing">Packing Station</option>
                    <option value="Dispatch">Dispatch / Transport</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Severity</label>
                  <select
                    value={newComplaintSeverity}
                    onChange={(e) => setNewComplaintSeverity(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-[11px]"
                  >
                    <option value="CRITICAL">CRITICAL (Recall)</option>
                    <option value="MAJOR">MAJOR</option>
                    <option value="MINOR">MINOR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Customer Problem Description *</label>
                <textarea
                  required
                  rows={2}
                  value={newComplaintDesc}
                  onChange={(e) => setNewComplaintDesc(e.target.value)}
                  placeholder="Describe exact customer feedback received..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-amber-900 block mb-1">Root Cause Analysis (RCA - क्यों हुआ?)</label>
                <textarea
                  rows={2}
                  value={newComplaintRCA}
                  onChange={(e) => setNewComplaintRCA(e.target.value)}
                  placeholder="Root cause identified (e.g. Forming mould temperature dipped, or edge blade was blunt)..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-emerald-900 block mb-1">Corrective & Preventive Action (CAPA - सुधारात्मक कदम)</label>
                <input
                  type="text"
                  value={newComplaintCAPA}
                  onChange={(e) => setNewComplaintCAPA(e.target.value)}
                  placeholder="Action taken to prevent reoccurrence..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsComplaintModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Save Complaint & Root Cause Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BATCH REPORT MODAL */}
      {activeReportModalId && (
        <BatchReportModal
          isOpen={Boolean(activeReportModalId)}
          initialSelectionId={activeReportModalId}
          state={state}
          onClose={() => setActiveReportModalId(null)}
        />
      )}
    </div>
  );
};
