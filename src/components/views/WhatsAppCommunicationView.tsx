import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Copy,
  Check,
  Phone,
  Clock,
  Save,
  CheckCircle2,
  AlertTriangle,
  Settings,
  ShieldCheck,
  Power
} from 'lucide-react';
import { FactoryState, CurrentView } from '../../types';
import {
  generateShiftChangeoverReportText,
  generateMachineWiseDailyReportText,
  generateBreakdownAlertText,
  generateManpowerAttendanceReportText,
  generateQcDefectAlertText,
  generateDispatchDeliveryNoteText,
  generateConsolidatedDispatchReportText,
  generateDispatchByInvoiceText,
  generatePurchaseIndentAlertText,
  generateScrapYieldReportText,
  generateJobStatusReportText,
  triggerWhatsAppShiftNotification
} from '../../lib/whatsappReports';

interface WhatsAppCommunicationViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (newState: FactoryState) => void;
  onNavigateToView?: (view: CurrentView) => void;
  currentUser?: { username: string; perms: string[] } | null;
}

type MessageCategory =
  | 'SHIFT_DAY'
  | 'SHIFT_NIGHT'
  | 'MACHINE_DAILY'
  | 'JOB_STATUS'
  | 'MAINTENANCE_BREAKDOWN'
  | 'MANPOWER_ATTENDANCE'
  | 'QC_DEFECT'
  | 'DISPATCH_NOTE'
  | 'PURCHASE_INDENT'
  | 'SCRAP_YIELD'
  | 'CUSTOM_BROADCAST';

