import React, { useState } from 'react';
import {
  X,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  ShoppingBag,
  ExternalLink,
  Check,
  Send,
  Sparkles,
  Search,
  Filter,
  Layers,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Building,
  MapPin,
  FileText
} from 'lucide-react';
import {
  FactoryState,
  MaterialRequisition,
  MaterialUrgency,
  MaterialRequisitionStatus
} from '../types';
import {
  DEFAULT_MATERIAL_CATEGORIES,
  COMMON_SPARE_PARTS
} from '../lib/constants';

interface MaterialRequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: FactoryState;
  onSaveState: (nextState: FactoryState) => void;
  defaultDepartment?: string;
  onNavigateToPurchase?: () => void;
  onOpenPurchaseDesk?: () => void;
}

const COMMON_PACKAGING_ITEMS = [
  'BOPP 2-inch Brown Packing Tape',
  'BOPP Transparent Tape 2-inch',
  'Master Shipper Carton 500 Pcs Box',
  'Inner Polybags Food Grade 100 Pcs',
  'Heavy Duty Strapping Roll 12mm',
  'Packaging Barcode Thermal Labels'
];

const COMMON_CONSUMABLES = [
  'Food-Grade Machine Lubricant Grease',
  'Hydraulic Oil ISO VG 68 (20L Can)',
  'Teflon High-Temp Tape (1 inch)',
  'Silicon Release Spray Can',
  'Compressed Air Filter Element',
  'Industrial Nitrile Gloves Box'
];

