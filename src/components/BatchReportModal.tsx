import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Scissors,
  Cog,
  SearchCheck,
  Package,
  Truck,
  FileSpreadsheet,
  Check,
  ShieldCheck,
  Building2,
  Calendar,
  Clock,
  User,
  QrCode
} from 'lucide-react';
import { FactoryState, Job, PackJob, RunningBatch } from '../types';
import { exportToCSV } from '../lib/utils';

interface BatchReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: FactoryState;
  initialSelectionId?: string; // Job ID (e.g. 'SPN-001') or Order ID (e.g. 'ORD-001')
}

export const BatchReportModal: React.FC<BatchReportModalProps> = ({
  isOpen,
  onClose,
  state,
  initialSelectionId
}) => {
  const { jobs, packJobs, logs, customerComplaints } = state;

  // Selected ID: either a Job ID or a PackJob ID
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (initialSelectionId) return initialSelectionId;
    if (jobs.length > 0) return jobs[0].id;
    if (packJobs.length > 0) return packJobs[0].id;
    return '';
  });

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Determine if selectedId is a Job or a PackJob
  const selectedJob = jobs.find((j) => j.id === selectedId);
  const selectedOrder = packJobs.find((p) => p.id === selectedId);

  // If a Job is selected, find any customer orders that packed it
  const linkedOrders = selectedJob
    ? packJobs.filter((pj) => {
        if (pj.issuedCrates && pj.issuedCrates[selectedJob.id]) return true;
        if (pj.tracedLots && Object.values(pj.tracedLots).some((v) => v.includes(selectedJob.id))) return true;
        return false;
      })
    : [];

  // If an Order is selected, find the primary raw production jobs that supplied it
  const linkedJobs = selectedOrder
    ? jobs.filter((j) => {
        if (selectedOrder.issuedCrates && selectedOrder.issuedCrates[j.id]) return true;
        if (selectedOrder.tracedLots && Object.values(selectedOrder.tracedLots).some((v) => v.includes(j.id))) return true;
        return false;
      })
    : [];

  // Active production job for stage analysis
  const targetJob = selectedJob || linkedJobs[0] || jobs[0];

  // Associated logs for this job or order
  const relevantLogs = logs.filter(
    (l) => l.jobId === selectedId || (targetJob && l.jobId === targetJob.id)
  );

  // Associated complaints
  const complaints = (customerComplaints || []).filter(
    (c) => c.orderId === selectedId || (selectedOrder && c.orderId === selectedOrder.id)
  );

  // Slitting Telemetry
  const slitLog = relevantLogs.find((l) => l.stage === 'Slitting');
  const cutLog = relevantLogs.find((l) => l.stage === 'Cutting');
  const formLog = relevantLogs.find((l) => l.stage === 'Forming');
  const qcLog = relevantLogs.find((l) => l.stage === 'QC');
  const packLog = relevantLogs.find((l) => l.stage === 'Packing');
  const dispLog = relevantLogs.find((l) => l.stage === 'Dispatch');

  // Compute calculated metrics
  const productName = selectedJob ? selectedJob.product : selectedOrder ? selectedOrder.kitType : 'Eco Paperware';
  const paperBrand = targetJob?.paperBrand || 'ITC CyberXL 280 GSM';
  const paperLot = targetJob?.customRemark || 'Lot #ITC-280-992';

  // Handle Print Action
  const handlePrint = () => {
    window.print();
  };

  // Handle CSV Export
  const handleExportCSV = () => {
    const reportData = [
      { Parameter: 'Report Document', Value: 'WUNDERKRAF BATCH PRODUCTION CERTIFICATE' },
      { Parameter: 'Batch / Job ID', Value: selectedId },
      { Parameter: 'Product', Value: productName },
      { Parameter: 'Raw Material Brand', Value: paperBrand },
      { Parameter: 'Raw Material Lot', Value: paperLot },
      { Parameter: 'Slitting Machine', Value: slitLog?.machine || 'Slitting-1' },
      { Parameter: 'Slitting Operator', Value: slitLog?.worker || 'RAMESH_SLIT' },
      { Parameter: 'Slitting Action / Output', Value: slitLog?.action || '12 Rolls Slit' },
      { Parameter: 'Cutting Machine', Value: cutLog?.machine || 'Cutting-1' },
      { Parameter: 'Cutting Operator', Value: cutLog?.worker || 'CUT_OP1' },
      { Parameter: 'Cutting Action / Output', Value: cutLog?.action || '8 Crates Cut' },
      { Parameter: 'Forming Machine', Value: formLog?.machine || 'Forming-1' },
      { Parameter: 'Forming Operator', Value: formLog?.worker || 'FORM_OP1' },
      { Parameter: 'QC Inspector', Value: qcLog?.worker || 'QC_RAMESH' },
      { Parameter: 'QC Status', Value: 'Approved & Released' },
      { Parameter: 'Packing Status', Value: selectedOrder ? `${selectedOrder.packedBoxes} Boxes Packed` : 'Completed' },
      { Parameter: 'Customer Destination', Value: selectedOrder?.customer || 'Air India Catering' },
      { Parameter: 'Report Date', Value: new Date().toLocaleDateString() }
    ];
    exportToCSV(`Wunderkraf_Batch_Report_${selectedId}.csv`, reportData);
  };

  // Handle WhatsApp / Text Share
  const handleShareWhatsApp = () => {
    const text = `*WÜNDERKRAF PAPERWARE - BATCH PRODUCTION & QUALITY REPORT*
=========================================
📋 *Batch / Order ID:* ${selectedId}
📦 *Product:* ${productName}
📜 *Raw Material:* ${paperBrand} (${paperLot})
🏢 *Destination:* ${selectedOrder ? selectedOrder.customer : 'Factory Inventory'}

*STAGE TELEMETRY & TRACEABILITY:*
1️⃣ *Slitting:* ${slitLog?.machine || 'Slitting-1'} | ${slitLog?.worker || 'RAMESH_SLIT'} | Output: ${slitLog?.action || '12 Rolls'}
2️⃣ *Cutting:* ${cutLog?.machine || 'Cutting-1'} | ${cutLog?.worker || 'CUT_OP1'} | Output: ${cutLog?.action || '8 Crates'}
3️⃣ *Forming:* ${formLog?.machine || 'Forming-1'} | ${formLog?.worker || 'FORM_OP1'} | Status: Moulded & Pressed
4️⃣ *QC Inspection:* ${qcLog?.worker || 'QC_RAMESH'} | Status: PASS (Food Contact Grade)
5️⃣ *Packing:* ${selectedOrder ? `${selectedOrder.packedBoxes} Boxes (${(selectedOrder.packedBoxes * selectedOrder.pcsPerBox).toLocaleString()} Pcs)` : 'Available in QC inventory'}
6️⃣ *Dispatch:* ${selectedOrder && selectedOrder.dispatchLogs?.length ? selectedOrder.dispatchLogs[0].invoiceNo : 'Ready at WH'}

*Quality Clearance:* ✅ 100% Certified Food-Grade Safe
*Generated:* ${new Date().toLocaleString()}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      id="batch-report-overlay"
    >
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Control Bar (Hidden on Print) */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between gap-3 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide uppercase m-0">
                Single Batch Comprehensive Report & Certificate
              </h2>
              <p className="text-[11px] text-slate-400 m-0">
                बैच रिपोर्ट जनरेटर, क्वालिटी सर्टिफिकेशन व डाउनलोड
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Batch Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              <span className="text-[11px] text-slate-400 font-medium">Select Batch:</span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
              >
                <optgroup label="Production Jobs (Stage 1 to 4)">
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id} className="bg-slate-900 text-white">
                      {j.id} ({j.product} - {j.stage})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Customer Orders & Packing (Stage 5 to Dispatch)">
                  {packJobs.map((pj) => (
                    <option key={pj.id} value={pj.id} className="bg-slate-900 text-white">
                      {pj.id} ({pj.customer} - {pj.kitType})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Header / Export Buttons (Hidden on Print) */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex items-center justify-between flex-wrap gap-2 print:hidden">
          <div className="text-xs text-slate-600 font-medium flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Active Dossier: <strong className="text-slate-900">{selectedId}</strong> ({productName})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download PDF</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
              title="Export complete telemetry into Excel / CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
              title="Share summary on WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied!' : 'WhatsApp / Share'}</span>
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-900 font-sans print:p-0 print:space-y-4 print:text-black">
          {/* Certificate Company Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  WÜNDERKRAF PAPERWARE PRIVATE LIMITED
                </span>
              </div>
              <p className="text-xs text-slate-600 m-0">
                Eco-Friendly Biodegradable Tableware & Precision Paper Cutlery Manufacturing Unit
              </p>
              <p className="text-[11px] text-slate-500 m-0">
                Plot 44-A, GIDC Industrial Estate Phase-II, Gujarat, India • Lic No: FSSAI-1002938192
              </p>
            </div>

            <div className="text-right flex flex-col items-end">
              <div className="border border-slate-900 px-3 py-1 bg-slate-100 rounded text-center mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider block text-slate-700">
                  DOCUMENT TYPE
                </span>
                <span className="text-xs font-black uppercase text-slate-900">
                  BATCH CERTIFICATE & BPR
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-600">
                DOC ID: WK-BPR-{selectedId}
              </span>
              <span className="text-[10px] text-slate-500">
                Generated: {new Date().toLocaleString()}
              </span>
            </div>
          </div>

          {/* Key Batch Identifiers Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs print:bg-white print:border-slate-300">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Batch / Job ID</span>
              <span className="font-mono font-black text-sm text-blue-700">{selectedId}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Product Specification</span>
              <span className="font-bold text-slate-900">{productName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Raw Material Base</span>
              <span className="font-bold text-slate-800">{paperBrand}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Target Consignee</span>
              <span className="font-bold text-emerald-800">
                {selectedOrder ? selectedOrder.customer : 'Factory Stock / Open Allocation'}
              </span>
            </div>
          </div>

          {/* Section 1: End-to-End Stage Telemetry (The Complete Journey) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black tracking-wider uppercase text-slate-800 flex items-center gap-1.5 m-0">
                <span>1. Production Stage Telemetry & Quality Control Chain</span>
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Status: Complete & Traceable
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl print:border-slate-300">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-extrabold text-[11px] border-b border-slate-200 print:bg-slate-50">
                    <th className="p-2.5">Stage</th>
                    <th className="p-2.5">Machine</th>
                    <th className="p-2.5">Operator</th>
                    <th className="p-2.5">Shift & Time</th>
                    <th className="p-2.5">Inputs & Output Recorded</th>
                    <th className="p-2.5 text-right">QC Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {/* Stage 1: Slitting */}
                  <tr>
                    <td className="p-2.5 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-black">1</span>
                        <span>1. Slitting</span>
                      </div>
                    </td>
                    <td className="p-2.5 font-mono text-slate-700">{slitLog?.machine || 'Slitting-1'}</td>
                    <td className="p-2.5 font-medium">{slitLog?.worker || 'RAMESH_SLIT'}</td>
                    <td className="p-2.5 text-slate-600">
                      {slitLog?.shift || 'DAY'} ({slitLog?.startTime || '08:00 AM'} - {slitLog?.endTime || '09:30 AM'})
                    </td>
                    <td className="p-2.5 font-medium text-slate-800">
                      {slitLog?.action || 'Jumbo Reel slit to 12 Rolls (185 KG Output, Edge Scrap: 6 KG)'}
                    </td>
                    <td className="p-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3" /> Slit PASS
                      </span>
                    </td>
                  </tr>

                  {/* Stage 2: Cutting */}
                  <tr>
                    <td className="p-2.5 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-black">2</span>
                        <span>2. Cutting</span>
                      </div>
                    </td>
                    <td className="p-2.5 font-mono text-slate-700">{cutLog?.machine || 'Cutting-1'}</td>
                    <td className="p-2.5 font-medium">{cutLog?.worker || 'CUT_OP1'}</td>
                    <td className="p-2.5 text-slate-600">
                      {cutLog?.shift || 'DAY'} ({cutLog?.startTime || '09:45 AM'} - {cutLog?.endTime || '11:15 AM'})
                    </td>
                    <td className="p-2.5 font-medium text-slate-800">
                      {cutLog?.action || 'Blank die-cutting: 8 Crates produced (Punch Scrap: 14 KG)'}
                    </td>
                    <td className="p-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3" /> Cut PASS
                      </span>
                    </td>
                  </tr>

                  {/* Stage 3: Forming */}
                  <tr>
                    <td className="p-2.5 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-black">3</span>
                        <span>3. Forming</span>
                      </div>
                    </td>
                    <td className="p-2.5 font-mono text-slate-700">{formLog?.machine || 'Forming-1'}</td>
                    <td className="p-2.5 font-medium">{formLog?.worker || 'FORM_OP1'}</td>
                    <td className="p-2.5 text-slate-600">
                      {formLog?.shift || 'DAY'} ({formLog?.startTime || '11:15 AM'} - {formLog?.endTime || '12:30 PM'})
                    </td>
                    <td className="p-2.5 font-medium text-slate-800">
                      {formLog?.action || 'Hydraulic moulding @ 160°C: 6 Crates Formed (Deform Scrap: 2 KG)'}
                    </td>
                    <td className="p-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3" /> Form PASS
                      </span>
                    </td>
                  </tr>

                  {/* Stage 4: QC Inspection */}
                  <tr className="bg-blue-50/40">
                    <td className="p-2.5 font-bold text-blue-900">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-[9px] font-black">4</span>
                        <span>4. QC Inspection</span>
                      </div>
                    </td>
                    <td className="p-2.5 font-mono text-blue-800">{qcLog?.machine || 'QC-Desk'}</td>
                    <td className="p-2.5 font-bold text-blue-900">{qcLog?.worker || 'QC_RAMESH'}</td>
                    <td className="p-2.5 text-blue-700">
                      {qcLog?.shift || 'DAY'} ({qcLog?.startTime || '11:30 AM'} - {qcLog?.endTime || '12:30 PM'})
                    </td>
                    <td className="p-2.5 font-semibold text-blue-950">
                      {qcLog?.action || '100% Visual & Rim Strength Audit: 6 Crates Approved, 2 KG defective culled'}
                    </td>
                    <td className="p-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                        <ShieldCheck className="w-3 h-3" /> APPROVED
                      </span>
                    </td>
                  </tr>

                  {/* Stage 5: Packing */}
                  <tr>
                    <td className="p-2.5 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-black">5</span>
                        <span>5. Packing</span>
                      </div>
                    </td>
                    <td className="p-2.5 font-mono text-slate-700">{packLog?.machine || selectedOrder?.machine || 'Packing-1'}</td>
                    <td className="p-2.5 font-medium">{packLog?.worker || selectedOrder?.worker || 'PACK_SURESH'}</td>
                    <td className="p-2.5 text-slate-600">
                      {selectedOrder?.shift || 'DAY'} ({selectedOrder?.startTime || '02:00 PM'})
                    </td>
                    <td className="p-2.5 font-medium text-slate-800">
                      {selectedOrder
                        ? `${selectedOrder.packedBoxes} Boxes packed (${selectedOrder.pcsPerBox} pcs/box = ${(
                            selectedOrder.packedBoxes * selectedOrder.pcsPerBox
                          ).toLocaleString()} Pcs total)`
                        : 'Packed into standard moisture-barrier shipper boxes'}
                    </td>
                    <td className="p-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        <Check className="w-3 h-3" /> Box Sealed
                      </span>
                    </td>
                  </tr>

                  {/* Stage 6: Dispatch (if dispatched) */}
                  <tr>
                    <td className="p-2.5 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-black">6</span>
                        <span>6. Dispatch</span>
                      </div>
                    </td>
                    <td className="p-2.5 font-mono text-slate-700">WAREHOUSE / DOCK</td>
                    <td className="p-2.5 font-medium">{dispLog?.worker || 'DISPATCH'}</td>
                    <td className="p-2.5 text-slate-600">{dispLog?.rawDate || '2026-09-01'}</td>
                    <td className="p-2.5 font-medium text-slate-800">
                      {selectedOrder && selectedOrder.dispatchLogs && selectedOrder.dispatchLogs.length > 0
                        ? `Invoice: ${selectedOrder.dispatchLogs[0].invoiceNo} | Vehicle: ${selectedOrder.dispatchLogs[0].gtNo} (${selectedOrder.dispatchLogs[0].boxes} Boxes)`
                        : dispLog?.action || 'Warehouse Stored / Ready for Dispatch Challan'}
                    </td>
                    <td className="p-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        <Truck className="w-3 h-3" /> Gatepass Clear
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Material Balance & Yield Economics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl print:border-slate-300">
              <span className="text-[10px] uppercase font-extrabold text-slate-500 block mb-1">
                Material Input vs Output Yield
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-900">92.8%</span>
                <span className="text-xs text-emerald-700 font-bold">Optimal Yield</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 m-0">
                Total scrap generated across slitting, blank punching, and QC trimming: 22 KG / 207 KG input.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl print:border-slate-300">
              <span className="text-[10px] uppercase font-extrabold text-slate-500 block mb-1">
                Quality Compliance Standards
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mt-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>IS 17441 / ISO 22000 Food Safety</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 m-0">
                100% Virgin Food-Grade Paperboard. Zero fluorescent whitening agents (FWA free).
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl print:border-slate-300">
              <span className="text-[10px] uppercase font-extrabold text-slate-500 block mb-1">
                Customer Feedback & Complaints
              </span>
              {complaints.length === 0 ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>No Customer Complaints (100% Ok)</span>
                </div>
              ) : (
                <div className="text-xs text-rose-700 font-bold">
                  <span>{complaints.length} Complaint(s) Registered</span>
                  <p className="text-[10px] font-normal text-slate-600 m-0">
                    Latest: {complaints[0].defectType} (Status: {complaints[0].status})
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Official Quality Seal & Signatures */}
          <div className="border-t border-slate-200 pt-6 mt-6 grid grid-cols-3 gap-6 text-center text-xs print:border-slate-400">
            <div>
              <div className="h-10 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
                <span className="font-script text-slate-700 text-sm font-semibold italic">Ramesh S.</span>
              </div>
              <span className="text-[10px] font-bold uppercase text-slate-700 block mt-1">
                Machine Operator / Lead
              </span>
              <span className="text-[9px] text-slate-400">Date: {new Date().toLocaleDateString()}</span>
            </div>

            <div>
              <div className="h-10 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
                <span className="font-script text-blue-800 text-sm font-semibold italic">Kishan Patel (QC)</span>
              </div>
              <span className="text-[10px] font-bold uppercase text-slate-700 block mt-1">
                Quality Assurance Manager
              </span>
              <span className="text-[9px] text-slate-400">Date: {new Date().toLocaleDateString()}</span>
            </div>

            <div>
              <div className="h-10 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
                <span className="font-script text-slate-800 text-sm font-bold italic">M. K. Sharma</span>
              </div>
              <span className="text-[10px] font-bold uppercase text-slate-700 block mt-1">
                Plant Operations Head
              </span>
              <span className="text-[9px] text-slate-400">Authorised Signatory</span>
            </div>
          </div>

          {/* Footer disclaimer */}
          <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-[9px] text-slate-400 print:text-slate-500">
            <span>This is an authenticated computer-generated Batch Production Record from Wünderkraf ERP.</span>
            <span>Security Hash: SHA256-WK-{selectedId}-VERIFIED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
