import React, { useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Layers,
  Scroll,
  Scissors,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  Play,
  Check,
  X,
  Droplets,
  TrendingDown,
  TrendingUp,
  FileText,
  Boxes,
  Database,
  Tag,
  Gauge,
  Download
} from 'lucide-react';
import { FactoryState, ProductionPlan, ProductType, MotherReelItem, PlannedLayer, Job } from '../../types';
import { PRODUCTS, PAPER_BRANDS, GLUE_BRANDS, PRODUCT_PREFIX_MAP, TARGET_GSM_DEFAULT, TARGET_LAYERS_DEFAULT } from '../../lib/constants';
import { getNumberingMaster, generateUnifiedJobId } from '../../lib/numberingMaster';
import { getJobPlannedLayers, parseNumericGsm, normalizeGsmLabel, exportToCSV } from '../../lib/utils';

interface PlanningDeskViewProps {
  state: FactoryState;
  onBackToHub: () => void;
  onSaveState: (nextState: FactoryState) => void;
  onNavigateToSlittingWithPlan?: (plan: ProductionPlan) => void;
  onSelectPlanForSlitting?: (plan: ProductionPlan) => void;
}

export const PlanningDeskView: React.FC<PlanningDeskViewProps> = ({
  state,
  onBackToHub,
  onSaveState,
  onNavigateToSlittingWithPlan,
  onSelectPlanForSlitting
}) => {
  const slittingNavigationHandler = onSelectPlanForSlitting || onNavigateToSlittingWithPlan;
  const { productionPlans = [], motherReelInventory = [], jobs = [] } = state;
  const productList = state.products && state.products.length > 0 ? state.products : PRODUCTS;
  const paperBrandList = state.paperBrands && state.paperBrands.length > 0 ? state.paperBrands : PAPER_BRANDS;
  const glueBrandList = state.glueBrands && state.glueBrands.length > 0 ? state.glueBrands : GLUE_BRANDS;
  const targetLayersList = state.targetLayersMaster && state.targetLayersMaster.length > 0 ? state.targetLayersMaster : TARGET_LAYERS_DEFAULT;
  const targetGsmList = state.targetGsmMaster && state.targetGsmMaster.length > 0 ? state.targetGsmMaster : TARGET_GSM_DEFAULT;
  const scrapLimitsList = state.scrapLimitsMaster && state.scrapLimitsMaster.length > 0 ? state.scrapLimitsMaster : [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
  const defaultPlannedGsm = (state.targetGsmMaster && state.targetGsmMaster.length > 0) ? state.targetGsmMaster[0] : (targetGsmList[0] || '120 GSM');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Scheduled' | 'In-Progress' | 'Completed'>('ALL');

  // Confirmation modal states (replaces window.confirm which fails in sandboxed iframe)
  const [planToDeleteId, setPlanToDeleteId] = useState<string | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);

  // Modal / Drawer state for creating / editing a plan
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  // Form Fields
  const [formProduct, setFormProduct] = useState<ProductType>(productList[0] || 'Spoon');
  const [formTargetLayers, setFormTargetLayers] = useState<number>(8);
  const [formTargetLengthMeters, setFormTargetLengthMeters] = useState<number>(1200);
  const [formAdhesiveBrand, setFormAdhesiveBrand] = useState<string>(glueBrandList[0] || 'Pidilite W-10 (Food Grade Adhesive)');
  const [formTargetScrapLimitPct, setFormTargetScrapLimitPct] = useState<number>(2.5);
  const [formTargetScrapLimitKg, setFormTargetScrapLimitKg] = useState<number>(15);
  const [formAssignedMachine, setFormAssignedMachine] = useState<string>('Slitting-1');
  const [formAssignedShift, setFormAssignedShift] = useState<'DAY' | 'NIGHT'>('DAY');
  const [formPlannedDate, setFormPlannedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formTargetQuantity, setFormTargetQuantity] = useState<number>(70000);
  const [formPaperBrand, setFormPaperBrand] = useState<string>(paperBrandList[0] || 'ITC');
  const [formTargetGsm, setFormTargetGsm] = useState<string>(defaultPlannedGsm);
  const [formSelectedGsms, setFormSelectedGsms] = useState<string[]>([defaultPlannedGsm]);
  const [customGsmInput, setCustomGsmInput] = useState<string>('');

  const handleToggleGsm = (gsmValue: string) => {
    setFormSelectedGsms((prev) => {
      if (prev.includes(gsmValue)) {
        if (prev.length === 1) return prev; // Retain at least 1 GSM
        return prev.filter((g) => g !== gsmValue);
      } else {
        return [...prev, gsmValue];
      }
    });
  };

  const handleAddCustomGsm = () => {
    const trimmed = customGsmInput.trim().toUpperCase();
    if (!trimmed) return;
    const formatted = trimmed.endsWith('GSM') ? trimmed : `${trimmed} GSM`;
    if (!formSelectedGsms.includes(formatted)) {
      setFormSelectedGsms((prev) => [...prev, formatted]);
    }
    setCustomGsmInput('');
  };
  const [formNotes, setFormNotes] = useState<string>('');
  const [formPrintedRollRequired, setFormPrintedRollRequired] = useState(false);
  const [formPrintedRollDesign, setFormPrintedRollDesign] = useState('');
  const [formPrintedRollIcon, setFormPrintedRollIcon] = useState('Sparkles');
  const [formPrintedLayersCount, setFormPrintedLayersCount] = useState(2);
  const [formPlannedLayers, setFormPlannedLayers] = useState<PlannedLayer[]>([]);

  const handleUpdatePlannedLayer = (index: number, field: keyof PlannedLayer, value: any) => {
    setFormPlannedLayers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddPlannedLayer = () => {
    setFormPlannedLayers((prev) => [
      ...prev,
      { gsm: 120, type: 'Plain', requiredReels: 1 }
    ]);
  };

  const handleRemovePlannedLayer = (index: number) => {
    if (formPlannedLayers.length <= 1) return;
    setFormPlannedLayers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAutoSyncPlannedLayers = () => {
    const gsms = formSelectedGsms.length > 0 ? formSelectedGsms : ['120 GSM', '60 GSM'];
    const plainGsm = parseNumericGsm(gsms[0]) || 120;
    const printedGsm = gsms.length > 1 ? (parseNumericGsm(gsms[1]) || 60) : 60;

    const totalL = Math.max(1, formTargetLayers || 8);
    const printedL = formPrintedRollRequired ? Math.max(1, formPrintedLayersCount || 1) : 0;
    const plainL = Math.max(1, totalL - printedL);

    const layers: PlannedLayer[] = [
      { gsm: plainGsm, type: 'Plain', requiredReels: plainL }
    ];
    if (printedL > 0) {
      layers.push({ gsm: printedGsm, type: 'Printed', requiredReels: printedL });
    }
    setFormPlannedLayers(layers);
  };

  // Mother Reel Modal State
  const [isMotherReelModalOpen, setIsMotherReelModalOpen] = useState(false);
  const [newReelBrand, setNewReelBrand] = useState(paperBrandList[0] || 'ITC');
  const [newReelGsm, setNewReelGsm] = useState(defaultPlannedGsm);
  const [newReelWeightKg, setNewReelWeightKg] = useState(250);
  const [newReelLengthMeters, setNewReelLengthMeters] = useState(1400);

  // Stats calculation
  const totalPlans = productionPlans.length;
  const scheduledCount = productionPlans.filter((p) => p.status === 'Scheduled').length;
  const inProgressCount = productionPlans.filter((p) => p.status === 'In-Progress').length;
  const completedCount = productionPlans.filter((p) => p.status === 'Completed').length;

  const filteredPlans = productionPlans.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.id.toLowerCase().includes(q) ||
        p.jobId.toLowerCase().includes(q) ||
        p.product.toLowerCase().includes(q) ||
        (p.adhesiveBrand && p.adhesiveBrand.toLowerCase().includes(q)) ||
        (p.paperBrand && p.paperBrand.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleOpenNewPlanModal = () => {
    setEditingPlanId(null);
    setFormProduct(productList[0] || 'Spoon');
    setFormTargetLayers(9);
    setFormTargetLengthMeters(1200);
    setFormAdhesiveBrand(glueBrandList[0] || 'Pidilite W-10 (Food Grade Adhesive)');
    setFormTargetScrapLimitPct(2.5);
    setFormTargetScrapLimitKg(15);
    setFormAssignedMachine('Slitting-1');
    setFormAssignedShift('DAY');
    setFormPlannedDate(new Date().toISOString().split('T')[0]);
    setFormTargetQuantity(70000);
    setFormPaperBrand(paperBrandList[0] || 'ITC');
    setFormTargetGsm('120 GSM, 60 GSM');
    setFormSelectedGsms(['120 GSM', '60 GSM']);
    setCustomGsmInput('');
    setFormNotes('');
    setFormPrintedRollRequired(true);
    setFormPrintedRollDesign('ITC Printed Design');
    setFormPrintedRollIcon('Sparkles');
    setFormPrintedLayersCount(1);
    setFormPlannedLayers([
      { gsm: 120, type: 'Plain', requiredReels: 8 },
      { gsm: 60, type: 'Printed', requiredReels: 1 }
    ]);
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlanModal = (plan: ProductionPlan) => {
    setEditingPlanId(plan.id);
    setFormProduct(plan.product);
    setFormTargetLayers(plan.targetLayers || 8);
    setFormTargetLengthMeters(plan.targetLengthMeters || 1200);
    setFormAdhesiveBrand(plan.adhesiveBrand || glueBrandList[0]);
    setFormTargetScrapLimitPct(plan.targetScrapLimitPct || 2.5);
    setFormTargetScrapLimitKg(plan.targetScrapLimitKg || 15);
    setFormAssignedMachine(plan.assignedMachine || 'Slitting-1');
    setFormAssignedShift(plan.assignedShift || 'DAY');
    setFormPlannedDate(plan.plannedDate || new Date().toISOString().split('T')[0]);
    setFormTargetQuantity(plan.targetQuantity || 70000);
    setFormPaperBrand(plan.paperBrand || paperBrandList[0] || 'ITC');
    const initialGsms = plan.plannedGsms && plan.plannedGsms.length > 0
      ? plan.plannedGsms
      : (plan.targetGsm ? plan.targetGsm.split(/[,+/]/).map((s) => s.trim()).filter(Boolean) : [defaultPlannedGsm]);
    setFormSelectedGsms(initialGsms);
    setFormTargetGsm(initialGsms.join(', '));
    setCustomGsmInput('');
    setFormNotes(plan.notes || '');
    setFormPrintedRollRequired(plan.printedRollRequired || false);
    setFormPrintedRollDesign(plan.printedRollDesign || '');
    setFormPrintedRollIcon(plan.printedRollIcon || 'Sparkles');
    setFormPrintedLayersCount(plan.printedLayersCount || 1);

    const existingLayers = plan.plannedLayers && plan.plannedLayers.length > 0
      ? plan.plannedLayers
      : getJobPlannedLayers(jobs.find(j => j.id === plan.jobId), plan);
    setFormPlannedLayers(existingLayers.length > 0 ? existingLayers : [
      { gsm: parseNumericGsm(plan.targetGsm) || 120, type: 'Plain', requiredReels: plan.targetLayers || 8 }
    ]);
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();

    const effectiveGsms = formSelectedGsms.length > 0 ? formSelectedGsms : [formTargetGsm || defaultPlannedGsm];
    const combinedGsmStr = effectiveGsms.join(', ');

    const effectivePlannedLayers: PlannedLayer[] = formPlannedLayers.length > 0
      ? formPlannedLayers.map((l) => ({
          gsm: typeof l.gsm === 'string' ? (parseNumericGsm(l.gsm) || 120) : l.gsm,
          type: l.type,
          requiredReels: Math.max(1, Number(l.requiredReels) || 1)
        }))
      : [
          { gsm: parseNumericGsm(effectiveGsms[0]) || 120, type: 'Plain', requiredReels: formTargetLayers || 8 }
        ];

    if (editingPlanId) {
      // Update existing plan
      const updatedPlans = productionPlans.map((p) => {
        if (p.id !== editingPlanId) return p;
        return {
          ...p,
          product: formProduct,
          targetLayers: formTargetLayers,
          targetLengthMeters: formTargetLengthMeters,
          adhesiveBrand: formAdhesiveBrand,
          targetScrapLimitPct: formTargetScrapLimitPct,
          targetScrapLimitKg: formTargetScrapLimitKg,
          assignedMachine: formAssignedMachine,
          assignedShift: formAssignedShift,
          plannedDate: formPlannedDate,
          targetQuantity: formTargetQuantity,
          paperBrand: formPaperBrand,
          targetGsm: combinedGsmStr,
          plannedGsms: effectiveGsms,
          notes: formNotes,
          plannedLayers: effectivePlannedLayers,
          printedRollRequired: formPrintedRollRequired || undefined,
          printedRollDesign: formPrintedRollRequired ? formPrintedRollDesign : undefined,
          printedRollIcon: formPrintedRollRequired ? formPrintedRollIcon : undefined,
          printedLayersCount: formPrintedRollRequired ? formPrintedLayersCount : undefined,
          plainLayersCount: formPrintedRollRequired ? (formTargetLayers - formPrintedLayersCount) : undefined
        };
      });

      // Also sync any existing Job card associated with this plan
      const updatedJobs = (state.jobs || []).map((j) => {
        if (j.planId === editingPlanId || (productionPlans.find(p => p.id === editingPlanId)?.jobId === j.id)) {
          return {
            ...j,
            plannedLayers: effectivePlannedLayers,
            targetLayers: formTargetLayers,
            targetGsm: combinedGsmStr,
            plannedGsms: effectiveGsms
          };
        }
        return j;
      });

      onSaveState({
        ...state,
        jobs: updatedJobs,
        productionPlans: updatedPlans
      });
      setIsPlanModalOpen(false);
      alert(`✅ Production Plan [${editingPlanId}] & Job Card specifications updated successfully!`);
    } else {
      // Robust sequence calculation across existing plans and deleted plan IDs
      const allKnownPlanIds = [
        ...(productionPlans || []).map((p) => p.id),
        ...(state.deletedPlanIds || [])
      ];
      let maxPlanSeq = 0;
      allKnownPlanIds.forEach((id) => {
        if (id) {
          const match = id.match(/PLAN-\d+-(\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxPlanSeq) maxPlanSeq = num;
          }
        }
      });
      const nextSeq = Math.max(maxPlanSeq + 1, (productionPlans || []).length + 1);
      const planId = `PLAN-${new Date().getFullYear()}-${String(nextSeq).padStart(3, '0')}`;
      
      const { jobId, updatedSeriesConfig } = generateUnifiedJobId(
        formProduct,
        state.seriesConfig,
        state.productPrefixMap,
        state.jobs || []
      );

      const newPlan: ProductionPlan = {
        id: planId,
        jobId,
        product: formProduct,
        targetLayers: formTargetLayers,
        targetLengthMeters: formTargetLengthMeters,
        adhesiveBrand: formAdhesiveBrand,
        targetScrapLimitPct: formTargetScrapLimitPct,
        targetScrapLimitKg: formTargetScrapLimitKg,
        assignedMachine: formAssignedMachine,
        assignedShift: formAssignedShift,
        plannedDate: formPlannedDate,
        targetQuantity: formTargetQuantity,
        paperBrand: formPaperBrand,
        targetGsm: combinedGsmStr,
        plannedGsms: effectiveGsms,
        notes: formNotes,
        status: 'Scheduled',
        createdAt: new Date().toISOString(),
        plannedLayers: effectivePlannedLayers,
        printedRollRequired: formPrintedRollRequired || undefined,
        printedRollDesign: formPrintedRollRequired ? formPrintedRollDesign : undefined,
        printedRollIcon: formPrintedRollRequired ? formPrintedRollIcon : undefined,
        printedLayersCount: formPrintedRollRequired ? formPrintedLayersCount : undefined,
        plainLayersCount: formPrintedRollRequired ? (formTargetLayers - formPrintedLayersCount) : undefined
      };

      onSaveState({
        ...state,
        seriesConfig: updatedSeriesConfig,
        deletedPlanIds: (state.deletedPlanIds || []).filter((id) => id !== planId),
        deletedJobIds: (state.deletedJobIds || []).filter((id) => id !== jobId),
        productionPlans: [newPlan, ...productionPlans],
        jobs: [{
          id: jobId,
          planId: planId,
          product: formProduct,
          paperBrand: formPaperBrand,
          gsm: combinedGsmStr,
          targetLayers: formTargetLayers,
          targetGsm: combinedGsmStr,
          plannedGsms: effectiveGsms,
          plannedLayers: effectivePlannedLayers,
          stage: 'Planning',
          status: 'Pending',
          availableRolls: 0,
          availableCuttingCrates: 0,
          availableFormingCrates: 0,
          availableQcCrates: 0,
          createdAt: new Date().toISOString()
        }, ...(state.jobs || [])]
      });
      setIsPlanModalOpen(false);
      alert(`✅ New Production Plan Created!\nPlan ID: [${planId}]\nJob ID: [${jobId}]\nTarget: ${formTargetLayers} Layers (${effectivePlannedLayers.map(l => `${l.requiredReels}x ${l.gsm} GSM ${l.type}`).join(' + ')}) | ${formTargetLengthMeters} Meters | ${formAdhesiveBrand}`);
    }
  };

  const handleDeletePlanConfirm = (planId: string) => {
    const updated = productionPlans.filter((p) => p.id !== planId);
    onSaveState({
      ...state,
      deletedPlanIds: Array.from(new Set([...(state.deletedPlanIds || []), planId])),
      productionPlans: updated
    });
    setPlanToDeleteId(null);
  };

  const handleDeleteAllPlansConfirm = () => {
    const allPlanIds = productionPlans.map((p) => p.id);
    onSaveState({
      ...state,
      deletedPlanIds: Array.from(new Set([...(state.deletedPlanIds || []), ...allPlanIds])),
      productionPlans: []
    });
    setIsDeleteAllModalOpen(false);
  };

  const handleDownloadPlansCSV = () => {
    if (productionPlans.length === 0) return;
    const data = productionPlans.map((p) => ({
      'Plan ID': p.id,
      'Job ID': p.jobId,
      'Product': p.product,
      'Paper Brand': p.paperBrand,
      'Status': p.status,
      'Target Layers': p.targetLayers,
      'Slit Length (M)': p.targetLengthMeters,
      'Planned Date': p.plannedDate,
      'Assigned Machine': p.assignedMachine,
      'Assigned Shift': p.assignedShift,
      'Adhesive Brand': p.adhesiveBrand,
      'Target Scrap Limit (%)': p.targetScrapLimitPct,
      'Notes': p.notes || ''
    }));
    exportToCSV(`Production_Plans_${new Date().toISOString().split('T')[0]}.csv`, data);
  };

  const handleToggleStatus = (planId: string, nextStatus: 'Scheduled' | 'In-Progress' | 'Completed') => {
    const updated = productionPlans.map((p) => {
      if (p.id !== planId) return p;
      return { ...p, status: nextStatus };
    });
    onSaveState({
      ...state,
      productionPlans: updated
    });
  };

  const handleAddMotherReel = (e: React.FormEvent) => {
    e.preventDefault();
    const nextSeq = motherReelInventory.length + 1;
    const brandPrefix = newReelBrand.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
    const newReelId = `M-REEL-${brandPrefix}-${String(nextSeq).padStart(3, '0')}`;

    const newReel: MotherReelItem = {
      id: newReelId,
      brand: newReelBrand,
      gsm: newReelGsm,
      weightKg: Number(newReelWeightKg) || 250,
      lengthMeters: Number(newReelLengthMeters) || 1400,
      status: 'Available'
    };

    onSaveState({
      ...state,
      motherReelInventory: [newReel, ...motherReelInventory]
    });
    setIsMotherReelModalOpen(false);
    alert(`✅ Mother Reel [${newReelId}] added to warehouse inventory!`);
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-12">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 mb-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHub}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Main Menu</span>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold shadow-sm">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 m-0">
                    Production Planning & Control Desk (PPC Dashboard)
                  </h2>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                    PPC v4.3
                  </span>
                </div>
                <p className="text-xs text-slate-500 m-0">
                  Target Layers, Slitting Length, Glue Brand, Scrap Limit & Live Plan vs Actual Matrix
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsMotherReelModalOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
            >
              <Scroll className="w-4 h-4 text-indigo-600" />
              <span>Mother Reels Stock ({motherReelInventory.filter((r) => r.status === 'Available').length} In-Stock)</span>
            </button>
            <button
              type="button"
              onClick={handleOpenNewPlanModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create Scheduled Plan</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-500 uppercase">Total Job Plans</span>
              <FileText className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900">{totalPlans}</div>
            <div className="text-[11px] text-slate-500 mt-1">Across all products</div>
          </div>

          <div className="bg-white border border-amber-200 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-amber-700 uppercase">Scheduled Queue</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-900">{scheduledCount}</div>
            <div className="text-[11px] text-amber-700 mt-1">Awaiting slitting run</div>
          </div>

          <div className="bg-white border border-blue-200 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-blue-700 uppercase">In-Progress Runs</span>
              <Play className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-900">{inProgressCount}</div>
            <div className="text-[11px] text-blue-700 mt-1">Active on production lines</div>
          </div>

          <div className="bg-white border border-emerald-200 rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-700 uppercase">Completed Plans</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-900">{completedCount}</div>
            <div className="text-[11px] text-emerald-700 mt-1">Fully produced & audited</div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-3 shadow-2xs">
          <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Plan ID, Job ID, Product, Glue Brand, Paper Mill..."
              className="w-full text-xs font-medium text-slate-800 outline-none bg-transparent"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(['ALL', 'Scheduled', 'In-Progress', 'Completed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-blue-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Plan vs Actual Live Tracking Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide m-0">
                Plan vs Actual Tracking Matrix
              </h3>
              <p className="text-xs text-slate-500 m-0">
                Compare Target Layers, Slit Length, Glue Consumed, and Scrap % Limits
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                Showing {filteredPlans.length} of {productionPlans.length} Plans
              </span>
              {productionPlans.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleDownloadPlansCSV}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Download Plans as CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDeleteAllModalOpen(true)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Delete All Plans"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete All Plans ({productionPlans.length})</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-extrabold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3.5">Plan / Job ID</th>
                  <th className="py-3 px-3">Product & Mill</th>
                  <th className="py-3 px-3">Machine & Shift</th>
                  <th className="py-3 px-3 text-center">Target Layers</th>
                  <th className="py-3 px-3">Target Length (M)</th>
                  <th className="py-3 px-3">Adhesive Brand</th>
                  <th className="py-3 px-3 text-center">Scrap Limit</th>
                  <th className="py-3 px-3">Plan vs Actual Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-medium text-xs">
                      No production plans found matching your criteria. Click "Create Scheduled Plan" above.
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((plan) => {
                    // Match live job data if exists
                    const linkedJob = jobs.find((j) => j.id === plan.jobId);
                    const actualLayers = plan.actualLayersUsed ?? (linkedJob?.reelsList?.filter(r => !r.isHotFoilLayer).length || (linkedJob?.reelNumbers?.length || 0));
                    const actualMeters = plan.actualMetersSlit ?? (linkedJob?.actualLengthMeters || 0);
                    const actualScrapPct = plan.actualScrapPct ?? (linkedJob?.scrapPercent || 0);
                    const isScrapExceeded = actualScrapPct > (plan.targetScrapLimitPct || 2.5);

                    return (
                      <tr key={plan.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3.5 font-mono">
                          <div className="font-extrabold text-blue-900">{plan.id}</div>
                          <div className="text-[11px] font-bold text-slate-500">{plan.jobId}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{plan.plannedDate}</div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-extrabold text-slate-800 block">{plan.product}</span>
                          <span className="text-[11px] text-slate-500 font-medium block">
                            {plan.paperBrand || 'ITC'}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(plan.plannedGsms && plan.plannedGsms.length > 0
                              ? plan.plannedGsms
                              : (plan.targetGsm ? plan.targetGsm.split(/[,+/]/).map(s => s.trim()).filter(Boolean) : [])
                            ).map((g) => (
                              <span
                                key={g}
                                className="text-[10px] font-black bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200 shadow-2xs"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                          {plan.printedRollRequired && (
                            <span className="mt-1 font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 shadow-xs inline-flex flex-col gap-0.5 text-[10px]">
                              <span className="flex items-center gap-1">
                                {plan.printedRollIcon === 'Coffee' && '☕'}
                                {plan.printedRollIcon === 'ShoppingBag' && '🛍️'}
                                {plan.printedRollIcon === 'Droplets' && '💧'}
                                {plan.printedRollIcon === 'Tag' && '🏷️'}
                                {plan.printedRollIcon === 'Boxes' && '📦'}
                                {(!plan.printedRollIcon || plan.printedRollIcon === 'Sparkles') && '✨'}
                                <span>{plan.printedRollDesign}</span>
                              </span>
                              <span className="text-indigo-700 opacity-80">
                                {plan.printedLayersCount || 2} Printed | {plan.plainLayersCount || (plan.targetLayers - 2)} Plain
                              </span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-700">{plan.assignedMachine}</div>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold mt-0.5 ${
                              plan.assignedShift === 'DAY'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {plan.assignedShift} SHIFT
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <span className="font-black text-sm text-slate-800">{plan.targetLayers}</span>
                            <span className="text-[10px] text-slate-400">L</span>
                          </div>
                          {plan.plannedLayers && plan.plannedLayers.length > 0 ? (
                            <div className="flex flex-col gap-0.5 mt-0.5 items-center">
                              {plan.plannedLayers.map((pl, plIdx) => (
                                <span
                                  key={plIdx}
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                    pl.type === 'Printed'
                                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                                      : 'bg-blue-50 text-blue-800 border-blue-200'
                                  }`}
                                >
                                  {pl.requiredReels}L @ {pl.gsm} {pl.type}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Actual: <span className="font-bold text-slate-700">{actualLayers} Reels</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800">{plan.targetLengthMeters} M</div>
                          <div className="text-[10px] text-slate-500">
                            Actual: <span className="font-bold text-slate-700">{actualMeters} M</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-bold text-indigo-900 max-w-[150px] truncate" title={plan.adhesiveBrand}>
                            {plan.adhesiveBrand}
                          </div>
                          {plan.actualGlueConsumedKg !== undefined && (
                            <div className="text-[10px] text-slate-500">
                              Used: <span className="font-bold text-slate-800">{plan.actualGlueConsumedKg} KG</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="font-bold text-slate-700">≤ {plan.targetScrapLimitPct}%</div>
                          <div
                            className={`text-[10px] font-extrabold ${
                              isScrapExceeded ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            Actual: {actualScrapPct}%
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                plan.status === 'Completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : plan.status === 'In-Progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {plan.status}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {plan.status === 'Scheduled' && slittingNavigationHandler && (
                              <button
                                type="button"
                                onClick={() => slittingNavigationHandler(plan)}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-extrabold transition cursor-pointer flex items-center gap-1"
                                title="Load Plan onto Slitting Desk"
                              >
                                <Play className="w-3 h-3" />
                                <span>Slit</span>
                              </button>
                            )}

                            {plan.status !== 'Completed' ? (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(plan.id, 'Completed')}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                title="Mark as Completed"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(plan.id, 'In-Progress')}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                title="Re-open to In-Progress"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenEditPlanModal(plan)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Edit Plan"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setPlanToDeleteId(plan.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Warehouse Mother Reels Inventory Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide m-0">
                Warehouse Mother Reel Inventory
              </h3>
              <p className="text-xs text-slate-500 m-0">
                Available mother reels for upcoming scheduled production runs
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsMotherReelModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer border border-indigo-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Mother Reel</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {motherReelInventory.map((reel) => {
              const isAvailable = reel.status === 'Available';
              const isInUse = reel.status === 'In-Use';
              return (
                <div
                  key={reel.id}
                  className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    isAvailable
                      ? 'bg-slate-50/70 border-slate-200'
                      : isInUse
                      ? 'bg-amber-50/50 border-amber-300'
                      : 'bg-slate-100/60 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-blue-900">{reel.id}</span>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                        isAvailable
                          ? 'bg-emerald-100 text-emerald-800'
                          : isInUse
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {reel.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium">
                    {reel.brand} • {reel.gsm}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-700 pt-1 border-t border-slate-200/60">
                    <span>Weight: {reel.weightKg} KG</span>
                    <span>Length: {reel.lengthMeters || 1400} M</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CREATE / EDIT PLAN MODAL */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-extrabold m-0 uppercase tracking-wide">
                  {editingPlanId ? `Edit Plan [${editingPlanId}]` : 'Create Scheduled Production Plan'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Product Item:</label>
                  <select
                    value={formProduct}
                    onChange={(e) => setFormProduct(e.target.value as ProductType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                  >
                    {productList.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Paper Mill / Brand:</label>
                  <select
                    value={formPaperBrand}
                    onChange={(e) => setFormPaperBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                  >
                    {paperBrandList.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Layers & Length */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-blue-900 uppercase mb-1">Target Layers:</label>
                  <select
                    value={formTargetLayers}
                    onChange={(e) => setFormTargetLayers(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg font-extrabold text-blue-900 bg-blue-50/50"
                  >
                    {targetLayersList.map((layer) => (
                      <option key={layer} value={layer}>{layer} Layers</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Slitting Length (Meters):</label>
                  <input
                    type="number"
                    value={formTargetLengthMeters}
                    onChange={(e) => setFormTargetLengthMeters(Number(e.target.value))}
                    min={100}
                    step={50}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
                    required
                  />
                </div>
              </div>

              {/* Target GSM Multi-Select & Slitting Integration */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block font-extrabold text-slate-800 text-xs uppercase flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Target Paper GSM (Select Multiple, e.g. 60 GSM, 120 GSM):</span>
                  </label>
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">
                    {formSelectedGsms.length} Selected (Auto-Integrated with Slitting)
                  </span>
                </div>

                {/* Dropdown to select/add GSM */}
                <div className="flex gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected) {
                        if (!formSelectedGsms.includes(selected)) {
                          setFormSelectedGsms((prev) => [...prev, selected]);
                        }
                        setFormTargetGsm(selected);
                      }
                    }}
                    className="w-full px-3 py-2 border border-indigo-300 rounded-lg font-bold text-slate-800 bg-white text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">➕ Click here to select GSM from dropdown (e.g. 60 GSM, 120 GSM)...</option>
                    {targetGsmList.map((gsm) => (
                      <option key={gsm} value={gsm}>
                        {gsm} {formSelectedGsms.includes(gsm) ? '✓ (Already Added)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Active Selected GSM Chips */}
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white rounded-lg border border-indigo-200 min-h-[38px]">
                  <span className="text-[11px] font-bold text-slate-600 uppercase mr-1">Planned for Slitting:</span>
                  {formSelectedGsms.map((gsm) => (
                    <span
                      key={gsm}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 text-white rounded-md text-xs font-black shadow-2xs"
                    >
                      <Check className="w-3 h-3 text-indigo-200" />
                      {gsm}
                      {formSelectedGsms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleToggleGsm(gsm)}
                          className="hover:bg-indigo-700 rounded-full p-0.5 ml-0.5 cursor-pointer"
                          title={`Remove ${gsm}`}
                        >
                          <X className="w-3 h-3 text-indigo-200 hover:text-white" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>

                {/* Quick Toggle Common GSM Pills */}
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Quick Toggle Popular GSMs (From GSM Master):
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {targetGsmList.map((gsm) => {
                      const isSelected = formSelectedGsms.includes(gsm);
                      return (
                        <button
                          key={gsm}
                          type="button"
                          onClick={() => handleToggleGsm(gsm)}
                          className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}{gsm}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom GSM Input */}
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Custom GSM (e.g. 70 GSM or 110 GSM)"
                    value={customGsmInput}
                    onChange={(e) => setCustomGsmInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomGsm();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-semibold text-slate-800 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomGsm}
                    className="px-3 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-lg cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Custom
                  </button>
                </div>
              </div>

              {/* PRINTED ROLL CONFIGURATION */}
              <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="formPrintedRollRequired"
                    checked={formPrintedRollRequired}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormPrintedRollRequired(checked);
                      if (checked && !formPrintedRollDesign) {
                        setFormPrintedRollDesign('ITC Printed Design');
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="formPrintedRollRequired" className="font-extrabold text-[11px] uppercase tracking-wider text-indigo-900 cursor-pointer select-none">
                    Require Printed Roll
                  </label>
                </div>

                {formPrintedRollRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pl-6 animate-in fade-in duration-200">
                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Printed Brand / Design Name:
                      </label>
                      <input
                        type="text"
                        value={formPrintedRollDesign}
                        onChange={(e) => setFormPrintedRollDesign(e.target.value)}
                        placeholder="e.g. ITC Printed Brand"
                        className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-md text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Printed Layers:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={formTargetLayers}
                        value={formPrintedLayersCount}
                        onChange={(e) => setFormPrintedLayersCount(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-md text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Plain Layers:
                      </label>
                      <input
                        type="number"
                        disabled
                        value={formTargetLayers - formPrintedLayersCount}
                        className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-xs font-bold text-slate-500 cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* PPC MULTI-GSM REQUIREMENT PROFILE */}
              <div className="bg-gradient-to-br from-indigo-50/80 via-blue-50/50 to-slate-50 border-2 border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-700" />
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide m-0">
                        Multi-GSM Layer Requirement Profile
                      </h4>
                      <p className="text-[11px] text-slate-500 m-0">
                        Target reels per GSM segment (e.g. 8 Layers @ 120 GSM Plain + 1 Layer @ 60 GSM Printed)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAutoSyncPlannedLayers}
                      className="px-2.5 py-1 text-[11px] font-extrabold bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-lg transition border border-indigo-300 cursor-pointer flex items-center gap-1"
                      title="Auto-calculate layer segments from selected GSMs and target layers"
                    >
                      <CheckCircle2 className="w-3 h-3 text-indigo-700" /> Auto-Sync
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPlannedLayer}
                      className="px-2.5 py-1 text-[11px] font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Layer
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {formPlannedLayers.map((layer, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-indigo-100 rounded-lg p-2.5 flex items-center justify-between flex-wrap gap-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-900 font-black text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>

                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold text-slate-600 uppercase">GSM:</label>
                          <select
                            value={String(parseNumericGsm(layer.gsm) || layer.gsm)}
                            onChange={(e) => handleUpdatePlannedLayer(idx, 'gsm', Number(e.target.value) || e.target.value)}
                            className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-bold text-xs text-slate-800"
                          >
                            {Array.from(new Set([...formSelectedGsms.map(g => parseNumericGsm(g)).filter(n => n > 0), 60, 80, 100, 120, 140, 160, 180])).map((gNum) => (
                              <option key={gNum} value={gNum}>
                                {gNum} GSM
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold text-slate-600 uppercase">Type:</label>
                          <select
                            value={layer.type}
                            onChange={(e) => handleUpdatePlannedLayer(idx, 'type', e.target.value as 'Plain' | 'Printed')}
                            className={`px-2 py-1 border rounded font-bold text-xs ${
                              layer.type === 'Printed'
                                ? 'bg-purple-50 border-purple-300 text-purple-900'
                                : 'bg-slate-50 border-slate-300 text-slate-800'
                            }`}
                          >
                            <option value="Plain">Plain Paper</option>
                            <option value="Printed">Printed Design Roll</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold text-slate-600 uppercase">Required Reels:</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={layer.requiredReels}
                            onChange={(e) => handleUpdatePlannedLayer(idx, 'requiredReels', Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-black text-xs text-slate-900 text-center"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded border ${
                          layer.type === 'Printed'
                            ? 'bg-purple-100 text-purple-900 border-purple-200'
                            : 'bg-blue-100 text-blue-900 border-blue-200'
                        }`}>
                          {layer.requiredReels} {layer.requiredReels === 1 ? 'Reel' : 'Reels'} @ {layer.gsm} GSM ({layer.type})
                        </span>

                        {formPlannedLayers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePlannedLayer(idx)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Remove layer segment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary badge */}
                {(() => {
                  const totalPlanned = formPlannedLayers.reduce((acc, l) => acc + (Number(l.requiredReels) || 0), 0);
                  const isMatch = totalPlanned === formTargetLayers;
                  return (
                    <div className="flex items-center justify-between text-xs bg-white/90 border border-indigo-200 px-3 py-1.5 rounded-lg">
                      <span className="font-bold text-slate-700">
                        Total Planned Reels: <b className="text-indigo-900 font-extrabold">{totalPlanned} Reels</b>
                        {!isMatch && (
                          <span className="text-amber-700 ml-2 font-medium">
                            (Target layers is set to {formTargetLayers})
                          </span>
                        )}
                      </span>
                      {!isMatch && (
                        <button
                          type="button"
                          onClick={() => setFormTargetLayers(totalPlanned)}
                          className="text-[11px] font-extrabold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                        >
                          Sync Target Layers to {totalPlanned}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Glue Brand */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Specified Glue Brand:</label>
                <select
                  value={formAdhesiveBrand}
                  onChange={(e) => setFormAdhesiveBrand(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                >
                  {glueBrandList.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Machine & Shift */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Assigned Machine:</label>
                  <select
                    value={formAssignedMachine}
                    onChange={(e) => setFormAssignedMachine(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                  >
                    <option value="Slitting-1">Slitting-1</option>
                    <option value="Slitting-2">Slitting-2</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Assigned Shift:</label>
                  <select
                    value={formAssignedShift}
                    onChange={(e) => setFormAssignedShift(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                  >
                    <option value="DAY">☀️ DAY SHIFT</option>
                    <option value="NIGHT">🌙 NIGHT SHIFT</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Planned Date:</label>
                  <input
                    type="date"
                    value={formPlannedDate}
                    onChange={(e) => setFormPlannedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Target Quantity & Notes */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Target Output Quantity (Pcs):</label>
                <input
                  type="number"
                  value={formTargetQuantity}
                  onChange={(e) => setFormTargetQuantity(Number(e.target.value))}
                  step={1000}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Manager Notes / Formulation Specs:</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Special high-stiffness formula for catering spoon delivery by Friday"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium text-slate-800 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-extrabold transition shadow-sm cursor-pointer"
                >
                  {editingPlanId ? 'Save Plan Changes' : 'Create & Schedule Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MOTHER REEL MODAL */}
      {isMotherReelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scroll className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-extrabold m-0 uppercase tracking-wide">
                  Add Mother Reel to Inventory
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMotherReelModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMotherReel} className="p-4 sm:p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Paper Mill / Brand:</label>
                <select
                  value={newReelBrand}
                  onChange={(e) => setNewReelBrand(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                >
                  {paperBrandList.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">GSM Thickness:</label>
                <input
                  type="text"
                  value={newReelGsm}
                  onChange={(e) => setNewReelGsm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Weight (KG):</label>
                  <input
                    type="number"
                    value={newReelWeightKg}
                    onChange={(e) => setNewReelWeightKg(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Length (Meters):</label>
                  <input
                    type="number"
                    value={newReelLengthMeters}
                    onChange={(e) => setNewReelLengthMeters(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsMotherReelModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold transition shadow-sm cursor-pointer"
                >
                  Add Reel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Plan Delete Confirm Modal */}
      {planToDeleteId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-extrabold text-slate-900 m-0">Confirm Delete Plan</h3>
            </div>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to delete Production Plan <strong>[{planToDeleteId}]</strong>? This action will permanently remove it from the database and sync tombstones.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPlanToDeleteId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeletePlanConfirm(planToDeleteId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete Plan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Plans Confirm Modal */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-extrabold text-slate-900 m-0">Delete All Production Plans</h3>
            </div>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              ⚠️ Are you sure you want to delete ALL <strong>{productionPlans.length}</strong> pending and scheduled production plans? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAllPlansConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete All ({productionPlans.length}) Plans</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