export const WhatsAppCommunicationView: React.FC<WhatsAppCommunicationViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  currentUser
}) => {
  // Permission Check
  const username = currentUser?.username || 'admin';
  const perms = currentUser?.perms || ['*'];
  const userRole = (state.users && state.users[username.toLowerCase()]?.role) || '';
  const isAdmin =
    perms.includes('*') ||
    perms.includes('Admin') ||
    username.toLowerCase() === 'admin' ||
    userRole.toLowerCase() === 'administrator' ||
    userRole.toLowerCase() === 'admin';

  const canEditConfig = isAdmin || perms.includes('WA_ConfigEdit') || perms.includes('WhatsApp');

  // Status message state
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // State for manual dispatch
  const [selectedCategory, setSelectedCategory] = useState<MessageCategory>('SHIFT_DAY');
  const [targetPhone, setTargetPhone] = useState(state.whatsappConfig?.phone || '+91 90339 12511');
  const [selectedJobId, setSelectedJobId] = useState<string>(state.jobs?.[0]?.id || '');
  const [messageText, setMessageText] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // States for enhanced Dispatch Note selection
  const [dispatchFilterType, setDispatchFilterType] = useState<'CONSOLIDATED_DATE' | 'SPECIFIC_INVOICE'>('CONSOLIDATED_DATE');
  const [dispatchDateFilter, setDispatchDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState<string>('');

  // Extract all unique invoice numbers from all dispatch logs across all packJobs
  const allInvoices = Array.from(
    new Set(
      (state.packJobs || []).flatMap((pj) => (pj.dispatchLogs || []).map((log) => log.invoiceNo))
    )
  ).filter(Boolean);

  // States for advanced category selections
  const [shiftDateFilter, setShiftDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
  const [machineReportDateFilter, setMachineReportDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
  const [machineReportShiftFilter, setMachineReportShiftFilter] = useState<'DAY' | 'NIGHT' | 'ALL'>('DAY');
  const [attendanceDateFilter, setAttendanceDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
  const [scrapDateFilter, setScrapDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedQcLogId, setSelectedQcLogId] = useState<string>('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [selectedRequisitionId, setSelectedRequisitionId] = useState<string>('');

  // Extract QC logs for dropdown
  const qcLogs = (state.logs || []).filter(
    (l) => l.stage === 'QC' || l.action?.toLowerCase().includes('qc') || l.details?.toLowerCase().includes('qc')
  );

  // State for background scheduler
  const [dayTime, setDayTime] = useState(state.whatsappConfig?.dayShiftReportTime || '20:00');
  const [nightTime, setNightTime] = useState(state.whatsappConfig?.nightShiftReportTime || '08:00');
  const [schedPhone, setSchedPhone] = useState(state.whatsappConfig?.phone || '+91 90339 12511');
  const [callmebotKey, setCallmebotKey] = useState(state.whatsappConfig?.apiKey || '');
  const [autoSendDay, setAutoSendDay] = useState(state.whatsappConfig?.autoSendShiftReportDay ?? true);
  const [autoSendNight, setAutoSendNight] = useState(state.whatsappConfig?.autoSendShiftReportNight ?? true);

  // Generate dynamic report preview based on category & details
  useEffect(() => {
    switch (selectedCategory) {
      case 'SHIFT_DAY':
        setMessageText(generateShiftChangeoverReportText(state, 'DAY', shiftDateFilter));
        break;
      case 'SHIFT_NIGHT':
        setMessageText(generateShiftChangeoverReportText(state, 'NIGHT', shiftDateFilter));
        break;
      case 'MACHINE_DAILY':
        setMessageText(generateMachineWiseDailyReportText(state, machineReportShiftFilter, machineReportDateFilter));
        break;
      case 'JOB_STATUS':
        setMessageText(generateJobStatusReportText(state, selectedJobId));
        break;
      case 'MAINTENANCE_BREAKDOWN': {
        const targetIncident = (state.maintenanceIncidents || []).find(i => i.id === selectedIncidentId);
        setMessageText(generateBreakdownAlertText(state, targetIncident));
        break;
      }
      case 'MANPOWER_ATTENDANCE':
        setMessageText(generateManpowerAttendanceReportText(state, attendanceDateFilter));
        break;
      case 'QC_DEFECT':
        setMessageText(generateQcDefectAlertText(state, selectedQcLogId));
        break;
      case 'DISPATCH_NOTE':
        if (dispatchFilterType === 'CONSOLIDATED_DATE') {
          setMessageText(generateConsolidatedDispatchReportText(state, dispatchDateFilter));
        } else {
          const targetInvoice = selectedInvoiceNo || allInvoices[0] || '';
          if (targetInvoice && !selectedInvoiceNo) {
            setSelectedInvoiceNo(targetInvoice);
          }
          setMessageText(generateDispatchByInvoiceText(state, targetInvoice));
        }
        break;
      case 'PURCHASE_INDENT': {
        const targetReq = (state.materialRequisitions || []).find(r => r.id === selectedRequisitionId);
        setMessageText(generatePurchaseIndentAlertText(state, targetReq));
        break;
      }
      case 'SCRAP_YIELD':
        setMessageText(generateScrapYieldReportText(state, scrapDateFilter));
        break;
      case 'CUSTOM_BROADCAST':
        setMessageText(
          `📢 *WÜNDERKRAF FACTORY ANNOUNCEMENT*\n━━━━━━━━━━━━━━━━━━━━\n📅 *Date:* ${new Date().toLocaleDateString()}\n\n⚠️ *SUBJECT:* Floor Operational Briefing\n\nAll Operators and Supervisors please note that...\n\n━━━━━━━━━━━━━━━━━━━━\n_Plant Management Office_`
        );
        break;
    }
  }, [
    selectedCategory,
    selectedJobId,
    state,
    dispatchFilterType,
    dispatchDateFilter,
    selectedInvoiceNo,
    shiftDateFilter,
    machineReportDateFilter,
    machineReportShiftFilter,
    attendanceDateFilter,
    scrapDateFilter,
    selectedQcLogId,
    selectedIncidentId,
    selectedRequisitionId
  ]);

  // Handle manual Copy to Clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    showStatus('📋 Message copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  // Handle Direct WhatsApp Web / Mobile dispatch (100% Free)
  const handleOpenWhatsApp = () => {
    const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      alert('Please enter a valid mobile number.');
      return;
    }
    triggerWhatsAppShiftNotification(cleanPhone, messageText);
    showStatus(`🚀 WhatsApp tab opened for phone number: ${cleanPhone}`);
  };

  // Save the scheduled trigger config back to server state
  const handleSaveSchedulerSettings = () => {
    if (!canEditConfig) {
      alert('⛔ Access Restricted: Only Administrators can update scheduled notifications.');
      return;
    }

    const updatedConfig = {
      ...state.whatsappConfig,
      phone: schedPhone.trim(),
      apiKey: callmebotKey.trim(),
      dayShiftReportTime: dayTime,
      nightShiftReportTime: nightTime,
      autoSendShiftReportDay: autoSendDay,
      autoSendShiftReportNight: autoSendNight,
      lastSentDayDate: '', // Reset locks to allow immediate triggers
      lastSentNightDate: ''
    };

    onSaveState({
      ...state,
      whatsappConfig: updatedConfig
    });

    showStatus('💾 Automated Background Scheduler Settings Saved successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Navigation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHub}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </button>
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-emerald-200 shadow-md">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 m-0">
                WhatsApp Messages
              </h2>
              <p className="text-xs text-slate-500 font-semibold m-0 mt-0.5">
                1-Click Direct Sending (100% Free) & Scheduled Time Reports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full border border-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              FREE GATEWAY ACTIVE
            </span>
          </div>
        </div>

        {/* Status Toast Notification */}
        {statusMessage && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Main Two Columns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Direct Manual 1-Click Dispatcher */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-700">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide m-0">
                1-Click Direct WhatsApp Sender
              </h3>
              <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                Select report category, enter recipient number and send via WhatsApp — 100% free with no API charges
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Select Report Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as MessageCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="SHIFT_DAY">☀️ Day Shift Summary Report</option>
                <option value="SHIFT_NIGHT">🌙 Night Shift Summary Report</option>
                <option value="MACHINE_DAILY">⚙️ Machine-Wise Daily Production Report (मशीन वाइज दैनिक रिपोर्ट)</option>
                <option value="JOB_STATUS">📋 Job WIP Status Report</option>
                <option value="MAINTENANCE_BREAKDOWN">🛠️ Machine Breakdown Incident Report</option>
                <option value="MANPOWER_ATTENDANCE">👥 Daily Workforce Attendance</option>
                <option value="QC_DEFECT">🧪 QC Inspection & Defect Report</option>
                <option value="DISPATCH_NOTE">🚚 Dispatch Delivery Confirmation</option>
                <option value="PURCHASE_INDENT">📦 Low Stock Material Indent Alert</option>
                <option value="SCRAP_YIELD">📉 Daily Scrap & Yield Report</option>
                <option value="CUSTOM_BROADCAST">📢 Custom Manual Broadcast Announcement</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Recipient Mobile Number
              </label>
              <input
                type="text"
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value)}
                placeholder="+91 90339 12511"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Conditional Machine-Wise Report Controls */}
          {selectedCategory === 'MACHINE_DAILY' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-[10px] font-black text-indigo-950 uppercase mb-1">
                  📅 Report Date (रिपोर्ट की तारीख)
                </label>
                <input
                  type="date"
                  value={machineReportDateFilter}
                  onChange={(e) => setMachineReportDateFilter(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-indigo-950 uppercase mb-1">
                  ⏱️ Target Shift (शिफ्ट चुनें)
                </label>
                <select
                  value={machineReportShiftFilter}
                  onChange={(e) => setMachineReportShiftFilter(e.target.value as 'DAY' | 'NIGHT' | 'ALL')}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="DAY">☀️ Day Shift Only (दिन की शिफ्ट)</option>
                  <option value="NIGHT">🌙 Night Shift Only (रात की शिफ्ट)</option>
                  <option value="ALL">🔄 Full Day - All Shifts (पूरा दिन / दोनों शिफ्ट)</option>
                </select>
              </div>
            </div>
          )}

          {/* Conditional Job Selection dropdown */}
          {selectedCategory === 'JOB_STATUS' && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Select Live Job to Report:
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {state.jobs.length === 0 ? (
                  <option value="">No live jobs available on floor</option>
                ) : (
                  state.jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.id} - {j.product} ({j.stage} Stage)
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Conditional Shift Selection Date */}
          {(selectedCategory === 'SHIFT_DAY' || selectedCategory === 'SHIFT_NIGHT') && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <label className="block text-[10px] font-black text-indigo-950 uppercase mb-1">
                📅 Select Shift Report Date (शिफ्ट की तारीख चुनें)
              </label>
              <input
                type="date"
                value={shiftDateFilter}
                onChange={(e) => setShiftDateFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
              />
            </div>
          )}

          {/* Conditional Attendance Selection Date */}
          {selectedCategory === 'MANPOWER_ATTENDANCE' && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <label className="block text-[10px] font-black text-indigo-950 uppercase mb-1">
                📅 Select Attendance Date (उपस्थिति की तारीख चुनें)
              </label>
              <input
                type="date"
                value={attendanceDateFilter}
                onChange={(e) => setAttendanceDateFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
              />
            </div>
          )}

          {/* Conditional Scrap Selection Date */}
          {selectedCategory === 'SCRAP_YIELD' && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <label className="block text-[10px] font-black text-indigo-950 uppercase mb-1">
                📅 Select Scrap Date (स्क्रैप की तारीख चुनें)
              </label>
              <input
                type="date"
                value={scrapDateFilter}
                onChange={(e) => setScrapDateFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
              />
            </div>
          )}

          {/* Conditional QC Log Selection */}
          {selectedCategory === 'QC_DEFECT' && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <label className="block text-[10px] font-black text-indigo-950 uppercase mb-1">
                🧪 Select QC Inspection Record (क्वालिटी प्रविष्टि चुनें)
              </label>
              <select
                value={selectedQcLogId}
                onChange={(e) => setSelectedQcLogId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
              >
                {qcLogs.length === 0 ? (
                  <option value="">No QC defects recorded on floor (Defaults to Template)</option>
                ) : (
                  qcLogs.map((log, idx) => (
                    <option key={log.timestamp || idx} value={log.timestamp}>
                      {log.rawDate || log.timestamp?.split(' ')?.[0]} - {log.machine} | {log.details || log.action}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Conditional Breakdown Incident Selection */}
          {selectedCategory === 'MAINTENANCE_BREAKDOWN' && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <label className="block text-[10px] font-black text-indigo-950 uppercase mb-1">
                🛠️ Select Breakdown Incident (मशीन ब्रेकडाउन चुनें)
              </label>
              <select
                value={selectedIncidentId}
                onChange={(e) => setSelectedIncidentId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
              >
                {(state.maintenanceIncidents || []).length === 0 ? (
                  <option value="">No machine breakdowns recorded (All Operational)</option>
                ) : (
                  (state.maintenanceIncidents || []).map((inc) => (
                    <option key={inc.id} value={inc.id}>
                      {inc.machine} - {inc.issue} | Status: {inc.status}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Conditional Purchase Indent Selection */}
          {selectedCategory === 'PURCHASE_INDENT' && (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <label className="block text-[10px] font-black text-indigo-950 uppercase mb-1">
                📦 Select Material Indent / Requisition (मटीरियल इंडेंट चुनें)
              </label>
              <select
                value={selectedRequisitionId}
                onChange={(e) => setSelectedRequisitionId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
              >
                {(state.materialRequisitions || []).length === 0 ? (
                  <option value="">No purchase indents present in system</option>
                ) : (
                  (state.materialRequisitions || []).map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.id} - {req.itemName || (req as any).item || (req as any).spareName} ({req.quantity || (req as any).qty || 1} {req.unit || 'Pcs'}) | Urgency: {req.urgency}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Conditional Dispatch Note Selection Controls */}
          {selectedCategory === 'DISPATCH_NOTE' && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
                <span className="text-xs font-black text-indigo-950 uppercase tracking-wide flex items-center gap-1">
                  🚚 Dispatch Report Parameters (पैरामीटर सेट करें)
                </span>
                <span className="text-[10px] text-slate-500 font-bold">Configure what to send</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 tracking-wider">
                    Select Filter Type
                  </label>
                  <select
                    value={dispatchFilterType}
                    onChange={(e) => setDispatchFilterType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="CONSOLIDATED_DATE">📅 Consolidated Date Wise (पूरे दिन की कुल रिपोर्ट)</option>
                    <option value="SPECIFIC_INVOICE">🧾 Specific Invoice / Challan (कोई विशेष बिल चुनें)</option>
                  </select>
                </div>

                {dispatchFilterType === 'CONSOLIDATED_DATE' ? (
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 tracking-wider">
                      Select Dispatch Date
                    </label>
                    <input
                      type="date"
                      value={dispatchDateFilter}
                      onChange={(e) => setDispatchDateFilter(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 tracking-wider">
                      Select Specific Invoice
                    </label>
                    <select
                      value={selectedInvoiceNo}
                      onChange={(e) => setSelectedInvoiceNo(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    >
                      {allInvoices.length === 0 ? (
                        <option value="">No dispatch invoices logged in system</option>
                      ) : (
                        allInvoices.map((inv) => {
                          let customerName = '';
                          for (const pj of state.packJobs || []) {
                            const found = (pj.dispatchLogs || []).some(l => l.invoiceNo === inv);
                            if (found) {
                              customerName = pj.customer;
                              break;
                            }
                          }
                          return (
                            <option key={inv} value={inv}>
                              🧾 {inv} - {customerName || 'N/A'}
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Real-Time Generated Text Area Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase px-1">
              <span>📝 Message Preview</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[10px] font-black text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
              </button>
            </div>
            <textarea
              readOnly
              value={messageText}
              className="w-full h-80 px-4 py-3 bg-slate-50 text-slate-800 border border-slate-300 rounded-2xl text-xs font-mono focus:outline-none leading-relaxed resize-none overflow-y-auto shadow-inner"
            />
          </div>

          {/* Big Green Dispatch Button */}
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-2xl shadow-lg hover:shadow-emerald-100 transition duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <MessageSquare className="w-5 h-5" />
            <span>💬 Open & Send in WhatsApp</span>
          </button>
        </div>

        {/* Right Column: Background Scheduler Trigger Config */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide m-0">
                Automated Time Reports
              </h3>
              <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                Configure scheduled automatic reports to be sent directly from the background server
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Scheduler Recipient Mobile Number
              </label>
              <input
                type="text"
                value={schedPhone}
                disabled={!canEditConfig}
                onChange={(e) => setSchedPhone(e.target.value)}
                placeholder="+91 90339 12511"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  ☀️ Day Report Time
                </label>
                <input
                  type="time"
                  value={dayTime}
                  disabled={!canEditConfig}
                  onChange={(e) => setDayTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <label className="flex items-center gap-1.5 mt-1.5 text-[10px] font-bold text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoSendDay}
                    onChange={(e) => setAutoSendDay(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Active</span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  🌙 Night Report Time
                </label>
                <input
                  type="time"
                  value={nightTime}
                  disabled={!canEditConfig}
                  onChange={(e) => setNightTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <label className="flex items-center gap-1.5 mt-1.5 text-[10px] font-bold text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoSendNight}
                    onChange={(e) => setAutoSendNight(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Active</span>
                </label>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                CallMeBot Free API Key
              </label>
              <input
                type="password"
                value={callmebotKey}
                disabled={!canEditConfig}
                onChange={(e) => setCallmebotKey(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Save Settings Button */}
          {canEditConfig && (
            <button
              type="button"
              onClick={handleSaveSchedulerSettings}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Automated Scheduler Settings</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
