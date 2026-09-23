export type ProductType = 'Spoon' | 'Fork' | 'Knife' | 'Dessert Spoon' | string;

export type CurrentView =
  | 'HUB'
  | 'DASHBOARD'
  | 'PLANNING'
  | 'MANPOWER'
  | 'MARKETING'
  | 'DISPATCH'
  | 'SLITTING'
  | 'CUTTING'
  | 'FORMING'
  | 'QC'
  | 'PACKING'
  | 'STOCK'
  | 'ORDERS'
  | 'ANALYTICS'
  | 'SCRAP'
  | 'SEARCH'
  | 'AUDIT'
  | 'ADMIN'
  | 'MAINTENANCE'
  | 'PURCHASE'
  | 'OPENING_STOCK'
  | 'WHATSAPP';

export type MaterialUrgency = 'CRITICAL_BREAKDOWN' | 'URGENT' | 'NORMAL' | 'LOW';

export type MaterialRequisitionStatus =
  | 'PENDING'       // Submitted by department, awaiting purchase review
  | 'PO_ISSUED'     // Purchase order issued / ordered from vendor
  | 'RECEIVED'      // Arrived at factory store / Material Arrived
  | 'ACKNOWLEDGED'  // Requester acknowledged & received into department stock
  | 'REJECTED';     // Rejected / cancelled

export interface MaterialRequisition {
  id: string; // e.g. "MR-2026-001"
  department:
    | 'Maintenance'
    | 'Slitting'
    | 'Cutting'
    | 'Forming'
    | 'QC'
    | 'Packing'
    | 'Warehouse'
    | 'General'
    | string;
  itemCategory:
    | 'Spare Parts & Machine Tooling'
    | 'Raw Material (Paper Reels)'
    | 'Packaging & Cartons'
    | 'Electrical & Sensors'
    | 'Lubricants & Consumables'
    | 'Safety & PPE'
    | 'Workshop Tools'
    | 'General Utility'
    | string;
  itemName: string;
  itemCodeOrPartNo?: string;
  quantity: number;
  unit: 'Pcs' | 'KG' | 'Box' | 'Litre' | 'Meters' | 'Rolls' | 'Set' | string;
  urgency: MaterialUrgency;
  machineOrPurpose?: string;
  machine?: string;
  purpose?: string;
  requestedBy: string;
  requestedDate: string; // YYYY-MM-DD
  requestedTime?: string;
  createdAt?: string;
  remarks?: string;
  status: MaterialRequisitionStatus;

  // Purchase fulfillment fields
  vendorName?: string;
  poNumber?: string;
  poDate?: string;
  expectedDeliveryDate?: string;
  expectedDate?: string;
  estimatedCost?: number;
  actualCost?: number;
  purchaseNotes?: string;

  // Goods Receiving fields (When goods are received)
  receivedDate?: string; // YYYY-MM-DD
  receivedTime?: string;
  receivedQty?: number;
  grnOrBillNo?: string;
  receivedBy?: string;
  storageLocationOrBin?: string; // e.g. "Maintenance Store Rack B2"
  acknowledgedByRequester?: boolean; // When requester marks it collected
  acknowledgedDate?: string;
  acknowledgedAt?: string;
}

export interface ProductCrateCapacity {
  cuttingPcs: number; // Flat blank pieces per crate
  formingPcs: number; // 3D formed pieces per crate
}

export interface OperatorRunSlice {
  sliceId: string;
  operator: string;
  relievedByOperator?: string;
  shift: 'DAY' | 'NIGHT' | string;
  date?: string;
  machine?: string;
  stage?: string;
  startTime?: string;
  handoverTime: string;
  startMeterReading?: number;
  endMeterReading?: number;
  strokeCount?: number;
  producedQty: number; // Crates / Rolls / Units produced during this operator's slice
  loosePieces?: number; // Loose flat blanks / pieces produced during slice
  producedPieces?: number;
  grossPieces?: number;
  scrapQty: number; // Scrap produced during this slice (kg or pcs)
  scrapKg?: number;
  scrapPcs?: number;
  rejectedPieces?: number;
  cuttingMaterialScrapKg?: number;
  pcsPerKg?: number;
  notes?: string;
  handoverConfirmed?: boolean;
  helpers?: string[];
  helperCount?: number;
  glueUsageKg?: number;
  glueBrand?: string;
  consumedQty?: number;
}

