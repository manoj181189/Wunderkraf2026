import React from 'react';
import { FileSpreadsheet, Download, X, Layers, Box, Truck } from 'lucide-react';
import { PackJob } from '../types';
import { downloadCSV } from '../lib/utils';

interface OrderSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PackJob | null;
}

export const OrderSpecModal: React.FC<OrderSpecModalProps> = ({ isOpen, onClose, order }) => {
  if (!isOpen || !order) return null;

  const targetBoxes = Math.ceil(order.orderQty / order.pcsPerBox);
  const readyBoxes = Math.max(0, (order.packedBoxes || 0) - (order.dispatchedBoxes || 0));

  const exportSpecCSV = () => {
    let csv = 'Section,Field,Value\r\n';
    csv += `"Step 1","Customer","${order.customer}"\r\n`;
    csv += `"Step 1","Order ID","${order.id}"\r\n`;
    csv += `"Step 1","Kit Type","${order.kitType}"\r\n`;
    csv += `"Step 2","Target Qty Pcs","${order.orderQty}"\r\n`;
    csv += `"Step 2","Pcs Per Box","${order.pcsPerBox}"\r\n`;
    csv += `"Step 2","Target Dispatch Date","${order.dispatchDate || ''}"\r\n`;
    csv += `"Step 2","Box Wrapping","${order.wrapping || 'NO'}"\r\n`;
    csv += `"Step 2","Labeling","${order.labeling || 'NO'}"\r\n`;
    csv += `"Step 2","Remarks","${(order.remarks || '').replace(/"/g, '""')}"\r\n`;
    csv += `"Step 3","Total Packed Boxes","${order.packedBoxes || 0}"\r\n`;
    csv += `"Step 3","Dispatched Boxes","${order.dispatchedBoxes || 0}"\r\n`;
    csv += `"Step 3","Ready in Warehouse","${readyBoxes}"\r\n`;

    if (order.dispatchLogs && order.dispatchLogs.length > 0) {
      order.dispatchLogs.forEach((dl) => {
        csv += `"Dispatch Log","${dl.date}","Boxes: ${dl.boxes} | Pcs: ${dl.pcs} | Inv: ${dl.invoiceNo} | GT: ${dl.gtNo}"\r\n`;
      });
    }

    downloadCSV(csv, `Order_Spec_${order.id}_${order.customer.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border-t-6 border-blue-600 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2 text-[#1a365d]">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold m-0">Customer Packing & Dispatch Spec Sheet</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportSpecCSV}
              className="flex items-center gap-1.5 bg-[#2f855a] hover:bg-[#276749] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Step 1 */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl border-l-4 border-l-blue-600">
            <h4 className="text-xs font-bold text-[#1a365d] uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Step 1: Customer & Order Identification</span>
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500">Customer / Brand:</span>
                <div className="font-extrabold text-slate-900 text-sm">{order.customer}</div>
              </div>
              <div>
                <span className="text-slate-500">Order ID:</span>
                <div className="font-extrabold text-blue-700">{order.id}</div>
              </div>
              <div>
                <span className="text-slate-500">Configuration:</span>
                <div className="font-bold text-emerald-700">{order.kitType}</div>
              </div>
              <div>
                <span className="text-slate-500">Created By:</span>
                <div className="font-medium text-slate-800">{order.createdBy || 'MARKETING'}</div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl border-l-4 border-l-orange-500">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
              <Box className="w-4 h-4 text-orange-600" />
              <span>Step 2: Packaging Specifications & Target</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500">Target Qty:</span>
                <div className="font-bold text-slate-800">{order.orderQty.toLocaleString()} Pcs</div>
              </div>
              <div>
                <span className="text-slate-500">Pcs Per Box:</span>
                <div className="font-bold text-slate-800">{order.pcsPerBox.toLocaleString()} Pcs/Box</div>
              </div>
              <div>
                <span className="text-slate-500">Total Boxes:</span>
                <div className="font-bold text-blue-700">{targetBoxes} Boxes</div>
              </div>
              <div>
                <span className="text-slate-500">Target Dispatch Date:</span>
                <div className="font-bold text-rose-600">{order.dispatchDate || 'N/A'}</div>
              </div>
              <div>
                <span className="text-slate-500">Box Wrapping:</span>
                <div className="font-bold text-slate-800">{order.wrapping || 'NO'}</div>
              </div>
              <div>
                <span className="text-slate-500">Label Placement:</span>
                <div className="font-bold text-slate-800">{order.labeling || 'NO'}</div>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="text-slate-500">Special Instructions / Remarks:</span>
                <div className="italic text-slate-700 bg-white p-2 rounded border border-slate-200 mt-1">
                  {order.remarks || 'Standard Packing'}
                </div>
              </div>
              {order.tracedLots && (
                <div className="col-span-2 sm:col-span-3 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-emerald-900">
                  <span className="font-bold block mb-1">🔍 Component QC Lots Used in Packing:</span>
                  <div className="space-y-0.5 font-mono text-[11px]">
                    {Object.keys(order.tracedLots).map((k) => (
                      <div key={k}>
                        • <b>{k}:</b> {order.tracedLots?.[k]}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl border-l-4 border-l-emerald-600">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 mb-2.5">
              <Truck className="w-4 h-4 text-emerald-600" />
              <span>Step 3: Live Warehouse Stock & Dispatch History</span>
            </h4>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                <span className="text-slate-500 block text-[11px]">Produced:</span>
                <span className="font-extrabold text-slate-900 text-sm">{order.packedBoxes || 0} Boxes</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                <span className="text-slate-500 block text-[11px]">Dispatched:</span>
                <span className="font-extrabold text-emerald-700 text-sm">{order.dispatchedBoxes || 0} Boxes</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                <span className="text-slate-500 block text-[11px]">Ready in WH:</span>
                <span className="font-extrabold text-blue-700 text-sm">{readyBoxes} Boxes</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-lg">
                <thead>
                  <tr className="bg-slate-200/70 text-slate-700 font-bold">
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-center">Boxes</th>
                    <th className="p-2 text-center">Pieces</th>
                    <th className="p-2 text-left">Invoice No</th>
                    <th className="p-2 text-left">Vehicle / GT</th>
                    <th className="p-2 text-left">Officer</th>
                  </tr>
                </thead>
                <tbody>
                  {order.dispatchLogs && order.dispatchLogs.length > 0 ? (
                    order.dispatchLogs.map((dl, idx) => (
                      <tr key={idx} className="border-t border-slate-200 hover:bg-white">
                        <td className="p-2">{dl.date}</td>
                        <td className="p-2 text-center font-bold text-emerald-700">{dl.boxes}</td>
                        <td className="p-2 text-center">{dl.pcs.toLocaleString()}</td>
                        <td className="p-2 font-bold">{dl.invoiceNo}</td>
                        <td className="p-2">{dl.gtNo}</td>
                        <td className="p-2 font-mono text-[11px]">{dl.user}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-3 text-center text-slate-400">
                        No dispatches logged yet for this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
