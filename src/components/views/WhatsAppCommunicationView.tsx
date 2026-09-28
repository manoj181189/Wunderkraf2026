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
  generateBreakdownAlertText,
  generateManpowerAttendanceReportText,
  generateQcDefectAlertText,
  generateDispatchDeliveryNoteText,
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
        setMessageText(generateShiftChangeoverReportText(state, 'DAY'));
        break;
      case 'SHIFT_NIGHT':
        setMessageText(generateShiftChangeoverReportText(state, 'NIGHT'));
        break;
      case 'JOB_STATUS':
        setMessageText(generateJobStatusReportText(state, selectedJobId));
        break;
      case 'MAINTENANCE_BREAKDOWN':
        setMessageText(generateBreakdownAlertText(state));
        break;
      case 'MANPOWER_ATTENDANCE':
        setMessageText(generateManpowerAttendanceReportText(state));
        break;
      case 'QC_DEFECT':
        setMessageText(generateQcDefectAlertText(state));
        break;
      case 'DISPATCH_NOTE':
        setMessageText(generateDispatchDeliveryNoteText(state));
        break;
      case 'PURCHASE_INDENT':
        setMessageText(generatePurchaseIndentAlertText(state));
        break;
      case 'SCRAP_YIELD':
        setMessageText(generateScrapYieldReportText(state));
        break;
      case 'CUSTOM_BROADCAST':
        setMessageText(
          `📢 *WÜNDERKRAF FACTORY ANNOUNCEMENT*\n━━━━━━━━━━━━━━━━━━━━\n📅 *Date:* ${new Date().toLocaleDateString()}\n\n⚠️ *SUBJECT:* Floor Operational Briefing\n\nAll Operators and Supervisors please note that...\n\n━━━━━━━━━━━━━━━━━━━━\n_Plant Management Office_`
        );
        break;
    }
  }, [selectedCategory, selectedJobId, state]);

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
                Wünderkraf WhatsApp Desk
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
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-700">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide m-0">
                1-Click Direct WhatsApp Sender (१-क्लिक संदेश प्रेषक)
              </h3>
              <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                रिपोर्ट चुनें, नंबर डालें और व्हाट्सएप पर भेजें — 100% मुफ्त, कोई एपीआई चार्ज नहीं
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Select Report Category (रिपोर्ट प्रकार)
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as MessageCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="SHIFT_DAY">☀️ Day Shift Summary Report</option>
                <option value="SHIFT_NIGHT">🌙 Night Shift Summary Report</option>
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
                Recipient Mobile Number (व्हाट्सएप नंबर)
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

          {/* Real-Time Generated Text Area Preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase px-1">
              <span>📝 Message Preview (मैसेज प्रिव्यू)</span>
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
              className="w-full h-80 px-4 py-3 bg-slate-900 text-emerald-300 rounded-2xl text-xs font-mono border border-slate-800 focus:outline-none leading-relaxed resize-none overflow-y-auto"
            />
          </div>

          {/* Big Green Dispatch Button */}
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-2xl shadow-lg hover:shadow-emerald-100 transition duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <MessageSquare className="w-5 h-5" />
            <span>💬 Open & Send in WhatsApp (व्हाट्सएप पर भेजें)</span>
          </button>
        </div>

        {/* Right Column: Background Scheduler Trigger Config */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide m-0">
                Automated Time Reports (स्वचालित रिपोर्ट टाइमर)
              </h3>
              <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                निर्धारित समय पर सीधे बैकएंड से बिना व्हाट्सएप खोले ऑटोमैटिक रिपोर्ट प्राप्त करें
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs leading-relaxed text-slate-600">
            <div className="font-bold text-slate-800 flex items-center gap-1 text-[11px] uppercase tracking-wide">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>100% Free Background Automation</span>
            </div>
            <p className="m-0 text-[11px]">
              यह फीचर बैकएंड सर्वर में स्वचालित चलता है। इसके लिए <strong>CallMeBot</strong> की निशुल्क एपीआई कुंजी का उपयोग होता है ताकि बिना किसी चार्ज के मैसेज सीधे आपके फोन पर डिलीवर हो सके।
            </p>
          </div>

          <div className="space-y-4 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Scheduler Recipient Mobile Number (रिपोर्ट प्राप्त करने वाला नंबर)
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
                  ☀️ Day Report Time (दिन का समय)
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
                  <span>सक्रिय (Active)</span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  🌙 Night Report Time (रात का समय)
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
                  <span>सक्रिय (Active)</span>
                </label>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                CallMeBot Free API Key (मुफ्त एपीआई कुंजी)
              </label>
              <input
                type="password"
                value={callmebotKey}
                disabled={!canEditConfig}
                onChange={(e) => setCallmebotKey(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 mt-2 text-[10px] text-emerald-800 font-medium space-y-1">
                <span className="font-bold block uppercase tracking-wide text-[9px] text-emerald-700">🔑 १ मिनट में चाबी प्राप्त करें:</span>
                <p className="m-0 leading-relaxed">
                  अपने व्हाट्सएप से <strong>+34 644 10 55 84</strong> नंबर पर यह मैसेज भेजें: 
                  <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono font-bold mx-1">I allow callmebot to send me messages</code>
                  इसके जवाब में जो API Key मिले, उसे ऊपर पेस्ट करके सेव कर दें!
                </p>
              </div>
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
              <span>💾 Save Automated Scheduler Settings</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