export interface RunningBatch {
  batchId: string;
  stage: 'Slitting' | 'Cutting' | 'Forming' | 'QC' | 'Packing' | string;
  machine: string;
  shift: 'DAY' | 'NIGHT' | string;
  startTime: string;
  endTime?: string;
  status: 'Running' | 'Held' | 'Completed' | string;
  reelNo?: string;
  reelNumbers?: string[];
  reelsSummary?: string;
  gsm?: string | number;
  gsmList?: (string | number)[];
  gsmsSummary?: string;
  issuedQty?: number;
  producedQty?: number;
  consumedQty?: number;
  pcsPerCrate?: number;
  producedPieces?: number;
  outputPieces?: number;
  loosePieces?: number;
  inputWeightKg?: number;
  outputWeightKg?: number;
  scrapKg?: number;
  scrapPercent?: number;
  scrapPcs?: number;
  scrapPieces?: number;
  rejectedPieces?: number;
  pcsPerKg?: number;
  grossPieces?: number;
  isHotFoilLayer?: boolean;
  isPrintedRoll?: boolean;
  printedRollDesign?: string;
  printedRollIcon?: string;
  worker: string;
  operator?: string;
  user: string;
  holdReason?: string;
  parentBatchId?: string;
  sourceLotId?: string;
  sourceOperator?: string;
  parentReelNo?: string;
  inputCrates?: number;
  inputPieces?: number;
  qcInspector?: string;
  qcAssignedCrates?: number;
  qcStatus?: 'Pending QC' | 'In Inspection' | 'Approved' | 'Rejected' | string;
  startMeterReading?: number;
  meterReading?: number;
  totalStrokes?: number;
  slices?: OperatorRunSlice[];
  helpers?: string[];
  helperCount?: number;
  motherReelsAllocated?: string[];
  glueBrand?: string;
  glueUsageKg?: number;
  glueEntries?: {
    id: string;
    qty?: number;
    quantityKg?: number;
    brand?: string;
    glueBrand?: string;
    time?: string;
    date?: string;
    operator?: string;
    [key: string]: any;
  }[];
  cuttingMaterialScrapKg?: number;
  layerType?: 'Plain' | 'Printed';
  layerSegmentGsm?: string | number;
}

export interface PlannedLayer {
  gsm: number | string;
  type: 'Plain' | 'Printed';
  requiredReels: number;
}

export interface JobReelItem {
  reelNo: string;
  rolls?: number;
  weightKg?: number;
  outputWeightKg?: number;
  scrapKg?: number;
  gsm?: string | number;
  paperBrand?: string;
  batchId?: string;
  startTime?: string;
  endTime?: string;
  worker?: string;
  isHotFoilLayer?: boolean;
  isPrintedRoll?: boolean;
  printedRollDesign?: string;
  printedRollIcon?: string;
  customRemark?: string;
  layerType?: 'Plain' | 'Printed';
  layerSegmentGsm?: string | number;
}

