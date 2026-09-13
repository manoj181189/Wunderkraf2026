import React, { useState } from 'react';
import { ArrowLeft, FilePlus2, CheckCircle2, Mic, Box, Tag } from 'lucide-react';
import { FactoryState } from '../../types';
import { PRODUCTS } from '../../lib/constants';

interface MarketingViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  onOpenVoiceModalForTarget: (targetCallback: (text: string) => void) => void;
}

export const MarketingView: React.FC<MarketingViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onOpenVoiceModalForTarget
}) => {
  const productList = state.products && state.products.length > 0 ? state.products : PRODUCTS;
  const [custName, setCustName] = useState('');
  const [packType, setPackType] = useState<'KIT' | 'INDIVIDUAL'>('KIT');
  const [singleItem, setSingleItem] = useState(productList[0] || 'Spoon');
  const [selectedKitItems, setSelectedKitItems] = useState<string[]>(['Tissue', productList[0] || 'Spoon', productList[1] || 'Fork']);
  const [orderQty, setOrderQty] = useState('');
  const [pcsPerBox, setPcsPerBox] = useState('1000');
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [wrappingReq, setWrappingReq] = useState('YES');
  const [labelReq, setLabelReq] = useState('YES');
  const [remarks, setRemarks] = useState('');

  // Order Submission Success Modal State
  const [submittedOrderModal, setSubmittedOrderModal] = useState<{
    orderId: string;
    customer: string;
    product: string;
    qty: number;
    dispatchDate: string;
    boxCapacity: number;
    totalBoxes: number;
  } | null>(null);

  const toggleKitItem = (item: string) => {
    setSelectedKitItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const getKitBadgeText = () => {
    if (packType === 'INDIVIDUAL') {
      return `SINGLE ITEM: ONLY ${singleItem.toUpperCase()}`;
    }
    if (selectedKitItems.length === 0) return 'NO ITEMS SELECTED';
    return `${selectedKitItems.length}-IN-1 COMBO KIT (${selectedKitItems.join(' + ')})`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = custName.trim().toUpperCase();
    const qty = parseInt(orderQty, 10) || 0;
    const boxSize = parseInt(pcsPerBox, 10) || 0;

    let items: string[] = [];
    let kitName = '';

    if (packType === 'INDIVIDUAL') {
      items = [singleItem];
      kitName = `Individual ${singleItem} Box`;
    } else {
      items = selectedKitItems;
      kitName = `${items.length}-in-1 Kit (${items.join(', ')})`;
    }

    if (!cust || qty <= 0 || boxSize <= 0 || items.length === 0) {
      alert('Please fill Customer Name, Order Quantity, Box Capacity, and at least 1 Item!');
      return;
    }

    const curSeq = state.seriesConfig.orderSeq || 1;
    const packJobId = 'ORD-' + String(curSeq).padStart(3, '0');
    const newOrderSeq = curSeq + 1;

    const newPackJob = {
      id: packJobId,
      customer: cust,
      packType: packType,
      orderQty: qty,
      pcsPerBox: boxSize,
      dispatchDate: dispatchDate,
      kitItems: items,
      kitType: kitName,
      status: 'Pending Queue',
      packedBoxes: 0,
      dispatchedBoxes: 0,
      wrapping: wrappingReq,
      labeling: labelReq,
      remarks: remarks || 'Standard Packing',
      startTime: '',
      endTime: '',
      createdBy: 'MARKETING',
      historyRuns: [],
      dispatchLogs: []
    };

    const newLog = {
      jobId: packJobId,
      product: kitName,
      stage: 'Marketing',
      machine: 'MKT-ENTRY',
      action: `Created Order ${packJobId} for ${cust} (${qty.toLocaleString()} Pcs | Target: ${dispatchDate})`,
      user: 'marketing',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    const nextState: FactoryState = {
      ...state,
      packJobs: [...state.packJobs, newPackJob],
      logs: [...state.logs, newLog],
      seriesConfig: {
        ...state.seriesConfig,
        orderSeq: newOrderSeq
      }
    };

    onSaveState(nextState);

    // Reset Form
    setCustName('');
    setOrderQty('');
    setRemarks('');

    // Open Success Confirmation Pop-up
    setSubmittedOrderModal({
      orderId: packJobId,
      customer: cust,
      product: kitName,
      qty,
      dispatchDate,
      boxCapacity: boxSize,
      totalBoxes: Math.ceil(qty / (boxSize || 1000))
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5 flex-wrap gap-2">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Main Menu</span>
        </button>
        <div className="flex items-center gap-2">
          <FilePlus2 className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-bold text-[#1a365d] uppercase tracking-wide m-0">
            Marketing — Customer Packing Order Entry
          </h3>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-orange-50/50 border border-dashed border-orange-300 p-5 rounded-xl space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Customer / Brand Name:
            </label>
            <input
              type="text"
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              placeholder="e.g. AIR INDIA / HALDIRAM FOODS / TATA STARBUCKS"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase text-slate-800 focus:border-blue-600 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select Packing Type:
            </label>
            <select
              value={packType}
              onChange={(e) => setPackType(e.target.value as any)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
            >
              <option value="KIT">COMBO KIT PACKING (Multi-Item Set)</option>
              <option value="INDIVIDUAL">INDIVIDUAL SINGLE ITEM PACKING</option>
            </select>
          </div>

          {packType === 'INDIVIDUAL' ? (
            <div>
              <label className="block text-xs font-bold text-blue-700 uppercase mb-1">
                Select Single Cutlery Item:
              </label>
              <select
                value={singleItem}
                onChange={(e) => setSingleItem(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                {productList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-blue-700 uppercase mb-1.5">
                Select Combo Kit Components:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-white p-3 rounded-lg border border-slate-200">
                {['Tissue', ...productList].map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedKitItems.includes(item)}
                      onChange={() => toggleKitItem(item)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300"
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Auto Kit Badge Tag */}
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-extrabold px-3 py-2 rounded-lg text-center tracking-wide uppercase">
            🏷️ {getKitBadgeText()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Total Order Quantity (Pieces):
              </label>
              <input
                type="number"
                value={orderQty}
                onChange={(e) => setOrderQty(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Pieces Per Box (Box Capacity):
              </label>
              <input
                type="number"
                value={pcsPerBox}
                onChange={(e) => setPcsPerBox(e.target.value)}
                placeholder="e.g. 1000"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-rose-600 uppercase mb-1">
              🎯 Target Dispatch Date:
            </label>
            <input
              type="date"
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              required
            />
          </div>

          {/* Packaging Specs Sub-box */}
          <div className="bg-slate-100 p-4 rounded-xl space-y-3">
            <span className="text-xs font-extrabold text-slate-800 uppercase block">
              📦 Box Packaging & Labeling Specifications:
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Box Wrapping:
                </label>
                <select
                  value={wrappingReq}
                  onChange={(e) => setWrappingReq(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                >
                  <option value="YES">YES (Wrap Box in Plastic Film)</option>
                  <option value="NO">NO (Plain Corrugated Box)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Label Placement:
                </label>
                <select
                  value={labelReq}
                  onChange={(e) => setLabelReq(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                >
                  <option value="YES">YES (Stick Custom Brand Label)</option>
                  <option value="NO">NO (Plain / Unlabeled)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase">
                  Special Instructions / Remarks / Custom Job Label:
                </label>
                <button
                  type="button"
                  onClick={() => onOpenVoiceModalForTarget((txt) => setRemarks(txt))}
                  className="flex items-center gap-1 text-[11px] text-purple-700 hover:text-purple-900 font-bold bg-purple-100 px-2 py-0.5 rounded cursor-pointer"
                >
                  <Mic className="w-3 h-3" /> Voice Dictate
                </button>
              </div>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Export Grade Heavy GSM / Custom Food Grade Wax Coating"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#2f855a] hover:bg-[#276749] text-white font-extrabold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Submit Customer Order To Factory Queue</span>
          </button>
        </div>
      </form>

      {/* ======================================================== */}
      {/* POP-UP MODAL: ORDER SUCCESSFULLY SUBMITTED CONFIRMATION */}
      {/* ======================================================== */}
      {submittedOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Success Icon & Header */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-black text-slate-900 m-0">
                Order submitted successfully!
              </h3>
              <p className="text-xs text-slate-500 font-medium m-0">
                Customer Order has been queued into Factory Production & Packing floor.
              </p>
            </div>

            {/* Order Details Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Order ID:</span>
                <span className="font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded text-xs">
                  {submittedOrderModal.orderId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">Customer:</span>
                <span className="font-extrabold text-slate-800">{submittedOrderModal.customer}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">Product / Kit:</span>
                <span className="font-bold text-slate-800 text-right max-w-[220px] truncate">
                  {submittedOrderModal.product}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">Order Quantity:</span>
                <span className="font-black text-emerald-700">
                  {submittedOrderModal.qty.toLocaleString()} Pcs{' '}
                  <span className="font-normal text-slate-500">
                    (~{submittedOrderModal.totalBoxes} Boxes @ {submittedOrderModal.boxCapacity} pcs/box)
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">Target Dispatch Date:</span>
                <span className="font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                  {submittedOrderModal.dispatchDate}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setSubmittedOrderModal(null)}
                className="w-full py-3 bg-[#2f855a] hover:bg-[#276749] text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>+ Enter Next Order</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmittedOrderModal(null);
                  onBackToHub();
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Main Hub</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
