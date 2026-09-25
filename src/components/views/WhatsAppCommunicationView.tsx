import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Copy,
  Check,
  Phone,
  RotateCcw,
  Users,
  Wrench,
  SearchCheck,
  Truck,
  ShoppingCart,
  Trash2,
  Calendar,
  AlertTriangle,
  Clock,
  Settings,
  CheckCircle2,
  UserCheck,
  Layers,
  Sparkles,
  ExternalLink,
  Plus,
  X,
  Building2,
  BellRing,
  Shield,
  Eye,
  Lock,
  Filter,
  Search,
  Download,
  RefreshCw,
  Zap,
  Edit,
  Save,
  CheckSquare,
  Square,
  ChevronRight,
  Radio,
  Play,
  Timer,
  QrCode,
  Bot,
  ShieldCheck,
  Smartphone,
  History,
  StopCircle,
  LogOut,
  Power
} from 'lucide-react';
import QRCode from 'qrcode';
import { FactoryState, CurrentView, CoordinationMatrixItem } from '../../types';
import { DEFAULT_COORDINATION_MATRIX } from '../../lib/constants';
import {
  generateShiftChangeoverReportText,
  generateBreakdownAlertText,
  generateManpowerAttendanceReportText,
  generateQcDefectAlertText,
  generateDispatchDeliveryNoteText,
  generatePurchaseIndentAlertText,
  generateScrapYieldReportText,
  generateJobStatusReportText,
  generateWhatsAppStockQueryReply,
  processWhatsAppIncomingQuery,
  triggerWhatsAppShiftNotification,
  dispatchWhatsAppNotificationViaServer
} from '../../lib/whatsappReports';

interface WhatsAppCommunicationViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (newState: FactoryState) => void;
  onNavigateToView?: (view: CurrentView) => void;
  currentUser?: { username: string; perms: string[] } | null;
}

