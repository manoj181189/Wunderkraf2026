import React from 'react';
import { Printer, FileCheck2, X } from 'lucide-react';

interface ChallanModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    customer: string;
    invoiceNo: string;
    gtNo: string;
    date: string;
    items: Array<{ orderId: string; item: string; boxes: number; pcs: number }>;
    totalBoxes: number;
    userName: string;
  } | null;
}

export const ChallanModal: React.FC<ChallanModalProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2 text-[#1a365d]">
            <FileCheck2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold m-0">Official Delivery Challan & Factory Gatepass</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-[#2f855a] hover:bg-[#276749] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Challan</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Challan Box */}
        <div id="printable-challan-area" className="border-2 border-[#1a365d] p-6 rounded-xl bg-white text-slate-800">
          <div className="flex justify-between items-start border-b-2 border-[#1a365d] pb-4 mb-4">
            <div>
              <h2 className="text-xl font-extrabold text-[#1a365d] m-0 tracking-tight">
                WÜNDERKRAF PAPERWARE
              </h2>
              <p className="text-xs text-slate-500 m-0 mt-0.5">
                Master Production & Export Packaging Facility • ISO / FDA Compliant
              </p>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <div>
                <span className="text-slate-500">Date:</span> <b>{data.date}</b>
              </div>
              <div>
                <span className="text-slate-500">Invoice:</span>{' '}
                <b className="text-blue-700">{data.invoiceNo}</b>
              </div>
              <div>
                <span className="text-slate-500">Vehicle/GT:</span> <b>{data.gtNo}</b>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
            <span className="text-xs text-slate-500 block">Consignee / Party Name:</span>
            <span className="text-base font-extrabold text-[#1a365d]">{data.customer}</span>
          </div>

          <table className="w-full text-xs border-collapse border border-slate-300 mb-6">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold">
                <th className="border border-slate-300 p-2 text-center w-10">Sr</th>
                <th className="border border-slate-300 p-2 text-left">Item Description & Order Ref</th>
                <th className="border border-slate-300 p-2 text-center w-28">Box Qty</th>
                <th className="border border-slate-300 p-2 text-center w-32">Total Pieces</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="border border-slate-300 p-2 text-center font-bold">{idx + 1}</td>
                  <td className="border border-slate-300 p-2">
                    <b className="text-slate-900">{it.item}</b>{' '}
                    <span className="text-slate-500">(Order: {it.orderId})</span>
                  </td>
                  <td className="border border-slate-300 p-2 text-center font-extrabold text-blue-700">
                    {it.boxes} Boxes
                  </td>
                  <td className="border border-slate-300 p-2 text-center font-medium">
                    {it.pcs.toLocaleString()} Pcs
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-extrabold">
                <td colSpan={2} className="border border-slate-300 p-2 text-right">
                  TOTAL DISPATCHED:
                </td>
                <td className="border border-slate-300 p-2 text-center text-emerald-700">
                  {data.totalBoxes} Boxes
                </td>
                <td className="border border-slate-300 p-2 text-center text-slate-600">-</td>
              </tr>
            </tfoot>
          </table>

          <div className="flex justify-between items-end pt-8 text-xs border-t border-slate-200">
            <div>
              <div className="text-slate-500">Prepared By:</div>
              <div className="font-bold text-slate-800 uppercase">{data.userName}</div>
            </div>
            <div className="text-right">
              <div className="border-b border-slate-400 w-40 mb-1"></div>
              <div className="text-slate-500 font-medium">Authorized Signatory / Gate Officer</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
