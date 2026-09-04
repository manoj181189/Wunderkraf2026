export type ProductType = 'Spoon' | 'Fork' | 'Knife' | 'Dessert Spoon';

export type CurrentView =
  | 'HUB'
  | 'DASHBOARD'
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
  | 'SEARCH'
  | 'AUDIT'
  | 'ADMIN'
  | 'MAINTENANCE'
  | 'PURCHASE';

export type MaterialUrgency = 'CRITICAL_BREAKDOWN' | 'URGENT' | 'NORMAL' | 'LOW';

export type MaterialRequisitionStatus =
  | 'PENDING'       // Submitted by department, awaiting purchase review
  | 'PO_ISSUED'     // Purchase order issued / ordered from vendor
  | 'RECEIVED'      // Arrived at factory store / माल आ गया है
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

  // Goods Receiving fields (जब माल आ जाए)
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

export interface RunningBatch {
  batchId: string;
  stage: 'Slitting' | 'Cutting' | 'Forming' | 'QC' | 'Packing' | string;
  machine: string;
  shift: 'DAY' | 'NIGHT' | string;
  startTime: string;
  endTime?: string;
  status: 'Running' | 'Held' | 'Completed' | string;
  issuedQty?: number;
  producedQty?: number;
  outputWeightKg?: number;
  scrapKg?: number;
  scrapPcs?: number;
  worker: string;
  user: string;
  holdReason?: string;
}

export interface Job {
  id: string;
  product: ProductType;
  paperBrand?: string;
  customRemark?: string;
  stage: string;
  availableRolls: number;
  availableCuttingCrates: number;
  availableFormingCrates: number;
  availableQcCrates: number;
  runningBatches?: RunningBatch[];
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
}

export interface LogEntry {
  jobId?: string;
  product?: string;
  stage: string;
  machine: string;
  shift?: 'DAY' | 'NIGHT' | string;
  action: string;
  worker?: string;
  user: string;
  startTime?: string;
  endTime?: string;
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

export interface SeriesConfig {
  orderSeq: number;
  productSeqs: Record<ProductType, number>;
}

export interface WhatsAppConfig {
  phone: string;
  apiKey: string;
  autoSend: boolean;
  lastSentKey?: string;
  webhookUrl?: string;
  customMessage?: string;
}

export interface SparePartItem {
  id?: string;
  name: string;
  qty: number;
  unit?: string;
  cost?: number;
  notes?: string;
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
  description?: string;
  reportedBy: string;
  maintenancePhone?: string;
  priority?: 'Normal' | 'Urgent' | 'Critical';
  status: 'OPEN' | 'IN_PROGRESS' | 'REPAIRED_READY' | 'ACKNOWLEDGED';
  breakdownStartTime: string; // ISO string
  breakdownDate: string; // YYYY-MM-DD
  repairStartTime?: string;
  repairedAt?: string; // ISO string
  acknowledgedAt?: string; // ISO string
  totalDowntimeMinutes?: number;
  technicianName?: string;
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

export interface FactoryState {
  jobs: Job[];
  logs: LogEntry[];
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