export interface Job {
  id: string;
  createdAt?: string;
  date?: string;
  product: ProductType;
  paperBrand?: string;
  reelNo?: string;
  reelNumbers?: string[];
  reelsList?: JobReelItem[];
  gsm?: string | number;
  gsmList?: (string | number)[];
  gsmsSummary?: string;
  customRemark?: string;
  stage: string;
  status?: string;
  availableRolls: number;
  availableCuttingCrates: number;
  totalCutCrates?: number;
  availableFormingCrates: number;
  availableForQcCrates?: number;
  availableQcCrates?: number;
  isReadyForQcInspection?: boolean;
  pcsPerCrateCutting?: number;
  pcsPerCrateForming?: number;
  totalCutPieces?: number;
  totalFormedPieces?: number;
  totalQcPieces?: number;
  cuttingLoosePcs?: number;
  formingLoosePcs?: number;
  qcLoosePcs?: number;
  cuttingScrapKg?: number;
  cuttingScrapPcs?: number;
  cuttingMaterialScrapKg?: number;
  cuttingRejectedPcs?: number;
  formingScrapPcs?: number;
  formingRejectedPcs?: number;
  glueUsageKg?: number;
  glueBrand?: string;
  glueEntries?: {
    id: string;
    qty?: number;
    quantityKg?: number;
    brand?: string;
    glueBrand?: string;
    time?: string;
    date?: string;
    operator?: string;
    [key: string]: any;
  }[];
  cuttingPcsPerKg?: number;
  inputWeightKg?: number;
  outputWeightKg?: number;
  scrapKg?: number;
  scrapPercent?: number;
  tracedLots?: Record<string, string>;
  runningBatches?: RunningBatch[];
  planId?: string;
  targetLayers?: number;
  targetGsm?: string;
  plannedGsms?: string[];
  plannedLayers?: PlannedLayer[];
  targetLengthMeters?: number;
  actualLengthMeters?: number;
  targetGlueBrand?: string;
  targetScrapLimitPct?: number;
  motherReelsAllocated?: string[];
  printedRollRequired?: boolean;
  printedRollDesign?: string;
  printedRollIcon?: string;
  printedLayersCount?: number;
  plainLayersCount?: number;
  isOpeningBalance?: boolean;
  lotId?: string;
  parentJobId?: string;
  isChildJob?: boolean;
  customerName?: string;
  childJobIds?: string[];
  isMultiCustomerSplit?: boolean;
  targetQuantity?: number;
}

export interface DispatchLog {
  invoiceNo: string;
  gtNo: string;
  boxes: number;
  pcs: number;
  date: string;
  user: string;
}

export interface HistoryRun {
  runId?: string;
  machine: string;
  shift?: 'DAY' | 'NIGHT' | string;
  boxes?: number;
  boxesPacked?: number;
  pcs?: number;
  date: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  worker: string;
  usedLots?: Record<string, string>;
  issuedRawMaterial?: string;
  issuedCrates?: Record<string, number>;
}

export interface PackJob {
  id: string;
  customer: string;
  packType: 'KIT' | 'INDIVIDUAL';
  orderQty: number;
  pcsPerBox: number;
  dispatchDate: string;
  kitItems: string[];
  kitType: string;
  status: string;
  packedBoxes: number;
  dispatchedBoxes: number;
  wrapping?: string;
  labeling?: string;
  remarks?: string;
  machine?: string;
  shift?: 'DAY' | 'NIGHT' | string;
  worker?: string;
  startTime?: string;
  endTime?: string;
  holdReason?: string;
  createdBy?: string;
  historyRuns?: HistoryRun[];
  dispatchLogs?: DispatchLog[];
  tracedLots?: Record<string, string>;
  issuedCrates?: Record<string, number>;
  slices?: OperatorRunSlice[];
  helpers?: string[];
  helperCount?: number;
  isOpeningBalance?: boolean;
  lotId?: string;
}

export interface LogEntry {
  jobId?: string;
  product?: string;
  stage: string;
  machine: string;
  station?: string;
  shift?: 'DAY' | 'NIGHT' | string;
  action: string;
  worker?: string;
  operator?: string;
  details?: string;
  user: string;
  startTime?: string;
  endTime?: string;
  date?: string;
  rawDate: string;
  timestamp: string;
}

export interface ScrapSale {
  id?: string;
  partyName?: string;
  weightKg?: number;
  ratePerKg?: number;
  totalAmount?: number;
  soldKg?: number;
  buyerNote?: string;
  date: string;
  time?: string;
  user: string;
}

export interface UserAccount {
  pass: string;
  perms: string[];
  name?: string;
  role?: string;
  phone?: string;
}

export interface ShiftConfig {
  dayStart: string;
  dayEnd: string;
  nightStart: string;
  nightEnd: string;
}

export interface NumberingEntityConfig {
  prefix: string;
  paddingDigits: number; // e.g. 2, 3, or 4
  nextSeq: number;
}

export interface NumberingSeriesMaster {
  jobSeries: NumberingEntityConfig;
  slitSeries: NumberingEntityConfig;
  cutSeries: NumberingEntityConfig;
  qcSeries: NumberingEntityConfig;
  useGlobalJobPrefix?: boolean;
}

