import React, { useState } from 'react';
import {
  ArrowLeft,
  Package,
  Play,
  Pause,
  Square,
  Info,
  RotateCcw,
  Send,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Minus,
  Trash2,
  Layers,
  Undo2,
  RefreshCw,
  Truck,
  Box,
  CornerDownLeft,
  ChevronRight,
  User,
  Clock,
  Check
} from 'lucide-react';
import { FactoryState, Job, PackJob, ProductType } from '../../types';
import { DEPT_WORKERS, MACHINES } from '../../lib/constants';
import { getCurrentExpectedShift } from '../../lib/utils';

interface PackingViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  onOpenHoldModal: (machineName: string) => void;
  onOpenOrderSpecModal: (orderId: string) => void;
}

export const PackingView: React.FC<PackingViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onOpenHoldModal,
  onOpenOrderSpecModal
}) => {
  const { packJobs, jobs, shiftConfig } = state;

  const [selectedMachine, setSelectedMachine] = useState('Packing-1');
  const [shift, setShift] = useState<'DAY' | 'NIGHT'>(() => getCurrentExpectedShift(shiftConfig));
  const [packerName, setPackerName] = useState(DEPT_WORKERS['Packing']?.[0] || 'PACK_SURESH');
  const [filterCust, setFilterCust] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [packedBoxesInput, setPackedBoxesInput] = useState('');

  // Selected crates to issue per Job ID: { [jobId: string]: number }
  const [selectedCratesToIssue, setSelectedCratesToIssue] = useState<Record<string, number>>({});

  // Return Crates Modal state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnJobId, setReturnJobId] = useState('');
  const [returnCratesQty, setReturnCratesQty] = useState(1);

  // Cancel & Revert Confirmation Modal state
  const [isCancelRevertModalOpen, setIsCancelRevertModalOpen] = useState(false);

  // Quick In-line Hold Drawer state
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdReasonSelection, setHoldReasonSelection] = useState('Mechanical Sealer / Tooling Fault');
  const [holdRemarks, setHoldRemarks] = useState('');

  // Active running or held packing jobs on this machine
  const activePackJobs = packJobs.filter(
    (pj) => pj.machine === selectedMachine && (pj.status === 'Running' || pj.status === 'Held')
  );

  const activeJob = activePackJobs[0];

  // Filter pending queue
  let pendingOrders = packJobs.filter(
    (pj) =>
      pj.status === 'Pending Queue' ||
      pj.status === 'Partially Packed' ||
      ((pj.packedBoxes || 0) * pj.pcsPerBox < pj.orderQty && pj.status !== 'Running' && pj.status !== 'Held')
  );

  if (filterCust) {
    pendingOrders = pendingOrders.filter((pj) => pj.customer === filterCust);
  }

  const selectedOrder = packJobs.find((pj) => pj.id === selectedOrderId);

  // Helper to get items required for the selected order
  const getRequiredItemsList = (order: PackJob): string[] => {
    if (order.kitItems && order.kitItems.length > 0) {
      return order.kitItems;
    }
    return [order.kitType];
  };

  // Helper to get available QC jobs for a given product
  const getQcJobsForProduct = (product: string): Job[] => {
    return jobs.filter((j) => j.product === product && (j.availableQcCrates || 0) > 0);
  };

  // Handle setting crate quantity for a job ID
  const handleSetCrateQuantity = (jobId: string, qty: number, maxAvailable: number) => {
    const validQty = Math.max(0, Math.min(qty, maxAvailable));
    setSelectedCratesToIssue((prev) => {
      const next = { ...prev };
      if (validQty > 0) {
        next[jobId] = validQty;
      } else {
        delete next[jobId];
      }
      return next;
    });
  };

  // When selected order changes, auto-suggest 1 or 2 crates per required product if available
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    if (!orderId) {
      setSelectedCratesToIssue({});
      return;
    }

    const order = packJobs.find((pj) => pj.id === orderId);
    if (!order) return;

    const initialCrates: Record<string, number> = {};
    const items = getRequiredItemsList(order);

    items.forEach((item) => {
      if (item === 'Tissue') return;
      const matchedJobs = getQcJobsForProduct(item);
      if (matchedJobs.length > 0) {
        const candidate = matchedJobs[0];
        const count = Math.min(2, candidate.availableQcCrates || 1);
        if (count > 0) {
          initialCrates[candidate.id] = count;
        }
      }
    });

    setSelectedCratesToIssue(initialCrates);
  };

  // Calculate total crates currently selected to issue
  const totalCratesSelected = Object.values(selectedCratesToIssue).reduce((sum, c) => sum + c, 0);

  // ==========================================
  // ACTION: START PACKING RUN WITH ISSUED CRATES
  // ==========================================
  const handleStartPacking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!packerName.trim()) {
      alert('⚠️ Mandatory: Packer Name is required!');
      return;
    }
    if (!selectedOrderId) {
      alert('Please select a Customer Packing Order!');
      return;
    }

    if (activePackJobs.some((pj) => pj.status === 'Running')) {
      alert(
        `⚠️ Workstation [${selectedMachine}] is currently RUNNING Order [${activeJob.id}]. Finish or Hold it first!`
      );
      return;
    }

    const order = packJobs.find((pj) => pj.id === selectedOrderId);
    if (!order) return;

    // Deduct selected crates from jobs
    const updatedJobs = state.jobs.map((j) => {
      const issueCount = selectedCratesToIssue[j.id] || 0;
      if (issueCount > 0) {
        const newQc = Math.max(0, (j.availableQcCrates || 0) - issueCount);
        return {
          ...j,
          availableQcCrates: newQc
        };
      }
      return j;
    });

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build human-readable trace text of issued lots
    const issuedSummaryList = Object.entries(selectedCratesToIssue).map(([jId, crates]) => {
      const jobObj = state.jobs.find((j) => j.id === jId);
      return `${jId} (${jobObj?.product || 'Item'}): ${crates} Crates`;
    });
    const issuedSummaryText = issuedSummaryList.length > 0 ? issuedSummaryList.join(' | ') : 'Direct Feed';

    const updatedPackJobs = packJobs.map((pj) => {
      if (pj.id !== order.id) return pj;
      return {
        ...pj,
        machine: selectedMachine,
        shift,
        worker: packerName.trim().toUpperCase(),
        startTime: nowTime,
        status: 'Running' as const,
        holdReason: undefined,
        issuedCrates: { ...(pj.issuedCrates || {}), ...selectedCratesToIssue }
      };
    });

    const newLog = {
      jobId: order.id,
      product: order.kitType,
      stage: 'Packing',
      machine: selectedMachine,
      shift,
      action: `▶️ Packing Started on ${selectedMachine} for ${order.customer} | Issued: [${issuedSummaryText}] | Team: ${packerName.toUpperCase()}`,
      worker: packerName.toUpperCase(),
      user: 'pack_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      packJobs: updatedPackJobs,
      logs: [...state.logs, newLog]
    });

    setSelectedOrderId('');
    setSelectedCratesToIssue({});
    alert(`✅ Packing Started for Order [${order.id}] on ${selectedMachine}!\nIssued Crates: ${issuedSummaryText}`);
  };

  // =========================================================================
  // ACTION: PARTIAL FORWARD TO DISPATCH READY (MACHINE STAYS 100% RUNNING!)
  // =========================================================================
  const handlePartialForwardToDispatch = () => {
    if (!activeJob) return alert('No active packing order to forward!');
    const addBoxes = parseInt(packedBoxesInput, 10) || 0;
    if (addBoxes <= 0) {
      alert('⚠️ Please enter the number of packed boxes ready for partial forward (e.g. 5)!');
      return;
    }

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newTotalBoxes = (activeJob.packedBoxes || 0) + addBoxes;
    const isOrderQtyMet = newTotalBoxes * activeJob.pcsPerBox >= activeJob.orderQty;

    // Build raw material description for history run
    const issuedSummaryList = Object.entries(activeJob.issuedCrates || {}).map(
      ([jId, crates]) => `${jId}: ${crates} Crates`
    );
    const issuedSummaryText = issuedSummaryList.length > 0 ? issuedSummaryList.join(', ') : 'QC Stock';

    const historyRun = {
      runId: 'PR-' + Math.floor(1000 + Math.random() * 9000),
      machine: selectedMachine,
      shift: activeJob.shift || shift,
      worker: activeJob.worker || packerName,
      boxesPacked: addBoxes,
      startTime: activeJob.startTime || '',
      endTime: nowTime,
      date: new Date().toISOString().split('T')[0],
      issuedRawMaterial: issuedSummaryText,
      issuedCrates: activeJob.issuedCrates
    };

    // CRUCIAL FIX: Status REMAINS 'Running' so machine DOES NOT stop or finish!
    const updatedPackJobs = packJobs.map((pj) => {
      if (pj.id !== activeJob.id) return pj;
      return {
        ...pj,
        packedBoxes: newTotalBoxes,
        // Status remains 'Running' so the workstation remains active on this machine!
        status: 'Running' as const,
        machine: selectedMachine,
        historyRuns: [...(pj.historyRuns || []), historyRun]
      };
    });

    const newLog = {
      jobId: activeJob.id,
      product: activeJob.kitType,
      stage: 'Packing',
      machine: selectedMachine,
      shift: activeJob.shift,
      action: `📦 Partial Forwarded ${addBoxes} Boxes to Dispatch Ready for ${activeJob.customer} (Total Ready: ${newTotalBoxes} Boxes | Workstation continues RUNNING)`,
      worker: activeJob.worker,
      user: 'pack_user',
      startTime: activeJob.startTime,
      endTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      packJobs: updatedPackJobs,
      logs: [...state.logs, newLog]
    });

    setPackedBoxesInput('');
    alert(
      `✅ Success: Forwarded ${addBoxes} Boxes to Dispatch Ready!\n\n• Total Boxes Ready in Dispatch: ${newTotalBoxes} Boxes (${(
        newTotalBoxes * activeJob.pcsPerBox
      ).toLocaleString()} Pcs)\n• Machine [${selectedMachine}] remains RUNNING for next boxes.\n• Remaining to pack: ${Math.max(
        0,
        activeJob.orderQty - newTotalBoxes * activeJob.pcsPerBox
      ).toLocaleString()} Pcs`
    );
  };

  // ==========================================
  // ACTION: UN-ISSUE / RETURN CRATES BACK TO QC
  // ==========================================
  const handleReturnCratesToQc = () => {
    if (!activeJob) return;
    if (!returnJobId) {
      alert('Please select which Job ID crate to return to QC stock!');
      return;
    }
    const currentIssued = activeJob.issuedCrates?.[returnJobId] || 0;
    if (returnCratesQty <= 0 || returnCratesQty > currentIssued) {
      alert(`Invalid return quantity. Max issued for ${returnJobId} is ${currentIssued} crates.`);
      return;
    }

    // Add returned crates back to Job's availableQcCrates
    const updatedJobs = state.jobs.map((j) => {
      if (j.id === returnJobId) {
        return {
          ...j,
          availableQcCrates: (j.availableQcCrates || 0) + returnCratesQty
        };
      }
      return j;
    });

    // Update active packJob issuedCrates
    const newIssuedCrates = { ...(activeJob.issuedCrates || {}) };
    const remaining = currentIssued - returnCratesQty;
    if (remaining > 0) {
      newIssuedCrates[returnJobId] = remaining;
    } else {
      delete newIssuedCrates[returnJobId];
    }

    const updatedPackJobs = packJobs.map((pj) => {
      if (pj.id !== activeJob.id) return pj;
      return {
        ...pj,
        issuedCrates: newIssuedCrates
      };
    });

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newLog = {
      jobId: activeJob.id,
      product: activeJob.kitType,
      stage: 'Packing',
      machine: selectedMachine,
      shift: activeJob.shift,
      action: `↩️ Un-Issued / Returned ${returnCratesQty} Crate(s) of [${returnJobId}] back to QC Inventory from ${selectedMachine}`,
      worker: activeJob.worker,
      user: 'pack_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      packJobs: updatedPackJobs,
      logs: [...state.logs, newLog]
    });

    setIsReturnModalOpen(false);
    setReturnJobId('');
    setReturnCratesQty(1);
    alert(
      `✅ Success: Returned ${returnCratesQty} Crate(s) of [${returnJobId}] back to QC Stock!\nUpdated QC Stock is now restored.`
    );
  };

  // =========================================================================
  // ACTION: CANCEL, REVERT & DELETE RUN (ALL RAW MATERIAL RETURNED TO QC!)
  // =========================================================================
  const handleConfirmCancelAndRevert = () => {
    if (!activeJob) return;

    // Return all issued crates back to their original jobs
    const issuedMap = activeJob.issuedCrates || {};
    let totalReturned = 0;

    const updatedJobs = state.jobs.map((j) => {
      const returnQty = issuedMap[j.id] || 0;
      if (returnQty > 0) {
        totalReturned += returnQty;
        return {
          ...j,
          availableQcCrates: (j.availableQcCrates || 0) + returnQty
        };
      }
      return j;
    });

    // Reset packJob machine assignment
    const updatedPackJobs = packJobs.map((pj) => {
      if (pj.id !== activeJob.id) return pj;
      return {
        ...pj,
        machine: undefined,
        status: (pj.packedBoxes || 0) > 0 ? ('Partially Packed' as const) : ('Pending Queue' as const),
        startTime: undefined,
        holdReason: undefined,
        issuedCrates: {}
      };
    });

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newLog = {
      jobId: activeJob.id,
      product: activeJob.kitType,
      stage: 'Packing',
      machine: selectedMachine,
      shift: activeJob.shift,
      action: `❌ Canceled & Reverted Packing Run on ${selectedMachine} - All ${totalReturned} issued crates safely returned to QC Inventory`,
      worker: activeJob.worker,
      user: 'pack_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      packJobs: updatedPackJobs,
      logs: [...state.logs, newLog]
    });

    setIsCancelRevertModalOpen(false);
    setPackedBoxesInput('');
    alert(
      `✅ Run Canceled & Reverted Successfully!\n\nAll ${totalReturned} issued crates have been returned to their respective QC Inventory lots.\nWorkstation [${selectedMachine}] is now IDLE and ready for a new order.`
    );
  };

  // ==========================================
  // ACTION: HOLD MACHINE WITH REASON & ALERT
  // ==========================================
  const handleConfirmHoldStation = () => {
    if (!activeJob) return;
    const holdDesc = holdRemarks ? `${holdReasonSelection}: ${holdRemarks}` : holdReasonSelection;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedPackJobs = packJobs.map((pj) => {
      if (pj.id !== activeJob.id) return pj;
      return {
        ...pj,
        status: 'Held' as const,
        holdReason: holdDesc
      };
    });

    const newLog = {
      jobId: activeJob.id,
      product: activeJob.kitType,
      stage: 'Station Hold',
      machine: selectedMachine,
      shift: activeJob.shift,
      action: `⏸️ Machine Paused / HELD on ${selectedMachine} (${holdDesc}) [Maintenance Notified]`,
      worker: activeJob.worker,
      user: 'pack_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      packJobs: updatedPackJobs,
      logs: [...state.logs, newLog]
    });

    setIsHoldModalOpen(false);
    setHoldRemarks('');
    alert(`⏸️ Station [${selectedMachine}] is now on HOLD.\nReason: ${holdDesc}\nMaintenance team alert recorded.`);
  };

  // ==========================================
  // ACTION: RESUME RUN
  // ==========================================
  const handleResumePacking = () => {
    if (!activeJob) return alert('No active packing order to resume!');
    if (activeJob.status === 'Running') return alert('Order is already running.');

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedPackJobs = packJobs.map((pj) => {
      if (pj.id !== activeJob.id) return pj;
      return {
        ...pj,
        status: 'Running' as const,
        holdReason: undefined
      };
    });

    const newLog = {
      jobId: activeJob.id,
      product: activeJob.kitType,
      stage: 'Packing',
      machine: selectedMachine,
      shift: activeJob.shift,
      action: `▶️ Packing Resumed to RUNNING | Team: ${activeJob.worker}`,
      worker: activeJob.worker,
      user: 'pack_user',
      startTime: nowTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      packJobs: updatedPackJobs,
      logs: [...state.logs, newLog]
    });

    alert(`▶️ Order [${activeJob.id}] resumed to RUNNING on ${selectedMachine}!`);
  };

  // ==========================================
  // ACTION: COMPLETE AND FINISH PACKING ORDER
  // ==========================================
  const handleFinishPacking = () => {
    if (!activeJob) return alert('No active packing order to finish!');
    const addBoxes = parseInt(packedBoxesInput, 10) || 0;
    const newTotalBoxes = (activeJob.packedBoxes || 0) + addBoxes;

    if (newTotalBoxes <= 0) {
      alert('Please enter boxes packed during this session!');
      return;
    }

    const stopTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isCompleted = newTotalBoxes * activeJob.pcsPerBox >= activeJob.orderQty;

    const issuedSummaryList = Object.entries(activeJob.issuedCrates || {}).map(
      ([jId, crates]) => `${jId}: ${crates} Crates`
    );
    const issuedSummaryText = issuedSummaryList.length > 0 ? issuedSummaryList.join(', ') : 'QC Stock';

    const historyRun = {
      runId: 'PR-' + Math.floor(1000 + Math.random() * 9000),
      machine: selectedMachine,
      shift: activeJob.shift || shift,
      worker: activeJob.worker || packerName,
      boxesPacked: addBoxes > 0 ? addBoxes : activeJob.packedBoxes,
      startTime: activeJob.startTime || '',
      endTime: stopTime,
      date: new Date().toISOString().split('T')[0],
      issuedRawMaterial: issuedSummaryText,
      issuedCrates: activeJob.issuedCrates
    };

    const updatedPackJobs = packJobs.map((pj) => {
      if (pj.id !== activeJob.id) return pj;
      return {
        ...pj,
        packedBoxes: newTotalBoxes,
        status: isCompleted ? ('Finished Packing' as const) : ('Partially Packed' as const),
        machine: isCompleted ? undefined : selectedMachine,
        endTime: stopTime,
        historyRuns: [...(pj.historyRuns || []), historyRun]
      };
    });

    const newLog = {
      jobId: activeJob.id,
      product: activeJob.kitType,
      stage: 'Packing',
      machine: selectedMachine,
      shift: activeJob.shift,
      action: `⏹️ Finished Packing Run: ${addBoxes > 0 ? addBoxes : newTotalBoxes} Boxes for ${activeJob.customer} (Total Done: ${newTotalBoxes} Boxes / ${(
        newTotalBoxes * activeJob.pcsPerBox
      ).toLocaleString()} Pcs)`,
      worker: activeJob.worker,
      user: 'pack_user',
      startTime: activeJob.startTime,
      endTime: stopTime,
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      packJobs: updatedPackJobs,
      logs: [...state.logs, newLog]
    });

    setPackedBoxesInput('');
    alert(
      `✅ Packing Session Completed!\nTotal Packed for ${activeJob.customer}: ${newTotalBoxes} Boxes (${(
        newTotalBoxes * activeJob.pcsPerBox
      ).toLocaleString()} Pcs).\nStatus: ${isCompleted ? 'Finished Packing & Ready for Dispatch' : 'Partially Packed'}.`
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs mb-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Main Menu</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#1a365d] uppercase tracking-wide m-0">
              5. Packing & Combo Kitting Desk
            </h3>
            <p className="text-[11px] text-slate-500 m-0">
              Live Workstation Floor, QC Crate Issuance & Partial Dispatch Forwarding
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISUAL WORKSTATION FLOOR SELECTOR (मशीन फ्लोर डैशबोर्ड कार्ड्स) */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <Package className="w-4 h-4 text-emerald-600" />
            1. Select Packing Workstation (मशीन चुनें):
          </label>
          <span className="text-[11px] font-bold text-slate-500">
            Click on any station to view its live status & operate
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {MACHINES['Packing'].map((mName) => {
            const mActiveJob = packJobs.find(
              (pj) => pj.machine === mName && (pj.status === 'Running' || pj.status === 'Held')
            );
            const isSelected = selectedMachine === mName;

            let statusBadge = (
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                ⚪ IDLE
              </span>
            );

            if (mActiveJob?.status === 'Running') {
              statusBadge = (
                <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> RUNNING
                </span>
              );
            } else if (mActiveJob?.status === 'Held') {
              statusBadge = (
                <span className="text-[10px] font-extrabold text-orange-800 bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Pause className="w-2.5 h-2.5 fill-orange-600" /> HELD
                </span>
              );
            }

            return (
              <button
                key={mName}
                type="button"
                onClick={() => setSelectedMachine(mName)}
                className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`font-extrabold text-xs ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                    {mName}
                  </span>
                  {statusBadge}
                </div>

                {mActiveJob ? (
                  <div className="space-y-0.5 text-[10px]">
                    <div className="font-extrabold text-blue-950 truncate">{mActiveJob.id}</div>
                    <div className="text-slate-600 font-semibold truncate">{mActiveJob.customer}</div>
                    <div className="text-emerald-700 font-bold">
                      {mActiveJob.packedBoxes || 0} Boxes ({mActiveJob.kitType})
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 italic py-1">Ready for next job</div>
                )}

                {isSelected && (
                  <div className="mt-2 pt-1 border-t border-blue-200/80 flex items-center justify-between text-[10px] font-extrabold text-blue-700">
                    <span>Active Screen</span>
                    <Check className="w-3 h-3 text-blue-700" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* ACTIVE RUNNING / PAUSED PACKING ORDER ON WORKSTATION CARD */}
      {/* ======================================================== */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
            <Layers className="w-4 h-4 text-blue-600" />
            Active Workstation Status: [{selectedMachine}]
          </h4>
          {activeJob && (
            <span
              className={`text-[11px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1 ${
                activeJob.status === 'Held'
                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
              }`}
            >
              {activeJob.status === 'Held' ? (
                <>
                  <Pause className="w-3 h-3 fill-orange-700" /> HELD / PAUSED
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-emerald-700" /> ACTIVE RUNNING
                </>
              )}
            </span>
          )}
        </div>

        {activeJob ? (
          <div className="space-y-4">
            {/* Live Station Card */}
            <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 rounded-xl space-y-3 text-xs shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 flex-wrap gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Active Order:</span>
                  <span className="font-extrabold text-base text-blue-950">
                    {activeJob.id} — <span className="text-slate-800">{activeJob.customer}</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Kit & Rate:</span>
                  <span className="font-bold text-slate-800">
                    {activeJob.kitType} ({activeJob.pcsPerBox} Pcs/Box)
                  </span>
                </div>
              </div>

              {/* ACTIVE ISSUED CRATES & LOTS TRACEABILITY BANNER */}
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-amber-600" />
                    Issued Raw Material (QC Crates & Lots on Machine):
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsReturnModalOpen(true)}
                    className="text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1"
                  >
                    <Undo2 className="w-3 h-3" />
                    <span>Un-Issue / Return Leftover Crates to QC</span>
                  </button>
                </div>

                {activeJob.issuedCrates && Object.keys(activeJob.issuedCrates).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(activeJob.issuedCrates).map(([jId, crates]) => {
                      const jobObj = state.jobs.find((j) => j.id === jId);
                      return (
                        <div
                          key={jId}
                          className="bg-amber-50 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5"
                        >
                          <span className="text-blue-900 font-extrabold">{jId}</span>
                          <span className="text-slate-600">({jobObj?.product || 'Item'}):</span>
                          <span className="bg-amber-200/80 px-1.5 py-0.2 rounded text-amber-950 font-black">
                            {crates} Crates
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 italic">
                    Raw Material Feed: Standard QC Stock assigned
                  </div>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 bg-white/70 p-2.5 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Operator:</span>
                  <b>{activeJob.worker}</b> ({activeJob.shift || 'DAY'})
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Start Time:</span>
                  <b>{activeJob.startTime || '-'}</b>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Order Target:</span>
                  <b>{activeJob.orderQty.toLocaleString()} Pcs</b>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Packed So Far:</span>
                  <b className="text-emerald-700">{activeJob.packedBoxes || 0} Boxes</b> (
                  {((activeJob.packedBoxes || 0) * activeJob.pcsPerBox).toLocaleString()} Pcs)
                </div>
              </div>

              {activeJob.holdReason && (
                <div className="text-orange-900 font-bold bg-orange-100 border border-orange-300 p-2 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-700 shrink-0" />
                  <span>Station On HOLD Reason: {activeJob.holdReason}</span>
                </div>
              )}
            </div>

            {/* Boxes Packed Input & Partial Forward Action */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2.5">
              <label className="block text-xs font-extrabold text-emerald-800 uppercase">
                Boxes Packed in Current Session / Run (बॉक्स तैयार):
              </label>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <input
                  type="number"
                  min={1}
                  value={packedBoxesInput}
                  onChange={(e) => setPackedBoxesInput(e.target.value)}
                  placeholder="e.g. 5 Boxes ready"
                  className="flex-1 min-w-[140px] px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-900 outline-none"
                />
                <button
                  type="button"
                  onClick={handlePartialForwardToDispatch}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Truck className="w-4 h-4" />
                  <span>Forward Partial (Dispatch Ready)</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 m-0">
                💡 <b>Note:</b> Forward Partial करने पर जितने बॉक्स आपने दर्ज किए हैं, वे तुरंत <b>Dispatch</b> में उपलब्ध हो जाएंगे और मशीन <b>चालू (RUNNING)</b> रहेगी। जब तक आप <b>"Complete Job"</b> नहीं दबाएंगे, मशीन नहीं रुकेगी।
              </p>
            </div>

            {/* Workstation Action Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {activeJob.status === 'Running' ? (
                <button
                  type="button"
                  onClick={() => setIsHoldModalOpen(true)}
                  className="py-2.5 px-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Pause className="w-4 h-4" />
                  <span>Hold Station</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResumePacking}
                  className="py-2.5 px-3 bg-[#319795] hover:bg-[#285e61] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Play className="w-4 h-4" />
                  <span>Resume Run</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsReturnModalOpen(true)}
                className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Undo2 className="w-4 h-4" />
                <span>Return Crates</span>
              </button>

              <button
                type="button"
                onClick={handleFinishPacking}
                className="py-2.5 px-3 bg-[#2f855a] hover:bg-[#276749] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Square className="w-4 h-4" />
                <span>Complete Job</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCancelRevertModalOpen(true)}
                className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete & Revert</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center space-y-1">
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
              <Package className="w-4 h-4" />
            </div>
            <div className="font-bold text-slate-700">Workstation [{selectedMachine}] is currently IDLE</div>
            <div>Select a Customer Order below to issue QC crates and start packing.</div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* START NEW PACKING RUN FORM (WHEN STATION IDLE OR SWITCHED) */}
      {/* ======================================================== */}
      <div className="border-t border-slate-200 pt-5">
        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Play className="w-4 h-4 text-blue-600" />
          Start New Packing Run on [{selectedMachine}]:
        </h4>

        <form onSubmit={handleStartPacking} className="space-y-4">
          {/* Row 1: Operator & Shift */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-purple-700 uppercase mb-1">
                Packer Name / Team Leader <span className="text-rose-600">*Mandatory</span>:
              </label>
              <input
                type="text"
                list="packWorkerList"
                value={packerName}
                onChange={(e) => setPackerName(e.target.value)}
                placeholder="Type Packer Name..."
                className="w-full px-3 py-2 bg-white border border-purple-300 rounded-lg text-xs font-bold uppercase text-slate-800 outline-none"
                required
              />
              <datalist id="packWorkerList">
                {(DEPT_WORKERS['Packing'] || []).map((w) => (
                  <option key={w} value={w} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Working Shift:</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                <option value="DAY">DAY SHIFT</option>
                <option value="NIGHT">NIGHT SHIFT</option>
              </select>
            </div>
          </div>

          {/* Row 2: Customer Filter & Order Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-blue-700 uppercase mb-1">
                Filter Orders by Customer:
              </label>
              <select
                value={filterCust}
                onChange={(e) => setFilterCust(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                <option value="">-- ALL CUSTOMERS --</option>
                {Array.from(new Set(packJobs.map((p) => p.customer))).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Select Customer Packing Order:
              </label>
              <select
                value={selectedOrderId}
                onChange={(e) => handleSelectOrder(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
              >
                <option value="">-- SELECT CUSTOMER ORDER --</option>
                {pendingOrders.map((pj) => (
                  <option key={pj.id} value={pj.id}>
                    {pj.id} — {pj.customer} [{pj.kitType}] (Target: {pj.orderQty.toLocaleString()} Pcs | Done:{' '}
                    {pj.packedBoxes || 0} Boxes)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Order Details & QC Crate Selection Section */}
          {selectedOrder && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
                <span className="font-extrabold text-slate-900 uppercase text-sm flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-emerald-600" />
                  {selectedOrder.customer} — {selectedOrder.kitType}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenOrderSpecModal(selectedOrder.id)}
                  className="flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5" /> Full Spec Sheet
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-700 bg-white p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Order Qty:</span>
                  <b>{selectedOrder.orderQty.toLocaleString()} Pcs</b> ({selectedOrder.pcsPerBox} Pcs/Box)
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Target Dispatch:</span>
                  <b className="text-rose-700">{selectedOrder.dispatchDate}</b>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Specs:</span>
                  Wrap: <b>{selectedOrder.wrapping || 'Standard'}</b> | Label: <b>{selectedOrder.labeling || 'Standard'}</b>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Packed So Far:</span>
                  <b className="text-emerald-700">{selectedOrder.packedBoxes || 0} Boxes</b> (
                  {((selectedOrder.packedBoxes || 0) * selectedOrder.pcsPerBox).toLocaleString()} Pcs)
                </div>
              </div>

              {/* DETAILED QC CRATE SELECTION BREAKDOWN PER COMPONENT */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-600" />
                    Select QC Approved Crates to Issue to Machine:
                  </span>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    Total Selected: {totalCratesSelected} Crates
                  </span>
                </div>

                <div className="space-y-2.5">
                  {getRequiredItemsList(selectedOrder).map((item) => {
                    if (item === 'Tissue') {
                      return (
                        <div
                          key="Tissue"
                          className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                            <span className="font-bold text-blue-900">Tissue / Napkin Roll:</span>
                            <span className="text-slate-600">Raw Material In-Stock (Direct Feed)</span>
                          </div>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                            Continuous Feed
                          </span>
                        </div>
                      );
                    }

                    const qcJobs = getQcJobsForProduct(item);
                    const totalAvailForItem = qcJobs.reduce((sum, j) => sum + (j.availableQcCrates || 0), 0);

                    return (
                      <div
                        key={item}
                        className={`p-3 rounded-xl border ${
                          totalAvailForItem > 0
                            ? 'bg-white border-slate-200 shadow-2xs'
                            : 'bg-rose-50/60 border-rose-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 uppercase">{item}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                totalAvailForItem > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {totalAvailForItem > 0 ? `${totalAvailForItem} Crates in QC Stock` : '0 QC Stock Available'}
                            </span>
                          </div>
                        </div>

                        {qcJobs.length === 0 ? (
                          <div className="text-[11px] text-rose-700 font-semibold bg-rose-50 p-2 rounded-lg border border-rose-200">
                            ⚠️ No QC Approved Crates available for {item}. Please process and pass crates in QC Desk first.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {qcJobs.map((j) => {
                              const currentSelected = selectedCratesToIssue[j.id] || 0;
                              const maxAvail = j.availableQcCrates || 0;

                              return (
                                <div
                                  key={j.id}
                                  className={`flex items-center justify-between p-2 rounded-lg border transition ${
                                    currentSelected > 0
                                      ? 'bg-amber-50/50 border-amber-300'
                                      : 'bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  <div>
                                    <span className="font-bold text-blue-800 text-xs">{j.id}</span>
                                    <span className="text-[11px] text-slate-600 ml-2 font-medium">
                                      Brand: <b>{j.paperBrand || 'ITC'}</b> | Available QC:{' '}
                                      <b className="text-emerald-700">{maxAvail} Crates</b>
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-600">Issue:</span>
                                    <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5">
                                      <button
                                        type="button"
                                        onClick={() => handleSetCrateQuantity(j.id, currentSelected - 1, maxAvail)}
                                        disabled={currentSelected <= 0}
                                        className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                                      >
                                        <Minus className="w-3 h-3 text-slate-700" />
                                      </button>
                                      <input
                                        type="number"
                                        min={0}
                                        max={maxAvail}
                                        value={currentSelected}
                                        onChange={(e) =>
                                          handleSetCrateQuantity(j.id, parseInt(e.target.value, 10) || 0, maxAvail)
                                        }
                                        className="w-10 text-center font-extrabold text-xs text-blue-950 bg-transparent outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSetCrateQuantity(j.id, currentSelected + 1, maxAvail)}
                                        disabled={currentSelected >= maxAvail}
                                        className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3 text-slate-700" />
                                      </button>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleSetCrateQuantity(j.id, maxAvail, maxAvail)}
                                      className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 px-1.5 py-1 rounded cursor-pointer border border-blue-200"
                                    >
                                      Max
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedOrderId}
            className="w-full py-3 bg-[#2b6cb0] hover:bg-[#1a365d] disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start Packing Run on {selectedMachine} ({totalCratesSelected} Crates Selected)</span>
          </button>
        </form>
      </div>

      {/* ======================================================== */}
      {/* MODAL: UN-ISSUE / RETURN CRATES BACK TO QC INVENTORY */}
      {/* ======================================================== */}
      {isReturnModalOpen && activeJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-amber-800">
                <Undo2 className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold m-0">Return Leftover Crates to QC Stock</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="text-slate-400 hover:text-rose-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 m-0">
              अगर आपने ज्यादा क्रेट इशू कर दिए थे और काम पूरा होने के बाद क्रेट बच गए हैं, तो यहाँ से सीधे QC स्टॉक में वापस जमा करें:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  1. Select Job Lot to Return From:
                </label>
                <select
                  value={returnJobId}
                  onChange={(e) => {
                    setReturnJobId(e.target.value);
                    setReturnCratesQty(1);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 outline-none"
                >
                  <option value="">-- SELECT ISSUED JOB LOT --</option>
                  {Object.entries(activeJob.issuedCrates || {}).map(([jId, crates]) => {
                    const jobObj = state.jobs.find((j) => j.id === jId);
                    return (
                      <option key={jId} value={jId}>
                        {jId} ({jobObj?.product || 'Item'}) — Currently Issued: {crates} Crates
                      </option>
                    );
                  })}
                </select>
              </div>

              {returnJobId && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    2. Quantity of Crates to Return:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={activeJob.issuedCrates?.[returnJobId] || 1}
                      value={returnCratesQty}
                      onChange={(e) => setReturnCratesQty(parseInt(e.target.value, 10) || 1)}
                      className="w-24 px-3 py-2 bg-white border border-amber-300 rounded-lg font-extrabold text-slate-800 outline-none"
                    />
                    <span className="text-slate-500 font-medium">
                      Max Returnable: <b>{activeJob.issuedCrates?.[returnJobId] || 0} Crates</b>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReturnCratesToQc}
                disabled={!returnJobId}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Confirm Return to QC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE & REVERT RUN (RESTORE ALL RAW MATERIAL TO QC INVENTORY) */}
      {/* ========================================================================= */}
      {isCancelRevertModalOpen && activeJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-rose-700">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-bold m-0">Delete & Revert Active Packing Run</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelRevertModalOpen(false)}
                className="text-slate-400 hover:text-rose-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed m-0">
              क्या आप <b>[{selectedMachine}]</b> पर चल रहे आर्डर <b>[{activeJob.id} — {activeJob.customer}]</b> के रन को रद्द और डिलीट करना चाहते हैं?
            </p>

            {/* Issued Crates Return List Breakdown */}
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2 text-xs">
              <div className="font-extrabold text-rose-900 flex items-center gap-1.5">
                <Undo2 className="w-4 h-4 text-rose-700" />
                Material to be returned to QC Inventory:
              </div>
              {activeJob.issuedCrates && Object.keys(activeJob.issuedCrates).length > 0 ? (
                <div className="space-y-1">
                  {Object.entries(activeJob.issuedCrates).map(([jId, crates]) => {
                    const jobObj = state.jobs.find((j) => j.id === jId);
                    return (
                      <div
                        key={jId}
                        className="bg-white p-2 rounded-lg border border-rose-200 flex items-center justify-between text-slate-800"
                      >
                        <div>
                          <b className="text-blue-900">{jId}</b> ({jobObj?.product || 'Item'})
                        </div>
                        <span className="font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                          +{crates} Crates back to QC
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-slate-600 italic">No specific crate deductions to restore.</div>
              )}
            </div>

            <div className="text-[11px] text-slate-500">
              ⚡ पुष्टि करने पर यह रनिंग एंट्री हट जाएगी, मशीन <b>IDLE</b> हो जाएगी और सारा मटेरियल सुरक्षित वापस QC स्टॉक में चला जाएगा।
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelRevertModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                No, Keep Running
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelAndRevert}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-xs"
              >
                Yes, Delete & Return Material
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: HOLD STATION WITH MAINTENANCE BREAKDOWN ALERT */}
      {/* ======================================================== */}
      {isHoldModalOpen && activeJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-orange-700">
                <Pause className="w-5 h-5" />
                <h3 className="text-sm font-bold m-0">Hold Workstation & Maintenance Alert</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHoldModalOpen(false)}
                className="text-slate-400 hover:text-rose-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 m-0">
              मशीन में कोई तकनीकी या मटेरियल समस्या आने पर होल्ड कारण दर्ज करें ताकि मेंटेनेंस टीम को तुरंत अलर्ट मिल सके:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Select Breakdown Reason:</label>
                <select
                  value={holdReasonSelection}
                  onChange={(e) => setHoldReasonSelection(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 outline-none"
                >
                  <option value="Mechanical Sealer / Tooling Fault">Mechanical Sealer / Tooling Fault</option>
                  <option value="Wrapper Film / Paper Roll Jam">Wrapper Film / Paper Roll Jam</option>
                  <option value="Heater Temperature Fluctuation">Heater Temperature Fluctuation</option>
                  <option value="Raw Material / Crate Quality Issue">Raw Material / Crate Quality Issue</option>
                  <option value="Electrical / Sensor Fault">Electrical / Sensor Fault</option>
                  <option value="Shift Handover / Operator Break">Shift Handover / Operator Break</option>
                  <option value="Other Maintenance Check">Other Maintenance Check</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Additional Operator Remarks:</label>
                <textarea
                  rows={2}
                  value={holdRemarks}
                  onChange={(e) => setHoldRemarks(e.target.value)}
                  placeholder="Specific details for maintenance team..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsHoldModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmHoldStation}
                className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Confirm Hold & Alert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