export const MaterialRequisitionModal: React.FC<MaterialRequisitionModalProps> = ({
  isOpen,
  onClose,
  state,
  onSaveState,
  defaultDepartment = 'Maintenance',
  onNavigateToPurchase
}) => {
  if (!isOpen) return null;

  const requisitions = state.materialRequisitions || [];

  // Active Tab: 'RAISE' or 'STATUS'
  const [activeTab, setActiveTab] = useState<'RAISE' | 'STATUS'>('RAISE');

  // Form State
  const [dept, setDept] = useState<string>(defaultDepartment);
  const [category, setCategory] = useState<string>(DEFAULT_MATERIAL_CATEGORIES[0]);
  const [itemName, setItemName] = useState<string>('');
  const [partNo, setPartNo] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [unit, setUnit] = useState<string>('Pcs');
  const [urgency, setUrgency] = useState<MaterialUrgency>('URGENT');
  const [purpose, setPurpose] = useState<string>('');
  const [requestedBy, setRequestedBy] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState<'ALL' | MaterialRequisitionStatus>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Quick suggestions based on category or department
  const quickItems =
    dept === 'Packing'
      ? COMMON_PACKAGING_ITEMS
      : dept === 'Slitting' || category.includes('Lubricant')
      ? COMMON_CONSUMABLES
      : COMMON_SPARE_PARTS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      alert('कृपया मटेरियल या स्पेयर पार्ट का नाम दर्ज करें (Item name required)');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Generate ID
    const nextNum = requisitions.length + 1;
    const reqId = `MR-${now.getFullYear()}-${String(nextNum).padStart(3, '0')}`;

    const newReq: MaterialRequisition = {
      id: reqId,
      department: dept,
      itemCategory: category,
      itemName: itemName.trim(),
      itemCodeOrPartNo: partNo.trim() || undefined,
      quantity: Number(qty) || 1,
      unit,
      urgency,
      machineOrPurpose: purpose.trim() || `${dept} General Requirement`,
      machine: purpose.trim() || undefined,
      purpose: purpose.trim() || undefined,
      requestedBy: requestedBy.trim() || 'Floor Operator',
      requestedDate: dateStr,
      requestedTime: timeStr,
      createdAt: now.toISOString(),
      remarks: remarks.trim() || undefined,
      status: 'PENDING'
    };

    // Plant Audit Log Entry
    const logEntry = {
      stage: dept || 'Requisition',
      machine: 'Floor Request',
      user: requestedBy.trim() || 'operator',
      action: `Material Requisition Raised [${reqId}]: ${qty} ${unit} ${itemName} for ${dept}`,
      rawDate: dateStr,
      timestamp: now.toLocaleString()
    };

    const updated = [newReq, ...requisitions];
    const nextLogs = [logEntry, ...(state.logs || [])];

    onSaveState({
      ...state,
      materialRequisitions: updated,
      logs: nextLogs
    });

    setFormSuccessMessage(`इंडेन्ट #${reqId} सफलतापूर्वक परचेस डिपार्टमेंट को भेज दिया गया है!`);
    setItemName('');
    setPartNo('');
    setQty(1);
    setPurpose('');
    setRemarks('');

    setTimeout(() => {
      setFormSuccessMessage(null);
      setActiveTab('STATUS');
    }, 1500);
  };

  // Mark Acknowledged / Received by Requester
  const handleAcknowledgeReceipt = (reqId: string) => {
    const updated = requisitions.map((r) => {
      if (r.id === reqId) {
        return {
          ...r,
          status: 'ACKNOWLEDGED' as const,
          acknowledgedByRequester: true,
          acknowledgedDate: new Date().toISOString().split('T')[0]
        };
      }
      return r;
    });

    const targetReq = requisitions.find((r) => r.id === reqId);
    const logEntry = {
      stage: targetReq?.department || 'Store',
      machine: 'Store Collection',
      user: targetReq?.requestedBy || 'Operator',
      action: `Material Collected from Store [${reqId}]: ${targetReq?.itemName} received by ${targetReq?.department}`,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      materialRequisitions: updated,
      logs: [logEntry, ...(state.logs || [])]
    });
  };

  // Filtered requisitions for status tab
  const filteredRequisitions = requisitions.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (deptFilter !== 'ALL' && r.department !== deptFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = r.itemName.toLowerCase().includes(q);
      const matchId = r.id.toLowerCase().includes(q);
      const matchVendor = (r.vendorName || '').toLowerCase().includes(q);
      const matchReq = r.requestedBy.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchVendor && !matchReq) return false;
    }
    return true;
  });

  const arrivedCount = requisitions.filter(
    (r) => r.status === 'RECEIVED' && !r.acknowledgedByRequester
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#1a365d] to-[#2b6cb0] text-white p-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/20">
              <ShoppingBag className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Material Requisition & Purchase Tracking
                </h2>
                <span className="bg-amber-400 text-slate-900 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded shadow-xs">
                  इंडेन्ट सिस्टम
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                किसी भी प्लांट डेस्क से तुरंत मटेरियल व स्पेयर पार्ट डिमांड भेजें और लाइव आगमन ट्रैक करें
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Alert Banner if material has arrived */}
        {arrivedCount > 0 && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-900 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>
                🎉 <strong>{arrivedCount} मटेरियल स्टोर में आ चुका है!</strong> (Ready for collection at Factory Store)
              </span>
            </div>
            <button
              onClick={() => {
                setActiveTab('STATUS');
                setStatusFilter('RECEIVED');
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-md font-bold text-[11px] transition cursor-pointer"
            >
              देखें कौन सा माल आया है →
            </button>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setActiveTab('RAISE')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 cursor-pointer ${
                activeTab === 'RAISE'
                  ? 'border-blue-600 text-blue-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-blue-600" />
              <span>1. नया इंडेन्ट भरें (Raise Requisition)</span>
            </button>

            <button
              onClick={() => setActiveTab('STATUS')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 relative cursor-pointer ${
                activeTab === 'STATUS'
                  ? 'border-blue-600 text-blue-700 bg-white shadow-xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-600" />
              <span>2. मेरे इंडेन्ट्स व माल आगमन स्थिति (Live Status)</span>
              {arrivedCount > 0 && (
                <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                  {arrivedCount} New
                </span>
              )}
            </button>
          </div>

          {onNavigateToPurchase && (
            <button
              onClick={() => {
                onClose();
                onNavigateToPurchase();
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition my-1 cursor-pointer"
            >
              <span>परचेस डिपार्टमेंट डेस्क खोलें</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-50/50">
          {formSuccessMessage && (
            <div className="bg-emerald-600 text-white p-4 rounded-xl mb-4 flex items-center gap-3 shadow-md animate-bounce">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
              <div className="font-bold text-sm">{formSuccessMessage}</div>
            </div>
          )}

          {activeTab === 'RAISE' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>Requirement Source & Category</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      डिपार्टमेंट / मशीन डेस्क (Department)*
                    </label>
                    <select
                      value={dept}
                      onChange={(e) => setDept(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500"
                    >
                      <option value="Maintenance">Maintenance (मेंटेनेंस / टूलींग)</option>
                      <option value="Forming">Forming Desk (फॉर्मिंग मशीन)</option>
                      <option value="Cutting">Cutting Desk (कटिंग स्टेशन)</option>
                      <option value="Slitting">Slitting Desk (स्लिटिंग मशीन)</option>
                      <option value="QC">QC Desk (क्वालिटी इंस्पेक्शन)</option>
                      <option value="Packing">Packing Station (पैकिंग डेस्क)</option>
                      <option value="Warehouse">Warehouse & Raw Material Store</option>
                      <option value="General">General Plant & Admin Utility</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      मटेरियल कैटेगरी (Item Category)*
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500"
                    >
                      {DEFAULT_MATERIAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Item Details */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>Item Description & Quantity</span>
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      मटेरियल / स्पेयर पार्ट का नाम (Item Description)*
                    </label>
                    <input
                      type="text"
                      placeholder="उदा. Band Heater 1500W, BOPP Brown Tape, Cutting Blade, Hydraulic Oil, etc."
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500"
                    />

                    {/* Quick selector chips */}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        त्वरित सुझाव:
                      </span>
                      {quickItems.slice(0, 5).map((qItem) => (
                        <button
                          key={qItem}
                          type="button"
                          onClick={() => setItemName(qItem)}
                          className="text-[11px] bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2.5 py-0.8 rounded-md border border-slate-200 transition cursor-pointer"
                        >
                          + {qItem}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        पार्ट नंबर / स्पेसिफिकेशन (Part No / Size)
                      </label>
                      <input
                        type="text"
                        placeholder="उदा. K-Type, 160mm, 280 GSM, 65 Micron"
                        value={partNo}
                        onChange={(e) => setPartNo(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        मात्रा (Required Quantity)*
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={qty}
                        onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        इकाई (Unit)*
                      </label>
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500"
                      >
                        <option value="Pcs">Pcs / Nos (नग)</option>
                        <option value="KG">KG (किलो)</option>
                        <option value="Box">Box / Cartons (बॉक्सेज)</option>
                        <option value="Rolls">Rolls (रोल्स)</option>
                        <option value="Litre">Litre (लीटर)</option>
                        <option value="Set">Set (सेट)</option>
                        <option value="Meters">Meters (मीटर)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        प्राथमिकता / तात्कालिकता (Urgency Priority)*
                      </label>
                      <select
                        value={urgency}
                        onChange={(e) => setUrgency(e.target.value as MaterialUrgency)}
                        className={`w-full border rounded-lg px-3 py-2 text-xs font-bold ${
                          urgency === 'CRITICAL_BREAKDOWN'
                            ? 'bg-rose-50 border-rose-300 text-rose-800'
                            : urgency === 'URGENT'
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'bg-slate-50 border-slate-300 text-slate-800'
                        }`}
                      >
                        <option value="CRITICAL_BREAKDOWN">
                          🚨 Emergency / Machine Stopped (मशीन बंद है - तत्काल चाहिए)
                        </option>
                        <option value="URGENT">
                          ⚡ Urgent / Stock Exhausted (स्टॉक खत्म - 24 घंटे में)
                        </option>
                        <option value="NORMAL">
                          📦 Normal / Planned Maintenance (सामान्य - 2-3 दिन)
                        </option>
                        <option value="LOW">⏳ Low / Routine Stock Up (नियमित)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        किस मशीन या काम के लिए चाहिए (Machine / Purpose)
                      </label>
                      <input
                        type="text"
                        placeholder="उदा. Forming-1 Upper Mould, Slitting Cutter, Dispatch Box"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        मांगकर्ता का नाम (Requested By)*
                      </label>
                      <input
                        type="text"
                        placeholder="ऑपरेटर / सुपरवाइजर का नाम"
                        value={requestedBy}
                        onChange={(e) => setRequestedBy(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        विशेष टिप्पणी (Remarks / Notes)
                      </label>
                      <input
                        type="text"
                        placeholder="सप्लायर या मॉडल सम्बन्धी कोई खास निर्देश..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition cursor-pointer active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>सबमिट करें और परचेस को भेजें (Submit Requisition)</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'STATUS' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between flex-wrap gap-2.5 text-xs">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="मटेरियल, इंडेन्ट नंबर, वेंडर या नाम से खोजें..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    <option value="ALL">सभी डिपार्टमेंट (All Depts)</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Forming">Forming</option>
                    <option value="Cutting">Cutting</option>
                    <option value="Slitting">Slitting</option>
                    <option value="QC">QC</option>
                    <option value="Packing">Packing</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    <option value="ALL">सभी स्टेटस (All Status)</option>
                    <option value="PENDING">⏳ Pending Review (जांच में)</option>
                    <option value="PO_ISSUED">🚚 Ordered / PO Issued (ऑर्डर किया)</option>
                    <option value="RECEIVED">✅ Arrived at Store (माल आ गया)</option>
                    <option value="REJECTED">❌ Rejected</option>
                  </select>
                </div>
              </div>

              {/* List of Requisitions */}
              {filteredRequisitions.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
                  कोई मटेरियल इंडेन्ट नहीं मिला। ऊपर "नया इंडेन्ट भरें" बटन से नया रिक्विजिशन सबमिट करें।
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRequisitions.map((req) => {
                    const isArrived = req.status === 'RECEIVED';
                    const isOrdered = req.status === 'PO_ISSUED';
                    const isPending = req.status === 'PENDING';

                    return (
                      <div
                        key={req.id}
                        className={`bg-white border rounded-xl p-4 shadow-xs transition ${
                          isArrived && !req.acknowledgedByRequester
                            ? 'border-emerald-400 ring-2 ring-emerald-100 bg-emerald-50/20'
                            : isArrived
                            ? 'border-slate-200 bg-white'
                            : isOrdered
                            ? 'border-blue-200 bg-blue-50/10'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                              {req.id}
                            </span>
                            <span className="text-xs font-extrabold text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded">
                              {req.department}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {req.requestedDate} {req.requestedTime || ''}
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {isArrived && (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-extrabold text-xs px-2.5 py-1 rounded-md border border-emerald-300 animate-pulse">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>माल आ गया है (Arrived at Store)</span>
                              </span>
                            )}
                            {isOrdered && (
                              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 font-bold text-xs px-2.5 py-1 rounded-md border border-blue-200">
                                <Package className="w-3.5 h-3.5 text-blue-600" />
                                <span>PO जारी / वेंडर को ऑर्डर भेजा</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-bold text-xs px-2.5 py-1 rounded-md border border-amber-200">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>परचेस रिव्यू में पेंडिंग</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Item and Quantity */}
                        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                          <div>
                            <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                              <span>{req.itemName}</span>
                              {req.itemCodeOrPartNo && (
                                <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {req.itemCodeOrPartNo}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              मकसद: <span className="font-semibold">{req.machineOrPurpose || 'General'}</span> | मांगकर्ता: <span className="font-semibold">{req.requestedBy}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-base font-extrabold text-[#1a365d]">
                              {req.quantity} {req.unit}
                            </span>
                            {req.urgency === 'CRITICAL_BREAKDOWN' && (
                              <div className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wide">
                                🚨 Breakdown Emergency
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Arrived Details Banner (विशेष रूप से जब माल आ गया हो) */}
                        {isArrived && (
                          <div className="mt-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center justify-between flex-wrap gap-3">
                            <div className="space-y-0.5">
                              <div className="font-bold flex items-center gap-1 text-emerald-900">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                                <span>स्टोर लोकेशन: <strong>{req.storageLocationOrBin || 'Main Factory Store'}</strong></span>
                              </div>
                              <div className="text-[11px] text-emerald-800">
                                प्राप्त तिथि: <strong>{req.receivedDate}</strong> {req.receivedTime || ''} | मात्रा: <strong>{req.receivedQty || req.quantity} {req.unit}</strong> | GRN/बिल: <strong>{req.grnOrBillNo || 'N/A'}</strong>
                              </div>
                            </div>

                            {/* Acknowledge Button */}
                            {!req.acknowledgedByRequester ? (
                              <button
                                onClick={() => handleAcknowledgeReceipt(req.id)}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-xs hover:shadow transition cursor-pointer"
                              >
                                <Check className="w-4 h-4" />
                                <span>मुझे प्राप्त हो गया (Acknowledge Receipt)</span>
                              </button>
                            ) : (
                              <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1 bg-emerald-100/80 px-2 py-1 rounded">
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>फ्लोर द्वारा प्राप्त कर लिया गया</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* PO Issued Details */}
                        {isOrdered && (
                          <div className="mt-2.5 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between flex-wrap gap-2">
                            <div>
                              वेंडर: <strong>{req.vendorName || 'Selected Vendor'}</strong> | PO No: <strong>{req.poNumber || 'N/A'}</strong>
                            </div>
                            <div className="text-[11px] font-semibold text-blue-700">
                              अनुमानित डिलीवरी: <strong>{req.expectedDeliveryDate || 'Soon'}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3 flex items-center justify-between text-xs text-slate-500">
          <div>
            कुल इंडेन्ट्स: <span className="font-bold text-slate-800">{requisitions.length}</span> | माल आया हुआ: <span className="font-bold text-emerald-700">{requisitions.filter(r => r.status === 'RECEIVED').length}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-200 border border-slate-300 rounded-lg font-bold text-slate-700 transition cursor-pointer"
          >
            बंद करें (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