export interface SeriesConfig {
  orderSeq: number;
  productSeqs: Record<string, number>;
  numberingMaster?: NumberingSeriesMaster;
}

export interface WhatsAppConfig {
  phone: string;
  apiKey: string;
  autoSend: boolean;
  lastSentKey?: string;
  webhookUrl?: string;
  customMessage?: string;
  dayShiftReportTime?: string;
  nightShiftReportTime?: string;
  autoSendShiftReportDay?: boolean;
  autoSendShiftReportNight?: boolean;
  lastSentDayDate?: string;
  lastSentNightDate?: string;
  // Multi-module automated triggers
  autoNotifyMaintenanceBreakdown?: boolean;
  autoNotifyCriticalQcDefect?: boolean;
  autoNotifyDispatchCompletion?: boolean;
  autoNotifyDailyManpower?: boolean;
  autoNotifyLowStockRequisition?: boolean;
  autoNotifyScrapSpike?: boolean;
  // Contact groups & recipients
  managementContacts?: Array<{ id: string; name: string; phone: string; role: string; dept?: string }>;
  // Module rights master: permissions for non-admin users (e.g. ['WA_SHIFT', 'WA_MAINTENANCE', 'WA_QC', 'WA_DISPATCH', 'WA_MANPOWER', 'WA_CONFIG'])
  userRights?: Record<string, string[]>;
  // Broadcast log history
  dispatchLogs?: Array<{
    id: string;
    timestamp: string;
    category: string;
    recipient: string;
    sender: string;
    preview: string;
    status: 'SENT' | 'FAILED' | 'OPENED';
  }>;
}

export interface SparePartItem {
  id?: string;
  name: string;
  qty: number;
  unit?: string;
  cost?: number;
  notes?: string;
  category?: string;
}

export interface MaintenanceContact {
  id: string;
  name: string;
  phone: string;
  role: string;
  dept?: string;
}

export interface MaintenanceIncident {
  id: string; // e.g. "MNT-001"
  machine: string;
  stage: string;
  reason: string;
  issue?: string;
  description?: string;
  reportedBy: string;
  maintenancePhone?: string;
  priority?: 'Normal' | 'Urgent' | 'Critical';
  machineStatus?: 'Operational' | 'Down' | 'Critical';
  deptHeadsNotified?: boolean;
  deptHeadsNotifiedAt?: string;
  notifiedHeadsList?: string[];
  status: 'OPEN' | 'IN_PROGRESS' | 'REPAIRED_READY' | 'ACKNOWLEDGED';
  breakdownStartTime: string; // ISO string
  breakdownDate: string; // YYYY-MM-DD
  repairStartTime?: string;
  repairedAt?: string; // ISO string
  breakdownStopTime?: string; // ISO string
  acknowledgedAt?: string; // ISO string
  totalDowntimeMinutes?: number;
  technicianName?: string;
  attendedBy?: string;
  attendingStartedAt?: string;
  responseTimeMinutes?: number;
  repairDurationMinutes?: number;
  technicianRemarks?: string;
  actionTaken?: string;
  spareParts?: SparePartItem[];
  whatsAppAlertSent?: boolean;
}

export interface MachineReadyAlert {
  incidentId: string;
  machine: string;
  technician: string;
  repairedAt: string;
  actionTaken: string;
  sparePartsSummary: string;
  downtimeMinutes: number;
  active: boolean;
}

export interface CustomerComplaint {
  id: string;
  orderId?: string;
  invoiceNo?: string;
  customer: string;
  boxBarcode?: string;
  defectType: string;
  defectStage: 'Raw Material' | 'Slitting' | 'Cutting' | 'Forming' | 'QC' | 'Packing' | 'Dispatch';
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  description: string;
  rootCauseAnalysis?: string;
  capaAction?: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  reportedDate: string;
  resolvedDate?: string;
  actionTakenBy?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string; // ISO String
  userId: string;
  action: string; // e.g., 'SUB_LOT_FORWARD'
  stage: string;
  machine: string;
  payload: Record<string, any>; // Snapshot of critical parameters
  complianceReference: '21-CFR-P11' | 'GPCB' | 'DISH' | 'INTERNAL';
}