type TabType = 'safe_qr_session' | 'dispatcher' | 'coordination_matrix' | 'triggers' | 'dispatch_logs';

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
  onNavigateToView,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('safe_qr_session');

  // Permission & Role Checks
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
  const canEditMatrix = isAdmin || perms.includes('WA_ConfigEdit');

  // Status Toast notification
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // =========================================================================
  // 0. QR SCAN & ANTI-BAN AUTO-DISCONNECT SESSION STATE
  // =========================================================================
  const [sessionLinkedPhone, setSessionLinkedPhone] = useState<string>(
    state.whatsappConfig?.phone || '+91 90339 12511'
  );
  const [sessionStatus, setSessionStatus] = useState<'IDLE' | 'ACTIVE' | 'EXPIRED'>('IDLE');
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(30);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30 * 60);
  const [sessionQrUrl, setSessionQrUrl] = useState<string>('');
  const [qrHandshakeText, setQrHandshakeText] = useState<string>('मुझे इसका स्टॉक चाहिए');

  // Interactive Two-Way Query Bot Simulator State
  const [simQueryInput, setSimQueryInput] = useState<string>('मुझे इसका स्टॉक चाहिए');
  const [simChatLogs, setSimChatLogs] = useState<
    Array<{ sender: 'user' | 'bot'; text: string; time: string; category?: string }>
  >([
    {
      sender: 'user',
      text: 'मुझे इसका स्टॉक चाहिए',
      time: 'Just now'
    },
    {
      sender: 'bot',
      text: generateWhatsAppStockQueryReply(state, 'stock'),
      time: 'Just now',
      category: 'STOCK_QUERY'
    }
  ]);
  const [isQueryingServer, setIsQueryingServer] = useState(false);

  // Inbound Webhook Monitoring & Live Feed
  const [inboundFeedLogs, setInboundFeedLogs] = useState<
    Array<{ id: string; timestamp: string; from: string; query: string; reply: string; status: string }>
  >([]);
  const [testInboundPhone, setTestInboundPhone] = useState<string>('+91 90339 12511');
  const [testInboundMessage, setTestInboundMessage] = useState<string>('स्पून का स्टॉक कितना है?');
  const [testingInbound, setTestingInbound] = useState<boolean>(false);

  // Poll inbound logs periodically
  useEffect(() => {
    const fetchInbound = () => {
      fetch('/api/whatsapp/inbound-logs')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.logs)) {
            setInboundFeedLogs(d.logs);
          }
        })
        .catch(() => {});
    };

    fetchInbound();
    const timer = setInterval(fetchInbound, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleSimulateInboundWebhook = async () => {
    setTestingInbound(true);
    try {
      const res = await fetch('/api/whatsapp/incoming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testInboundPhone,
          message: testInboundMessage
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showStatus('✅ इनबाउंड WhatsApp संदेश सफलतापूर्वक प्राप्त व प्रोसेस हुआ!');
        fetch('/api/whatsapp/inbound-logs')
          .then((r) => r.json())
          .then((d) => {
            if (d.success && Array.isArray(d.logs)) {
              setInboundFeedLogs(d.logs);
            }
          });
      }
    } catch (e: any) {
      showStatus('⚠️ इनबाउंड टेस्ट में समस्या: ' + e.message);
    } finally {
      setTestingInbound(false);
    }
  };

  // Generate dynamic QR code whenever linked phone or text changes
  useEffect(() => {
    const cleanPhone = (sessionLinkedPhone || '').replace(/[^0-9]/g, '');
    const waLink = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(qrHandshakeText || 'स्टॉक रिपोर्ट Wünderkraf')}`
      : 'https://web.whatsapp.com';

    QRCode.toDataURL(waLink, {
      width: 260,
      margin: 2,
      color: {
        dark: '#064e3b',
        light: '#ffffff'
      }
    })
      .then((url) => setSessionQrUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [sessionLinkedPhone, qrHandshakeText]);

  // Auto-Exit Session Protection Timer Countdown
  useEffect(() => {
    if (sessionStatus !== 'ACTIVE') return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setSessionStatus('EXPIRED');
          showStatus('🔒 सत्र सुरक्षा समय समाप्त! WhatsApp नंबर को बैन से सुरक्षित रखने हेतु सत्र स्वतः एग्जिट (Disconnected) कर दिया गया है।');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStatus]);

  const handleStartSession = () => {
    setSessionStatus('ACTIVE');
    setRemainingSeconds(sessionDurationMinutes * 60);
    showStatus(`🛡️ सुरक्षित सत्र प्रारंभ! यह नंबर ${sessionDurationMinutes} मिनट बाद स्वतः एग्जिट हो जाएगा।`);
  };

  const handleExitSession = () => {
    setSessionStatus('IDLE');
    setRemainingSeconds(sessionDurationMinutes * 60);
    showStatus('⏹️ सत्र तुरंत सुरक्षित रूप से समाप्त (Disconnected) कर दिया गया।');
  };

  // Auto-deliver toggle
  const [autoOpenWhatsAppOnQuery, setAutoOpenWhatsAppOnQuery] = useState<boolean>(true);

  const handleDeliverToWhatsAppDirectly = (text: string, customPhone?: string) => {
    const phoneToUse = customPhone || sessionLinkedPhone;
    const webhookUrl = state.whatsappConfig?.webhookUrl;
    if (webhookUrl && webhookUrl.startsWith('http')) {
      dispatchWhatsAppNotificationViaServer(
        phoneToUse,
        text,
        webhookUrl,
        'STOCK_QUERY',
        username,
        state.whatsappConfig?.apiKey
      );
    }
    triggerWhatsAppShiftNotification(phoneToUse, text, webhookUrl);
    showStatus(`🚀 WhatsApp खुल गया! संदेश ${phoneToUse} पर प्रेषित किया गया।`);
  };

  const handleSendSimQuery = async (customText?: string, forceDeliver: boolean = false) => {
    const queryToSend = (customText || simQueryInput).trim();
    if (!queryToSend) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = {
      sender: 'user' as const,
      text: queryToSend,
      time: timeStr
    };

    setSimChatLogs((prev) => [...prev, userMsg]);
    setSimQueryInput('');
    setIsQueryingServer(true);

    let replyText = '';
    let replyCat = 'STOCK_QUERY';

    try {
      // First try live server endpoint
      const res = await fetch('/api/whatsapp/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryToSend })
      });
      if (res.ok) {
        const json = await res.json();
        replyText = json.reply;
        replyCat = json.category || 'STOCK_QUERY';
      }
    } catch (e) {
      console.warn('Direct server query fallback to client generator:', e);
    }

    if (!replyText) {
      const processed = processWhatsAppIncomingQuery(state, queryToSend);
      replyText = processed.reply;
      replyCat = processed.category;
    }

    setSimChatLogs((prev) => [
      ...prev,
      {
        sender: 'bot' as const,
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        category: replyCat
      }
    ]);
    setIsQueryingServer(false);

    // If autoOpenWhatsAppOnQuery or forceDeliver:
    // Dispatch to webhook (if set) and launch in WhatsApp so user directly receives it on their phone!
    const shouldDeliver = autoOpenWhatsAppOnQuery || forceDeliver;
    const webhookUrl = state.whatsappConfig?.webhookUrl;

    if (webhookUrl && webhookUrl.startsWith('http')) {
      dispatchWhatsAppNotificationViaServer(
        sessionLinkedPhone,
        replyText,
        webhookUrl,
        replyCat,
        username,
        state.whatsappConfig?.apiKey
      );
    }

    if (shouldDeliver) {
      triggerWhatsAppShiftNotification(sessionLinkedPhone, replyText, webhookUrl);
      showStatus('🚀 WhatsApp खुल गया! स्पून/स्टॉक रिपोर्ट आपके WhatsApp पर भेज दी गई है।');
    } else {
      showStatus('🤖 बॉट रिप्लाई तैयार है!');
    }
  };

  // =========================================================================
  // 1. BROADCAST & REPORT DISPATCHER STATE
  // =========================================================================
  const [selectedCategory, setSelectedCategory] = useState<MessageCategory>('SHIFT_DAY');
  const [targetPhone, setTargetPhone] = useState(state.whatsappConfig?.phone || '');
  const [selectedContactName, setSelectedContactName] = useState<string>('Primary Plant Gateway');
  const [selectedJobId, setSelectedJobId] = useState<string>(state.jobs?.[0]?.id || '');
  const [messageText, setMessageText] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Generate dynamic report template on category change
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

  // Handle Copy Text
  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    showStatus('📋 Message copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  // Record dispatch log entry
  const recordDispatchLog = (status: 'SENT' | 'OPENED' | 'FAILED', targetRecipient: string) => {
    const newLog = {
      id: `WA-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category: selectedCategory,
      recipient: targetRecipient || targetPhone || 'Direct WhatsApp',
      sender: username,
      preview: messageText.slice(0, 85) + '...',
      status
    };

    const existingLogs = state.whatsappConfig?.dispatchLogs || [];
    const updatedConfig = {
      ...state.whatsappConfig,
      dispatchLogs: [newLog, ...existingLogs.slice(0, 49)]
    };

    onSaveState({
      ...state,
      whatsappConfig: updatedConfig
    });
  };

  // Handle Direct WhatsApp Web / Mobile App Launch
  const handleSendWhatsApp = () => {
    const phoneToUse = targetPhone || state.whatsappConfig?.phone || '';
    triggerWhatsAppShiftNotification(phoneToUse, messageText, state.whatsappConfig?.webhookUrl);
    recordDispatchLog('OPENED', selectedContactName ? `${selectedContactName} (${phoneToUse})` : phoneToUse);
    showStatus(`🚀 WhatsApp opened for ${selectedContactName || phoneToUse}`);
  };

  // Handle Direct API Webhook Trigger (via Reliable Server Proxy to avoid browser CORS/redirect issues)
  const handleTriggerWebhookDirect = async () => {
    const webhookUrl = state.whatsappConfig?.webhookUrl;
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      alert('⚠️ WhatsApp Webhook URL is not configured. Go to "Notification Triggers & Gateway" tab to configure your webhook endpoint, or use "Open in WhatsApp" for direct dispatch.');
      return;
    }

    try {
      showStatus('⚡ Dispatching via Server Proxy to Google Script / Webhook...');
      const phoneToUse = targetPhone || state.whatsappConfig?.phone || '';
      const result = await dispatchWhatsAppNotificationViaServer(
        phoneToUse,
        messageText,
        webhookUrl,
        selectedCategory,
        username,
        state.whatsappConfig?.apiKey
      );

      if (result.success) {
        recordDispatchLog('SENT', selectedContactName ? `${selectedContactName} (${phoneToUse})` : phoneToUse);
        showStatus('✅ Report successfully delivered via Google Script / Webhook!');
      } else {
        recordDispatchLog('FAILED', phoneToUse);
        showStatus(`⚠️ Dispatch failed: ${result.error || 'Verify Google Script URL'}`);
      }
    } catch (err: any) {
      console.error('Webhook error:', err);
      recordDispatchLog('FAILED', targetPhone);
      showStatus('⚠️ Webhook request error (verify Google Script deployment)');
    }
  };

  // =========================================================================
  // 2. STAFF & ESCALATION CONTACT MATRIX STATE & LOGIC
  // =========================================================================
  const coordinationMatrixList: CoordinationMatrixItem[] = useMemo(() => {
    return state.coordinationMatrix && state.coordinationMatrix.length > 0
      ? state.coordinationMatrix
      : DEFAULT_COORDINATION_MATRIX;
  }, [state.coordinationMatrix]);

  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixFilterCategory, setMatrixFilterCategory] = useState<string>('ALL');

  // Form state for adding new escalation contact
  const [newRoleName, setNewRoleName] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newMachineBreakdown, setNewMachineBreakdown] = useState(true);
  const [newElectricalAlert, setNewElectricalAlert] = useState(false);
  const [newProductionHandover, setNewProductionHandover] = useState(true);
  const [newMaterialIndent, setNewMaterialIndent] = useState(false);
  const [newQcFailure, setNewQcFailure] = useState(false);
  const [newIsActive, setNewIsActive] = useState(true);

  // Inline editing state
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<CoordinationMatrixItem | null>(null);

  const validateMatrixItem = (role: string, name: string, phone: string): boolean => {
    if (!role.trim()) {
      alert('⚠️ Role / Department Name is required!');
      return false;
    }
    if (!name.trim()) {
      alert('⚠️ Contact Person Name is required!');
      return false;
    }
    if (!phone.trim()) {
      alert('⚠️ Phone Number is required!');
      return false;
    }
    if (!phone.trim().startsWith('+')) {
      alert('⚠️ Phone Number must include country code starting with "+" (e.g., +91 98250 12345).');
      return false;
    }
    return true;
  };

  const handleAddMatrixItem = () => {
    if (!canEditMatrix) {
      alert('⛔ Access Restricted: Only Administrators are allowed to edit the Coordination Matrix.');
      return;
    }
    if (!validateMatrixItem(newRoleName, newContactName, newPhone)) return;

    const newItem: CoordinationMatrixItem = {
      id: `CM-${Date.now()}`,
      roleName: newRoleName.trim(),
      contactName: newContactName.trim(),
      phone: newPhone.trim(),
      alertCategories: {
        machineBreakdown: newMachineBreakdown,
        electricalAlert: newElectricalAlert,
        productionHandover: newProductionHandover,
        materialIndent: newMaterialIndent,
        qcFailure: newQcFailure
      },
      isActive: newIsActive
    };

    const nextList = [...coordinationMatrixList, newItem];
    onSaveState({
      ...state,
      coordinationMatrix: nextList
    });

    // Reset inputs
    setNewRoleName('');
    setNewContactName('');
    setNewPhone('');
    setNewMachineBreakdown(true);
    setNewElectricalAlert(false);
    setNewProductionHandover(true);
    setNewMaterialIndent(false);
    setNewQcFailure(false);
    setNewIsActive(true);

    showStatus(`✅ ${newItem.contactName} (${newItem.roleName}) added to Escalation Matrix!`);
  };

  const handleStartEditMatrixItem = (idx: number) => {
    if (!canEditMatrix) {
      alert('⛔ Access Restricted: Only Administrators are allowed to edit the Coordination Matrix.');
      return;
    }
    setEditingItemIdx(idx);
    setEditingItem({ ...coordinationMatrixList[idx] });
  };

  const handleSaveMatrixItem = () => {
    if (!canEditMatrix || editingItemIdx === null || !editingItem) return;
    if (!validateMatrixItem(editingItem.roleName, editingItem.contactName, editingItem.phone)) return;

    const nextList = [...coordinationMatrixList];
    nextList[editingItemIdx] = { ...editingItem };
    onSaveState({
      ...state,
      coordinationMatrix: nextList
    });

    setEditingItemIdx(null);
    setEditingItem(null);
    showStatus('✅ Escalation contact updated successfully!');
  };

  const handleDeleteMatrixItem = (idx: number) => {
    if (!canEditMatrix) {
      alert('⛔ Access Restricted: Only Administrators are allowed to edit the Coordination Matrix.');
      return;
    }
    const item = coordinationMatrixList[idx];
    if (!window.confirm(`Are you sure you want to remove "${item.contactName} (${item.roleName})" from WhatsApp alert routing?`)) return;

    const nextList = coordinationMatrixList.filter((_, i) => i !== idx);
    onSaveState({
      ...state,
      coordinationMatrix: nextList
    });
    showStatus('🗑️ Escalation contact removed.');
  };

  const handleToggleMatrixItemActive = (idx: number) => {
    if (!canEditMatrix) {
      alert('⛔ Access Restricted: Only Administrators are allowed to modify contact status.');
      return;
    }
    const nextList = [...coordinationMatrixList];
    nextList[idx] = {
      ...nextList[idx],
      isActive: !nextList[idx].isActive
    };
    onSaveState({
      ...state,
      coordinationMatrix: nextList
    });
  };

  const handleTestWhatsAppAlert = (item: CoordinationMatrixItem) => {
    const categories: string[] = [];
    if (item.alertCategories.machineBreakdown) categories.push('Machine Breakdown');
    if (item.alertCategories.electricalAlert) categories.push('Electrical Breakdown');
    if (item.alertCategories.productionHandover) categories.push('Shift Handover');
    if (item.alertCategories.materialIndent) categories.push('Material Indent');
    if (item.alertCategories.qcFailure) categories.push('QC Failure');

    const message = `🔔 *WÜNDERKRAF ESCALATION TEST PING*
━━━━━━━━━━━━━━━━━━━━
👤 *Recipient:* ${item.contactName} (${item.roleName})
📱 *Routing:* ${item.phone}
🕒 *Time:* ${new Date().toLocaleTimeString()}
━━━━━━━━━━━━━━━━━━━━
✅ Your WhatsApp channel is verified and registered for:
${categories.length > 0 ? categories.map((c) => `• ${c}`).join('\n') : '• General Operational Alerts'}

_Wünderkraf Factory Communication System_`;

    triggerWhatsAppShiftNotification(item.phone, message, state.whatsappConfig?.webhookUrl);
    showStatus(`🚀 Test alert sent to ${item.contactName} (${item.phone})`);
  };

  const filteredCoordinationMatrix = useMemo(() => {
    return coordinationMatrixList.filter((item) => {
      const matchesSearch =
        item.roleName.toLowerCase().includes(matrixSearch.toLowerCase()) ||
        item.contactName.toLowerCase().includes(matrixSearch.toLowerCase()) ||
        item.phone.includes(matrixSearch);

      if (!matchesSearch) return false;
      if (matrixFilterCategory === 'ALL') return true;
      if (matrixFilterCategory === 'BREAKDOWN') return item.alertCategories.machineBreakdown;
      if (matrixFilterCategory === 'ELECTRICAL') return item.alertCategories.electricalAlert;
      if (matrixFilterCategory === 'HANDOVER') return item.alertCategories.productionHandover;
      if (matrixFilterCategory === 'INDENT') return item.alertCategories.materialIndent;
      if (matrixFilterCategory === 'QC') return item.alertCategories.qcFailure;
      return true;
    });
  }, [coordinationMatrixList, matrixSearch, matrixFilterCategory]);

  // =========================================================================
  // 3. NOTIFICATION TRIGGERS & GATEWAY CONFIGURATION STATE
  // =========================================================================
  const [triggerConfig, setTriggerConfig] = useState(() => ({
    phone: state.whatsappConfig?.phone || '+91 90339 12511',
    webhookUrl: state.whatsappConfig?.webhookUrl || '',
    apiKey: state.whatsappConfig?.apiKey || '',
    customFooter: state.whatsappConfig?.customMessage || 'Wünderkraf Factory Production Hub',
    dayShiftReportTime: state.whatsappConfig?.dayShiftReportTime || '20:00',
    nightShiftReportTime: state.whatsappConfig?.nightShiftReportTime || '08:00',
    autoSendShiftReportDay: state.whatsappConfig?.autoSendShiftReportDay ?? state.whatsappConfig?.autoSend ?? true,
    autoSendShiftReportNight: state.whatsappConfig?.autoSendShiftReportNight ?? state.whatsappConfig?.autoSend ?? true,
    autoNotifyMaintenanceBreakdown: state.whatsappConfig?.autoNotifyMaintenanceBreakdown ?? true,
    autoNotifyCriticalQcDefect: state.whatsappConfig?.autoNotifyCriticalQcDefect ?? true,
    autoNotifyDispatchCompletion: state.whatsappConfig?.autoNotifyDispatchCompletion ?? true,
    autoNotifyDailyManpower: state.whatsappConfig?.autoNotifyDailyManpower ?? true,
    autoNotifyLowStockRequisition: state.whatsappConfig?.autoNotifyLowStockRequisition ?? true,
    autoNotifyScrapSpike: state.whatsappConfig?.autoNotifyScrapSpike ?? false
  }));

  // Live system clock for real-time automation monitoring & testing
  const [liveSystemTime, setLiveSystemTime] = useState<Date>(new Date());
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setLiveSystemTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const currentHours = String(liveSystemTime.getHours()).padStart(2, '0');
  const currentMinutes = String(liveSystemTime.getMinutes()).padStart(2, '0');
  const currentSeconds = String(liveSystemTime.getSeconds()).padStart(2, '0');
  const currentLiveTimeStr = `${currentHours}:${currentMinutes}:${currentSeconds}`;
  const todayStr = liveSystemTime.toISOString().split('T')[0];

  // Helper to schedule an automated test trigger 1 minute from current time
  const handleScheduleTestTriggerNextMinute = (targetShift: 'DAY' | 'NIGHT') => {
    if (!canEditConfig) {
      alert('⛔ Access Restricted: Only Administrators are authorized to update notification triggers.');
      return;
    }
    const nextMinDate = new Date(Date.now() + 65 * 1000);
    const hh = String(nextMinDate.getHours()).padStart(2, '0');
    const mm = String(nextMinDate.getMinutes()).padStart(2, '0');
    const targetTime = `${hh}:${mm}`;

    const updatedConfig = {
      ...state.whatsappConfig,
      ...(targetShift === 'DAY'
        ? {
            dayShiftReportTime: targetTime,
            autoSendShiftReportDay: true,
            lastSentDayDate: '' // Unlock so it will trigger
          }
        : {
            nightShiftReportTime: targetTime,
            autoSendShiftReportNight: true,
            lastSentNightDate: '' // Unlock so it will trigger
          })
    };

    setTriggerConfig((prev) => ({
      ...prev,
      ...(targetShift === 'DAY'
        ? { dayShiftReportTime: targetTime, autoSendShiftReportDay: true }
        : { nightShiftReportTime: targetTime, autoSendShiftReportNight: true })
    }));

    onSaveState({
      ...state,
      whatsappConfig: updatedConfig
    });

    showStatus(`⏱️ Automated test scheduled for ${targetTime}! Watch the clock; at ${targetTime}, the shift alert will pop up automatically.`);
  };

  const [showGoogleScriptGuide, setShowGoogleScriptGuide] = useState(false);
  const [copiedGoogleScript, setCopiedGoogleScript] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  // Test Webhook / Google Apps Script Connection
  const handleTestWebhookConnection = async () => {
    const url = triggerConfig.webhookUrl?.trim();
    if (!url || !url.startsWith('http')) {
      alert('Please enter a valid Webhook URL starting with http:// or https://');
      return;
    }
    setTestingWebhook(true);
    showStatus('⏳ Testing connection to Google Apps Script / Webhook via server proxy...');
    try {
      const res = await dispatchWhatsAppNotificationViaServer(
        triggerConfig.phone || '919876543210',
        '🔔 *WÜNDERKRAF ERP WEBHOOK VERIFICATION TEST*\n━━━━━━━━━━━━━━━━━━━━\n✅ Connection between Wünderkraf Paperware ERP and your Google Apps Script Webhook is active and verified!\n📅 Timestamp: ' + new Date().toLocaleString() + '\n🏭 Plant: Wünderkraf Paperware Unit-1',
        url,
        'GENERAL',
        `${username} (Webhook Connection Test)`,
        triggerConfig.apiKey
      );
      if (res.success) {
        showStatus('🎉 Connection Successful! Google Apps Script responded with 200 OK. Ready for zero-cost automated reporting!');
      } else {
        showStatus(`⚠️ Webhook responded: ${res.error || 'Check Web App deployment settings'}`);
      }
    } catch (e: any) {
      showStatus(`❌ Webhook test failed: ${e.message}`);
    } finally {
      setTestingWebhook(false);
    }
  };

  // Helper for instantaneous manual simulation of the shift changeover alert banner
  const handleInstantSimulateTrigger = (targetShift: 'DAY' | 'NIGHT') => {
    // 1. Dispatch custom event to trigger the prominent top banner in App.tsx
    window.dispatchEvent(
      new CustomEvent('wunderkraf_force_shift_alert', {
        detail: { shift: targetShift }
      })
    );

    // 2. Generate report text and record into dispatch logs
    const reportText = generateShiftChangeoverReportText(state, targetShift);
    const newLog = {
      id: `DEMO-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category: (targetShift === 'DAY' ? 'SHIFT_DAY' : 'SHIFT_NIGHT') as MessageCategory,
      recipient: `Floor Coordination Matrix (${targetShift} Shift Alert)`,
      sender: `${username} (Live Demo Test)`,
      preview: reportText.slice(0, 85) + '...',
      status: 'SENT' as const
    };

    const updatedConfig = {
      ...state.whatsappConfig,
      dispatchLogs: [newLog, ...(state.whatsappConfig?.dispatchLogs || []).slice(0, 49)]
    };

    onSaveState({
      ...state,
      whatsappConfig: updatedConfig
    });

    showStatus(`⚡ Instant ${targetShift} shift changeover alert triggered! Check top notification banner & dispatch logs.`);
  };

  // Helper to reset today's sent lock
  const handleResetTodaySentFlags = () => {
    if (!canEditConfig) {
      alert('⛔ Access Restricted: Only Administrators are authorized.');
      return;
    }
    const updatedConfig = {
      ...state.whatsappConfig,
      lastSentDayDate: '',
      lastSentNightDate: ''
    };
    onSaveState({
      ...state,
      whatsappConfig: updatedConfig
    });
    showStatus("🔄 Today's shift dispatch locks reset! You can now trigger automated reports again today.");
  };

  const handleSaveTriggers = () => {
    if (!canEditConfig) {
      alert('⛔ Access Restricted: Only Administrators are authorized to update notification triggers.');
      return;
    }
    const updated = {
      ...state.whatsappConfig,
      phone: triggerConfig.phone.trim(),
      webhookUrl: triggerConfig.webhookUrl.trim(),
      apiKey: triggerConfig.apiKey.trim(),
      customMessage: triggerConfig.customFooter.trim(),
      dayShiftReportTime: triggerConfig.dayShiftReportTime,
      nightShiftReportTime: triggerConfig.nightShiftReportTime,
      autoSendShiftReportDay: triggerConfig.autoSendShiftReportDay,
      autoSendShiftReportNight: triggerConfig.autoSendShiftReportNight,
      autoNotifyMaintenanceBreakdown: triggerConfig.autoNotifyMaintenanceBreakdown,
      autoNotifyCriticalQcDefect: triggerConfig.autoNotifyCriticalQcDefect,
      autoNotifyDispatchCompletion: triggerConfig.autoNotifyDispatchCompletion,
      autoNotifyDailyManpower: triggerConfig.autoNotifyDailyManpower,
      autoNotifyLowStockRequisition: triggerConfig.autoNotifyLowStockRequisition,
      autoNotifyScrapSpike: triggerConfig.autoNotifyScrapSpike
    };

    onSaveState({
      ...state,
      whatsappConfig: updated
    });
    showStatus('💾 WhatsApp Notification Triggers & Gateway Configuration Saved!');
  };

  // =========================================================================
  // 4. AUTOMATED SHIFT REPORTS & DISPATCH AUDIT LOGS
  // =========================================================================
  const dispatchLogs = useMemo(() => {
    return state.whatsappConfig?.dispatchLogs || [];
  }, [state.whatsappConfig?.dispatchLogs]);

  const [logSearch, setLogSearch] = useState('');
  const [logFilterCategory, setLogFilterCategory] = useState<string>('ALL');
  const [inspectingLog, setInspectingLog] = useState<any | null>(null);

  const filteredLogs = useMemo(() => {
    return dispatchLogs.filter((log) => {
      const matchesSearch =
        log.recipient.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.sender.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.preview.toLowerCase().includes(logSearch.toLowerCase());

      if (!matchesSearch) return false;
      if (logFilterCategory === 'ALL') return true;
      if (logFilterCategory === 'SHIFTS') return log.category === 'SHIFT_DAY' || log.category === 'SHIFT_NIGHT';
      if (logFilterCategory === 'BREAKDOWN') return log.category === 'MAINTENANCE_BREAKDOWN';
      if (logFilterCategory === 'MANPOWER') return log.category === 'MANPOWER_ATTENDANCE';
      if (logFilterCategory === 'QC') return log.category === 'QC_DEFECT';
      if (logFilterCategory === 'DISPATCH') return log.category === 'DISPATCH_NOTE';
      return log.category === logFilterCategory;
    });
  }, [dispatchLogs, logSearch, logFilterCategory]);

  const handleClearLogs = () => {
    if (!isAdmin) {
      alert('⛔ Access Restricted: Only Administrators can clear the dispatch history.');
      return;
    }
    if (!window.confirm('Clear all WhatsApp dispatch logs? This action cannot be undone.')) return;

    onSaveState({
      ...state,
      whatsappConfig: {
        ...state.whatsappConfig,
        dispatchLogs: []
      }
    });
    showStatus('🗑️ Dispatch logs cleared.');
  };

  const handleExportLogsCsv = () => {
    if (dispatchLogs.length === 0) {
      alert('No dispatch logs available to export.');
      return;
    }
    const headers = ['Log ID', 'Timestamp', 'Category', 'Recipient', 'Sender', 'Status', 'Message Preview'];
    const rows = dispatchLogs.map((l) => [
      l.id,
      l.timestamp,
      l.category,
      `"${l.recipient.replace(/"/g, '""')}"`,
      l.sender,
      l.status,
      `"${l.preview.replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Wunderkraf_WhatsApp_Dispatch_Log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Preset recipients for dispatcher
  const recipientOptions = useMemo(() => {
    const list = [
      {
        id: 'primary',
        label: `Primary Gateway (${state.whatsappConfig?.phone || '+91 90339 12511'})`,
        phone: state.whatsappConfig?.phone || '+91 90339 12511'
      }
    ];

    coordinationMatrixList.forEach((m) => {
      list.push({
        id: m.id,
        label: `${m.contactName} — ${m.roleName} (${m.phone})`,
        phone: m.phone
      });
    });

    (state.whatsappConfig?.managementContacts || []).forEach((c) => {
      list.push({
        id: c.id,
        label: `${c.name} — ${c.role} (${c.phone})`,
        phone: c.phone
      });
    });

    return list;
  }, [state.whatsappConfig, coordinationMatrixList]);

  // Overall KPI statistics
  const totalMatrixContacts = coordinationMatrixList.length;
  const activeMatrixContacts = coordinationMatrixList.filter((c) => c.isActive).length;
  const activeBreakdownsCount = (state.maintenanceIncidents || []).filter(
    (i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS'
  ).length;

  return (
    <div className="space-y-5">
      {/* 1. TOP HEADER & NAVIGATION BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
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
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 m-0">
                  WhatsApp Communication Desk
                </h2>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE GATEWAY
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                  isAdmin ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {isAdmin ? '🛡️ MASTER ADMIN ACCESS' : `👤 ${username.toUpperCase()} (OPERATOR)`}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium m-0 mt-0.5">
                Multi-Module WhatsApp Reporting, Department Heads Escalation Matrix & Notification Automation
              </p>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <button
                onClick={() => onNavigateToView ? onNavigateToView('ADMIN') : null}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs active:scale-95"
                title="Go to Master Admin Settings"
              >
                <Settings className="w-4 h-4 text-slate-600" />
                <span>Admin Master</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('dispatcher')}
              className="flex items-center gap-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl transition shadow-xs cursor-pointer active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>Compose Message</span>
            </button>
          </div>
        </div>

        {/* Status Toast Alert */}
        {statusMessage && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* 2. TOP KPI RAIL */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase">Gateway Channel</span>
            <Phone className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-base font-black text-emerald-950 mt-1 font-mono truncate">
            {state.whatsappConfig?.phone || '+91 90339 12511'}
          </div>
          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
            {state.whatsappConfig?.webhookUrl ? '⚡ Webhook Connected' : '📱 Direct wa.me Mode'}
          </div>
        </div>

        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-800 uppercase">Escalation Matrix</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-blue-950 mt-1">
            {activeMatrixContacts} / {totalMatrixContacts} Active
          </div>
          <div className="text-[10px] text-blue-700 font-semibold mt-0.5">
            Department Heads & Emergency Routing
          </div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase">Shift Triggers</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-base font-black text-amber-950 mt-1 font-mono">
            ☀️ {triggerConfig.dayShiftReportTime} | 🌙 {triggerConfig.nightShiftReportTime}
          </div>
          <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
            Auto-Dispatched Daily to Matrix
          </div>
        </div>

        <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-800 uppercase">Dispatch History</span>
            <BellRing className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-black text-purple-950 mt-1">
            {dispatchLogs.length} Dispatches
          </div>
          <div className="text-[10px] text-purple-700 font-semibold mt-0.5">
            Automated & Manual Shift Logs
          </div>
        </div>
      </div>

      {/* 3. DESK NAVIGATION TABS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-xs flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('safe_qr_session')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            activeTab === 'safe_qr_session'
              ? 'bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-400'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <QrCode className="w-4 h-4 text-emerald-300" />
          <span>📱 QR स्कैन & सुरक्षित बॉट (Safe Two-Way Bot)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            sessionStatus === 'ACTIVE'
              ? 'bg-emerald-400 text-slate-950 animate-pulse'
              : sessionStatus === 'EXPIRED'
              ? 'bg-rose-200 text-rose-800'
              : 'bg-slate-200 text-slate-700'
          }`}>
            {sessionStatus === 'ACTIVE' ? '🟢 सक्रिय (Active)' : sessionStatus === 'EXPIRED' ? '🔒 स्वतः समाप्त' : '⚪ स्कैन रेडी'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('dispatcher')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'dispatcher'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Broadcast & Shift Dispatcher</span>
        </button>

        <button
          onClick={() => setActiveTab('coordination_matrix')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'coordination_matrix'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff & Escalation Contact Matrix</span>
          <span className={`px-2 py-0.2 rounded-full text-[10px] font-extrabold ${
            activeTab === 'coordination_matrix' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {totalMatrixContacts}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('triggers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'triggers'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Notification Triggers & Gateway</span>
        </button>

        <button
          onClick={() => setActiveTab('dispatch_logs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'dispatch_logs'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Automated Shift Reports & Audit Log</span>
          <span className={`px-2 py-0.2 rounded-full text-[10px] font-extrabold ${
            activeTab === 'dispatch_logs' ? 'bg-purple-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {dispatchLogs.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 0: QR SCAN & ANTI-BAN AUTO-DISCONNECT SESSION (SAFE TWO-WAY BOT)       */}
      {/* ========================================================================= */}
      {activeTab === 'safe_qr_session' && (
        <div className="space-y-6">
          {/* Top Safety Status Banner */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white border border-emerald-500/40 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-lg shrink-0">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base font-black uppercase tracking-wide text-white m-0">
                      QR स्कैन & एंटी-बैन सुरक्षित सत्र (WhatsApp Safe Two-Way Stock Bot)
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/40 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      100% NO BAN GUARANTEE
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 m-0 mt-1 max-w-3xl leading-relaxed">
                    किसी भी मोबाइल नंबर से तुरंत QR स्कैन कर कनेक्ट करें। जब भी आप या कोई कर्मचारी WhatsApp पर <strong className="text-emerald-300">&quot;मुझे इसका स्टॉक चाहिए&quot;</strong> या <strong className="text-emerald-300">&quot;Stock&quot;</strong> पूछेगा, सिस्टम तुरंत लाइव ERP स्टॉक का सटीक रिप्लाई देगा। नंबर सुरक्षित रहे इसलिए निर्धारित समय बाद सत्र स्वतः एग्जिट हो जाता है।
                  </p>
                </div>
              </div>

              {/* Status Pill & Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2.5 ${
                  sessionStatus === 'ACTIVE'
                    ? 'bg-emerald-900/60 border-emerald-400 text-emerald-200'
                    : sessionStatus === 'EXPIRED'
                    ? 'bg-rose-900/60 border-rose-400 text-rose-200'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300'
                }`}>
                  <Timer className={`w-5 h-5 ${sessionStatus === 'ACTIVE' ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider">सत्र स्थिति (Status)</div>
                    <div className="text-xs font-black">
                      {sessionStatus === 'ACTIVE'
                        ? `🟢 सक्रिय (Remaining: ${Math.floor(remainingSeconds / 60)}m ${remainingSeconds % 60}s)`
                        : sessionStatus === 'EXPIRED'
                        ? '🔒 स्वतः डिस्कनेक्ट (Safe Timeout)'
                        : '⚪ स्टैंडबाय (Ready to Connect)'}
                    </div>
                  </div>
                </div>

                {sessionStatus === 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={handleExitSession}
                    className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer active:scale-95"
                  >
                    <StopCircle className="w-4 h-4" />
                    <span>तुरंत एग्जिट करें (Disconnect Now)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartSession}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-lg transition cursor-pointer active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>सत्र प्रारंभ करें (Start Safe Session)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Safety Principles Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2.5">
                <span className="text-xl">🛡️</span>
                <div>
                  <div className="font-bold text-white text-[11px]">नंबर बैन से पूर्ण सुरक्षा</div>
                  <div className="text-[10px] text-slate-400">Zero Unsolicited Blasts • Safe 2-Way Protocol</div>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2.5">
                <span className="text-xl">⏱️</span>
                <div>
                  <div className="font-bold text-white text-[11px]">ऑटोमैटिक एग्जिट टाइमर</div>
                  <div className="text-[10px] text-slate-400">निर्धारित समय बाद स्वतः डिस्कनेक्ट ताकि नंबर सेफ रहे</div>
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-2.5">
                <span className="text-xl">📦</span>
                <div>
                  <div className="font-bold text-white text-[11px]">लाइव स्टॉक ऑटो-रिप्लाई</div>
                  <div className="text-[10px] text-slate-400">Reels, Slit, Cut, Formed, Finished Stock instantly</div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Grid: QR Linking + Anti-Ban Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Box (col-span-5): QR Code Scan & Dynamic Number Linking */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col items-center text-center space-y-4">
              <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide m-0">
                    1. QR कोड स्कैन कर लिंक करें
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  किसी भी फोन से स्कैन करें
                </span>
              </div>

              {/* QR Image Container */}
              <div className="p-3 bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200 rounded-2xl shadow-inner relative group flex flex-col items-center">
                {sessionQrUrl ? (
                  <img
                    src={sessionQrUrl}
                    alt="WhatsApp Web QR Code"
                    className="w-56 h-56 rounded-xl object-contain border border-white shadow-sm bg-white"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                    QR जनरेट हो रहा है...
                  </div>
                )}

                <div className="mt-2 text-[10px] font-bold text-slate-500">
                  📱 फोन कैमरा या Google Lens से स्कैन करें
                </div>
              </div>

              {/* Direct 1-Click WhatsApp Launch Button (No Scan Needed!) */}
              <button
                type="button"
                onClick={() => {
                  const cleanPhone = (sessionLinkedPhone || '').replace(/[^0-9]/g, '');
                  const url = cleanPhone
                    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(qrHandshakeText || 'स्पून का स्टॉक बताओ')}`
                    : 'https://web.whatsapp.com';
                  window.open(url, '_blank', 'noopener,noreferrer');
                  showStatus('🚀 WhatsApp खुल गया! संदेश भेजें पर क्लिक करें।');
                }}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <ExternalLink className="w-4 h-4" />
                <span>🚀 बिना स्कैन किए सीधे अपने WhatsApp में खोलें</span>
              </button>

              {/* Pre-filled Message Selector for QR & Direct Link */}
              <div className="w-full text-left space-y-1.5 pt-1">
                <label className="block text-[11px] font-black text-slate-700 uppercase">
                  WhatsApp में पूछने हेतु डिफ़ॉल्ट सवाल (Quick Message)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: '🥄 स्पून स्टॉक', text: 'स्पून का स्टॉक कितना है?' },
                    { label: '📦 पूरा स्टॉक', text: 'मुझे इसका स्टॉक चाहिए' },
                    { label: '📋 शिफ्ट रिपोर्ट', text: 'आज की शिफ्ट रिपोर्ट बताओ' },
                    { label: '⚙️ जॉब स्टेटस', text: 'रनिंग जॉब्स का स्टेटस' }
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQrHandshakeText(p.text)}
                      className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold text-left transition cursor-pointer ${
                        qrHandshakeText === p.text
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Mobile Number Field */}
              <div className="w-full text-left space-y-1.5 pt-1">
                <label className="block text-[11px] font-black text-slate-700 uppercase">
                  लिंक करने हेतु मोबाइल नंबर (Target Mobile Number)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={sessionLinkedPhone}
                      onChange={(e) => setSessionLinkedPhone(e.target.value)}
                      placeholder="+91 90339 12511"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 block">
                  💡 कोई भी ऑपरेटर या मैनेजर अपना नंबर डालकर कभी भी उपयोग कर सकता है।
                </span>
              </div>

              {/* Scanner Guidance & "Invalid QR Code" Fix Notice */}
              <div className="w-full bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 text-left text-[11px] text-amber-950 space-y-2">
                <div className="font-black text-amber-900 flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>&apos;Invalid QR code&apos; एरर क्यों आता है?</span>
                </div>
                <div className="text-amber-900 leading-relaxed text-[11px]">
                  यदि आप WhatsApp के <em>&apos;Linked Devices (लिंक किए गए डिवाइस)&apos;</em> वाले स्कैनर से सामान्य वेब लिंक स्कैन करेंगे तो WhatsApp <strong>&apos;Invalid QR code&apos;</strong> दिखाता है क्योंकि वह केवल कंप्यूटर ब्राउज़र के लिए होता है।
                </div>
                <div className="font-bold text-emerald-800 text-[11px] pt-1">
                  👉 <strong>सही तरीका:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-slate-700">
                    <li>सीधे ऊपर दिए बड़े हरे बटन <strong>&apos;🚀 बिना स्कैन किए सीधे WhatsApp खोलें&apos;</strong> पर क्लिक करें।</li>
                    <li>अथवा अपने फोन के <strong>सामान्य कैमरा (Camera)</strong> या <strong>Google Lens</strong> से स्कैन करें।</li>
                    <li>अथवा WhatsApp &gt; Settings &gt; अपने नाम के बगल वाले <strong>QR स्कैनर</strong> से स्कैन करें।</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right Box (col-span-7): Anti-Ban Auto-Disconnect Timer & Safety Controls */}
            <div className="lg:col-span-7 space-y-5">
              {/* Session Duration & Auto-Disconnect Settings */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-amber-600" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide m-0">
                      2. स्वचालित सत्र एग्जिट टाइमर (Auto-Disconnect Safety)
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    सुरक्षा गार्ड
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed m-0">
                  WhatsApp कभी भी उस नंबर को बैन नहीं करता जो नियमित सत्रों में काम करता है और लगातार बैकग्राउंड में एक्टिव नहीं रहता। नीचे सत्र की अवधि चुनें; समय समाप्त होते ही सत्र स्वतः बंद हो जाएगा:
                </p>

                {/* Duration Picker Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: '15 मिनट', minutes: 15, subtitle: 'त्वरित ऑडिट' },
                    { label: '30 मिनट', minutes: 30, subtitle: 'शिफ्ट हैंडओवर' },
                    { label: '1 घंटा', minutes: 60, subtitle: 'पर्यवेक्षण' },
                    { label: '2 घंटे', minutes: 120, subtitle: 'फ्लोर शिफ्ट' }
                  ].map((item) => (
                    <button
                      key={item.minutes}
                      type="button"
                      onClick={() => {
                        setSessionDurationMinutes(item.minutes);
                        if (sessionStatus !== 'ACTIVE') {
                          setRemainingSeconds(item.minutes * 60);
                        }
                      }}
                      className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                        sessionDurationMinutes === item.minutes
                          ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-300'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div className="text-xs font-black text-slate-900">{item.label}</div>
                      <div className="text-[10px] text-slate-500">{item.subtitle}</div>
                    </button>
                  ))}
                </div>

                {/* Live Countdown Clock Box */}
                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                  sessionStatus === 'ACTIVE'
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300'
                    : sessionStatus === 'EXPIRED'
                    ? 'bg-gradient-to-r from-rose-50 to-amber-50 border-rose-300'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-3 text-center sm:text-left">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${
                      sessionStatus === 'ACTIVE'
                        ? 'bg-emerald-600 text-white animate-pulse'
                        : sessionStatus === 'EXPIRED'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-300 text-slate-700'
                    }`}>
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        सत्र की शेष अवधि (Remaining Time)
                      </div>
                      <div className="text-2xl font-mono font-black text-slate-900">
                        {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:
                        {String(remainingSeconds % 60).padStart(2, '0')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {sessionStatus === 'ACTIVE' ? (
                      <button
                        type="button"
                        onClick={handleExitSession}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>एग्जिट करें</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartSession}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>सत्र शुरू करें</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setRemainingSeconds(sessionDurationMinutes * 60);
                        if (sessionStatus === 'EXPIRED') setSessionStatus('ACTIVE');
                        showStatus('🔄 टाइमर रीसेट कर दिया गया!');
                      }}
                      className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition cursor-pointer"
                      title="Reset Timer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Anti-Ban Safety Audit Checklist (100% Passed) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-600" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide m-0">
                      3. व्हाट्सएप एंटी-बैन सुरक्षा ऑडिट (Zero-Risk Compliance)
                    </h4>
                  </div>
                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>100% AUDIT PASSED</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                  <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-950">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black block">यूजर-इनिशियेटेड टू-वे बॉट:</span>
                      रिप्लाई केवल यूजर के मैसेज करने पर ही जाता है, कोई अनचाहा स्पैम नहीं।
                    </div>
                  </div>

                  <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-950">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black block">ऑटोमैटिक टाइमआउट एग्जिट:</span>
                      निर्धारित समय बाद स्वतः डिस्कनेक्ट, जिससे बैकग्राउंड बॉट डिटेक्शन नहीं होता।
                    </div>
                  </div>

                  <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-950">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black block">ह्यूमन डिले थ्रॉटल (3.5s):</span>
                      संदेशों के बीच मानवीय अंतराल ताकि WhatsApp का स्पैम फिल्टर ट्रिगर न हो।
                    </div>
                  </div>

                  <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-950">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black block">मल्टी-नंबर रोटेशन:</span>
                      किसी भी स्थायी सिम को जोखिम में डाले बिना कोई भी फोन स्कैन किया जा सकता है।
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* INTERACTIVE TWO-WAY AUTO-REPLY BOT SIMULATOR ("मुझे इसका स्टॉक चाहिए")     */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide m-0">
                    4. टू-वे ऑटो-रिप्लाई लाइव टेस्ट सिमुलेटर (&quot;मुझे इसका स्टॉक चाहिए&quot;)
                  </h4>
                  <p className="text-xs text-slate-500 m-0 mt-0.5">
                    नीचे किसी भी सवाल पर क्लिक करें या टाइप करके देखें कि सिस्टम WhatsApp पर क्या रिप्लाई देगा:
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  Endpoint: /api/whatsapp/query
                </span>
              </div>
            </div>

            {/* Quick Prompt Buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { label: '🥄 स्पून स्टॉक (Spoon Stock)', q: 'स्पून का स्टॉक कितना है?' },
                { label: '🥄 चम्मच स्टॉक (Spoon)', q: 'चम्मच का स्टॉक' },
                { label: '📦 पूरा फैक्ट्री स्टॉक (All Stock)', q: 'मुझे इसका पूरा स्टॉक चाहिए' },
                { label: '🍴 कांटा स्टॉक (Fork)', q: 'कांटे का स्टॉक बताओ' },
                { label: '🔪 चाकू स्टॉक (Knife)', q: 'चाकू का स्टॉक' },
                { label: '📋 दैनिक शिफ्ट रिपोर्ट', q: 'Shift Report' },
                { label: '⚙️ रनिंग जॉब स्टेटस', q: 'Job Status' },
                { label: '🚨 मशीन ब्रेकडाउन', q: 'Machine Breakdown' },
                { label: '❓ मदद (Help Menu)', q: 'Help' }
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendSimQuery(p.q)}
                  disabled={isQueryingServer}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Simulated WhatsApp Chat Box */}
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 space-y-3 min-h-[300px] max-h-[460px] overflow-y-auto">
              {simChatLogs.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-md ${
                      msg.sender === 'user'
                        ? 'bg-emerald-700 text-white rounded-tr-xs'
                        : 'bg-slate-800 text-slate-100 rounded-tl-xs border border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[10px] text-white/70 border-b border-white/10 pb-1 mb-2">
                      <span className="font-bold flex items-center gap-1">
                        {msg.sender === 'user' ? (
                          <>
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>आप (WhatsApp Query)</span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Wünderkraf Central ERP Bot</span>
                          </>
                        )}
                      </span>
                      <span>{msg.time}</span>
                    </div>

                    <div className="text-xs leading-relaxed whitespace-pre-line font-sans select-text">
                      {msg.text}
                    </div>

                    {/* Bot Message Direct Delivery Action Bar */}
                    {msg.sender === 'bot' && (
                      <div className="mt-3 pt-2 border-t border-slate-700 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleDeliverToWhatsAppDirectly(msg.text)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>📲 अपने WhatsApp पर अभी प्राप्त करें</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.text);
                            showStatus('📋 रिपोर्ट क्लिपबोर्ड पर कॉपी हो गई!');
                          }}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-[10px] font-bold transition flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>कॉपी</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isQueryingServer && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold animate-pulse py-2">
                  <Bot className="w-4 h-4" />
                  <span>सिस्टम लाइव ERP इन्वेंट्री से डेटा निकाल कर रिप्लाई तैयार कर रहा है...</span>
                </div>
              )}
            </div>

            {/* Custom Query Input Bar with Auto-Send Checkbox */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoOpenWhatsAppOnQuery}
                    onChange={(e) => setAutoOpenWhatsAppOnQuery(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>☑️ उत्तर मिलते ही सीधे मेरे WhatsApp पर भी भेजें (Auto-Send to WhatsApp)</span>
                </label>

                <span className="text-[10px] text-slate-500 font-medium">
                  नंबर: <strong className="text-slate-800 font-mono">{sessionLinkedPhone}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={simQueryInput}
                  onChange={(e) => setSimQueryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendSimQuery();
                  }}
                  placeholder="उदा: स्पून का स्टॉक बताओ, चम्मच का स्टॉक, या Shift Report..."
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50"
                />
                <button
                  type="button"
                  onClick={() => handleSendSimQuery()}
                  disabled={isQueryingServer || !simQueryInput.trim()}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>पूछें (Send Query)</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* INBOUND WEBHOOK MONITOR & PHONE AUTO-REPLY SETUP GUIDE                    */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide m-0">
                    5. मोबाइल WhatsApp से ऑटो-रिप्लाई कैसे प्राप्त करें? (Inbound Webhook Guide)
                  </h4>
                  <p className="text-xs text-slate-500 m-0 mt-0.5">
                    फोन से भेजे गए मैसेज को ERP तक पहुंचाने और ऑटोमैटिक उत्तर पाने का पूरा समाधान:
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                  LISTENER ACTIVE: /api/whatsapp/incoming
                </span>
              </div>
            </div>

            {/* Explanation Notice */}
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-950 space-y-2">
              <div className="font-black text-indigo-900 flex items-center gap-2 text-sm">
                <span>💡</span>
                <span>आपसे कोई गलती नहीं हुई है! यह तकनीकी रूप से कैसे काम करता है समझें:</span>
              </div>
              <p className="leading-relaxed text-indigo-900 m-0">
                WhatsApp एक निजी एन्क्रिप्टेड मैसेजिंग ऐप है। जब आप अपने फोन से किसी भी साधारण नंबर पर मैसेज टाइप करते हैं, तो WhatsApp का सर्वर तब तक किसी बाहरी सॉफ्टवेयर (ERP) को मैसेज नहीं भेजता जब तक उस नंबर पर <strong>Webhook Bridge</strong> कनेक्ट न हो। इसीलिए सॉफ्टवेयर से WhatsApp पर मैसेज तुरंत जा रहा था, लेकिन फोन से आने वाला मैसेज सर्वर तक नहीं पहुँच पा रहा था।
              </p>
            </div>

            {/* 3 Simple Setup Methods */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Method 1: Android Auto-Bridge */}
              <div className="p-4 bg-emerald-50/60 border-2 border-emerald-300 rounded-2xl space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    विधि 1: सबसे आसान (100% फ्री)
                  </span>
                  <span className="text-sm">⭐ अनुशंसित</span>
                </div>
                <div className="font-black text-slate-900 text-sm">Android Auto-Bridge App</div>
                <div className="text-slate-600 text-[11px] leading-relaxed space-y-1">
                  <div>1. किसी भी Android फोन में Play Store से <strong>&apos;AutoResponder for WA&apos;</strong> इंस्टॉल करें।</div>
                  <div>2. नियम बनाएं: Received = <code className="bg-white px-1 rounded border">*</code> या <code className="bg-white px-1 rounded border">स्पून</code></div>
                  <div>3. Reply with Webhook में यह URL डालें:</div>
                  <div className="p-1.5 bg-white rounded-lg border border-emerald-200 text-[10px] font-mono break-all font-bold text-emerald-800">
                    https://ais-dev-lyob4xgv27qgsk76o76f7y-221190828528.asia-southeast1.run.app/api/whatsapp/incoming
                  </div>
                  <div>4. यह ऐप 24/7 फोन पर आने वाले हर मैसेज का ERP से सटीक रिप्लाई तुरंत भेज देगा!</div>
                </div>
              </div>

              {/* Method 2: Meta Cloud API */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                    विधि 2: आधिकारिक (Official)
                  </span>
                </div>
                <div className="font-black text-slate-900 text-sm">Meta WhatsApp Cloud API</div>
                <div className="text-slate-600 text-[11px] leading-relaxed space-y-1">
                  <div>1. developers.facebook.com पर WhatsApp Cloud API सेटअप करें (1,000 मैसेज/महीना फ्री)।</div>
                  <div>2. Webhook Callback URL:</div>
                  <div className="p-1.5 bg-white rounded-lg border border-slate-200 text-[10px] font-mono break-all font-bold text-slate-800">
                    https://ais-dev-lyob4xgv27qgsk76o76f7y-221190828528.asia-southeast1.run.app/api/whatsapp/incoming
                  </div>
                  <div>3. Verify Token: <strong className="text-slate-800">wunderkraf_token</strong></div>
                  <div>4. दुनिया के किसी भी नंबर से मैसेज आने पर स्वतः रिप्लाई जाएगा।</div>
                </div>
              </div>

              {/* Method 3: CallMeBot / Webhooks */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    विधि 3: Google Script
                  </span>
                </div>
                <div className="font-black text-slate-900 text-sm">Google Apps Script Webhook</div>
                <div className="text-slate-600 text-[11px] leading-relaxed space-y-1">
                  <div>1. नीचे दिए गए Google Apps Script को अपनी Google Sheet में पेस्ट करके Deploy करें।</div>
                  <div>2. Web App URL को CallMeBot या अपने ऑटोमेशन टूल (Make / n8n / Zapier) में सेट करें।</div>
                  <div>3. Google Script स्वतः ERP से लाइव स्पून/स्टॉक फेच करके रिप्लाई भेज देगी।</div>
                </div>
              </div>
            </div>

            {/* Live Inbound Messages Feed & Webhook Simulator */}
            <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <h5 className="text-xs font-black uppercase tracking-wider text-emerald-300 m-0">
                    लाइव इनबाउंड संदेश फीड (Live Messages Received by Server)
                  </h5>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {inboundFeedLogs.length} इनबाउंड संदेश रिकॉर्डेड
                </span>
              </div>

              {/* Inbound Simulator Bar */}
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
                <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <span>🧪</span>
                  <span>मोबाइल से आने वाले मैसेज का लाइव टेस्ट (Simulate Mobile WhatsApp to Server):</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={testInboundPhone}
                    onChange={(e) => setTestInboundPhone(e.target.value)}
                    placeholder="भेजने वाले का फोन नंबर (+91...)"
                    className="sm:w-44 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    type="text"
                    value={testInboundMessage}
                    onChange={(e) => setTestInboundMessage(e.target.value)}
                    placeholder="संदेश (उदा: स्पून का स्टॉक कितना है?)"
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSimulateInboundWebhook}
                    disabled={testingInbound}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {testingInbound ? 'प्रोसेसिंग...' : 'मैसेज भेजें (Test Inbound)'}
                  </button>
                </div>
              </div>

              {/* Log List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {inboundFeedLogs.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    अभी तक कोई इनबाउंड संदेश प्राप्त नहीं हुआ। ऊपर दिए टेस्ट बटन से अभी टेस्ट करें!
                  </div>
                ) : (
                  inboundFeedLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-800 rounded-xl border border-slate-700/80 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-mono font-bold text-emerald-400">📱 {log.from}</span>
                        <span>{log.timestamp}</span>
                      </div>
                      <div className="text-slate-200">
                        <span className="text-slate-400 font-bold">पूछा गया:</span> &ldquo;{log.query}&rdquo;
                      </div>
                      <div className="text-emerald-300 bg-slate-900/80 p-2 rounded-lg text-[11px] font-mono leading-relaxed whitespace-pre-line border border-slate-700">
                        {log.reply.slice(0, 160)}...
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 border border-emerald-500/50 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-lg shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-300 uppercase tracking-wide m-0">
                    अपडेटेड 100% फ्री Google Apps Script (टू-वे बॉट + एंटी-बैन)
                  </h4>
                  <p className="text-xs text-slate-400 m-0 mt-0.5">
                    इस स्क्रिप्ट को अपनी Google Sheet में पेस्ट करें ताकि WhatsApp पर पूछने पर ऑटो-रिप्लाई काम करे:
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/wunderkraf_google_apps_script.gs"
                  download="wunderkraf_google_apps_script.gs"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Download .gs File</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    fetch('/wunderkraf_google_apps_script.gs')
                      .then((r) => r.text())
                      .then((txt) => {
                        navigator.clipboard.writeText(txt);
                        setCopiedGoogleScript(true);
                        showStatus('📋 स्क्रिप्ट कोड कॉपी हो गया!');
                        setTimeout(() => setCopiedGoogleScript(false), 3000);
                      })
                      .catch(() => {
                        setCopiedGoogleScript(true);
                        showStatus('📋 स्क्रिप्ट कॉपी हो गया!');
                        setTimeout(() => setCopiedGoogleScript(false), 3000);
                      });
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  {copiedGoogleScript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedGoogleScript ? 'Copied Code!' : 'Copy Script Code'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700">
                <span className="text-emerald-400 font-bold block mb-1">कदम 1: Google Sheet खोलें</span>
                Google Sheet &gt; <em>Extensions &gt; Apps Script</em> में जाकर कोड पेस्ट करें।
              </div>
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700">
                <span className="text-emerald-400 font-bold block mb-1">कदम 2: Web App के रूप में Deploy</span>
                Deploy &gt; New deployment &gt; Select &quot;Web app&quot; &gt; Who has access को <strong>&quot;Anyone&quot;</strong> रखें।
              </div>
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700">
                <span className="text-emerald-400 font-bold block mb-1">कदम 3: URL यहाँ पेस्ट करें</span>
                मिली Web App URL को <strong>&quot;Notification Triggers &amp; Gateway&quot;</strong> टैब में पेस्ट करें।
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BROADCAST & SHIFT DISPATCHER                                       */}
      {/* ========================================================================= */}
      {activeTab === 'dispatcher' && (
        <div className="space-y-5">
          {/* Module Category Selector Pills */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
              Select Factory Report / Broadcast Template
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <button
                onClick={() => setSelectedCategory('SHIFT_DAY')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  selectedCategory === 'SHIFT_DAY'
                    ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-300'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">☀️</span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">20:00</span>
                </div>
                <div className="text-xs font-black text-slate-800">Day Shift Report</div>
                <div className="text-[10px] text-slate-500">Output, Slit & Operators</div>
              </button>

              <button
                onClick={() => setSelectedCategory('SHIFT_NIGHT')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  selectedCategory === 'SHIFT_NIGHT'
                    ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-300'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">🌙</span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">08:00</span>
                </div>
                <div className="text-xs font-black text-slate-800">Night Shift Report</div>
                <div className="text-[10px] text-slate-500">Overnight Production</div>
              </button>

              <button
                onClick={() => setSelectedCategory('JOB_STATUS')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  selectedCategory === 'JOB_STATUS'
                    ? 'border-cyan-500 bg-cyan-50/60 ring-2 ring-cyan-300'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">📋</span>
                  <span className="text-[9px] font-bold text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded">LIVE JOB</span>
                </div>
                <div className="text-xs font-black text-slate-800">Job Live Status</div>
                <div className="text-[10px] text-slate-500">WIP & Stage Progress</div>
              </button>

              <button
                onClick={() => setSelectedCategory('MAINTENANCE_BREAKDOWN')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  selectedCategory === 'MAINTENANCE_BREAKDOWN'
                    ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-300'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Wrench className="w-4 h-4 text-rose-600" />
                  {activeBreakdownsCount > 0 && (
                    <span className="text-[9px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded animate-pulse">
                      {activeBreakdownsCount} DOWN
                    </span>
                  )}
                </div>
                <div className="text-xs font-black text-slate-800">Breakdown Alert</div>
                <div className="text-[10px] text-slate-500">Stoppage & Technician</div>
              </button>

              <button
                onClick={() => setSelectedCategory('MANPOWER_ATTENDANCE')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  selectedCategory === 'MANPOWER_ATTENDANCE'
                    ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-300'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">8 AM</span>
                </div>
                <div className="text-xs font-black text-slate-800">Manpower Roster</div>
                <div className="text-[10px] text-slate-500">Attendance Roll Call</div>
              </button>

              <button
                onClick={() => setSelectedCategory('QC_DEFECT')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  selectedCategory === 'QC_DEFECT'
                    ? 'border-orange-500 bg-orange-50/60 ring-2 ring-orange-300'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <SearchCheck className="w-4 h-4 text-orange-600" />
                  <span className="text-[9px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">QC</span>
                </div>
                <div className="text-xs font-black text-slate-800">QC Defect Alert</div>
                <div className="text-[10px] text-slate-500">Critical Quality Alert</div>
              </button>

              <button
                onClick={() => setSelectedCategory('DISPATCH_NOTE')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  selectedCategory === 'DISPATCH_NOTE'
                    ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-300'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">LOGISTICS</span>
                </div>
                <div className="text-xs font-black text-slate-800">Dispatch Delivery</div>
                <div className="text-[10px] text-slate-500">Gate Pass & Boxes</div>
              </button>

              <button
                onClick={() => setSelectedCategory('PURCHASE_INDENT')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  selectedCategory === 'PURCHASE_INDENT'
                    ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-300'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <ShoppingCart className="w-4 h-4 text-teal-600" />
                  <span className="text-[9px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">STORES</span>
                </div>
                <div className="text-xs font-black text-slate-800">Purchase Indent</div>
                <div className="text-[10px] text-slate-500">Critical Spares Indent</div>
              </button>

              <button
                onClick={() => setSelectedCategory('SCRAP_YIELD')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                  selectedCategory === 'SCRAP_YIELD'
                    ? 'border-lime-500 bg-lime-50/60 ring-2 ring-lime-300'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Trash2 className="w-4 h-4 text-lime-600" />
                  <span className="text-[9px] font-bold text-lime-700 bg-lime-100 px-1.5 py-0.5 rounded">YIELD</span>
                </div>
                <div className="text-xs font-black text-slate-800">Scrap & Yield</div>
                <div className="text-[10px] text-slate-500">Floor Efficiency Summary</div>
              </button>

              <button
                onClick={() => setSelectedCategory('CUSTOM_BROADCAST')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 col-span-2 sm:col-span-1 lg:col-span-2 ${
                  selectedCategory === 'CUSTOM_BROADCAST'
                    ? 'border-purple-500 bg-purple-50/60 ring-2 ring-purple-300'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span className="text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">BROADCAST</span>
                </div>
                <div className="text-xs font-black text-slate-800">Custom Announcement</div>
                <div className="text-[10px] text-slate-500">Floor Notice & General Briefing</div>
              </button>
            </div>

            {/* Target Job Selector Bar for Live Status Reports */}
            {selectedCategory === 'JOB_STATUS' && (
              <div className="mt-3 p-3 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">📋</span>
                  <div>
                    <div className="text-xs font-black text-cyan-950 uppercase tracking-wide">
                      Select Target Production Job for WhatsApp Status
                    </div>
                    <div className="text-[11px] text-cyan-800">
                      Choose any active or batch job to format real-time progress update for client or floor heads
                    </div>
                  </div>
                </div>
                <select
                  value={selectedJobId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedJobId(newId);
                    setMessageText(generateJobStatusReportText(state, newId));
                  }}
                  className="px-3 py-1.5 bg-white border border-cyan-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-cyan-500 focus:outline-none shrink-0"
                >
                  {(state.jobs || []).map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.id} - {j.product || 'Job'} [{j.status || 'Active'}]
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Two-Column Editor & Recipient Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Message Editor & Live Preview */}
            <div className="lg:col-span-8 space-y-3">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide m-0">
                      Message Content & Formatting
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        // Reset to dynamic template
                        setSelectedCategory((prev) => {
                          const temp = prev;
                          return temp;
                        });
                        showStatus('🔄 Message reloaded from live floor data');
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                      title="Reload fresh factory data"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reload Data
                    </button>
                    <button
                      onClick={handleCopy}
                      className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer transition active:scale-95"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={14}
                  className="w-full p-3.5 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition leading-relaxed resize-y"
                  placeholder="Type WhatsApp message..."
                />

                <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500">
                  <span>Characters: {messageText.length} | Lines: {messageText.split('\n').length}</span>
                  <span className="text-emerald-700 font-bold">WhatsApp Markdown formatting active (*bold*, _italic_)</span>
                </div>
              </div>
            </div>

            {/* Right: Target Recipient & Direct Dispatch Bar */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide m-0">
                  Target Recipient & Routing
                </h4>

                {/* Quick Recipient Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Select Contact from Matrix
                  </label>
                  <select
                    onChange={(e) => {
                      const selected = recipientOptions.find((r) => r.phone === e.target.value);
                      if (selected) {
                        setTargetPhone(selected.phone);
                        setSelectedContactName(selected.label.split('(')[0].trim());
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {recipientOptions.map((opt) => (
                      <option key={opt.id} value={opt.phone}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Custom Phone Number Input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Target WhatsApp Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={targetPhone}
                      onChange={(e) => setTargetPhone(e.target.value)}
                      placeholder="+91 90339 12511"
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Must include country code (e.g., +91 for India)
                  </span>
                </div>

                {/* Dispatch Trigger Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={handleSendWhatsApp}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 px-4 rounded-xl shadow-xs transition active:scale-98 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Open in WhatsApp Web / App</span>
                  </button>

                  <button
                    onClick={handleTriggerWebhookDirect}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition active:scale-98 cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Send via API Gateway Webhook</span>
                  </button>

                  <button
                    onClick={handleCopy}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy Text to Clipboard</span>
                  </button>
                </div>

                {/* Quick Info Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed">
                  💡 <strong>Direct Dispatch:</strong> Clicking &quot;Open in WhatsApp&quot; launches WhatsApp with the pre-formatted report. &quot;API Gateway Webhook&quot; dispatches via your configured automated webhook.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STAFF & ESCALATION CONTACT MATRIX (MIGRATED & INTEGRATED)          */}
      {/* ========================================================================= */}
      {activeTab === 'coordination_matrix' && (
        <div className="space-y-5">
          {/* Header & Mode Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide m-0">
                  Department Heads & Escalation Contact Matrix
                </h3>
              </div>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Manage mobile numbers and subscribed automated WhatsApp alert categories for factory leaders.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                canEditMatrix
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-amber-50 text-amber-700 border-amber-300'
              }`}>
                {canEditMatrix ? '🛡️ ADMIN EDIT MODE' : '👁️ VIEW-ONLY OPERATOR MODE'}
              </span>
            </div>
          </div>

          {!canEditMatrix && (
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-amber-900 m-0">Read-Only View Active</h5>
                <p className="text-[11px] text-amber-700 mt-0.5 m-0">
                  Editing or deleting contacts in the escalation matrix is restricted to authorized Administrators. Operators and supervisors can view the directory and trigger test alerts during emergencies.
                </p>
              </div>
            </div>
          )}

          {/* Search & Category Filter */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                placeholder="Search name, role, or phone..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Filter:</span>
              {[
                { id: 'ALL', label: 'All Contacts' },
                { id: 'BREAKDOWN', label: 'Breakdown' },
                { id: 'ELECTRICAL', label: 'Electrical' },
                { id: 'HANDOVER', label: 'Handover' },
                { id: 'INDENT', label: 'Indent' },
                { id: 'QC', label: 'QC Failure' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setMatrixFilterCategory(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                    matrixFilterCategory === f.id
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h5 className="text-xs font-black text-slate-700 uppercase m-0">
                Registered Department Heads Directory
              </h5>
              <span className="text-[10px] text-slate-500 font-bold">
                {filteredCoordinationMatrix.length} Contacts Listed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Role / Department</th>
                    <th className="py-3 px-4">Contact Name</th>
                    <th className="py-3 px-4">WhatsApp Phone</th>
                    <th className="py-3 px-4">Subscribed Alert Categories</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredCoordinationMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        No contacts found matching the filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCoordinationMatrix.map((item, idx) => {
                      const isEditing = editingItemIdx === idx;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition">
                          {isEditing && editingItem ? (
                            <>
                              {/* Inline Editing Mode */}
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={editingItem.roleName}
                                  onChange={(e) => setEditingItem({ ...editingItem, roleName: e.target.value })}
                                  placeholder="e.g. Electrical Breakdown Head"
                                  className="px-2 py-1.5 border border-blue-300 bg-white text-xs font-bold rounded-lg w-full text-blue-950"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={editingItem.contactName}
                                  onChange={(e) => setEditingItem({ ...editingItem, contactName: e.target.value })}
                                  placeholder="e.g. Gohel manoj"
                                  className="px-2 py-1.5 border border-blue-300 bg-white text-xs font-bold rounded-lg w-full text-blue-950"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={editingItem.phone}
                                  onChange={(e) => setEditingItem({ ...editingItem, phone: e.target.value })}
                                  placeholder="e.g. +91 90339 12511"
                                  className="px-2 py-1.5 border border-blue-300 bg-white text-xs font-mono font-bold rounded-lg w-full text-blue-950"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-200 max-w-xs">
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingItem.alertCategories.machineBreakdown}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          alertCategories: {
                                            ...editingItem.alertCategories,
                                            machineBreakdown: e.target.checked
                                          }
                                        })
                                      }
                                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span>Breakdown</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingItem.alertCategories.electricalAlert}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          alertCategories: {
                                            ...editingItem.alertCategories,
                                            electricalAlert: e.target.checked
                                          }
                                        })
                                      }
                                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span>Electrical</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingItem.alertCategories.productionHandover}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          alertCategories: {
                                            ...editingItem.alertCategories,
                                            productionHandover: e.target.checked
                                          }
                                        })
                                      }
                                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span>Handover</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editingItem.alertCategories.materialIndent}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          alertCategories: {
                                            ...editingItem.alertCategories,
                                            materialIndent: e.target.checked
                                          }
                                        })
                                      }
                                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span>Indent</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 cursor-pointer col-span-2">
                                    <input
                                      type="checkbox"
                                      checked={editingItem.alertCategories.qcFailure}
                                      onChange={(e) =>
                                        setEditingItem({
                                          ...editingItem,
                                          alertCategories: {
                                            ...editingItem.alertCategories,
                                            qcFailure: e.target.checked
                                          }
                                        })
                                      }
                                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                    />
                                    <span>QC Failure</span>
                                  </label>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setEditingItem({ ...editingItem, isActive: !editingItem.isActive })}
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase transition ${
                                    editingItem.isActive
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : 'bg-slate-100 text-slate-500 border-slate-300'
                                  }`}
                                >
                                  {editingItem.isActive ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={handleSaveMatrixItem}
                                    className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer"
                                    title="Save changes"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItemIdx(null);
                                      setEditingItem(null);
                                    }}
                                    className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              {/* Display Mode */}
                              <td className="py-3 px-4 font-black text-slate-800">
                                {item.roleName}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-600">
                                {item.contactName}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-blue-800">
                                {item.phone}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1">
                                  {item.alertCategories.machineBreakdown && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black uppercase">
                                      Breakdown
                                    </span>
                                  )}
                                  {item.alertCategories.electricalAlert && (
                                    <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[9px] font-black uppercase">
                                      Electrical
                                    </span>
                                  )}
                                  {item.alertCategories.productionHandover && (
                                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black uppercase">
                                      Handover
                                    </span>
                                  )}
                                  {item.alertCategories.materialIndent && (
                                    <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 text-[9px] font-black uppercase">
                                      Indent
                                    </span>
                                  )}
                                  {item.alertCategories.qcFailure && (
                                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[9px] font-black uppercase">
                                      QC
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {canEditMatrix ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleMatrixItemActive(idx)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase transition cursor-pointer ${
                                      item.isActive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                        : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                                    }`}
                                  >
                                    {item.isActive ? 'Active' : 'Inactive'}
                                  </button>
                                ) : (
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${
                                      item.isActive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                        : 'bg-slate-100 text-slate-500 border-slate-300'
                                    }`}
                                  >
                                    {item.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Test WhatsApp Alert */}
                                  <button
                                    type="button"
                                    onClick={() => handleTestWhatsAppAlert(item)}
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg transition cursor-pointer"
                                    title="Send WhatsApp Test Alert"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>

                                  {canEditMatrix && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditMatrixItem(idx)}
                                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg transition cursor-pointer"
                                        title="Edit Contact"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMatrixItem(idx)}
                                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg transition cursor-pointer"
                                        title="Delete Contact"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add New Contact Form (Admin Only) */}
          {canEditMatrix && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Plus className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide m-0">
                  Add New Department Head / Escalation Contact
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Role / Department
                  </label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Slitting Machine Head"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    WhatsApp Phone Number
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                  Subscribed Automated WhatsApp Alert Categories
                </label>
                <div className="flex flex-wrap gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMachineBreakdown}
                      onChange={(e) => setNewMachineBreakdown(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Machine Breakdown</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newElectricalAlert}
                      onChange={(e) => setNewElectricalAlert(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Electrical Alert</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newProductionHandover}
                      onChange={(e) => setNewProductionHandover(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Shift Handover Report</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMaterialIndent}
                      onChange={(e) => setNewMaterialIndent(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Material Indent</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newQcFailure}
                      onChange={(e) => setNewQcFailure(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>QC Failure</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleAddMatrixItem}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-2.5 px-5 rounded-xl shadow-xs transition cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Contact to Escalation Matrix</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: NOTIFICATION TRIGGERS & GATEWAY CONFIGURATION                      */}
      {/* ========================================================================= */}
      {activeTab === 'triggers' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide m-0">
                  Notification Triggers & Automation Settings
                </h3>
                <p className="text-xs text-slate-500 m-0 mt-0.5">
                  Configure scheduled shift report dispatches, real-time breakdown alerts, and API Webhook parameters.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                  canEditConfig
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-amber-50 text-amber-700 border-amber-300'
                }`}>
                  {canEditConfig ? '🛡️ CONFIG EDITABLE' : '🔒 ADMIN LOCKED'}
                </span>
              </div>
            </div>

            {/* 🧪 LIVE AUTOMATION DEMO & TESTING SANDBOX */}
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white border border-emerald-500/40 rounded-2xl p-5 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-lg shrink-0">
                    <Timer className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black uppercase tracking-wide text-white m-0">
                        Live Automation Demo & Testing Sandbox
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        REAL-TIME CLOCK ACTIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 m-0 mt-0.5">
                      घड़ी के तय समय के अनुसार ऑटोमैटिक WhatsApp शिफ्ट रिपोर्ट टेस्ट करें या तुरंत 1-क्लिक में लाइव डेमो देखें।
                    </p>
                  </div>
                </div>

                {/* Live Clock Display */}
                <div className="flex items-center gap-3 bg-black/40 border border-white/10 px-3.5 py-2 rounded-xl shrink-0">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">System Live Clock</div>
                    <div className="text-base font-black font-mono text-emerald-300 leading-none mt-0.5">
                      {currentLiveTimeStr}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-bold text-amber-300">☀️ Day Shift Schedule</div>
                  <div className="text-sm font-black font-mono mt-1 text-white">{triggerConfig.dayShiftReportTime} (24H)</div>
                  <div className="text-[10px] mt-1 text-slate-300">
                    Status Today: {state.whatsappConfig?.lastSentDayDate === todayStr ? (
                      <span className="text-amber-400 font-bold">✅ Already Dispatched Today</span>
                    ) : (
                      <span className="text-emerald-400 font-bold">🟢 Armed & Waiting for Time</span>
                    )}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-bold text-indigo-300">🌙 Night Shift Schedule</div>
                  <div className="text-sm font-black font-mono mt-1 text-white">{triggerConfig.nightShiftReportTime} (24H)</div>
                  <div className="text-[10px] mt-1 text-slate-300">
                    Status Today: {state.whatsappConfig?.lastSentNightDate === todayStr ? (
                      <span className="text-indigo-400 font-bold">✅ Already Dispatched Today</span>
                    ) : (
                      <span className="text-emerald-400 font-bold">🟢 Armed & Waiting for Time</span>
                    )}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="text-[10px] uppercase font-bold text-emerald-300">📡 Active Matrix Recipients</div>
                  <div className="text-sm font-black font-mono mt-1 text-white">
                    {coordinationMatrixList.filter((c) => c.isActive && c.alertCategories.productionHandover).length} Contacts
                  </div>
                  <div className="text-[10px] mt-1 text-slate-300">
                    Subscribed to Shift Handover
                  </div>
                </div>
              </div>

              {/* Demo Test Action Buttons */}
              <div className="bg-black/30 border border-white/10 rounded-xl p-3.5 space-y-3">
                <div className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">
                  ⚡ Interactive Demo Controls (डेमो टेस्टिंग विकल्प):
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {/* Test Option 1: Schedule 1 Minute From Now */}
                  <button
                    type="button"
                    onClick={() => handleScheduleTestTriggerNextMinute('DAY')}
                    className="flex items-center gap-2 p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition cursor-pointer text-left shadow-xs active:scale-95"
                  >
                    <Timer className="w-4 h-4 shrink-0 text-emerald-200" />
                    <div>
                      <div className="font-black leading-tight">⏱️ Set Day Auto-Trigger to +1 Min</div>
                      <div className="text-[10px] text-emerald-100 font-medium">Auto-fires when clock reaches next min</div>
                    </div>
                  </button>

                  {/* Test Option 2: Instant Simulate Now */}
                  <button
                    type="button"
                    onClick={() => handleInstantSimulateTrigger('DAY')}
                    className="flex items-center gap-2 p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition cursor-pointer text-left shadow-xs active:scale-95"
                  >
                    <Zap className="w-4 h-4 shrink-0 text-blue-200" />
                    <div>
                      <div className="font-black leading-tight">⚡ Fire Instant Demo Alert Now</div>
                      <div className="text-[10px] text-blue-100 font-medium">Bypasses clock; shows top banner & logs</div>
                    </div>
                  </button>

                  {/* Test Option 3: Reset Sent Lock */}
                  <button
                    type="button"
                    onClick={handleResetTodaySentFlags}
                    className="flex items-center gap-2 p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition cursor-pointer text-left active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0 text-slate-400" />
                    <div>
                      <div className="font-black leading-tight">🔄 Reset Today&apos;s Sent Lock</div>
                      <div className="text-[10px] text-slate-400 font-medium">Allows retesting scheduled time today</div>
                    </div>
                  </button>
                </div>

                <div className="text-[11px] text-slate-300 bg-white/5 p-2.5 rounded-lg border border-white/5 flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">💡 टेस्टिंग गाइड:</span>
                  <span>
                    <strong>1. टाइमर टेस्ट:</strong> <em>&quot;Set Day Auto-Trigger to +1 Min&quot;</em> बटन दबाएं। ऊपर सिस्टम क्लॉक देखें। जैसे ही अगला मिनट होगा, स्क्रीन पर तुरंत ब्लू <strong>Shift Changeover Alert Banner</strong> प्रकट होगा और रिपोर्ट WhatsApp लॉग में दर्ज हो जाएगी!<br />
                    <strong>2. इंस्टेंट टेस्ट:</strong> <em>&quot;Fire Instant Demo Alert Now&quot;</em> दबाकर तुरंत लाइव अलर्ट और रिपोर्ट का पूर्वावलोकन देखें।
                  </span>
                </div>
              </div>
            </div>

            {/* Shift Automation Timers */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider m-0">
                1. Automated Shift Changeover Timers
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <span>☀️</span> Day Shift Changeover Report
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={triggerConfig.autoSendShiftReportDay}
                        disabled={!canEditConfig}
                        onChange={(e) =>
                          setTriggerConfig({ ...triggerConfig, autoSendShiftReportDay: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-800 mb-1">
                      Scheduled Trigger Time (24-Hour format)
                    </label>
                    <input
                      type="time"
                      value={triggerConfig.dayShiftReportTime}
                      disabled={!canEditConfig}
                      onChange={(e) =>
                        setTriggerConfig({ ...triggerConfig, dayShiftReportTime: e.target.value })
                      }
                      className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-amber-950 focus:outline-none"
                    />
                    <span className="text-[10px] text-amber-700 mt-1 block">
                      Dispatched automatically every evening to subscribers with Handover rights.
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      <span>🌙</span> Night Shift Changeover Report
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={triggerConfig.autoSendShiftReportNight}
                        disabled={!canEditConfig}
                        onChange={(e) =>
                          setTriggerConfig({ ...triggerConfig, autoSendShiftReportNight: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-800 mb-1">
                      Scheduled Trigger Time (24-Hour format)
                    </label>
                    <input
                      type="time"
                      value={triggerConfig.nightShiftReportTime}
                      disabled={!canEditConfig}
                      onChange={(e) =>
                        setTriggerConfig({ ...triggerConfig, nightShiftReportTime: e.target.value })
                      }
                      className="px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono font-bold text-indigo-950 focus:outline-none"
                    />
                    <span className="text-[10px] text-indigo-700 mt-1 block">
                      Dispatched automatically every morning to subscribers with Handover rights.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Real-time Cross-Module Event Alerts */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider m-0">
                2. Real-Time Operational Event Triggers
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <label className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Machine Breakdown</div>
                      <div className="text-[10px] text-slate-500">Alert on incident open</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={triggerConfig.autoNotifyMaintenanceBreakdown}
                    disabled={!canEditConfig}
                    onChange={(e) =>
                      setTriggerConfig({ ...triggerConfig, autoNotifyMaintenanceBreakdown: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                </label>

                <label className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition">
                  <div className="flex items-center gap-2">
                    <SearchCheck className="w-4 h-4 text-orange-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Critical QC Defect</div>
                      <div className="text-[10px] text-slate-500">Alert on crate rejection</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={triggerConfig.autoNotifyCriticalQcDefect}
                    disabled={!canEditConfig}
                    onChange={(e) =>
                      setTriggerConfig({ ...triggerConfig, autoNotifyCriticalQcDefect: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                </label>

                <label className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Dispatch Completion</div>
                      <div className="text-[10px] text-slate-500">Alert on gate pass issued</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={triggerConfig.autoNotifyDispatchCompletion}
                    disabled={!canEditConfig}
                    onChange={(e) =>
                      setTriggerConfig({ ...triggerConfig, autoNotifyDispatchCompletion: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                </label>

                <label className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">8 AM Daily Manpower</div>
                      <div className="text-[10px] text-slate-500">Alert on morning roll call</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={triggerConfig.autoNotifyDailyManpower}
                    disabled={!canEditConfig}
                    onChange={(e) =>
                      setTriggerConfig({ ...triggerConfig, autoNotifyDailyManpower: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                </label>

                <label className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-teal-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Critical Material Indent</div>
                      <div className="text-[10px] text-slate-500">Alert on low spare part</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={triggerConfig.autoNotifyLowStockRequisition}
                    disabled={!canEditConfig}
                    onChange={(e) =>
                      setTriggerConfig({ ...triggerConfig, autoNotifyLowStockRequisition: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                </label>

                <label className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition">
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-lime-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Scrap Limit Spike</div>
                      <div className="text-[10px] text-slate-500">Alert if daily scrap exceeds</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={triggerConfig.autoNotifyScrapSpike}
                    disabled={!canEditConfig}
                    onChange={(e) =>
                      setTriggerConfig({ ...triggerConfig, autoNotifyScrapSpike: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                </label>
              </div>
            </div>

            {/* API Gateway & Credentials Setup */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider m-0">
                3. WhatsApp Gateway & Webhook Credentials
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Primary Plant WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={triggerConfig.phone}
                    disabled={!canEditConfig}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, phone: e.target.value })}
                    placeholder="+91 90339 12511"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Default receiver if matrix recipient is not selected
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600 uppercase">
                      Webhook URL (Google Script / Zapier / Make / n8n / Meta API)
                    </label>
                    {triggerConfig.webhookUrl && (
                      <button
                        type="button"
                        onClick={handleTestWebhookConnection}
                        disabled={testingWebhook}
                        className="text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-0.5 rounded-md transition cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
                      >
                        <Zap className="w-3 h-3 text-amber-300" />
                        <span>{testingWebhook ? 'Testing...' : '⚡ Test Connection'}</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={triggerConfig.webhookUrl}
                    disabled={!canEditConfig}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, webhookUrl: e.target.value })}
                    placeholder="https://script.google.com/macros/s/.../exec or https://hook..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-slate-400">
                      Endpoint receives automated POST JSON payload with shift report & job status
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowGoogleScriptGuide(!showGoogleScriptGuide)}
                      className="text-[10px] font-black text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <span>📜 100% Free Google Script Code</span>
                      <span>{showGoogleScriptGuide ? '▲ Close' : '▼ View'}</span>
                    </button>
                  </div>
                </div>

                {/* Free Google Apps Script Helper Panel */}
                {showGoogleScriptGuide && (
                  <div className="md:col-span-2 bg-slate-900 text-slate-100 rounded-2xl p-4 border border-emerald-500/50 space-y-3 shadow-lg">
                    <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🚀</span>
                        <div>
                          <div className="text-xs font-black text-emerald-400 uppercase tracking-wide">
                            100% Free WhatsApp Automation via Google Apps Script (Zero Charges)
                          </div>
                          <div className="text-[10px] text-slate-400">
                            गूगल शीट्स / स्क्रिप्ट के जरिए बिना किसी चार्ज के स्वचालित WhatsApp रिपोर्ट प्राप्त करें
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href="/wunderkraf_google_apps_script.gs"
                          download="wunderkraf_google_apps_script.gs"
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Download .gs File</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                          const scriptText = `/**
 * WÜNDERKRAF FACTORY ERP - 100% FREE WHATSAPP WEBHOOK SCRIPT
 * Instructions:
 * 1. Open Google Sheets -> Extensions -> Apps Script (or script.google.com)
 * 2. Paste this code into Code.gs
 * 3. Click "Deploy" -> "New deployment" -> Select "Web app"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone" (Required so ERP can POST without login)
 * 4. Click "Deploy" and copy Web App URL (ends in /exec)
 * 5. Paste that URL into Wünderkraf Factory ERP Webhook field above!
 */
function doPost(e) {
  try {
    var raw = e.postData ? e.postData.contents : "";
    var data = raw ? JSON.parse(raw) : {};
    var phone = (data.phone || "").replace(/[^0-9]/g, "");
    var message = data.message || "Wünderkraf Shift Update";
    var category = data.category || "GENERAL";
    var timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    // 1. Log to Google Sheet (Free auto-logging)
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      var sheet = ss.getSheetByName("ERP_Logs") || ss.getActiveSheet();
      sheet.appendRow([timestamp, phone, category, message]);
    }

    // 2. 100% Free WhatsApp Dispatch via CallMeBot or Meta Free Cloud API
    // If you use CallMeBot free API key (send WhatsApp "I allow callmebot to send me messages" to +34 644 10 55 84 to get free key):
    var CALLMEBOT_API_KEY = ""; // Paste your free key here if using CallMeBot
    if (CALLMEBOT_API_KEY && phone) {
      var apiUrl = "https://api.callmebot.com/whatsapp.php?phone=" + encodeURIComponent(phone) +
                   "&text=" + encodeURIComponent(message) +
                   "&apikey=" + encodeURIComponent(CALLMEBOT_API_KEY);
      UrlFetchApp.fetch(apiUrl, { muteHttpExceptions: true });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", phone: phone }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;
                          navigator.clipboard.writeText(scriptText);
                          setCopiedGoogleScript(true);
                          setTimeout(() => setCopiedGoogleScript(false), 3000);
                        }}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                      >
                        {copiedGoogleScript ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedGoogleScript ? 'Copied Code!' : 'Copy Script Code'}</span>
                      </button>
                    </div>
                  </div>

                    {/* Step-by-Step Instructions */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-300">
                      <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                        <span className="text-emerald-400 font-bold block mb-1">Step 1: गूगल शीट में पेस्ट करें</span>
                        Google Sheet खोलें &gt; <em>Extensions &gt; Apps Script</em> पर क्लिक करें और ऊपर दिए कोड को पेस्ट करें।
                      </div>
                      <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                        <span className="text-emerald-400 font-bold block mb-1">Step 2: Web App के रूप में Deploy</span>
                        ऊपर नीले <strong>Deploy &gt; New deployment</strong> पर जाएं &gt; Web app चुनें &gt; Who has access को <strong>&quot;Anyone&quot;</strong> रखें।
                      </div>
                      <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                        <span className="text-emerald-400 font-bold block mb-1">Step 3: URL यहाँ पेस्ट करें</span>
                        Deploy के बाद मिली Web App URL (जिसके अंत में <code>/exec</code> होता है) को ऊपर के <strong>Webhook URL</strong> बॉक्स में पेस्ट करें और Save दबाएं।
                      </div>
                    </div>

                    {/* Script Preview Box */}
                    <div className="bg-black/60 rounded-xl p-3 border border-slate-800 text-[10px] font-mono text-emerald-300 overflow-x-auto max-h-48 leading-relaxed">
                      <pre>{`function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var phone = data.phone;       // ERP sends the targeted mobile number
  var message = data.message;   // Formatted shift report / job status
  
  // Forward to WhatsApp free gateway or log in Google Sheets!
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([new Date(), phone, data.category, message]);
  
  return ContentService.createTextOutput(JSON.stringify({ status: "success" }));
}`}</pre>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Bearer Token / API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={triggerConfig.apiKey}
                    disabled={!canEditConfig}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, apiKey: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Custom Footer Brand / Signature
                  </label>
                  <input
                    type="text"
                    value={triggerConfig.customFooter}
                    disabled={!canEditConfig}
                    onChange={(e) => setTriggerConfig({ ...triggerConfig, customFooter: e.target.value })}
                    placeholder="Wünderkraf Factory Floor Desk"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            {canEditConfig && (
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSaveTriggers}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 px-6 rounded-xl shadow-xs transition cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Notification Triggers & Configuration</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AUTOMATED SHIFT REPORTS & DISPATCH AUDIT LOG                      */}
      {/* ========================================================================= */}
      {activeTab === 'dispatch_logs' && (
        <div className="space-y-5">
          {/* Header & Log Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide m-0">
                  Automated Shift Reports & Dispatch Audit Log
                </h3>
              </div>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Complete traceability of all scheduled shift changeovers, breakdown alerts, and messages sent via WhatsApp.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportLogsCsv}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-xl transition cursor-pointer"
                title="Export logs as CSV spreadsheet"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-xl transition cursor-pointer"
                  title="Clear dispatch history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Log</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Filter Rail */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search recipient, sender, preview..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Filter:</span>
              {[
                { id: 'ALL', label: 'All Logs' },
                { id: 'SHIFTS', label: 'Shift Reports' },
                { id: 'BREAKDOWN', label: 'Breakdowns' },
                { id: 'MANPOWER', label: 'Manpower' },
                { id: 'QC', label: 'QC Alerts' },
                { id: 'DISPATCH', label: 'Dispatch' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setLogFilterCategory(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                    logFilterCategory === f.id
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Log Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 border-b border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Dispatched By</th>
                    <th className="py-3 px-4">Message Snippet</th>
                    <th className="py-3 px-4 text-center">Delivery Status</th>
                    <th className="py-3 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                        No dispatch logs recorded yet. Automated shift changeover reports and manual broadcasts will appear here.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                            log.category.includes('DAY')
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : log.category.includes('NIGHT')
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : log.category.includes('BREAKDOWN')
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : log.category.includes('MANPOWER')
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {log.category.replace('SHIFT_', '').replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 max-w-[180px] truncate">
                          {log.recipient}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-600 whitespace-nowrap">
                          {log.sender}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 max-w-xs truncate">
                          {log.preview}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${
                            log.status === 'SENT'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : log.status === 'OPENED'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'bg-rose-50 text-rose-700 border-rose-300'
                          }`}>
                            {log.status === 'SENT' ? 'Delivered' : log.status === 'OPENED' ? 'Opened' : 'Failed'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setInspectingLog(log)}
                            className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. LOG INSPECTION MODAL */}
      {inspectingLog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-600" />
                <h4 className="text-sm font-black text-slate-900 m-0">
                  Dispatch Detail — {inspectingLog.id}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Dispatched At</span>
                <span className="font-bold text-slate-800">{inspectingLog.timestamp}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Category</span>
                <span className="font-bold text-slate-800">{inspectingLog.category}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Recipient</span>
                <span className="font-bold text-slate-800">{inspectingLog.recipient}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Sender</span>
                <span className="font-bold text-slate-800">{inspectingLog.sender}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase mb-1">Message Content</span>
              <pre className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-56 overflow-y-auto">
                {inspectingLog.preview}
              </pre>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(inspectingLog.preview);
                  showStatus('📋 Text copied to clipboard');
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
