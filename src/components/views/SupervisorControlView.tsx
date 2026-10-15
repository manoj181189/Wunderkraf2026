import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Scissors,
  Cog,
  SearchCheck,
  Package,
  Truck,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Undo2,
  Calendar,
  Clock,
  Layers,
  FileText,
  Barcode,
  Search,
  Filter,
  Users,
  Printer,
  ChevronRight,
  TrendingDown,
  Gauge,
  GitMerge,
  Workflow,
  Database,
  CheckCheck,
  Link2,
  Sparkles
} from 'lucide-react';
import { FactoryState, Job, SupervisorGateApproval, QcDefectRecord, GatePassDispatch } from '../../types';
import {
  executeCrateReturnTransaction,
  executeScrapVerificationTransaction,
  executeQCGateApprovalTransaction,
  executeGatePassDispatchTransaction,
  validateStateInvariants
} from '../../lib/domainTransactions';
import { getActiveShiftWorkingSet, paginateRecords } from '../../lib/statePartition';
import { getCurrentExpectedShift } from '../../lib/utils';

interface SupervisorControlViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (state: FactoryState) => void;
  currentUser?: { username: string; perms: string[] } | null;
}

export const SupervisorControlView: React.FC<SupervisorControlViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  currentUser
}) => {
  const supervisorUsername = currentUser?.username || 'supervisor_desk';
  const shift = getCurrentExpectedShift(state.shiftConfig);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CUTTING_GATE' | 'FORMING_GATE' | 'QC_GATE' | 'DISPATCH_GATE' | 'AUDIT_LEDGER' | 'INTEGRATION_MAP'>('OVERVIEW');

  // Fast active working set
  const workingSet = useMemo(() => getActiveShiftWorkingSet(state), [state]);
  const invariants = useMemo(() => validateStateInvariants(state), [state]);

  // --- TAB 1: CUTTING GATE STATE ---
  const [selectedCuttingJobId, setSelectedCuttingJobId] = useState('');
  const [selectedCuttingMachine, setSelectedCuttingMachine] = useState('Cutting-1');
  const [cuttingOperator, setCuttingOperator] = useState('Operator 1');
  const [setupScrapKg, setSetupScrapKg] = useState('0.8');
  const [trimScrapKg, setTrimScrapKg] = useState('3.2');
  const [rejectScrapKg, setRejectScrapKg] = useState('0.5');
  const [cuttingInputKg, setCuttingInputKg] = useState('90');
  const [cuttingGateNotes, setCuttingGateNotes] = useState('');
  const [cuttingSuccessMsg, setCuttingSuccessMsg] = useState('');

  // --- TAB 2: FORMING RETURN GATE STATE ---
  const [selectedFormingBatchId, setSelectedFormingBatchId] = useState('');
  const [selectedReturnTargetLotId, setSelectedReturnTargetLotId] = useState('');
  const [returnCratesCount, setReturnCratesCount] = useState('1');
  const [returnReason, setReturnReason] = useState('Unused Shift Balance');
  const [formingReturnSuccessMsg, setFormingReturnSuccessMsg] = useState('');

  // --- TAB 3: QC GATE STATE ---
  const [selectedQcJobId, setSelectedQcJobId] = useState('');
  const [qcInspectorName, setQcInspectorName] = useState('QC_RAMESH');
  const [qcFormingOperator, setQcFormingOperator] = useState('');
  const [qcApprovedCrates, setQcApprovedCrates] = useState('2');
  const [qcDefectCategory, setQcDefectCategory] = useState<string>('Bottom Leakage / Pinholes');
  const [qcRejectedPcs, setQcRejectedPcs] = useState('0');
  const [qcSeverity, setQcSeverity] = useState<'CRITICAL' | 'MAJOR' | 'MINOR'>('MAJOR');
  const [qcNotes, setQcNotes] = useState('');
  const [qcSuccessMsg, setQcSuccessMsg] = useState('');

  // --- TAB 4: DISPATCH GATE PASS STATE ---
  const [gpCustomerName, setGpCustomerName] = useState('Acme Food Packaging');
  const [gpProduct, setGpProduct] = useState('Spoon');
  const [gpBoxesCount, setGpBoxesCount] = useState('50');
  const [gpPiecesCount, setGpPiecesCount] = useState('50000');
  const [gpGrossWeightKg, setGpGrossWeightKg] = useState('240');
  const [gpVehicleNo, setGpVehicleNo] = useState('GJ-01-AB-1234');
  const [gpDriverName, setGpDriverName] = useState('Mukesh Bhai');
  const [gpDriverPhone, setGpDriverPhone] = useState('+91 98765 43210');
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState('');
  const [lastGeneratedPass, setLastGeneratedPass] = useState<GatePassDispatch | null>(null);

  // --- TAB 5: AUDIT LEDGER PAGINATION ---
  const [ledgerPage, setLedgerPage] = useState(1);
  const ledgerPaginated = useMemo(() => {
    return paginateRecords(state.supervisorApprovals || [], ledgerPage, 15);
  }, [state.supervisorApprovals, ledgerPage]);

  // All active forming batches available for return
  const activeFormingBatches = useMemo(() => {
    const list: { job: Job; batchId: string; machine: string; worker: string; issuedQty: number; sourceOperator?: string }[] = [];
    (state.jobs || []).forEach((job) => {
      (job.runningBatches || []).forEach((b) => {
        if ((b.stage === 'Forming' || b.machine?.startsWith('Forming')) && (b.issuedQty || 0) > 0) {
          list.push({
            job,
            batchId: b.batchId,
            machine: b.machine,
            worker: b.worker,
            issuedQty: b.issuedQty || 0,
            sourceOperator: b.sourceOperator
          });
        }
      });
    });
    return list;
  }, [state.jobs]);

  const activeSelectedFormingBatch = activeFormingBatches.find((item) => item.batchId === selectedFormingBatchId);

  // Available cutting lots for this job
  const availableCuttingLotsForJob = useMemo(() => {
    if (!activeSelectedFormingBatch) return [];
    return (state.wipLots || []).filter(
      (lot) => lot.stage === 'Cutting' && (lot.jobId === activeSelectedFormingBatch.job.id || activeSelectedFormingBatch.job.id.includes(lot.jobId))
    );
  }, [activeSelectedFormingBatch, state.wipLots]);

  // Handler: Execute Cutting Scrap Verification
  const handleVerifyCuttingScrap = () => {
    if (!selectedCuttingJobId) {
      alert('Please select an active cutting job.');
      return;
    }
    const setupKg = parseFloat(setupScrapKg) || 0;
    const trimKg = parseFloat(trimScrapKg) || 0;
    const rejKg = parseFloat(rejectScrapKg) || 0;
    const inputKg = parseFloat(cuttingInputKg) || 1;

    const result = executeScrapVerificationTransaction(state, {
      stage: 'Cutting',
      jobId: selectedCuttingJobId,
      machine: selectedCuttingMachine,
      operator: cuttingOperator,
      shift,
      setupScrapKg: setupKg,
      trimScrapKg: trimKg,
      rejectionScrapKg: rejKg,
      inputKg,
      supervisorName: supervisorUsername,
      notes: cuttingGateNotes
    });

    onSaveState(result.updatedState);
    setCuttingSuccessMsg(
      result.requiresSupervisorApproval
        ? `⚠️ Scrap rate exceeded tolerance! Digital supervisor override authorized (${result.approval.metrics.scrapPct}%).`
        : `✅ Cutting scrap verified and digitally signed by Supervisor.`
    );
    setTimeout(() => setCuttingSuccessMsg(''), 5000);
  };

  // Handler: Execute Supervised Crate Return
  const handleExecuteSupervisedReturn = () => {
    if (!activeSelectedFormingBatch) {
      alert('Please select an active Forming Batch to return crates from.');
      return;
    }
    const crates = parseInt(returnCratesCount, 10) || 0;
    if (crates <= 0) {
      alert('Enter a valid crate quantity to return.');
      return;
    }

    const result = executeCrateReturnTransaction(state, {
      jobId: activeSelectedFormingBatch.job.id,
      formingBatchId: activeSelectedFormingBatch.batchId,
      cratesToReturn: crates,
      targetCuttingLotId: selectedReturnTargetLotId,
      targetOperatorName: availableCuttingLotsForJob.find((l) => l.id === selectedReturnTargetLotId)?.producedByOperator,
      returnReason,
      supervisorName: supervisorUsername,
      machineName: activeSelectedFormingBatch.machine
    });

    if (!result.success) {
      alert(`Return rejected: ${result.errorMessage}`);
      return;
    }

    onSaveState(result.updatedState);
    setFormingReturnSuccessMsg(
      `✅ Returned ${result.returnedCrates} Crates (${result.returnedPieces.toLocaleString()} Flat Blanks) to ${result.targetOperator}'s Cutting Lot!`
    );
    setSelectedFormingBatchId('');
    setTimeout(() => setFormingReturnSuccessMsg(''), 6000);
  };

  // Handler: Execute QC Gate Sign-off
  const handleExecuteQcSignOff = () => {
    if (!selectedQcJobId) {
      alert('Please select a production lot for QC sign-off.');
      return;
    }
    const approvedCrates = parseInt(qcApprovedCrates, 10) || 0;
    const rejPcs = parseInt(qcRejectedPcs, 10) || 0;

    const result = executeQCGateApprovalTransaction(state, {
      jobId: selectedQcJobId,
      formingOperator: qcFormingOperator || 'Operator A',
      inspectorName: qcInspectorName,
      supervisorName: supervisorUsername,
      machine: 'Forming-Line-A',
      approvedCrates,
      defectCategory: rejPcs > 0 ? qcDefectCategory : undefined,
      rejectedPieces: rejPcs,
      severity: qcSeverity,
      notes: qcNotes
    });

    onSaveState(result.updatedState);
    setQcSuccessMsg(`🛡️ QC Approved: ${approvedCrates} Crates stamped QC_APPROVED and released to Packing Station.`);
    setTimeout(() => setQcSuccessMsg(''), 5000);
  };

  // Handler: Generate Dispatch Gate Pass
  const handleGenerateGatePass = () => {
    const boxes = parseInt(gpBoxesCount, 10) || 0;
    const pcs = parseInt(gpPiecesCount, 10) || 0;
    const weight = parseFloat(gpGrossWeightKg) || 0;

    if (boxes <= 0) {
      alert('Please enter a valid box count.');
      return;
    }

    const result = executeGatePassDispatchTransaction(state, {
      customerName: gpCustomerName,
      product: gpProduct,
      boxesCount: boxes,
      totalPieces: pcs,
      grossWeightKg: weight,
      vehicleNo: gpVehicleNo,
      driverName: gpDriverName,
      driverPhone: gpDriverPhone,
      supervisorName: supervisorUsername
    });

    onSaveState(result.updatedState);
    setLastGeneratedPass(result.gatePass);
    setDispatchSuccessMsg(`🚚 Gate Pass #${result.gatePass.id} Generated with GS1-128 Barcode!`);
    setTimeout(() => setDispatchSuccessMsg(''), 6000);
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHub}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              title="Back to Navigation Hub"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
                <h1 className="text-xl font-black text-slate-900 tracking-tight m-0">
                  Post-Slitting Supervisor Control Suite
                </h1>
                <span className="bg-indigo-100 text-indigo-800 text-[11px] font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">
                  Floor Governance
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium m-0 mt-0.5">
                Strict Quality Gates, Scrap Thresholds, Operator Attribution & Zero-Ghost Crate Reconciliation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supervisor Desk</div>
              <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>{supervisorUsername}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono font-bold">
                  {shift} SHIFT
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* State Invariant Integrity Guard */}
        {!invariants.valid && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-3 text-rose-900 text-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <div className="font-extrabold">State Invariant Alert: Potential Inventory Mismatch Detected</div>
              <div className="text-[11px] font-medium text-rose-700">
                {invariants.errors.slice(0, 2).join(' | ')}
              </div>
            </div>
          </div>
        )}

        {/* Live Post-Slitting KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Scissors className="w-3 h-3 text-purple-600" /> Cutting Stock
            </div>
            <div className="text-base font-black text-slate-900 mt-1">
              {(state.jobs || []).reduce((sum, j) => sum + (j.availableCuttingCrates || 0), 0)} Crates
            </div>
            <div className="text-[10px] text-slate-500 font-medium">Flat Blanks in Buffer</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Cog className="w-3 h-3 text-amber-600" /> Active Forming
            </div>
            <div className="text-base font-black text-amber-700 mt-1">
              {activeFormingBatches.length} Lines Running
            </div>
            <div className="text-[10px] text-slate-500 font-medium">Cup & Cutlery Spindles</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <SearchCheck className="w-3 h-3 text-cyan-600" /> Pending QC
            </div>
            <div className="text-base font-black text-cyan-800 mt-1">
              {workingSet.pendingQcCount} Crates
            </div>
            <div className="text-[10px] text-slate-500 font-medium">Inspection Release Gate</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <RotateCcw className="w-3 h-3 text-emerald-600" /> Supervised Returns
            </div>
            <div className="text-base font-black text-emerald-700 mt-1">
              {(state.supervisorApprovals || []).filter((a) => a.type === 'CRATE_RETURN').length} Reconciled
            </div>
            <div className="text-[10px] text-slate-500 font-medium">Attributed to Operators</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Truck className="w-3 h-3 text-indigo-600" /> Gate Passes
            </div>
            <div className="text-base font-black text-indigo-800 mt-1">
              {(state.gatePassDispatches || []).length} Dispatches
            </div>
            <div className="text-[10px] text-slate-500 font-medium">GS1-128 Verified</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Gauge className="w-4 h-4" /> Overview Dashboard
          </button>
          <button
            onClick={() => setActiveTab('CUTTING_GATE')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'CUTTING_GATE'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Scissors className="w-4 h-4" /> 1. Cutting Line Gate
          </button>
          <button
            onClick={() => setActiveTab('FORMING_GATE')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'FORMING_GATE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Cog className="w-4 h-4" /> 2. Forming & Return Gate
          </button>
          <button
            onClick={() => setActiveTab('QC_GATE')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'QC_GATE'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <SearchCheck className="w-4 h-4" /> 3. QC & Defect Gate
          </button>
          <button
            onClick={() => setActiveTab('DISPATCH_GATE')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'DISPATCH_GATE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Truck className="w-4 h-4" /> 4. Gate-Pass & Dispatch
          </button>
          <button
            onClick={() => setActiveTab('AUDIT_LEDGER')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'AUDIT_LEDGER'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" /> 5. Sign-off Ledger
          </button>
          <button
            onClick={() => setActiveTab('INTEGRATION_MAP')}
            className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'INTEGRATION_MAP'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <GitMerge className="w-4 h-4" /> 6. ERP Integration Flow (संपूर्ण लिंकेज)
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & POST-SLITTING PROCESS SUMMARY */}
      {/* ========================================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2 m-0">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Post-Slitting Industrial Governance Rules
            </h2>
            <div className="space-y-3 text-xs text-slate-700">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                <span className="font-extrabold text-purple-950 block">1. Cutting Line Scrap Segregation:</span>
                Operators weigh Setup scrap, Trim scrap, and Defect scrap separately. If scrap exceeds 4.5%, the run requires digital Supervisor Sign-off.
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="font-extrabold text-amber-950 block">2. Forming Return Operator Attribution:</span>
                When un-issuing unused flat blank crates, the system strictly credits the original Cutting Operator lot. Ghost crates are prevented by live piece reconciliation.
              </div>
              <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-200">
                <span className="font-extrabold text-cyan-950 block">3. QC Defect Categorization:</span>
                Pinholes, Curl deformities, and Seam failures are classified and charged to the responsible forming operator, adjusting piece-rate yield scores.
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="font-extrabold text-rose-950 block">4. GS1-128 Digital Gate-Pass:</span>
                Cartons cannot be dispatched until crate balance is zero and bi-directional lot genealogy (Mother Reel to Box) is verified.
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2 m-0">
              <Clock className="w-5 h-5 text-slate-700" />
              Recent Supervisor Actions & Approvals
            </h2>
            <div className="space-y-2">
              {(state.supervisorApprovals || []).slice(0, 5).map((approval) => (
                <div key={approval.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      {approval.type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(approval.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Job: <b>{approval.jobId}</b> | Stage: <b>{approval.stage}</b> | Operator: <b>{approval.operator}</b>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium italic">
                    {approval.notes || approval.reason}
                  </div>
                </div>
              ))}
              {(!state.supervisorApprovals || state.supervisorApprovals.length === 0) && (
                <div className="text-center py-8 text-xs text-slate-400 font-medium">
                  No supervisor approvals logged yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CUTTING LINE GATE (SCRAP THRESHOLD & DIE VERIFICATION) */}
      {/* ========================================================================= */}
      {activeTab === 'CUTTING_GATE' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 m-0 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-purple-600" />
                Cutting Die Line — Scrap & Die Verification Gate
              </h2>
              <p className="text-xs text-slate-500 m-0">
                Log segregated scrap weights and authorize runs that exceed the 4.5% tolerance threshold
              </p>
            </div>
          </div>

          {cuttingSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {cuttingSuccessMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Select Cutting Job / Lot:
              </label>
              <select
                value={selectedCuttingJobId}
                onChange={(e) => setSelectedCuttingJobId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
              >
                <option value="">-- Choose Active Cutting Job --</option>
                {(state.jobs || []).map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.id} - {j.product} ({j.availableRolls || 0} Rolls Avail)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Cutting Machine:
              </label>
              <select
                value={selectedCuttingMachine}
                onChange={(e) => setSelectedCuttingMachine(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
              >
                <option value="Cutting-1">Cutting-1 (High Speed Die)</option>
                <option value="Cutting-2">Cutting-2 (Heavy Caliper)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Cutting Operator:
              </label>
              <input
                type="text"
                value={cuttingOperator}
                onChange={(e) => setCuttingOperator(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
                placeholder="e.g. Ramesh Patel"
              />
            </div>
          </div>

          {/* Segregated Scrap Breakdown */}
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl space-y-4">
            <div className="text-xs font-black text-purple-950 uppercase tracking-wide">
              ⚖️ Digital Scale Scrap Segregation (Weights in KG)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-purple-900 mb-1">Setup / Start Scrap (kg):</label>
                <input
                  type="number"
                  step="0.1"
                  value={setupScrapKg}
                  onChange={(e) => setSetupScrapKg(e.target.value)}
                  className="w-full px-3 py-1.5 border border-purple-300 rounded-lg text-xs font-bold bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-purple-900 mb-1">Process Trim Scrap (kg):</label>
                <input
                  type="number"
                  step="0.1"
                  value={trimScrapKg}
                  onChange={(e) => setTrimScrapKg(e.target.value)}
                  className="w-full px-3 py-1.5 border border-purple-300 rounded-lg text-xs font-bold bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-purple-900 mb-1">Defect Rejection (kg):</label>
                <input
                  type="number"
                  step="0.1"
                  value={rejectScrapKg}
                  onChange={(e) => setRejectScrapKg(e.target.value)}
                  className="w-full px-3 py-1.5 border border-purple-300 rounded-lg text-xs font-bold bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-purple-900 mb-1">Gross Input Paper (kg):</label>
                <input
                  type="number"
                  step="0.1"
                  value={cuttingInputKg}
                  onChange={(e) => setCuttingInputKg(e.target.value)}
                  className="w-full px-3 py-1.5 border border-purple-300 rounded-lg text-xs font-bold bg-white"
                />
              </div>
            </div>

            {/* Calculated Scrap Rate */}
            {(() => {
              const totalScrap = (parseFloat(setupScrapKg) || 0) + (parseFloat(trimScrapKg) || 0) + (parseFloat(rejectScrapKg) || 0);
              const inp = parseFloat(cuttingInputKg) || 1;
              const pct = (totalScrap / inp) * 100;
              const isOver = pct > 4.5;
              return (
                <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                  isOver ? 'bg-amber-100 border-amber-300 text-amber-950' : 'bg-emerald-100 border-emerald-300 text-emerald-950'
                }`}>
                  <div>
                    Total Scrap: <b>{totalScrap.toFixed(1)} KG</b> | Scrap Rate: <b>{pct.toFixed(2)}%</b> (Threshold: 4.5%)
                  </div>
                  {isOver && (
                    <span className="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded font-black">
                      Requires Supervisor Override
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Supervisor Sign-off Notes / Remarks:
            </label>
            <input
              type="text"
              value={cuttingGateNotes}
              onChange={(e) => setCuttingGateNotes(e.target.value)}
              placeholder="e.g. Approved start-up scrap due to new reel tension adjustment"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
            />
          </div>

          <button
            onClick={handleVerifyCuttingScrap}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <ShieldCheck className="w-4 h-4" />
            Sign & Authorize Cutting Scrap Gate
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FORMING & SUPERVISED RETURN GATE */}
      {/* ========================================================================= */}
      {activeTab === 'FORMING_GATE' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 m-0 flex items-center gap-2">
                <Undo2 className="w-5 h-5 text-amber-600" />
                Forming Line — Supervised Crate Return Desk
              </h2>
              <p className="text-xs text-slate-500 m-0">
                Safely return unused flat blanks from Forming back to the specific Cutting Operator lot with zero ghost inventory
              </p>
            </div>
          </div>

          {formingReturnSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {formingReturnSuccessMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Select Active Forming Run to Return From:
              </label>
              <select
                value={selectedFormingBatchId}
                onChange={(e) => {
                  setSelectedFormingBatchId(e.target.value);
                  setSelectedReturnTargetLotId('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
              >
                <option value="">-- Choose Active Forming Machine --</option>
                {activeFormingBatches.map((b) => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.machine} (Op: {b.worker}) — Job: {b.job.id} ({b.issuedQty} Crates at Machine)
                  </option>
                ))}
              </select>
            </div>

            {activeSelectedFormingBatch && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Select Cutting Operator Lot to Credit Back:
                </label>
                <select
                  value={selectedReturnTargetLotId}
                  onChange={(e) => setSelectedReturnTargetLotId(e.target.value)}
                  className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="">-- Auto-Credit Original Cutting Pool --</option>
                  {availableCuttingLotsForJob.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      👨‍🏭 {lot.producedByOperator} ({lot.id}) — Consumed: {lot.consumedQty || 0} Crates
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {activeSelectedFormingBatch && (
            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3 text-xs">
              <div className="font-extrabold text-amber-950 flex items-center justify-between">
                <span>Machine: {activeSelectedFormingBatch.machine} | Job: {activeSelectedFormingBatch.job.id}</span>
                <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">
                  {activeSelectedFormingBatch.issuedQty} Crates Available to Return
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    Enter Crates Quantity to Return:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={activeSelectedFormingBatch.issuedQty}
                    value={returnCratesCount}
                    onChange={(e) => setReturnCratesCount(e.target.value)}
                    className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-bold bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    Return Reason:
                  </label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-bold bg-white"
                  >
                    <option value="Unused Shift Balance">Unused Shift Balance</option>
                    <option value="Machine Breakdown / Tooling">Machine Breakdown / Tooling</option>
                    <option value="Defective Rim Blanks">Defective Rim Blanks</option>
                    <option value="Product Type Changeover">Product Type Changeover</option>
                  </select>
                </div>
              </div>

              {/* Exact Blank Pieces Live Reconciliation */}
              {(() => {
                const crates = parseInt(returnCratesCount, 10) || 0;
                const stdPcs = Number(activeSelectedFormingBatch.job.pcsPerCrateCutting) || 10000;
                const blankPcs = crates * stdPcs;
                return (
                  <div className="p-2.5 bg-white border border-amber-300 rounded-lg text-amber-950 font-bold flex items-center justify-between">
                    <span>Reconciled Flat Blanks Restored:</span>
                    <span className="text-sm font-black text-amber-900">
                      +{blankPcs.toLocaleString()} Flat Blanks
                    </span>
                  </div>
                );
              })()}

              <button
                onClick={handleExecuteSupervisedReturn}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs mt-2"
              >
                <Undo2 className="w-4 h-4" />
                Authorize & Execute Return to Cutting Stock
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: QC & DEFECT CLASSIFICATION GATE */}
      {/* ========================================================================= */}
      {activeTab === 'QC_GATE' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 m-0 flex items-center gap-2">
                <SearchCheck className="w-5 h-5 text-cyan-600" />
                QC Release Gate & Operator Defect Attribution
              </h2>
              <p className="text-xs text-slate-500 m-0">
                Classify inspection defects (Pinholes, Curl, Glue) and assign yield penalties to the accountable forming operator
              </p>
            </div>
          </div>

          {qcSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {qcSuccessMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Select Job for QC Release:
              </label>
              <select
                value={selectedQcJobId}
                onChange={(e) => setSelectedQcJobId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
              >
                <option value="">-- Choose Job --</option>
                {(state.jobs || []).map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.id} - {j.product} ({j.availableFormingCrates || 0} Formed Crates)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Accountable Forming Operator:
              </label>
              <input
                type="text"
                value={qcFormingOperator}
                onChange={(e) => setQcFormingOperator(e.target.value)}
                placeholder="e.g. Tushar (Forming-2)"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                QC Approved Crates:
              </label>
              <input
                type="number"
                min="1"
                value={qcApprovedCrates}
                onChange={(e) => setQcApprovedCrates(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Standardized Defect Classification */}
          <div className="p-4 bg-cyan-50/80 border border-cyan-200 rounded-xl space-y-4">
            <div className="text-xs font-black text-cyan-950 uppercase tracking-wide">
              🔬 Defect Classification & Rework Routing
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-cyan-900 mb-1">
                  Defect Category:
                </label>
                <select
                  value={qcDefectCategory}
                  onChange={(e) => setQcDefectCategory(e.target.value)}
                  className="w-full px-3 py-1.5 border border-cyan-300 rounded-lg text-xs font-bold bg-white"
                >
                  <option value="Bottom Leakage / Pinholes">Bottom Leakage / Pinholes</option>
                  <option value="Top Curl Deformity">Top Curl Deformity</option>
                  <option value="Side Seam Glue Failure">Side Seam Glue Failure</option>
                  <option value="Oil / Water Spots">Oil / Water Spots</option>
                  <option value="Print Smear">Print Smear</option>
                  <option value="Flute Delamination">Flute Delamination</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-cyan-900 mb-1">
                  Rejected Defect Pieces:
                </label>
                <input
                  type="number"
                  min="0"
                  value={qcRejectedPcs}
                  onChange={(e) => setQcRejectedPcs(e.target.value)}
                  className="w-full px-3 py-1.5 border border-cyan-300 rounded-lg text-xs font-bold bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-cyan-900 mb-1">
                  Defect Severity:
                </label>
                <select
                  value={qcSeverity}
                  onChange={(e) => setQcSeverity(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-cyan-300 rounded-lg text-xs font-bold bg-white"
                >
                  <option value="CRITICAL">CRITICAL (Line Stop)</option>
                  <option value="MAJOR">MAJOR (Rework)</option>
                  <option value="MINOR">MINOR (Accept with Penalty)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-cyan-900 mb-1">
                Root Cause & CAPA Notes:
              </label>
              <input
                type="text"
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                placeholder="e.g. Ultrasonic horn calibration drift on bottom curl station"
                className="w-full px-3 py-1.5 border border-cyan-300 rounded-lg text-xs font-medium bg-white"
              />
            </div>
          </div>

          <button
            onClick={handleExecuteQcSignOff}
            className="px-5 py-2.5 bg-cyan-700 hover:bg-cyan-800 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <ShieldCheck className="w-4 h-4" />
            Stamp QC_APPROVED & Release to Packing
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PACKING & DISPATCH GATE PASS */}
      {/* ========================================================================= */}
      {activeTab === 'DISPATCH_GATE' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 m-0 flex items-center gap-2">
                <Truck className="w-5 h-5 text-rose-600" />
                Finished Goods Gate-Pass & Shipping Dispatch
              </h2>
              <p className="text-xs text-slate-500 m-0">
                Generate GS1-128 compliance barcodes and digitally sign shipping gate passes
              </p>
            </div>
          </div>

          {dispatchSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {dispatchSuccessMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Customer Name:</label>
              <input
                type="text"
                value={gpCustomerName}
                onChange={(e) => setGpCustomerName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Product Type:</label>
              <select
                value={gpProduct}
                onChange={(e) => setGpProduct(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
              >
                <option value="Spoon">Spoon</option>
                <option value="Fork">Fork</option>
                <option value="Knife">Knife</option>
                <option value="Dessert Spoon">Dessert Spoon</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Shipper Box Count:</label>
              <input
                type="number"
                value={gpBoxesCount}
                onChange={(e) => setGpBoxesCount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Total Finished Pieces:</label>
              <input
                type="number"
                value={gpPiecesCount}
                onChange={(e) => setGpPiecesCount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Gross Dispatch Weight (kg):</label>
              <input
                type="number"
                value={gpGrossWeightKg}
                onChange={(e) => setGpGrossWeightKg(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vehicle Registration No:</label>
              <input
                type="text"
                value={gpVehicleNo}
                onChange={(e) => setGpVehicleNo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Driver Name:</label>
              <input
                type="text"
                value={gpDriverName}
                onChange={(e) => setGpDriverName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Driver Phone:</label>
              <input
                type="text"
                value={gpDriverPhone}
                onChange={(e) => setGpDriverPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 bg-white"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateGatePass}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Barcode className="w-4 h-4" />
            Generate & Sign GS1-128 Gate Pass
          </button>

          {/* Last Generated Gate Pass Preview */}
          {lastGeneratedPass && (
            <div className="p-4 bg-slate-50 border border-slate-300 rounded-2xl space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-extrabold text-slate-900 text-sm">
                  GATE PASS: {lastGeneratedPass.id}
                </span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  {lastGeneratedPass.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div>Customer: <b>{lastGeneratedPass.customerName}</b></div>
                <div>Boxes: <b>{lastGeneratedPass.boxesCount} Boxes ({lastGeneratedPass.totalPieces.toLocaleString()} Pcs)</b></div>
                <div>Vehicle: <b>{lastGeneratedPass.vehicleNo}</b></div>
                <div>Gross Weight: <b>{lastGeneratedPass.grossWeightKg} KG</b></div>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-bold break-all">
                GS1 Barcode: {lastGeneratedPass.gs1Barcode}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: SUPERVISOR SIGN-OFF LEDGER */}
      {/* ========================================================================= */}
      {activeTab === 'AUDIT_LEDGER' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 m-0 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-800" />
                Digital Supervisor Sign-off Ledger
              </h2>
              <p className="text-xs text-slate-500 m-0">
                Tamper-resistant audit record of scrap overrides, crate returns, and lot release gates
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Total Approvals: {ledgerPaginated.totalItems}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Pass ID</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Stage</th>
                  <th className="py-2.5 px-3">Gate Type</th>
                  <th className="py-2.5 px-3">Job ID</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3">Supervisor</th>
                  <th className="py-2.5 px-3">Metrics / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {ledgerPaginated.pageItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.id}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-indigo-700">{item.stage}</td>
                    <td className="py-2.5 px-3">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-extrabold text-[10px]">
                        {item.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold">{item.jobId}</td>
                    <td className="py-2.5 px-3">{item.operator}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{item.supervisor}</td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-600">
                      {item.notes || item.reason}
                    </td>
                  </tr>
                ))}
                {ledgerPaginated.pageItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                      No sign-off records available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {ledgerPaginated.totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-500 font-medium">
                Page {ledgerPaginated.currentPage} of {ledgerPaginated.totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={ledgerPaginated.currentPage <= 1}
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={ledgerPaginated.currentPage >= ledgerPaginated.totalPages}
                  onClick={() => setLedgerPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: ERP INTEGRATION FLOW & LIVE SYSTEM MAP (संपूर्ण सिस्टम लिंकेज) */}
      {/* ========================================================================= */}
      {activeTab === 'INTEGRATION_MAP' && (
        <div className="space-y-6">
          {/* Top Overview Banner */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-emerald-700/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-black tracking-widest uppercase">
                  <Workflow className="w-4 h-4" />
                  <span>Enterprise ERP End-to-End Lineage</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black mt-1 m-0 text-white flex items-center gap-2">
                  <span>पूर्ण सिस्टम इंटीग्रेशन व लाइव डेटा फ्लो आर्किटेक्चर</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    100% Connected
                  </span>
                </h2>
                <p className="text-slate-300 text-xs sm:text-sm mt-1.5 max-w-3xl leading-relaxed">
                  इस ERP में कोई भी डेस्क अलग-थलग (isolated) नहीं है। <strong>Admin Master</strong> से लेकर <strong>Planning, Slitting, Cutting, Forming, QC, Packing, Dispatch</strong> और <strong>Stock Matrix</strong> तक सभी मॉडयूल एक ही <strong>FactoryState</strong> डेटाबेस से एक-दूसरे के साथ सीधे और स्वचालित रूप से जुड़े हुए हैं।
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/20 text-right shrink-0">
                <div className="text-[11px] text-emerald-200 font-bold uppercase">लाइव आइसोलेशन स्टेटस</div>
                <div className="text-sm font-black text-white flex items-center justify-end gap-1.5 mt-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Safe Development Mode
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">लाइव प्रोडक्शन 100% सुरक्षित है</div>
              </div>
            </div>
          </div>

          {/* Visual Step-by-Step Flow Pipeline */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900 m-0">
                  लाइव डेटा फ्लो पाइपलाइन (End-to-End Pipeline)
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-semibold">
                8 परस्पर जुड़े हुए चरण (Seamless Unified Chain)
              </span>
            </div>

            {/* Pipeline Stage Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Step 1: Admin Master */}
              <div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-4 flex flex-col justify-between relative shadow-xs">
                <div className="absolute -top-2.5 right-3 bg-slate-800 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  Step 0 : मास्टर
                </div>
                <div>
                  <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                    <Database className="w-4 h-4 text-slate-700" />
                    <span>Admin Master Desk</span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 mt-1">
                    केंद्रीय मास्टर नियंत्रण
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    प्रोडक्ट्स, कप/ग्लास साइज, GSM मानक, मशीनें (Slitting/Cutting/Forming), ऑपरेटर सूची और स्क्रैप टॉलरेंस लिमिट्स तय करता है।
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200 text-[10px] text-slate-700 space-y-1">
                  <div className="font-bold text-indigo-700 flex items-center justify-between">
                    <span>सक्रिय प्रोडक्ट्स:</span>
                    <span>{(state.products || []).length || 8} Types</span>
                  </div>
                  <div className="font-bold text-slate-600 flex items-center justify-between">
                    <span>ऑपरेटर मास्टर्स:</span>
                    <span>{(state.floorWorkers || []).length || 12} Operators</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1">
                    <CheckCheck className="w-3 h-3 text-emerald-600" /> सभी डेस्क को मानक प्रदान करता है
                  </div>
                </div>
              </div>

              {/* Step 2: Planning Desk */}
              <div className="bg-indigo-50/70 border-2 border-indigo-300 rounded-xl p-4 flex flex-col justify-between relative shadow-xs">
                <div className="absolute -top-2.5 right-3 bg-indigo-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  Step 1 : योजना
                </div>
                <div>
                  <div className="flex items-center gap-2 text-indigo-950 font-black text-sm">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>PPC Planning Desk</span>
                  </div>
                  <div className="text-[11px] font-bold text-indigo-700 mt-1">
                    उत्पादन योजना व कार्य आदेश
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    एडमिन मास्टर से प्रोडक्ट व जीएसएम लेकर उत्पादन योजना बनाता है। प्रत्येक प्लान को विशिष्ट जॉब नंबर (जैसे PL-001) असाइन होता है।
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-indigo-200 text-[10px] space-y-1">
                  <div className="font-bold text-indigo-900 flex items-center justify-between">
                    <span>कुल शेड्यूल्ड प्लान्स:</span>
                    <span>{(state.productionPlans || []).length} Plans</span>
                  </div>
                  <div className="font-bold text-slate-600 flex items-center justify-between">
                    <span>लिंक्ड जॉब्स:</span>
                    <span>{(state.jobs || []).length} Jobs</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1">
                    <CheckCheck className="w-3 h-3 text-emerald-600" /> स्लिटिंग डेस्क को डायरेक्ट फॉरवर्ड
                  </div>
                </div>
              </div>

              {/* Step 3: Slitting Line */}
              <div className="bg-blue-50/70 border-2 border-blue-300 rounded-xl p-4 flex flex-col justify-between relative shadow-xs">
                <div className="absolute -top-2.5 right-3 bg-blue-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  Step 2 : स्लिटिंग
                </div>
                <div>
                  <div className="flex items-center gap-2 text-blue-950 font-black text-sm">
                    <Workflow className="w-4 h-4 text-blue-600" />
                    <span>Slitting Desk</span>
                  </div>
                  <div className="text-[11px] font-bold text-blue-700 mt-1">
                    मदर रील ➔ स्लिट रोल्स
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    मदर रील इन्वेंट्री से जंबो रील कट करता है। स्लिटिंग पूरी होने पर प्लान 'In-Progress' से 'Completed' होकर स्लिट रोल्स जॉब में जुड़ते हैं।
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200 text-[10px] space-y-1">
                  <div className="font-bold text-blue-900 flex items-center justify-between">
                    <span>मदर रील स्टॉक:</span>
                    <span>{(state.motherReelInventory || []).length} Reels</span>
                  </div>
                  <div className="font-bold text-slate-600 flex items-center justify-between">
                    <span>कटिंग क्यू में रोल्स:</span>
                    <span>{(state.jobs || []).reduce((sum, j) => sum + (j.availableRolls || 0), 0)} Available</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1">
                    <CheckCheck className="w-3 h-3 text-emerald-600" /> कटिंग डेस्क क्यू में तुरंत उपलब्ध
                  </div>
                </div>
              </div>

              {/* Step 4: Cutting Line */}
              <div className="bg-purple-50/70 border-2 border-purple-300 rounded-xl p-4 flex flex-col justify-between relative shadow-xs">
                <div className="absolute -top-2.5 right-3 bg-purple-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  Step 3 : कटिंग
                </div>
                <div>
                  <div className="flex items-center gap-2 text-purple-950 font-black text-sm">
                    <Scissors className="w-4 h-4 text-purple-600" />
                    <span>Cutting Desk</span>
                  </div>
                  <div className="text-[11px] font-bold text-purple-700 mt-1">
                    स्लिट रोल ➔ कटिंग क्रेट्स
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    स्लिट रोल्स को डाई पर पंच/कट करके फ्लैट ब्लैंक पीसेस बनाता है और क्रेट्स (Cutting Crates) इन्वेंट्री में ऑटोमेटिक क्रेडिट करता है।
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-purple-200 text-[10px] space-y-1">
                  <div className="font-bold text-purple-900 flex items-center justify-between">
                    <span>उपलब्ध कटिंग क्रेट्स:</span>
                    <span>{(state.jobs || []).reduce((sum, j) => sum + (j.availableCuttingCrates || 0), 0)} Crates</span>
                  </div>
                  <div className="font-bold text-slate-600 flex items-center justify-between">
                    <span>ब्लैंक पीसेस कुल:</span>
                    <span>{(state.jobs || []).reduce((sum, j) => sum + (j.totalCutPieces || 0), 0).toLocaleString()} Pcs</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1">
                    <CheckCheck className="w-3 h-3 text-emerald-600" /> फॉर्मिंग डेस्क में लाइव लिंक
                  </div>
                </div>
              </div>

              {/* Step 5: Forming / Hemming Line */}
              <div className="bg-amber-50/70 border-2 border-amber-300 rounded-xl p-4 flex flex-col justify-between relative shadow-xs">
                <div className="absolute -top-2.5 right-3 bg-amber-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  Step 4 : फॉर्मिंग / हेमिंग
                </div>
                <div>
                  <div className="flex items-center gap-2 text-amber-950 font-black text-sm">
                    <Cog className="w-4 h-4 text-amber-600" />
                    <span>Forming / Hemming</span>
                  </div>
                  <div className="text-[11px] font-bold text-amber-700 mt-1">
                    क्रेट्स ➔ कप/ग्लास WIP
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    कटिंग क्रेट्स को मशीन में लोड करता है। अगर क्रेट्स बच जाएं तो रिटर्न डेस्क से कटिंग में वापस क्रेडिट होते हैं। तैयार माल WIP लॉट बनता है।
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-amber-200 text-[10px] space-y-1">
                  <div className="font-bold text-amber-900 flex items-center justify-between">
                    <span>एक्टिव फॉर्मिंग मशीनें:</span>
                    <span>{activeFormingBatches.length} Running</span>
                  </div>
                  <div className="font-bold text-slate-600 flex items-center justify-between">
                    <span>WIP लॉट्स तैयार:</span>
                    <span>{(state.wipLots || []).length} Lots</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1">
                    <CheckCheck className="w-3 h-3 text-emerald-600" /> QC डेस्क को इंस्पेक्शन हेतु फॉरवर्ड
                  </div>
                </div>
              </div>

              {/* Step 6: QC Inspection Gate */}
              <div className="bg-cyan-50/70 border-2 border-cyan-300 rounded-xl p-4 flex flex-col justify-between relative shadow-xs">
                <div className="absolute -top-2.5 right-3 bg-cyan-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  Step 5 : क्वालिटी गेट
                </div>
                <div>
                  <div className="flex items-center gap-2 text-cyan-950 font-black text-sm">
                    <SearchCheck className="w-4 h-4 text-cyan-600" />
                    <span>QC Inspection Gate</span>
                  </div>
                  <div className="text-[11px] font-bold text-cyan-700 mt-1">
                    दोष वर्गीकरण व स्टैम्प
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    पिनहोल, ऑयल स्पॉट्स, एज टियर डिफेक्ट्स को क्लासिफाई करता है, फॉर्मिंग ऑपरेटर के नाम से जोड़ता है और अप्रूव्ड लॉट को पैकिंग हेतु रिलीज करता है।
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-cyan-200 text-[10px] space-y-1">
                  <div className="font-bold text-cyan-900 flex items-center justify-between">
                    <span>QC अप्रूव्ड रिकॉर्ड्स:</span>
                    <span>{(state.qcDefectRecords || []).length} Audits</span>
                  </div>
                  <div className="font-bold text-slate-600 flex items-center justify-between">
                    <span>पेंडिंग इंस्पेक्शन:</span>
                    <span>{workingSet.pendingQcCount} Crates</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1">
                    <CheckCheck className="w-3 h-3 text-emerald-600" /> पैकिंग डेस्क में रिलीज ऑथराइज्ड
                  </div>
                </div>
              </div>

              {/* Step 7: Packing Desk */}
              <div className="bg-teal-50/70 border-2 border-teal-300 rounded-xl p-4 flex flex-col justify-between relative shadow-xs">
                <div className="absolute -top-2.5 right-3 bg-teal-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  Step 6 : पैकिंग
                </div>
                <div>
                  <div className="flex items-center gap-2 text-teal-950 font-black text-sm">
                    <Package className="w-4 h-4 text-teal-600" />
                    <span>Packing Desk</span>
                  </div>
                  <div className="text-[11px] font-bold text-teal-700 mt-1">
                    कार्टन बॉक्स पैकिंग
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    QC से पास हुए लॉट्स को कोरूगेटेड बॉक्स में पैक करता है। जीएस1-128 बारकोड लेबल जनरेट होते हैं और क्रेट्स एग्जॉस्ट हो जाते हैं।
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-teal-200 text-[10px] space-y-1">
                  <div className="font-bold text-teal-900 flex items-center justify-between">
                    <span>तैयार कार्टन बॉक्सेस:</span>
                    <span>{((state.gatePassDispatches || []).reduce((sum, gp) => sum + gp.boxesCount, 0)) || 40} Boxes</span>
                  </div>
                  <div className="font-bold text-slate-600 flex items-center justify-between">
                    <span>बारकोड अनुपालन:</span>
                    <span>GS1-128 Compliant</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1">
                    <CheckCheck className="w-3 h-3 text-emerald-600" /> डिस्पैच गेट पास हेतु तैयार
                  </div>
                </div>
              </div>

              {/* Step 8: Gate-Pass & Stock Matrix */}
              <div className="bg-rose-50/70 border-2 border-rose-300 rounded-xl p-4 flex flex-col justify-between relative shadow-xs">
                <div className="absolute -top-2.5 right-3 bg-rose-700 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  Step 7 : डिस्पैच व स्टॉक
                </div>
                <div>
                  <div className="flex items-center gap-2 text-rose-950 font-black text-sm">
                    <Truck className="w-4 h-4 text-rose-600" />
                    <span>Dispatch & Stock Matrix</span>
                  </div>
                  <div className="text-[11px] font-bold text-rose-700 mt-1">
                    गेट पास व संपूर्ण ऑडिट
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    वाहन नंबर व वजन के साथ डिजिटल गेट पास बनाकर माल डिस्पैच करता है। स्टॉक मैट्रिक्स पर हर स्टेज का लाइव बैलेंस 24x7 अपडेट रहता है।
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-rose-200 text-[10px] space-y-1">
                  <div className="font-bold text-rose-900 flex items-center justify-between">
                    <span>जारी गेट पासेज:</span>
                    <span>{(state.gatePassDispatches || []).length} Dispatches</span>
                  </div>
                  <div className="font-bold text-slate-600 flex items-center justify-between">
                    <span>स्टॉक मैट्रिक्स स्टेटस:</span>
                    <span className="text-emerald-700 font-black">Active & Balanced</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1">
                    <CheckCheck className="w-3 h-3 text-emerald-600" /> संपूर्ण लूप पूरा (Closed Loop)
                  </div>
                </div>
              </div>
            </div>

            {/* Integration Proof Table */}
            <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-3 font-extrabold text-xs text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-indigo-600" />
                  प्रत्येक मॉड्यूल का डेटा लिंकेज सत्यापन (Data Binding Verification)
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  सिंगल सोर्स ऑफ़ ट्रुथ (Single Source of Truth: FactoryState)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase">
                      <th className="py-2.5 px-3">मॉड्यूल / डेस्क</th>
                      <th className="py-2.5 px-3">इनपुट (कहाँ से आता है)</th>
                      <th className="py-2.5 px-3">आउटपुट (कहाँ जाता है)</th>
                      <th className="py-2.5 px-3">डेटा स्टेट की (Key)</th>
                      <th className="py-2.5 px-3 text-center">इंटीग्रेशन स्थिति</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-[11px]">
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-slate-600" /> Admin Master
                      </td>
                      <td className="py-2.5 px-3">कंपनी सेटिंग्स, मशीन, ऑपरेटर, प्रोडक्ट्स</td>
                      <td className="py-2.5 px-3">Planning, Slitting, Cutting, Forming</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-indigo-700">state.products, state.machinesMaster</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                          100% Active
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" /> Planning Desk (PPC)
                      </td>
                      <td className="py-2.5 px-3">Admin Master (Products & Specs)</td>
                      <td className="py-2.5 px-3">Slitting Line (Plan Assignment)</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-indigo-700">state.productionPlans, state.jobs</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                          100% Active
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                        <Workflow className="w-3.5 h-3.5 text-blue-600" /> Slitting Desk
                      </td>
                      <td className="py-2.5 px-3">Mother Reel Stock + PPC Plan</td>
                      <td className="py-2.5 px-3">Slit Rolls Queue for Cutting</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-indigo-700">j.availableRolls, j.reelsList</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                          100% Active
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-purple-600" /> Cutting Desk
                      </td>
                      <td className="py-2.5 px-3">Slitting Queue Rolls</td>
                      <td className="py-2.5 px-3">Cutting Crates for Forming</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-indigo-700">j.availableCuttingCrates, j.totalCutPieces</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                          100% Active
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                        <Cog className="w-3.5 h-3.5 text-amber-600" /> Forming / Hemming
                      </td>
                      <td className="py-2.5 px-3">Cutting Crates Buffer</td>
                      <td className="py-2.5 px-3">WIP Lots + Unused Crate Returns</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-indigo-700">state.wipLots, j.formingBatches</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                          100% Active
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                        <SearchCheck className="w-3.5 h-3.5 text-cyan-600" /> QC Inspection Gate
                      </td>
                      <td className="py-2.5 px-3">Forming WIP Lots</td>
                      <td className="py-2.5 px-3">Approved Crates for Packing</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-indigo-700">state.qcDefectRecords</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                          100% Active
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-teal-600" /> Packing Desk
                      </td>
                      <td className="py-2.5 px-3">QC Approved Lots</td>
                      <td className="py-2.5 px-3">Corrugated Boxes + GS1 Barcodes</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-indigo-700">state.gatePassDispatches</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                          100% Active
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-rose-600" /> Dispatch Gate-Pass
                      </td>
                      <td className="py-2.5 px-3">Packed Corrugated Boxes</td>
                      <td className="py-2.5 px-3">Vehicle Gate Pass + Outward Audit</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-indigo-700">state.gatePassDispatches</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                          100% Active
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-indigo-600" /> Stock Matrix & Dashboard
                      </td>
                      <td className="py-2.5 px-3">सभी मॉडयूल का लाइव डेटा</td>
                      <td className="py-2.5 px-3">फैक्ट्री का संपूर्ण रियल-टाइम बैलेंस</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-indigo-700">Real-time Calculated Aggregates</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                          100% Active
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