export interface DeletedVaultItem {
  id: string;
  originalId: string;
  type: 'JOB' | 'PLAN' | 'SHIFT_HANDOVER' | 'LOG' | 'ORDER';
  title: string;
  deletedBy: string;
  deletedAt: string;
  data: any;
}

export interface WipLot {
  id: string; // e.g. "LOT-CUT-001"
  jobId: string;
  product: string;
  stage: 'Slitting' | 'Cutting' | 'Forming' | 'QC';
  producedQty: number; // e.g. crates or rolls
  consumedQty: number; // quantity taken by next stage
  remainingQty: number; // producedQty - consumedQty
  piecesPerCrate?: number;
  totalPieces?: number;
  producedByOperator: string;
  machine: string;
  shift: string;
  timestamp: string;
  parentLotId?: string; // Hard-link to the previous stage lot
  isQcApproved?: boolean;
  sourceOperator?: string;
  sourceLotId?: string;
}

export interface FactoryState {
  lastResetTimestamp?: number;
  deletedJobIds?: string[];
  deletedOrderIds?: string[];
  deletedLogIds?: string[];
  deletedPlanIds?: string[];
  deletedWorkerIds?: string[];
  deletedVaultItems?: DeletedVaultItem[];
  jobs: Job[];
  wipLots?: WipLot[]; // New ERP Lot Ledger
  logs: LogEntry[];
  auditLogs?: AuditLog[]; // Immutable compliance ledger
  packJobs: PackJob[];
  scrapSales: ScrapSale[];
  users: Record<string, UserAccount>;
  deptWorkers?: Record<string, string[]>;
  seriesConfig: SeriesConfig;
  whatsappConfig: WhatsAppConfig;
  shiftConfig: ShiftConfig;
  adminPassword?: string;
  brandLogoBase64?: string;
  maintenanceIncidents?: MaintenanceIncident[];
  machineReadyAlerts?: MachineReadyAlert[];
  maintenanceContacts?: MaintenanceContact[];
  customerComplaints?: CustomerComplaint[];
  materialRequisitions?: MaterialRequisition[];
  products?: string[];
  paperBrands?: string[];
  productPrefixMap?: Record<string, string>;
  machinesMaster?: Record<string, string[]>;
  pcsPerKgMaster?: Record<string, number>;
  maintenanceTechniciansMaster?: string[];
  maintenanceSparePartsMaster?: string[];
  maintenancePauseReasonsMaster?: string[];
  maintenanceBreakdownReasonsMaster?: Record<string, string[]>;
  maxPiecesPerSlitRoll?: number;
  strictAuditRollYield?: boolean;
  maintenanceRightsMaster?: Record<string, string[]>;
  autoNotifyDeptHeadsOnCritical?: boolean;
  departmentHeads?: MaintenanceContact[];
  crateCapacityMaster?: Record<string, ProductCrateCapacity>;
  archivedJobs?: Job[];
  archivedLogs?: LogEntry[];
  lastBackupDate?: string;
  floorWorkers?: FloorWorker[];
  glueBrands?: string[];
  targetLayersMaster?: number[];
  targetGsmMaster?: string[];
  scrapLimitsMaster?: Record<string, number>;
  scrapToleranceKgMaster?: number[];
  glueUsageLogs?: GlueUsageEntry[];
  productionPlans?: ProductionPlan[];
  motherReelInventory?: MotherReelItem[];
  shiftHandovers?: ShiftHandoverRecord[];
  coordinationMatrix?: CoordinationMatrixItem[];
}

export interface CoordinationMatrixItem {
  id: string;
  roleName: string; // e.g. "Maintenance Head", "Electrical Breakdown Head", etc.
  contactName: string;
  phone: string; // e.g. "+91..."
  alertCategories: {
    machineBreakdown: boolean;
    electricalAlert: boolean;
    productionHandover: boolean;
    materialIndent: boolean;
    qcFailure: boolean;
  };
  isActive: boolean;
}

