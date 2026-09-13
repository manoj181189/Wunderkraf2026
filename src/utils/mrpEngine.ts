import {
  InventoryItem,
  BomDefinition,
  ProductionOrder,
  PurchaseOrder,
  MrpRequirement,
  MrpRunSummary,
} from '../types/mrp';

/**
 * Calculates date offset by minus lead time days
 */
export function subtractDays(dateStr: string, days: number): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

/**
 * Executes full multi-level MRP BOM explosion and netting against inventory & incoming orders
 */
export function runMrpCalculation(
  orders: ProductionOrder[],
  boms: BomDefinition[],
  inventory: InventoryItem[],
  existingPOs: PurchaseOrder[]
): { requirements: MrpRequirement[]; summary: MrpRunSummary } {
  // Map inventory by SKU for fast lookup
  const invMap = new Map<string, InventoryItem>();
  inventory.forEach((item) => invMap.set(item.sku, item));

  // Map BOM by product SKU
  const bomMap = new Map<string, BomDefinition>();
  boms.forEach((bom) => bomMap.set(bom.productSku, bom));

  // Structure to aggregate gross requirements across all demand
  interface DemandEntry {
    itemSku: string;
    grossQty: number;
    sourceOrders: { code: string; dueDate: string }[];
  }
  const demandMap = new Map<string, DemandEntry>();

  const addDemand = (sku: string, qty: number, orderCode: string, dueDate: string) => {
    const existing = demandMap.get(sku) || {
      itemSku: sku,
      grossQty: 0,
      sourceOrders: [],
    };
    existing.grossQty += qty;
    if (!existing.sourceOrders.some((o) => o.code === orderCode)) {
      existing.sourceOrders.push({ code: orderCode, dueDate });
    }
    demandMap.set(sku, existing);
  };

  // Helper function to recursively explode BOM
  const explodeNode = (parentSku: string, multiplierQty: number, orderCode: string, dueDate: string) => {
    const bom = bomMap.get(parentSku);
    if (!bom) return;

    for (const comp of bom.components) {
      const compGross = multiplierQty * comp.quantityPerParent * (1 + comp.scrapFactor);
      addDemand(comp.componentSku, compGross, orderCode, dueDate);

      // If this child component is also a sub-assembly that has its own BOM, explode down
      if (bomMap.has(comp.componentSku)) {
        explodeNode(comp.componentSku, compGross, orderCode, dueDate);
      }
    }
  };

  // 1. Process active/planned production orders (exclude completed & cancelled)
  const activeOrders = orders.filter((o) => o.status !== 'completed');
  let totalFinishedDemand = 0;

  for (const ord of activeOrders) {
    totalFinishedDemand += ord.quantity;
    // Add finished good demand itself
    addDemand(ord.productSku, ord.quantity, ord.code, ord.dueDate);
    // Explode components
    explodeNode(ord.productSku, ord.quantity, ord.code, ord.dueDate);
  }

  // Calculate actual open POs quantity per item
  const poQtyMap = new Map<string, number>();
  existingPOs
    .filter((po) => po.status === 'issued' || po.status === 'in_transit')
    .forEach((po) => {
      po.items.forEach((item) => {
        poQtyMap.set(item.itemSku, (poQtyMap.get(item.itemSku) || 0) + item.quantity);
      });
    });

  // 2. Netting calculations
  const requirements: MrpRequirement[] = [];
  let itemsWithDeficit = 0;
  let totalProcurementCost = 0;
  let criticalAlerts = 0;

  const today = new Date().toISOString().split('T')[0];

  demandMap.forEach((entry, sku) => {
    const inv = invMap.get(sku);
    if (!inv) return;

    // Available stock = on hand - allocated to currently active work
    const availableStock = Math.max(0, inv.onHand - inv.allocated);
    // On order from active purchase orders
    const onOrder = poQtyMap.get(sku) ?? inv.onOrder;

    // Net Deficit = Gross - Available - OnOrder + SafetyStock
    const rawDeficit = entry.grossQty - availableStock - onOrder + inv.safetyStock;
    const netDeficit = Math.max(0, Number(rawDeficit.toFixed(2)));

    // Find earliest need-by date
    let earliestNeedDate = '2099-12-31';
    entry.sourceOrders.forEach((o) => {
      if (o.dueDate < earliestNeedDate) {
        earliestNeedDate = o.dueDate;
      }
    });
    if (earliestNeedDate === '2099-12-31') earliestNeedDate = today;

    const orderReleaseDate = subtractDays(earliestNeedDate, inv.leadTimeDays);

    let recommendedAction: 'BUY' | 'BUILD' | 'OK' = 'OK';
    if (netDeficit > 0) {
      if (inv.category === 'finished_good' || inv.category === 'sub_assembly') {
        recommendedAction = 'BUILD';
      } else {
        recommendedAction = 'BUY';
      }
      itemsWithDeficit++;
      totalProcurementCost += netDeficit * inv.unitCost;

      // Check if release date is already in past or dangerously close
      if (orderReleaseDate <= today) {
        criticalAlerts++;
      }
    }

    requirements.push({
      itemSku: sku,
      itemName: inv.name,
      category: inv.category,
      unit: inv.unit,
      unitCost: inv.unitCost,
      grossRequirement: Number(entry.grossQty.toFixed(2)),
      currentOnHand: inv.onHand,
      allocated: inv.allocated,
      availableStock,
      onOrder,
      safetyStock: inv.safetyStock,
      netDeficit,
      leadTimeDays: inv.leadTimeDays,
      recommendedAction,
      recommendedOrderQty: Math.ceil(netDeficit),
      orderReleaseDate,
      needByDate: earliestNeedDate,
      sourceOrders: entry.sourceOrders.map((o) => o.code),
      estimatedCost: Number((Math.ceil(netDeficit) * inv.unitCost).toFixed(2)),
      supplier: inv.defaultSupplier,
    });
  });

  // Sort requirements: Deficits first, then by earliest order release date
  requirements.sort((a, b) => {
    if (a.netDeficit > 0 && b.netDeficit <= 0) return -1;
    if (a.netDeficit <= 0 && b.netDeficit > 0) return 1;
    return a.orderReleaseDate.localeCompare(b.orderReleaseDate);
  });

  const summary: MrpRunSummary = {
    runId: `MRP-${Date.now().toString().slice(-6)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    totalFinishedGoodsDemand: totalFinishedDemand,
    totalComponentsEvaluated: requirements.length,
    itemsWithDeficit,
    totalProcurementCost: Number(totalProcurementCost.toFixed(2)),
    criticalLeadTimeAlerts: criticalAlerts,
  };

  return { requirements, summary };
}

/**
 * Groups BUY recommendations by supplier and generates formal purchase orders
 */
export function createPurchaseOrdersFromMrp(
  deficits: MrpRequirement[],
  currentPOsCount: number
): PurchaseOrder[] {
  const buyItems = deficits.filter((d) => d.recommendedAction === 'BUY' && d.recommendedOrderQty > 0);
  
  // Group by supplier
  const supplierGroups = new Map<string, MrpRequirement[]>();
  for (const item of buyItems) {
    const list = supplierGroups.get(item.supplier) || [];
    list.push(item);
    supplierGroups.set(item.supplier, list);
  }

  const today = new Date().toISOString().split('T')[0];
  const newPOs: PurchaseOrder[] = [];
  let index = currentPOsCount + 1;

  supplierGroups.forEach((items, supplier) => {
    const poNumber = `PO-2026-${String(index).padStart(3, '0')}`;
    index++;

    // Expected delivery is today + max lead time
    const maxLead = Math.max(...items.map((i) => i.leadTimeDays));
    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + maxLead);
    const expectedStr = expectedDelivery.toISOString().split('T')[0];

    let total = 0;
    const poItems = items.map((i) => {
      const lineCost = i.recommendedOrderQty * i.unitCost;
      total += lineCost;
      return {
        itemSku: i.itemSku,
        itemName: i.itemName,
        quantity: i.recommendedOrderQty,
        unitCost: i.unitCost,
        unit: i.unit,
      };
    });

    newPOs.push({
      id: `po-gen-${Date.now()}-${index}`,
      poNumber,
      supplierName: supplier,
      status: 'issued',
      orderDate: today,
      expectedDeliveryDate: expectedStr,
      items: poItems,
      totalAmount: Number(total.toFixed(2)),
    });
  });

  return newPOs;
}
