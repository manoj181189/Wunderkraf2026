import React, { useState } from 'react';
import {
  X,
  Check,
  Database,
  Layers,
  Scissors,
  Cog,
  SearchCheck,
  PackageCheck,
  Plus,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { FactoryState, Job, JobReelItem, LogEntry, PackJob, ProductType, MotherReelItem } from '../types';
import { PRODUCTS, PAPER_BRANDS } from '../lib/constants';

interface OpeningStockModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  state: FactoryState;
  onSaveState: (nextState: FactoryState) => void;
  isEmbedded?: boolean;
}

export const OpeningStockModal: React.FC<OpeningStockModalProps> = ({
  isOpen = true,
  onClose,
  state,
  onSaveState,
  isEmbedded = false
}) => {
  const productList = state.products && state.products.length > 0 ? state.products : PRODUCTS;

  // Active Stage Tab inside this Inward Module:
  // 1 = Jumbo Reels, 2 = Slit Rolls Buffer, 3 = Cut Crates Buffer, 4 = Formed Crates Buffer, 5 = Packed Warehouse
  const [activeStageTab, setActiveStageTab] = useState<1 | 2 | 3 | 4 | 5>(1);

  // --- STAGE 1: RAW JUMBO REELS FORM STATE ---
  const [s1Mill, setS1Mill] = useState('ITC');
  const [s1Brand, setS1Brand] = useState('ITC');
  const [s1Gsm, setS1Gsm] = useState('120 GSM');
  const [s1WeightKg, setS1WeightKg] = useState('230');
  const [s1ReelNumbers, setS1ReelNumbers] = useState('JR-OPN-101, JR-OPN-102');

  // --- STAGE 2: SLIT ROLLS BUFFER FORM STATE ---
  const [s2Product, setS2Product] = useState<ProductType>(productList[0] as ProductType || 'Spoon');
  const [s2TotalRolls, setS2TotalRolls] = useState('12');
  const [s2Gsm, setS2Gsm] = useState('280 GSM');
  const [s2LotRef, setS2LotRef] = useState('LOT-SLIT-OPN');
  const [s2JobType, setS2JobType] = useState<'existing' | 'new'>('new');
  const [s2SelectedJobId, setS2SelectedJobId] = useState('');
  const [s2CustomJobId, setS2CustomJobId] = useState('');

  // --- STAGE 3: CUT CRATES BUFFER FORM STATE ---
  const [s3Product, setS3Product] = useState<ProductType>(productList[0] as ProductType || 'Spoon');
  const [s3Crates, setS3Crates] = useState('15');
  const [s3EstPieces, setS3EstPieces] = useState('150000');
  const [s3MachineLotRef, setS3MachineLotRef] = useState('LOT-CUT-OPN');
  const [s3JobType, setS3JobType] = useState<'existing' | 'new'>('new');
  const [s3SelectedJobId, setS3SelectedJobId] = useState('');
  const [s3CustomJobId, setS3CustomJobId] = useState('');

  // --- STAGE 4: FORMED CRATES BUFFER FORM STATE ---
  const [s4Product, setS4Product] = useState<ProductType>(productList[0] as ProductType || 'Spoon');
  const [s4Crates, setS4Crates] = useState('20');
  const [s4QcPending, setS4QcPending] = useState(true);
  const [s4JobType, setS4JobType] = useState<'existing' | 'new'>('new');
  const [s4SelectedJobId, setS4SelectedJobId] = useState('');
  const [s4CustomJobId, setS4CustomJobId] = useState('');

  // --- STAGE 5: FINISHED PACKED GOODS FORM STATE ---
  const [s5Product, setS5Product] = useState<ProductType>(productList[0] as ProductType || 'Spoon');
  const [s5BoxCount, setS5BoxCount] = useState('50');
  const [s5PcsPerBox, setS5PcsPerBox] = useState('1000');
  const [s5Consignee, setS5Consignee] = useState('OPEN STOCK WAREHOUSE');
  const [s5JobType, setS5JobType] = useState<'existing' | 'new'>('new');
  const [s5SelectedJobId, setS5SelectedJobId] = useState('');
  const [s5CustomJobId, setS5CustomJobId] = useState('');

  const [activeUser, setActiveUser] = useState('Admin/ProdHead');

  if (!isOpen && !isEmbedded) return null;

  const handleSaveInwardStock = (e: React.FormEvent) => {
    e.preventDefault();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayStr = new Date().toISOString().split('T')[0];

    let updatedJobs = [...state.jobs];
    let updatedPackJobs = [...(state.packJobs || [])];
    let updatedMotherReels = [...(state.motherReelInventory || [])];
    let auditMessage = '';
    let successMessage = '';

    if (activeStageTab === 1) {
      // Stage 1: Raw Jumbo Reels
      const reels = s1ReelNumbers
        .split(',')
        .map((r) => r.trim().toUpperCase())
        .filter((r) => r.length > 0);
      const singleWeight = parseFloat(s1WeightKg) || 0;

      if (reels.length === 0) {
        alert('⚠️ Please enter at least one Reel Number!');
        return;
      }
      if (singleWeight <= 0) {
        alert('⚠️ Reel weight must be greater than 0 kg!');
        return;
      }

      const addedReelsList: string[] = [];
      reels.forEach((rNo) => {
        // Prevent duplicate IDs in inventory
        const exists = updatedMotherReels.some((item) => item.id === rNo);
        if (!exists) {
          const newReelItem: MotherReelItem = {
            id: rNo,
            brand: s1Brand || s1Mill,
            gsm: s1Gsm,
            weightKg: singleWeight,
            status: 'Available'
          };
          updatedMotherReels.push(newReelItem);
          addedReelsList.push(rNo);
        }
      });

      if (addedReelsList.length === 0) {
        alert('⚠️ All entered Reel Numbers already exist in the database!');
        return;
      }

      auditMessage = `INITIAL OPENING INVENTORY LOADED: Raw Jumbo Reels ${addedReelsList.join(', ')} (${singleWeight} KG each, Brand: ${s1Brand}) by ${activeUser}`;
      successMessage = `Successfully loaded ${addedReelsList.length} Raw Jumbo Reels into Inventory:\n${addedReelsList.join(', ')}`;
    } else if (activeStageTab === 2) {
      // Stage 2: Slit Output Reels Buffer
      const rollsCount = parseInt(s2TotalRolls, 10) || 0;
      if (rollsCount <= 0) {
        alert('⚠️ Please enter a valid number of Slit Rolls!');
        return;
      }

      const lotIdSeq = `OPENING-SLIT-${Date.now().toString().slice(-4)}`;
      const cleanLot = s2LotRef.trim().toUpperCase() || lotIdSeq;

      let targetJobId = '';
      if (s2JobType === 'existing') {
        if (!s2SelectedJobId) {
          alert('⚠️ Please select an existing Job ID!');
          return;
        }
        targetJobId = s2SelectedJobId;
      } else {
        targetJobId = s2CustomJobId.trim().toUpperCase() || `JOB-OPN-SLIT-${Date.now().toString().slice(-4)}`;
      }

      // Check if job already exists in state
      const existingJobIndex = updatedJobs.findIndex((j) => j.id === targetJobId);
      if (existingJobIndex > -1) {
        // Increment stock
        const j = updatedJobs[existingJobIndex];
        updatedJobs[existingJobIndex] = {
          ...j,
          availableRolls: (j.availableRolls || 0) + rollsCount,
          status: j.status === 'COMPLETED' ? 'READY_FOR_CUTTING' : j.status,
          customRemark: (j.customRemark || '') + ` | Loaded +${rollsCount} Slit Rolls Opening`
        };
      } else {
        // Create new
        const newJob: Job = {
          id: targetJobId,
          product: s2Product,
          paperBrand: 'ITC',
          reelNo: cleanLot,
          reelNumbers: [cleanLot],
          gsm: s2Gsm,
          customRemark: 'Go-Live Slit Rolls Opening Balance',
          stage: 'Cutting',
          status: 'READY_FOR_CUTTING',
          availableRolls: rollsCount,
          availableCuttingCrates: 0,
          availableFormingCrates: 0,
          availableQcCrates: 0,
          isOpeningBalance: true,
          lotId: lotIdSeq,
          runningBatches: []
        };
        updatedJobs = [newJob, ...updatedJobs];
      }

      auditMessage = `INITIAL OPENING INVENTORY LOADED: ${rollsCount} Slit Rolls for ${s2Product} under Job Number [${targetJobId}] (Lot: ${cleanLot}) by ${activeUser}`;
      successMessage = `Successfully created/updated WIP for ${rollsCount} Slit Rolls under Job Number [${targetJobId}] Lot ${cleanLot}. Ready on Cutting Desk.`;
    } else if (activeStageTab === 3) {
      // Stage 3: Cut Blank Crates Buffer
      const cratesCount = parseInt(s3Crates, 10) || 0;
      const estPcs = parseInt(s3EstPieces, 10) || 0;
      if (cratesCount <= 0) {
        alert('⚠️ Please enter a valid number of Cut Crates!');
        return;
      }

      const lotIdSeq = `OPENING-CUT-${Date.now().toString().slice(-4)}`;
      const cleanLot = s3MachineLotRef.trim().toUpperCase() || lotIdSeq;

      let targetJobId = '';
      if (s3JobType === 'existing') {
        if (!s3SelectedJobId) {
          alert('⚠️ Please select an existing Job ID!');
          return;
        }
        targetJobId = s3SelectedJobId;
      } else {
        targetJobId = s3CustomJobId.trim().toUpperCase() || `JOB-OPN-CUT-${Date.now().toString().slice(-4)}`;
      }

      const existingJobIndex = updatedJobs.findIndex((j) => j.id === targetJobId);
      if (existingJobIndex > -1) {
        const j = updatedJobs[existingJobIndex];
        updatedJobs[existingJobIndex] = {
          ...j,
          availableCuttingCrates: (j.availableCuttingCrates || 0) + cratesCount,
          totalCutPieces: (j.totalCutPieces || 0) + estPcs,
          status: j.status === 'COMPLETED' ? 'READY_FOR_FORMING' : j.status,
          customRemark: (j.customRemark || '') + ` | Loaded +${cratesCount} Cut Crates Opening`
        };
      } else {
        const newJob: Job = {
          id: targetJobId,
          product: s3Product,
          paperBrand: 'ITC',
          reelNo: cleanLot,
          reelNumbers: [cleanLot],
          gsm: '280 GSM',
          customRemark: 'Go-Live Cut Crates Opening Balance',
          stage: 'Forming',
          status: 'READY_FOR_FORMING',
          availableRolls: 0,
          availableCuttingCrates: cratesCount,
          availableFormingCrates: 0,
          availableQcCrates: 0,
          totalCutPieces: estPcs,
          pcsPerCrateCutting: Math.round(estPcs / cratesCount) || 10000,
          isOpeningBalance: true,
          lotId: lotIdSeq,
          runningBatches: []
        };
        updatedJobs = [newJob, ...updatedJobs];
      }

      auditMessage = `INITIAL OPENING INVENTORY LOADED: ${cratesCount} Cut Blank Crates (${estPcs.toLocaleString()} Pieces) under Job Number [${targetJobId}] (Lot: ${cleanLot}) by ${activeUser}`;
      successMessage = `Successfully loaded/updated ${cratesCount} Cut Blank Crates under Job Number [${targetJobId}] (${estPcs.toLocaleString()} pieces). Ready for selection on Forming Lines.`;
    } else if (activeStageTab === 4) {
      // Stage 4: Formed Cutlery Crates Buffer
      const cratesCount = parseInt(s4Crates, 10) || 0;
      if (cratesCount <= 0) {
        alert('⚠️ Please enter a valid number of Formed Crates!');
        return;
      }

      const lotIdSeq = `OPENING-FORM-${Date.now().toString().slice(-4)}`;
      const cleanLot = `LOT-FORM-${s4Product.slice(0,3).toUpperCase()}-OPN`;

      let targetJobId = '';
      if (s4JobType === 'existing') {
        if (!s4SelectedJobId) {
          alert('⚠️ Please select an existing Job ID!');
          return;
        }
        targetJobId = s4SelectedJobId;
      } else {
        targetJobId = s4CustomJobId.trim().toUpperCase() || `JOB-OPN-FORM-${Date.now().toString().slice(-4)}`;
      }

      const existingJobIndex = updatedJobs.findIndex((j) => j.id === targetJobId);
      if (existingJobIndex > -1) {
        const j = updatedJobs[existingJobIndex];
        updatedJobs[existingJobIndex] = {
          ...j,
          availableFormingCrates: (j.availableFormingCrates || 0) + cratesCount,
          totalFormedPieces: (j.totalFormedPieces || 0) + (cratesCount * 7000),
          status: j.status === 'COMPLETED' ? (s4QcPending ? 'PENDING_QC' : 'IN_INSPECTION') : j.status,
          customRemark: (j.customRemark || '') + ` | Loaded +${cratesCount} Formed Crates Opening`
        };
      } else {
        const newJob: Job = {
          id: targetJobId,
          product: s4Product,
          paperBrand: 'ITC',
          reelNo: cleanLot,
          reelNumbers: [cleanLot],
          gsm: '280 GSM',
          customRemark: 'Go-Live Formed Crates Opening Balance',
          stage: 'QC',
          status: s4QcPending ? 'PENDING_QC' : 'IN_INSPECTION',
          availableRolls: 0,
          availableCuttingCrates: 0,
          availableFormingCrates: cratesCount,
          availableQcCrates: 0,
          totalFormedPieces: cratesCount * 7000,
          pcsPerCrateForming: 7000,
          isOpeningBalance: true,
          lotId: lotIdSeq,
          runningBatches: []
        };
        updatedJobs = [newJob, ...updatedJobs];
      }

      auditMessage = `INITIAL OPENING INVENTORY LOADED: ${cratesCount} Formed Crates for ${s4Product} under Job Number [${targetJobId}] (QC-Pending: ${s4QcPending ? 'Yes' : 'No'}) by ${activeUser}`;
      successMessage = `Successfully loaded/updated ${cratesCount} Formed Crates under Job Number [${targetJobId}] for ${s4Product}. Ready on QC & Checking Desk immediately.`;
    } else if (activeStageTab === 5) {
      // Stage 5: Finished Packed Goods Warehouse
      const boxes = parseInt(s5BoxCount, 10) || 0;
      const pBox = parseInt(s5PcsPerBox, 10) || 0;
      if (boxes <= 0) {
        alert('⚠️ Please enter a valid box count!');
        return;
      }

      const lotIdSeq = `OPENING-PACK-${Date.now().toString().slice(-4)}`;
      const totalPieces = boxes * pBox;

      let targetOrderId = '';
      if (s5JobType === 'existing') {
        if (!s5SelectedJobId) {
          alert('⚠️ Please select an existing Order/Job ID!');
          return;
        }
        targetOrderId = s5SelectedJobId;
      } else {
        targetOrderId = s5CustomJobId.trim().toUpperCase() || `ORD-OPN-${Date.now().toString().slice(-4)}`;
      }

      const existingPackIndex = updatedPackJobs.findIndex((pj) => pj.id === targetOrderId);
      if (existingPackIndex > -1) {
        const pj = updatedPackJobs[existingPackIndex];
        updatedPackJobs[existingPackIndex] = {
          ...pj,
          packedBoxes: (pj.packedBoxes || 0) + boxes,
          remarks: (pj.remarks || '') + ` | Added +${boxes} Boxes Opening Finished Stock`
        };
      } else {
        const newPackJob: PackJob = {
          id: targetOrderId,
          customer: s5Consignee.trim().toUpperCase() || 'OPEN STOCK WAREHOUSE',
          kitType: s5Product,
          kitItems: [s5Product],
          orderQty: Math.max(100000, totalPieces),
          packedBoxes: boxes,
          dispatchedBoxes: 0,
          pcsPerBox: pBox,
          status: 'READY',
          dispatchDate: todayStr,
          packType: 'INDIVIDUAL',
          isOpeningBalance: true,
          lotId: lotIdSeq,
          remarks: 'Opening Balance Finished Stock Inward'
        };
        updatedPackJobs = [newPackJob, ...updatedPackJobs];
      }

      auditMessage = `INITIAL OPENING INVENTORY LOADED: ${boxes} Packed Boxes (${totalPieces.toLocaleString()} Pcs, Product: ${s5Product}, Consignee: ${s5Consignee}) by ${activeUser}`;
      successMessage = `Successfully created finished stock of ${boxes} Packed Boxes for ${s5Product} (${totalPieces.toLocaleString()} pieces) in Warehouse. Ready for dispatch.`;
    }

    // Add Master Audit Log
    const newLog: LogEntry = {
      jobId: 'SYSTEM-SETUP',
      product: 'ERP GO-LIVE',
      stage: 'System Setup',
      machine: 'Main Office',
      action: `⚡ ${auditMessage}`,
      user: activeUser,
      startTime: nowTime,
      rawDate: todayStr,
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      packJobs: updatedPackJobs,
      motherReelInventory: updatedMotherReels,
      logs: [...(state.logs || []), newLog]
    });

    alert(`✅ Go-Live Opening Stock Registered Successfully!\n\n${successMessage}\n\nState safely saved & synchronized to high-capacity IndexedDB.`);
    if (onClose) onClose();
  };

  const getActiveTabTitle = () => {
    switch (activeStageTab) {
      case 1: return 'Stage 1: Raw Jumbo Reels Setup';
      case 2: return 'Stage 2: Slit Output Reels Buffer';
      case 3: return 'Stage 3: Cut Blank Crates Buffer';
      case 4: return 'Stage 4: Formed Cutlery Crates Buffer';
      case 5: return 'Stage 5: Finished Packed Warehouse';
    }
  };

  const formContent = (
    <div className="space-y-4">
      {/* AUTHORIZATION BANNER */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5 items-start text-xs text-amber-900">
        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold block">⚠️ AUTHORIZED ACCESS MODULE (GO-LIVE SETUP)</span>
          <p className="m-0 text-[11px] opacity-90 mt-0.5">
            This module directly injects initial physical stock and active WIP buffers on the shop floor. No previous production steps are required.
          </p>
        </div>
      </div>

      {/* STAGE SELECTOR TABS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => setActiveStageTab(1)}
          className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col items-center text-center gap-1.5 ${
            activeStageTab === 1
              ? 'bg-[#1a365d] text-white border-[#1a365d]'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span className="text-[10px] font-extrabold leading-tight">Stage 1</span>
          <span className="text-[9px] opacity-80 leading-none truncate w-full">Jumbo Reels</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStageTab(2)}
          className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col items-center text-center gap-1.5 ${
            activeStageTab === 2
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span className="text-[10px] font-extrabold leading-tight">Stage 2</span>
          <span className="text-[9px] opacity-80 leading-none truncate w-full">Slit Rolls</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStageTab(3)}
          className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col items-center text-center gap-1.5 ${
            activeStageTab === 3
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span className="text-[10px] font-extrabold leading-tight">Stage 3</span>
          <span className="text-[9px] opacity-80 leading-none truncate w-full">Cut Crates</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStageTab(4)}
          className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col items-center text-center gap-1.5 ${
            activeStageTab === 4
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Cog className="w-4 h-4" />
          <span className="text-[10px] font-extrabold leading-tight">Stage 4</span>
          <span className="text-[9px] opacity-80 leading-none truncate w-full">Formed Crates</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStageTab(5)}
          className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col items-center text-center gap-1.5 col-span-2 sm:col-span-1 ${
            activeStageTab === 5
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span className="text-[10px] font-extrabold leading-tight">Stage 5</span>
          <span className="text-[9px] opacity-80 leading-none truncate w-full">Packed Goods</span>
        </button>
      </div>

      <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
        <h4 className="text-xs font-black uppercase tracking-wide text-slate-800 border-b border-slate-200 pb-2 mb-3">
          {getActiveTabTitle()}
        </h4>

        {/* STAGE 1 FORM FIELDS */}
        {activeStageTab === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Paper Mill / Supplier:</label>
                <select
                  value={s1Mill}
                  onChange={(e) => {
                    setS1Mill(e.target.value);
                    setS1Brand(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-900"
                >
                  {PAPER_BRANDS.map((pb) => (
                    <option key={pb} value={pb}>{pb}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">GSM Thickness:</label>
                <input
                  type="text"
                  value={s1Gsm}
                  onChange={(e) => setS1Gsm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-900"
                  placeholder="e.g. 120 GSM"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Reel Weight (KG):</label>
                <input
                  type="number"
                  value={s1WeightKg}
                  onChange={(e) => setS1WeightKg(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-900"
                  placeholder="e.g. 230"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">
                Jumbo Reel Numbers (Comma-Separated for Batch Upload):
              </label>
              <textarea
                value={s1ReelNumbers}
                onChange={(e) => setS1ReelNumbers(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-mono text-slate-900 h-16 resize-none"
                placeholder="JR-OPN-101, JR-OPN-102, JR-OPN-103"
              />
              <span className="text-[10px] text-slate-400 font-medium">
                Tip: Enter multiple reel IDs separated by commas. We will automatically create separate, available mother reels of {s1WeightKg} KG each.
              </span>
            </div>
          </div>
        )}

        {/* STAGE 2 FORM FIELDS */}
        {activeStageTab === 2 && (
          <div className="space-y-3">
            {/* Job Association Selector for Traceability */}
            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-2">
              <label className="block text-[10px] font-black text-indigo-900 uppercase">Associate with Job Number:</label>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="s2JobType"
                    checked={s2JobType === 'existing'}
                    onChange={() => setS2JobType('existing')}
                    className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Existing active Job</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="s2JobType"
                    checked={s2JobType === 'new'}
                    onChange={() => setS2JobType('new')}
                    className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Assign Custom Job No (Recommended)</span>
                </label>
              </div>

              {s2JobType === 'existing' ? (
                <div>
                  <select
                    value={s2SelectedJobId}
                    onChange={(e) => {
                      setS2SelectedJobId(e.target.value);
                      const j = state.jobs.find((x) => x.id === e.target.value);
                      if (j) {
                        setS2Product(j.product);
                        if (j.gsm) setS2Gsm(String(j.gsm));
                        if (j.reelNo) setS2LotRef(String(j.reelNo));
                      }
                    }}
                    className="w-full px-3 py-1.5 border border-indigo-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="">-- SELECT ACTIVE JOB ID --</option>
                    {state.jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.id} - {j.product} ({j.gsm || 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    value={s2CustomJobId}
                    onChange={(e) => setS2CustomJobId(e.target.value)}
                    placeholder="e.g. JOB-OPN-102"
                    className="w-full px-3 py-1.5 border border-indigo-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400">
                    If this Job Number exists, the slit rolls will be added to it. If not, a new tracking Job will be created.
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Target Finished Product:</label>
                <select
                  value={s2Product}
                  onChange={(e) => setS2Product(e.target.value as ProductType)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-900"
                >
                  {productList.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Total Slit Rolls Buffer Count:</label>
                <input
                  type="number"
                  value={s2TotalRolls}
                  onChange={(e) => setS2TotalRolls(e.target.value)}
                  className="w-full px-3 py-2 border border-[#6366f1] bg-white rounded-lg text-xs font-black text-slate-900"
                  placeholder="e.g. 12"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">GSM Thickness:</label>
                <input
                  type="text"
                  value={s2Gsm}
                  onChange={(e) => setS2Gsm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-900"
                  placeholder="e.g. 280 GSM"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Lot / Mother Reel Reference:</label>
                <input
                  type="text"
                  value={s2LotRef}
                  onChange={(e) => setS2LotRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-mono font-bold text-slate-900 uppercase"
                  placeholder="e.g. LOT-SLIT-OPN"
                />
              </div>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              💡 These slit rolls will become instantly available as active material on the **Cutting Desk** for slicing.
            </span>
          </div>
        )}

        {/* STAGE 3 FORM FIELDS */}
        {activeStageTab === 3 && (
          <div className="space-y-3">
            {/* Job Association Selector for Traceability */}
            <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100 space-y-2">
              <label className="block text-[10px] font-black text-purple-900 uppercase">Associate with Job Number:</label>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="s3JobType"
                    checked={s3JobType === 'existing'}
                    onChange={() => setS3JobType('existing')}
                    className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Existing active Job</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="s3JobType"
                    checked={s3JobType === 'new'}
                    onChange={() => setS3JobType('new')}
                    className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Assign Custom Job No</span>
                </label>
              </div>

              {s3JobType === 'existing' ? (
                <div>
                  <select
                    value={s3SelectedJobId}
                    onChange={(e) => {
                      setS3SelectedJobId(e.target.value);
                      const j = state.jobs.find((x) => x.id === e.target.value);
                      if (j) {
                        setS3Product(j.product);
                        if (j.reelNo) setS3MachineLotRef(j.reelNo);
                      }
                    }}
                    className="w-full px-3 py-1.5 border border-purple-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="">-- SELECT ACTIVE JOB ID --</option>
                    {state.jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.id} - {j.product} ({j.availableCuttingCrates || 0} Cut Crates already)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    value={s3CustomJobId}
                    onChange={(e) => setS3CustomJobId(e.target.value)}
                    placeholder="e.g. JOB-OPN-103"
                    className="w-full px-3 py-1.5 border border-purple-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400">
                    If this Job Number exists, the cut crates will be added to it. If not, a new tracking Job will be created.
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Target Product:</label>
                <select
                  value={s3Product}
                  onChange={(e) => setS3Product(e.target.value as ProductType)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-900"
                >
                  {productList.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Number of Blank Crates in Buffer:</label>
                <input
                  type="number"
                  value={s3Crates}
                  onChange={(e) => {
                    setS3Crates(e.target.value);
                    const val = parseInt(e.target.value, 10) || 0;
                    setS3EstPieces(String(val * 10000));
                  }}
                  className="w-full px-3 py-2 border border-purple-500 bg-white rounded-lg text-xs font-black text-slate-900"
                  placeholder="e.g. 15"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Estimated Total Pieces:</label>
                <input
                  type="number"
                  value={s3EstPieces}
                  onChange={(e) => setS3EstPieces(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-900"
                  placeholder="e.g. 150000"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Lot / Cutting Machine Reference:</label>
                <input
                  type="text"
                  value={s3MachineLotRef}
                  onChange={(e) => setS3MachineLotRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-mono font-bold text-slate-900 uppercase"
                  placeholder="e.g. LOT-CUT-OPN"
                />
              </div>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              💡 These cut blank crates will be visible and select-ready on **Forming Lines (FM-01 to FM-04)** instantly.
            </span>
          </div>
        )}

        {/* STAGE 4 FORM FIELDS */}
        {activeStageTab === 4 && (
          <div className="space-y-3">
            {/* Job Association Selector for Traceability */}
            <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 space-y-2">
              <label className="block text-[10px] font-black text-amber-900 uppercase">Associate with Job Number:</label>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="s4JobType"
                    checked={s4JobType === 'existing'}
                    onChange={() => setS4JobType('existing')}
                    className="w-3.5 h-3.5 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Existing active Job</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="s4JobType"
                    checked={s4JobType === 'new'}
                    onChange={() => setS4JobType('new')}
                    className="w-3.5 h-3.5 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Assign Custom Job No</span>
                </label>
              </div>

              {s4JobType === 'existing' ? (
                <div>
                  <select
                    value={s4SelectedJobId}
                    onChange={(e) => {
                      setS4SelectedJobId(e.target.value);
                      const j = state.jobs.find((x) => x.id === e.target.value);
                      if (j) {
                        setS4Product(j.product);
                      }
                    }}
                    className="w-full px-3 py-1.5 border border-amber-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="">-- SELECT ACTIVE JOB ID --</option>
                    {state.jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.id} - {j.product} ({j.availableFormingCrates || 0} Formed Crates already)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    value={s4CustomJobId}
                    onChange={(e) => setS4CustomJobId(e.target.value)}
                    placeholder="e.g. JOB-OPN-104"
                    className="w-full px-3 py-1.5 border border-amber-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400">
                    If this Job Number exists, the formed crates will be added to it. If not, a new tracking Job will be created.
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Target Product:</label>
                <select
                  value={s4Product}
                  onChange={(e) => setS4Product(e.target.value as ProductType)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-900"
                >
                  {productList.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Total Formed Crates:</label>
                <input
                  type="number"
                  value={s4Crates}
                  onChange={(e) => setS4Crates(e.target.value)}
                  className="w-full px-3 py-2 border border-amber-500 bg-white rounded-lg text-xs font-black text-slate-900"
                  placeholder="e.g. 20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 p-2 bg-slate-100 rounded-lg">
              <input
                id="qc-pending-check"
                type="checkbox"
                checked={s4QcPending}
                onChange={(e) => setS4QcPending(e.target.checked)}
                className="w-4 h-4 text-amber-600 focus:ring-amber-500 border-slate-300 rounded cursor-pointer"
              />
              <label htmlFor="qc-pending-check" className="text-xs font-bold text-slate-800 cursor-pointer">
                Lock status to "QC-Pending" for safety check (Highly Recommended)
              </label>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              💡 These crates appear instantly as "Ready for Inspection" inside the **QC & Checking Desk**.
            </span>
          </div>
        )}

        {/* STAGE 5 FORM FIELDS */}
        {activeStageTab === 5 && (
          <div className="space-y-3">
            {/* Job Association Selector for Traceability */}
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 space-y-2">
              <label className="block text-[10px] font-black text-emerald-900 uppercase">Associate with Order / Job Number:</label>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="s5JobType"
                    checked={s5JobType === 'existing'}
                    onChange={() => setS5JobType('existing')}
                    className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Existing active Order/Job</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="s5JobType"
                    checked={s5JobType === 'new'}
                    onChange={() => setS5JobType('new')}
                    className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Assign Custom Order/Job No</span>
                </label>
              </div>

              {s5JobType === 'existing' ? (
                <div>
                  <select
                    value={s5SelectedJobId}
                    onChange={(e) => {
                      setS5SelectedJobId(e.target.value);
                      const pj = state.packJobs.find((x) => x.id === e.target.value);
                      if (pj) {
                        setS5Product(pj.kitType as ProductType);
                        if (pj.customer) setS5Consignee(pj.customer);
                        if (pj.pcsPerBox) setS5PcsPerBox(String(pj.pcsPerBox));
                      }
                    }}
                    className="w-full px-3 py-1.5 border border-emerald-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="">-- SELECT ACTIVE ORDER ID --</option>
                    {state.packJobs.map((pj) => (
                      <option key={pj.id} value={pj.id}>
                        {pj.id} - {pj.customer} ({pj.kitType}) ({pj.packedBoxes || 0} Boxes Packed)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    value={s5CustomJobId}
                    onChange={(e) => setS5CustomJobId(e.target.value)}
                    placeholder="e.g. ORD-OPN-105"
                    className="w-full px-3 py-1.5 border border-emerald-200 bg-white rounded-lg text-xs font-bold text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400">
                    If this Order/Job Number exists, the boxes will be added to it. If not, a new tracking entry will be created.
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Product or Assembly Kit:</label>
                <select
                  value={s5Product}
                  onChange={(e) => setS5Product(e.target.value as ProductType)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-900"
                >
                  {productList.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Ready Packed Box Count:</label>
                <input
                  type="number"
                  value={s5BoxCount}
                  onChange={(e) => setS5BoxCount(e.target.value)}
                  className="w-full px-3 py-2 border border-emerald-500 bg-white rounded-lg text-xs font-black text-slate-900"
                  placeholder="e.g. 50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Quantity per Box (Pcs/Box):</label>
                <input
                  type="number"
                  value={s5PcsPerBox}
                  onChange={(e) => setS5PcsPerBox(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-900"
                  placeholder="e.g. 1000"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-700 uppercase mb-1">Consignee or Stock Location:</label>
                <input
                  type="text"
                  value={s5Consignee}
                  onChange={(e) => setS5Consignee(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-900"
                  placeholder="e.g. OPEN STOCK WAREHOUSE"
                />
              </div>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">
              💡 These packed boxes are visible in the **Warehouse Stock & Dispatch Desk** ready for logistics challans.
            </span>
          </div>
        )}
      </div>

      {/* FOOTER CONTROLS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-3 border-t border-slate-200">
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase">Setup Performed By:</label>
          <input
            type="text"
            value={activeUser}
            onChange={(e) => setActiveUser(e.target.value)}
            className="w-full max-w-xs px-2.5 py-1.5 border border-slate-300 bg-white rounded-lg text-xs font-bold text-slate-800"
            placeholder="e.g. Admin / Production Head"
          />
        </div>
        <div className="flex justify-end gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#1a365d] hover:bg-[#122744] text-white font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>💾 Register Opening Stock Inward</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (isEmbedded) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
            <Database className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black tracking-tight text-[#1a365d] m-0">
              Shop Floor Opening WIP & Stock Inward
            </h3>
            <p className="text-xs text-slate-500 m-0">
              Inject initial live physical inventory across all stages to bootstrap operations
            </p>
          </div>
        </div>
        <form onSubmit={handleSaveInwardStock}>{formContent}</form>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#1a365d] to-[#2b4c7e] p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight uppercase m-0 flex items-center gap-2">
                <span>Shop Floor Opening WIP & Stock Inward</span>
              </h3>
              <p className="text-xs text-slate-200 font-medium m-0">
                Go-Live Master Setup Module
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSaveInwardStock} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {formContent}
        </form>
      </div>
    </div>
  );
};