export interface ProductionPlan {
  printedLayersCount?: number;
  plainLayersCount?: number;
  id: string; // e.g. "PLAN-2026-001"
  jobId: string; // e.g. "JOB-2026-001"
  product: ProductType;
  targetLayers: number; // e.g. 4, 6, 8
  targetLengthMeters: number; // in Meters
  adhesiveBrand: string; // e.g. "Fevicol", "Henkel", etc.
  targetScrapLimitPct: number; // e.g. 2.5%
  targetScrapLimitKg?: number;
  assignedMachine: string; // e.g. "Slitting-1"
  assignedShift: 'DAY' | 'NIGHT';
  plannedDate: string; // YYYY-MM-DD
  targetQuantity?: number;
  paperBrand?: string;
  targetGsm?: string;
  plannedGsms?: string[];
  plannedLayers?: PlannedLayer[];
  notes?: string;
  status: 'Scheduled' | 'In-Progress' | 'Completed' | 'Cancelled';
  createdAt: string;
  printedRollRequired?: boolean;
  printedRollDesign?: string;
  printedRollIcon?: string;
  actualLayersUsed?: number;
  actualMetersSlit?: number;
  actualScrapKg?: number;
  actualScrapPct?: number;
  actualGlueConsumedKg?: number;
  isMultiCustomerSplit?: boolean;
  customerAllocations?: { customerName: string; allocatedQty: number; childJobId?: string }[];
}

export interface MotherReelItem {
  id: string; // e.g. "M-REEL-ITC-001"
  brand: string; // e.g. "ITC", "Bilt"
  gsm: string | number;
  weightKg: number;
  lengthMeters?: number;
  status: 'Available' | 'In-Use' | 'Consumed';
  allocatedJobId?: string;
  allocatedDate?: string;
}

export interface ShiftHandoverRecord {
  id: string; // e.g. "HO-2026-001"
  timestamp: string;
  date: string;
  jobId?: string;
  batchId?: string;
  department: 'Slitting' | 'Cutting' | 'Forming' | 'QC' | 'Packing' | string;
  machine: string;
  outgoingOperator: string;
  relievedByOperator: string;
  currentShift: 'DAY' | 'NIGHT' | string;
  nextShift: 'DAY' | 'NIGHT' | string;
  meterReading?: number;
  producedQty: number; // units/crates/rolls
  producedPieces?: number;
  scrapQty: number; // scrap kg or defect pcs
  checklistPassed?: boolean;
  technicalChecklist?: Record<string, boolean | string | number>;
  notes?: string;
  helpers?: string[];
}

export interface GlueUsageEntry {
  id: string; // e.g. "GLUE-2026-001"
  date: string; // YYYY-MM-DD
  time: string; // HH:MM AM/PM
  shift: 'DAY' | 'NIGHT' | string;
  machine: string; // e.g. "Cutting-1"
  stage: 'Cutting' | 'Forming' | 'Slitting' | 'Packing' | string;
  jobId?: string;
  batchId?: string;
  product?: string;
  glueBrand: string; // Selected from glueBrands master
  quantityKg: number; // e.g. 5.5 kg or litres
  operator: string;
  lotOrDrumNo?: string;
  notes?: string;
  user: string;
  createdAt?: string;
}

export type WorkforceRole = 'OPERATOR' | 'HELPER' | 'SUPERVISOR' | 'MAINTENANCE' | 'QC_INSPECTOR' | 'MANAGER' | 'EXECUTIVE' | 'TECHNICIAN';

export interface FloorWorker {
  id: string;
  name: string;
  staffId?: string;
  designation?: string;
  role: WorkforceRole;
  department: 'Slitting' | 'Cutting' | 'Forming' | 'QC' | 'Packing' | 'Maintenance' | 'Admin' | 'Production' | 'Housekeeping' | 'Printing' | 'HR' | string;
  assignedMachine?: string; // e.g. "Cutting-1"
  pairedWithOperator?: string; // If role is HELPER, which operator they assist
  shift: 'DAY' | 'NIGHT' | string;
  isPresent: boolean;
  shiftStatus?: 'PRESENT' | 'ON_LEAVE' | 'ABSENT';
  inTime?: string;
  notes?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'PRODUCING' | string;
}

export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: Array<{
    web?: {
      uri: string;
      title: string;
    };
  }>;
  groundingSupports?: Array<{
    groundingChunkIndices?: number[];
    segment?: {
      startIndex?: number;
      endIndex?: number;
      text?: string;
    };
  }>;
}
