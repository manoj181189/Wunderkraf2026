export type ItemCategory = 
  | 'finished_good'
  | 'sub_assembly'
  | 'raw_material'
  | 'hardware'
  | 'electronic';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: ItemCategory;
  unit: string; // 'pcs', 'kg', 'm', 'board_ft', 'sheets', 'liters'
  onHand: number;
  allocated: number;
  onOrder: number;
  safetyStock: number;
  reorderPoint: number;
  leadTimeDays: number;
  unitCost: number;
  defaultSupplier: string;
  location: string;
  minOrderQty?: number;
}

export interface BomComponent {
  componentSku: string;
  quantityPerParent: number;
  scrapFactor: number; // e.g., 0.05 for 5% scrap
  level: number; // 1 for direct child, 2 for grandchild, etc.
  notes?: string;
}

export interface BomDefinition {
  id: string;
  productSku: string;
  name: string;
  version: string;
  status: 'active' | 'draft' | 'obsolete';
  components: BomComponent[];
  laborHoursEstimate: number;
  laborRatePerHour: number;
  targetMSRP: number;
  description: string;
}

export interface RoutingStep {
  id: string;
  workCenterId: string;
  name: string;
  estimatedHours: number;
  status: 'pending' | 'active' | 'completed';
}

export interface WorkCenter {
  id: string;
  name: string;
  code: string;
  category: string;
  weeklyCapacityHours: number;
  assignedTechnicians: number;
  hourlyMachineRate: number;
}

export interface ProductionOrder {
  id: string;
  code: string;
  productSku: string;
  quantity: number;
  status: 'planned' | 'released' | 'in_progress' | 'completed' | 'on_hold';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  startDate: string;
  dueDate: string;
  customerName?: string;
  progressPercent: number;
  routing: RoutingStep[];
}

export interface PurchaseOrderItem {
  itemSku: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  unit: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierName: string;
  status: 'draft' | 'issued' | 'in_transit' | 'received' | 'cancelled';
  orderDate: string;
  expectedDeliveryDate: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  linkedMrpRunId?: string;
}

export interface MrpRequirement {
  itemSku: string;
  itemName: string;
  category: ItemCategory;
  unit: string;
  unitCost: number;
  grossRequirement: number;
  currentOnHand: number;
  allocated: number;
  availableStock: number; // onHand - allocated
  onOrder: number;
  safetyStock: number;
  netDeficit: number; // gross - availableStock - onOrder + safetyStock
  leadTimeDays: number;
  recommendedAction: 'BUY' | 'BUILD' | 'OK';
  recommendedOrderQty: number;
  orderReleaseDate: string;
  needByDate: string;
  sourceOrders: string[]; // PO numbers requesting this
  estimatedCost: number;
  supplier: string;
}

export interface MrpRunSummary {
  runId: string;
  timestamp: string;
  totalFinishedGoodsDemand: number;
  totalComponentsEvaluated: number;
  itemsWithDeficit: number;
  totalProcurementCost: number;
  criticalLeadTimeAlerts: number;
}
