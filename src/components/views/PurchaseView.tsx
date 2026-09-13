import React, { useState } from 'react';
import {
  ArrowLeft,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Package,
  Search,
  Filter,
  Download,
  Share2,
  Send,
  Building,
  MapPin,
  FileText,
  Truck,
  Plus,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Phone,
  User,
  Sparkles,
  Layers,
  Check
} from 'lucide-react';
import {
  FactoryState,
  MaterialRequisition,
  MaterialRequisitionStatus,
  MaterialUrgency
} from '../../types';
import { downloadCSV } from '../../lib/utils';
import { DEFAULT_MATERIAL_CATEGORIES } from '../../lib/constants';

interface PurchaseViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (nextState: FactoryState) => void;
  onOpenRequisitionModal?: (department?: string) => void;
}

export const PurchaseView: React.FC<PurchaseViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onOpenRequisitionModal
}) => {
  const requisitions = state.materialRequisitions || [];

  // Filter States
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | MaterialRequisitionStatus>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active Action Modals
  const [poModalReq, setPoModalReq] = useState<MaterialRequisition | null>(null);
  const [receiveModalReq, setReceiveModalReq] = useState<MaterialRequisition | null>(null);

  // PO Form State
  const [vendorName, setVendorName] = useState<string>('');
  const [poNumber, setPoNumber] = useState<string>('');
  const [expectedDate, setExpectedDate] = useState<string>('');
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [purchaseNotes, setPurchaseNotes] = useState<string>('');

  // Receive / GRN Form State
  const [receivedQty, setReceivedQty] = useState<number>(0);
  const [grnBillNo, setGrnBillNo] = useState<string>('');
  const [storageLocation, setStorageLocation] = useState<string>('');
  const [receivedBy, setReceivedBy] = useState<string>('Store Manager');

  // Success Notification Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // KPIs
  const totalCount = requisitions.length;
  const pendingCount = requisitions.filter((r) => r.status === 'PENDING').length;
  const orderedCount = requisitions.filter((r) => r.status === 'PO_ISSUED').length;
  const arrivedCount = requisitions.filter((r) => r.status === 'RECEIVED').length;
  const criticalCount = requisitions.filter(
    (r) => r.urgency === 'CRITICAL_BREAKDOWN' && r.status !== 'RECEIVED'
  ).length;

  // Filter logic
  const filtered = requisitions.filter((r) => {
    if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
    if (selectedDept !== 'ALL' && r.department !== selectedDept) return false;
    if (selectedUrgency !== 'ALL' && r.urgency !== selectedUrgency) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = r.itemName.toLowerCase().includes(q);
      const matchId = r.id.toLowerCase().includes(q);
      const matchVendor = (r.vendorName || '').toLowerCase().includes(q);
      const matchRequester = r.requestedBy.toLowerCase().includes(q);
      const matchDept = r.department.toLowerCase().includes(q);
      const matchPo = (r.poNumber || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchVendor && !matchRequester && !matchDept && !matchPo) {
        return false;
      }
    }
    return true;
  });

  // Open PO Issue Modal
  const handleOpenPoModal = (req: MaterialRequisition) => {
    setPoModalReq(req);
    setVendorName(req.vendorName || '');
    setPoNumber(req.poNumber || `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 2);
    setExpectedDate(req.expectedDeliveryDate || tmrw.toISOString().split('T')[0]);
    setEstimatedCost(req.estimatedCost || 0);
    setPurchaseNotes(req.purchaseNotes || '');
  };

  // Submit PO
  const handleSavePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poModalReq) return;

    if (!vendorName.trim()) {
      alert('Please enter the vendor name (Vendor name required)');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const updated = requisitions.map((r) => {
      if (r.id === poModalReq.id) {
        return {
          ...r,
          status: 'PO_ISSUED' as MaterialRequisitionStatus,
          vendorName: vendorName.trim(),
          poNumber: poNumber.trim(),
          poDate: todayStr,
          expectedDeliveryDate: expectedDate,
          estimatedCost: Number(estimatedCost) || undefined,
          purchaseNotes: purchaseNotes.trim() || undefined
        };
      }
      return r;
    });

    const logEntry = {
      stage: 'Purchase',
      machine: 'Purchase Desk',
      user: 'Purchase Officer',
      action: `PO Issued [${poModalReq.id}]: Ordered ${poModalReq.itemName} from ${vendorName} (PO: ${poNumber})`,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      materialRequisitions: updated,
      logs: [logEntry, ...(state.logs || [])]
    });

    showToast(`PO #${poNumber} Issued! Status updated to 'PO Issued'.`);
    setPoModalReq(null);
  };

  // Open Goods Received Modal
  const handleOpenReceiveModal = (req: MaterialRequisition) => {
    setReceiveModalReq(req);
    setReceivedQty(req.receivedQty || req.quantity);
    setGrnBillNo(req.grnOrBillNo || `GRN-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}`);
    setStorageLocation(req.storageLocationOrBin || `${req.department} Store Bin`);
    setReceivedBy('Store Incharge');
  };

  // Submit Goods Received
  const handleSaveReceived = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModalReq) return;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updated = requisitions.map((r) => {
      if (r.id === receiveModalReq.id) {
        return {
          ...r,
          status: 'RECEIVED' as MaterialRequisitionStatus,
          receivedDate: dateStr,
          receivedTime: timeStr,
          receivedQty: Number(receivedQty) || r.quantity,
          grnOrBillNo: grnBillNo.trim() || undefined,
          storageLocationOrBin: storageLocation.trim() || 'Factory Main Store',
          receivedBy: receivedBy.trim(),
          acknowledgedByRequester: false // Reset so requester gets notification to collect!
        };
      }
      return r;
    });

    const logEntry = {
      stage: 'Purchase',
      machine: 'Store Receiving',
      user: receivedBy.trim() || 'Store Incharge',
      action: `Material Arrived & Received [${receiveModalReq.id}]: ${receiveModalReq.itemName} (Qty: ${receivedQty}) stored at ${storageLocation}`,
      rawDate: now.toISOString().split('T')[0],
      timestamp: now.toLocaleString()
    };

    onSaveState({
      ...state,
      materialRequisitions: updated,
      logs: [logEntry, ...(state.logs || [])]
    });

    showToast(
      `🎉 Goods receipt recorded! [${receiveModalReq.id}] ${receiveModalReq.itemName} status is now \'RECEIVED\' and the concerned department has been notified!`
    );
    setReceiveModalReq(null);
  };

  // Send WhatsApp Arrival Alert to Requester
  const handleSendWhatsAppAlert = (req: MaterialRequisition) => {
    const text = `*WÜNDERKRAF ERP - MATERIAL ARRIVAL NOTICE*\n\n` +
      `Hello ${req.requestedBy},
` +
      `The material requested by your department (${req.department}) has arrived at the factory store:

` +
      `📦 *Material:* ${req.itemName}\n` +
      `🔢 *Quantity:* ${req.receivedQty || req.quantity} ${req.unit}\n` +
      `🔖 *Indent ID:* ${req.id}\n` +
      `📍 *Store Location:* ${req.storageLocationOrBin || 'Main Factory Store'}\n` +
      `📄 *GRN / Bill No:* ${req.grnOrBillNo || 'N/A'}\n` +
      `📅 *Receipt Date:* ${req.receivedDate || 'Today'}\n\n` +
      `Please collect the material from the factory store and mark \'Acknowledge Receipt\' on your desk.
` +
      `_Wünderkraf Paperware Procurement Suite_`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // Export CSV
  const handleExportCSV = () => {
    let csv = 'ID,Department,Category,Item Name,Part No,Qty,Unit,Urgency,Status,Purpose,Requested By,Date,Vendor,PO No,GRN No,Received Date,Location\r\n';
    requisitions.forEach((r) => {
      csv += `"${r.id}","${r.department}","${r.itemCategory}","${r.itemName.replace(/"/g, '""')}","${r.itemCodeOrPartNo || ''}","${r.quantity}","${r.unit}","${r.urgency}","${r.status}","${(r.machineOrPurpose || '').replace(/"/g, '""')}","${r.requestedBy}","${r.requestedDate}","${r.vendorName || ''}","${r.poNumber || ''}","${r.grnOrBillNo || ''}","${r.receivedDate || ''}","${r.storageLocationOrBin || ''}"\r\n`;
    });
    downloadCSV(csv, `Material_Requisitions_Procurement_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-500 animate-bounce">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-200" />
          <div className="text-xs font-bold">{toastMessage}</div>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBackToHub}
            className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛒</span>
              <h1 className="text-xl font-bold text-[#1a365d] tracking-tight">
                Purchase Department & Procurement Desk
              </h1>
              <span className="bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-xs">
                Procurement
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Centralized platform for plant department indents, vendor Purchase Orders (PO), and goods arrival (GRN) control.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onOpenRequisitionModal?.()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Raise Requisition</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold transition border border-slate-300 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Total Indents
          </div>
          <div className="text-2xl font-extrabold text-[#1a365d] mt-1">{totalCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">All Plant Requests</div>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Pending Review</span>
          </div>
          <div className="text-2xl font-extrabold text-amber-900 mt-1">{pendingCount}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">To review & issue PO</div>
        </div>

        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wide flex items-center gap-1">
            <Truck className="w-3.5 h-3.5 text-blue-600" />
            <span>PO Issued / Transit</span>
          </div>
          <div className="text-2xl font-extrabold text-blue-900 mt-1">{orderedCount}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Awaiting Delivery</div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Arrived at Store</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-900 mt-1">{arrivedCount}</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">Received at Plant</div>
        </div>

        <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wide flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Emergency Breakdown</span>
          </div>
          <div className="text-2xl font-extrabold text-rose-900 mt-1">{criticalCount}</div>
          <div className="text-[10px] text-rose-700 mt-0.5">High Priority Spares</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Material, Indent ID, Vendor, PO Number or Department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="ALL">All Depts</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Forming">Forming</option>
            <option value="Cutting">Cutting</option>
            <option value="Slitting">Slitting</option>
            <option value="QC">QC Desk</option>
            <option value="Packing">Packing Station</option>
            <option value="Warehouse">Warehouse</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">⏳ Pending Review</option>
            <option value="PO_ISSUED">🚚 PO Issued / Ordered</option>
            <option value="RECEIVED">✅ Arrived at Store</option>
            <option value="REJECTED">❌ Rejected</option>
          </select>

          <select
            value={selectedUrgency}
            onChange={(e) => setSelectedUrgency(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL_BREAKDOWN">🚨 Emergency Breakdown</option>
            <option value="URGENT">⚡ Urgent (24h)</option>
            <option value="NORMAL">📦 Normal</option>
          </select>
        </div>
      </div>

      {/* Main List of Requisitions */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-xs">
          No requisition found. You can submit a new demand using "+ Raise Requisition".
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => {
            const isArrived = req.status === 'RECEIVED';
            const isOrdered = req.status === 'PO_ISSUED';
            const isPending = req.status === 'PENDING';
            const isCritical = req.urgency === 'CRITICAL_BREAKDOWN';

            return (
              <div
                key={req.id}
                className={`bg-white border rounded-xl p-5 shadow-xs transition hover:shadow-md ${
                  isCritical && !isArrived
                    ? 'border-rose-300 bg-rose-50/10'
                    : isArrived
                    ? 'border-emerald-200 bg-emerald-50/10'
                    : 'border-slate-200'
                }`}
              >
                {/* Top Row */}
                <div className="flex items-start justify-between flex-wrap gap-2 mb-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                      {req.id}
                    </span>
                    <span className="text-xs font-bold text-blue-900 bg-blue-100 px-2.5 py-1 rounded">
                      {req.department}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Date: {req.requestedDate} {req.requestedTime || ''}
                    </span>
                    {isCritical && (
                      <span className="inline-flex items-center gap-1 bg-rose-600 text-white font-extrabold text-[10px] uppercase px-2 py-0.5 rounded shadow-xs animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Breakdown Emergency</span>
                      </span>
                    )}
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {isArrived && (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 font-extrabold text-xs px-3 py-1 rounded-lg border border-emerald-300 shadow-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Goods have arrived at factory store (Received)</span>
                      </span>
                    )}
                    {isOrdered && (
                      <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-900 font-bold text-xs px-3 py-1 rounded-lg border border-blue-200">
                        <Truck className="w-4 h-4 text-blue-600" />
                        <span>PO Issued / Order sent to vendor</span>
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 font-bold text-xs px-3 py-1 rounded-lg border border-amber-200">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Pending review (Awaiting PO)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Column 1: Item & Demand details */}
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                      Material / Spare Part
                    </div>
                    <div className="text-base font-extrabold text-slate-900">
                      {req.itemName}
                    </div>
                    {req.itemCodeOrPartNo && (
                      <div className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded inline-block">
                        Part No: {req.itemCodeOrPartNo}
                      </div>
                    )}
                    <div className="text-xs text-slate-600 mt-1">
                      Category: <span className="font-semibold text-slate-800">{req.itemCategory}</span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Purpose: <span className="font-semibold text-slate-800">{req.machineOrPurpose || 'General'}</span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Requested By: <span className="font-semibold text-slate-800">{req.requestedBy}</span>
                    </div>
                    {req.remarks && (
                      <div className="text-xs italic text-slate-500 bg-slate-50 p-1.5 rounded mt-1">
                        "{req.remarks}"
                      </div>
                    )}
                  </div>

                  {/* Column 2: Quantity & Procurement Spec */}
                  <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-bold">Requested Qty:</span>
                      <span className="text-sm font-extrabold text-[#1a365d]">
                        {req.quantity} {req.unit}
                      </span>
                    </div>

                    {req.vendorName && (
                      <div className="text-xs text-slate-700">
                        Supplier/Vendor: <strong>{req.vendorName}</strong>
                      </div>
                    )}

                    {req.poNumber && (
                      <div className="text-xs text-slate-700">
                        PO Number: <strong className="font-mono text-blue-700">{req.poNumber}</strong>
                      </div>
                    )}

                    {req.expectedDeliveryDate && (
                      <div className="text-xs text-slate-700">
                        Estimated Delivery: <strong>{req.expectedDeliveryDate}</strong>
                      </div>
                    )}

                    {req.estimatedCost ? (
                      <div className="text-xs text-slate-700">
                        Cost: <strong>₹{req.estimatedCost.toLocaleString()}</strong>
                      </div>
                    ) : null}

                    {req.purchaseNotes && (
                      <div className="text-[11px] text-blue-800 bg-blue-50/80 p-1.5 rounded">
                        Purchase Note: {req.purchaseNotes}
                      </div>
                    )}
                  </div>

                  {/* Column 3: Receiving Details or Action Buttons */}
                  <div className="space-y-2 flex flex-col justify-between">
                    {isArrived ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs space-y-1">
                        <div className="font-extrabold text-emerald-900 flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>Goods available in store</span>
                        </div>
                        <div className="text-emerald-950 font-medium">
                          Location: <strong>{req.storageLocationOrBin || 'Main Factory Store'}</strong>
                        </div>
                        <div className="text-emerald-800 text-[11px]">
                          Received: <strong>{req.receivedDate}</strong> {req.receivedTime || ''} | Qty: <strong>{req.receivedQty || req.quantity} {req.unit}</strong>
                        </div>
                        <div className="text-emerald-800 text-[11px]">
                          GRN / Invoice: <strong>{req.grnOrBillNo || 'N/A'}</strong> | Deposited By: <strong>{req.receivedBy}</strong>
                        </div>
                        <div className="pt-1">
                          {req.acknowledgedByRequester ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Received by Department</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
                              ⏳ Pending pickup by floor
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">
                        Purchase Action:
                      </div>
                    )}

                    {/* Action Buttons for Purchase Officer */}
                    <div className="flex items-center gap-2 flex-wrap pt-2">
                      {/* Step 1: Issue PO button */}
                      {!isArrived && (
                        <button
                          onClick={() => handleOpenPoModal(req)}
                          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xs hover:shadow transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{isOrdered ? 'Update PO' : 'Issue PO / Order'}</span>
                        </button>
                      )}

                      {/* Step 2: Mark Material Received button (CRITICAL USER REQUIREMENT) */}
                      {!isArrived ? (
                        <button
                          onClick={() => handleOpenReceiveModal(req)}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs hover:shadow transition cursor-pointer active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Goods Arrived (Mark Received)</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSendWhatsAppAlert(req)}
                          className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
                          title="Send arrival notification on WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Send WhatsApp Notification</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PO Issue Modal */}
      {poModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scaleIn">
            <div className="bg-[#1a365d] text-white p-4.5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Issue PO / Order to Vendor</h3>
                <p className="text-xs text-blue-200">
                  {poModalReq.id} — {poModalReq.itemName} ({poModalReq.quantity} {poModalReq.unit})
                </p>
              </div>
              <button
                onClick={() => setPoModalReq(null)}
                className="text-white hover:bg-white/20 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePO} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vendor / Supplier Name*
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shreeji Electricals, Apex Packaging, JK Paper, etc."
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PO Number (Purchase Order No)*
                  </label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold font-mono text-slate-900 focus:bg-white focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expected Delivery Date*
                  </label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estimated Total Cost (Est Cost ₹)
                  </label>
                  <input
                    type="number"
                    value={estimatedCost || ''}
                    onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Purchase Remarks / Delivery Terms
                  </label>
                  <input
                    type="text"
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                    placeholder="e.g. Urgent delivery, by courier"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPoModalReq(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Submit Order & PO (Confirm PO)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Material Received / GRN Modal (User requested: When material arrives, submitting it will notify everyone) */}
      {receiveModalReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-200 w-full max-w-lg overflow-hidden animate-scaleIn">
            <div className="bg-gradient-to-r from-emerald-700 to-emerald-800 text-white p-4.5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                  <h3 className="text-base font-bold">Enter Goods Receipt (Goods Received Note - GRN)</h3>
                </div>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Upon submitting, the {receiveModalReq.department} desk will immediately be notified that the material has arrived in the store!
                </p>
              </div>
              <button
                onClick={() => setReceiveModalReq(null)}
                className="text-white hover:bg-white/20 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReceived} className="p-5 space-y-3.5">
              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 text-xs">
                <div className="font-bold text-emerald-950">{receiveModalReq.itemName}</div>
                <div className="text-emerald-800">
                  Indent: <strong>{receiveModalReq.id}</strong> | Department: <strong>{receiveModalReq.department}</strong> | Requested By: <strong>{receiveModalReq.requestedBy}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Received Qty*
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="any"
                      value={receivedQty}
                      onChange={(e) => setReceivedQty(parseFloat(e.target.value) || 0)}
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500"
                    />
                    <span className="text-xs font-bold text-slate-600">{receiveModalReq.unit}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    GRN No / Supplier Bill No
                  </label>
                  <input
                    type="text"
                    value={grnBillNo}
                    onChange={(e) => setGrnBillNo(e.target.value)}
                    placeholder="e.g. GRN-2026-095"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold font-mono text-slate-900 focus:bg-white focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Store Location / Rack Bin*
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maintenance Tool Crib Rack B2, Main Chemical Store Shelf 3"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Received By Store Incharge*
                </label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReceiveModalReq(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition cursor-pointer active:scale-95"
                >
                  ✓ Goods Arrived - Submit (Confirm Arrival)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
