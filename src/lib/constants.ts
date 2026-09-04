import { FactoryState, ProductType, CustomerComplaint, MaterialRequisition } from '../types';

export const PRODUCTS: ProductType[] = ['Spoon', 'Fork', 'Knife', 'Dessert Spoon'];

export const LOCAL_STORAGE_KEY = 'wunderkraf_erp_state_v1';

export const PRODUCT_PREFIX_MAP: Record<ProductType, string> = {
  'Spoon': 'SPN',
  'Fork': 'FRK',
  'Knife': 'KNF',
  'Dessert Spoon': 'DSP'
};

export const MACHINES = {
  'Slitting': ['Slitting-1'],
  'Cutting': ['Cutting-1', 'Cutting-2'],
  'Forming': ['Forming-1', 'Forming-2', 'Forming-3', 'Forming-4', 'Forming-5', 'Forming-6', 'Forming-7'],
  'QC': ['QC-Desk'],
  'Packing': ['Packing-1', 'Packing-2', 'Manual-1', 'Manual-2', 'Manual-3']
};

export const ALL_MACHINES_LIST = [
  'Slitting-1',
  'Cutting-1',
  'Cutting-2',
  'Forming-1',
  'Forming-2',
  'Forming-3',
  'Forming-4',
  'Forming-5',
  'Forming-6',
  'Forming-7',
  'QC-Desk',
  'Packing-1',
  'Packing-2',
  'Manual-1',
  'Manual-2',
  'Manual-3'
];

export const DEPT_WORKERS: Record<string, string[]> = {
  'Slitting': ['RAMESH_SLIT', 'SURESH_SLIT', 'DINESH_SLIT'],
  'Cutting': ['CUT_OP1', 'CUT_OP2', 'VIKRAM_CUT'],
  'Forming': ['FORM_OP1', 'FORM_OP2', 'FORM_OP3', 'RAHUL_FORM', 'KISHORE_FORM'],
  'QC': ['QC_RAMESH', 'QC_DINESH', 'QC_ANIL'],
  'Packing': ['PACK_SURESH', 'PACK_MAHESH', 'PACK_SUNIL']
};

export const PAPER_BRANDS = ['ITC', 'CENTURY', 'JK PAPER', 'WEST COAST', 'EMAMI', 'APP (ASIA PULP)'];

export const DEFAULT_USERS = {
  'admin': { pass: 'admin123', perms: ['Admin', 'Marketing', 'Dispatch', 'Slitting', 'Cutting', 'Forming', 'QC', 'Packing', 'Maintenance', 'Purchase'] },
  'purchase': { pass: 'pur123', perms: ['Purchase'] },
  'marketing': { pass: 'mkt123', perms: ['Marketing'] },
  'disp_user': { pass: 'disp123', perms: ['Dispatch'] },
  'slit_user': { pass: 'slit123', perms: ['Slitting'] },
  'cut_user': { pass: 'cut123', perms: ['Cutting'] },
  'form_user': { pass: 'form123', perms: ['Forming'] },
  'qc_user': { pass: 'qc123', perms: ['QC'] },
  'pack_user': { pass: 'pack123', perms: ['Packing'] },
  'maint_user': { pass: 'maint123', perms: ['Maintenance'] }
};

export const DEFAULT_MAINTENANCE_CONTACTS = [
  { id: 'MC-1', name: 'Ramesh Sharma (Head Mech)', phone: '+91 98250 12345', role: 'Mechanical & Tooling', dept: 'Mechanical' },
  { id: 'MC-2', name: 'Kishan Patel (Sr. Electrical)', phone: '+91 98251 67890', role: 'Heater & PLC Sensors', dept: 'Electrical' },
  { id: 'MC-3', name: 'Dinesh Varma (Pneumatics)', phone: '+91 98252 54321', role: 'Hydraulic & Air Pressure', dept: 'Pneumatic' }
];

export const COMMON_SPARE_PARTS = [
  'Band Heater Element 1500W',
  'Thermocouple K-Type Sensor',
  'Digital PID Temp Controller',
  'Proximity Inductive Sensor M12',
  'High-Speed Cutting Blade Sharpened',
  'Teflon High-Temp Tape 1 inch',
  'Pneumatic Cylinder Seal Kit 63mm',
  'Timing Belt 5PK Heavy Duty',
  'Micro Limit Switch Roller Arm',
  'Silicon Rubber Sponge Strip 10mm'
];

export const DEFAULT_CUSTOMER_COMPLAINTS: CustomerComplaint[] = [
  {
    id: 'CMP-2026-001',
    orderId: 'ORD-001',
    invoiceNo: 'INV-2026-001',
    customer: 'AIR INDIA CATERING',
    boxBarcode: 'BOX-ORD001-B07',
    defectType: 'Tip Cracking / Weak Edge',
    defectStage: 'Forming',
    severity: 'MAJOR',
    description: 'Passenger flight tray batch had 12 spoons with hairline edge crack upon soup serving.',
    rootCauseAnalysis: 'Traced back to Job SPN-001 Forming Machine-1 run at 11:15 AM. Mould temperature dipped to 142°C (target 160°C) causing improper binder curing.',
    capaAction: 'Recalibrated PID temperature controller on Forming-1 and updated QC desk checklist to check bend rigidity.',
    status: 'RESOLVED',
    reportedDate: '2026-09-02',
    resolvedDate: '2026-09-02',
    actionTakenBy: 'QC_RAMESH & Plant Head'
  }
];

export const DEFAULT_MATERIAL_CATEGORIES = [
  'Spare Parts & Machine Tooling',
  'Raw Material (Paper Reels)',
  'Packaging & Cartons',
  'Electrical & Sensors',
  'Lubricants & Consumables',
  'Safety & PPE',
  'Workshop Tools',
  'General Utility'
];

export const DEFAULT_MATERIAL_REQUISITIONS: MaterialRequisition[] = [
  {
    id: 'MR-2026-001',
    department: 'Maintenance',
    itemCategory: 'Spare Parts & Machine Tooling',
    itemName: 'Band Heater Element 1500W',
    itemCodeOrPartNo: 'HTR-1500W-M1',
    quantity: 4,
    unit: 'Pcs',
    urgency: 'CRITICAL_BREAKDOWN',
    machineOrPurpose: 'Forming Machine-2 Upper Mould',
    requestedBy: 'Ramesh Sharma (Head Mech)',
    requestedDate: '2026-09-02',
    requestedTime: '09:30 AM',
    remarks: 'Emergency spare stock depleted during repair',
    status: 'RECEIVED',
    vendorName: 'Shreeji Electricals & Heaters',
    poNumber: 'PO-2026-101',
    poDate: '2026-09-02',
    expectedDeliveryDate: '2026-09-02',
    estimatedCost: 3200,
    actualCost: 3200,
    receivedDate: '2026-09-02',
    receivedTime: '04:15 PM',
    receivedQty: 4,
    grnOrBillNo: 'GRN-2026-088',
    receivedBy: 'Store Manager',
    storageLocationOrBin: 'Maintenance Store Rack B2',
    acknowledgedByRequester: true,
    acknowledgedDate: '2026-09-02'
  },
  {
    id: 'MR-2026-002',
    department: 'Packing',
    itemCategory: 'Packaging & Cartons',
    itemName: 'BOPP 2-inch Brown Packing Tape (65 Micron)',
    itemCodeOrPartNo: 'PKG-TAPE-BR2',
    quantity: 36,
    unit: 'Rolls',
    urgency: 'URGENT',
    machineOrPurpose: 'Packing Station 1 & 2 Shipper Boxing',
    requestedBy: 'PACK_SURESH',
    requestedDate: '2026-09-02',
    requestedTime: '11:00 AM',
    remarks: 'For Air India export master boxes sealing',
    status: 'PO_ISSUED',
    vendorName: 'Apex Packaging Industries',
    poNumber: 'PO-2026-104',
    poDate: '2026-09-02',
    expectedDeliveryDate: '2026-09-04',
    estimatedCost: 2700,
    purchaseNotes: 'Dispatch promised tomorrow morning 10 AM by vendor'
  },
  {
    id: 'MR-2026-003',
    department: 'Cutting',
    itemCategory: 'Spare Parts & Machine Tooling',
    itemName: 'High-Speed Punch Cutting Blade Set (Spoon Die)',
    itemCodeOrPartNo: 'BLD-SPN-CR60',
    quantity: 2,
    unit: 'Set',
    urgency: 'NORMAL',
    machineOrPurpose: 'Cutting-1 Die Punching',
    requestedBy: 'CUT_OP1',
    requestedDate: '2026-09-03',
    requestedTime: '08:15 AM',
    remarks: 'Required for scheduled die regrinding rotation next Monday',
    status: 'PENDING'
  },
  {
    id: 'MR-2026-004',
    department: 'Slitting',
    itemCategory: 'Lubricants & Consumables',
    itemName: 'Food-Grade Machine Lubricant Grease (FG-2)',
    itemCodeOrPartNo: 'LUB-FG2-SYN',
    quantity: 5,
    unit: 'KG',
    urgency: 'NORMAL',
    machineOrPurpose: 'Slitting-1 Roller Bearings & Gearbox',
    requestedBy: 'RAMESH_SLIT',
    requestedDate: '2026-09-03',
    requestedTime: '09:00 AM',
    remarks: 'Monthly scheduled preventive lubrication',
    status: 'RECEIVED',
    vendorName: 'Total Lubricants India',
    poNumber: 'PO-2026-102',
    poDate: '2026-09-03',
    expectedDeliveryDate: '2026-09-03',
    estimatedCost: 4500,
    actualCost: 4500,
    receivedDate: '2026-09-03',
    receivedTime: '02:30 PM',
    receivedQty: 5,
    grnOrBillNo: 'GRN-2026-091',
    receivedBy: 'Store Incharge',
    storageLocationOrBin: 'Chemical Store Locker #3',
    acknowledgedByRequester: false
  }
];

export const INITIAL_STATE: FactoryState = {
  jobs: [
    {
      id: 'SPN-001',
      product: 'Spoon',
      paperBrand: 'ITC',
      customRemark: 'Export Heavy GSM 280',
      stage: 'QC Completed',
      availableRolls: 4,
      availableCuttingCrates: 2,
      availableFormingCrates: 1,
      availableQcCrates: 6,
      runningBatches: [
        {
          batchId: 'B-1011',
          stage: 'Forming',
          machine: 'Forming-1',
          shift: 'DAY',
          startTime: '09:00 AM',
          status: 'Running',
          issuedQty: 2,
          producedQty: 0,
          worker: 'FORM_OP1',
          user: 'form_user'
        }
      ]
    },
    {
      id: 'FRK-001',
      product: 'Fork',
      paperBrand: 'CENTURY',
      customRemark: 'Standard 240 GSM',
      stage: 'Cutting Completed',
      availableRolls: 3,
      availableCuttingCrates: 4,
      availableFormingCrates: 2,
      availableQcCrates: 5,
      runningBatches: [
        {
          batchId: 'B-1022',
          stage: 'Cutting',
          machine: 'Cutting-1',
          shift: 'DAY',
          startTime: '08:45 AM',
          status: 'Running',
          issuedQty: 2,
          producedQty: 0,
          worker: 'CUT_OP1',
          user: 'cut_user'
        }
      ]
    },
    {
      id: 'KNF-001',
      product: 'Knife',
      paperBrand: 'JK PAPER',
      customRemark: 'Reinforced Edge 300 GSM',
      stage: 'Slitting Completed',
      availableRolls: 6,
      availableCuttingCrates: 3,
      availableFormingCrates: 0,
      availableQcCrates: 4,
      runningBatches: []
    },
    {
      id: 'DSP-001',
      product: 'Dessert Spoon',
      paperBrand: 'ITC',
      customRemark: 'Ice cream mini spoon',
      stage: 'QC Completed',
      availableRolls: 2,
      availableCuttingCrates: 1,
      availableFormingCrates: 0,
      availableQcCrates: 3,
      runningBatches: []
    }
  ],
  packJobs: [
    {
      id: 'ORD-001',
      customer: 'AIR INDIA CATERING',
      packType: 'KIT',
      orderQty: 25000,
      pcsPerBox: 500,
      dispatchDate: '2026-09-10',
      kitItems: ['Tissue', 'Spoon', 'Fork'],
      kitType: '3-in-1 Kit (Tissue, Spoon, Fork)',
      status: 'Partially Packed',
      packedBoxes: 28,
      dispatchedBoxes: 10,
      wrapping: 'YES',
      labeling: 'YES',
      remarks: 'Flight export grade sealed packing',
      createdBy: 'marketing',
      tracedLots: { 'Spoon': 'SPN-001 (4 Crates)', 'Fork': 'FRK-001 (4 Crates)' },
      issuedCrates: { 'Spoon': 4, 'Fork': 4 },
      historyRuns: [
        {
          machine: 'Packing-1',
          boxes: 28,
          pcs: 14000,
          date: '2026-09-01',
          time: '02:30 PM',
          worker: 'PACK_SURESH'
        }
      ],
      dispatchLogs: [
        {
          invoiceNo: 'INV-2026-001',
          gtNo: 'GJ-03-AK-9922',
          boxes: 10,
          pcs: 5000,
          date: '2026-09-01',
          user: 'disp_user'
        }
      ]
    },
    {
      id: 'ORD-002',
      customer: 'HALDIRAM FOODS PVT LTD',
      packType: 'INDIVIDUAL',
      orderQty: 40000,
      pcsPerBox: 1000,
      dispatchDate: '2026-09-12',
      kitItems: ['Spoon'],
      kitType: 'Individual Spoon Box',
      status: 'Pending Queue',
      packedBoxes: 15,
      dispatchedBoxes: 0,
      wrapping: 'NO',
      labeling: 'YES',
      remarks: 'Standard yellow branding tape',
      createdBy: 'marketing',
      issuedCrates: { 'Spoon': 2 },
      historyRuns: [
        {
          machine: 'Manual-1',
          boxes: 15,
          pcs: 15000,
          date: '2026-09-01',
          time: '01:15 PM',
          worker: 'PACK_MAHESH'
        }
      ]
    }
  ],
  logs: [
    {
      jobId: 'SPN-001',
      product: 'Spoon',
      stage: 'Slitting',
      machine: 'Slitting-1',
      shift: 'DAY',
      action: 'Slitting Finished (12 Rolls, 185 KG Output)',
      worker: 'RAMESH_SLIT',
      user: 'slit_user',
      startTime: '08:00 AM',
      endTime: '09:30 AM',
      rawDate: '2026-09-01',
      timestamp: '9/1/2026, 09:30:00 AM'
    },
    {
      jobId: 'SPN-001',
      product: 'Spoon',
      stage: 'Cutting',
      machine: 'Cutting-1',
      shift: 'DAY',
      action: 'Finished Cutting Batch B-1002 (8 Crates, Scrap: 14 KG)',
      worker: 'CUT_OP1',
      user: 'cut_user',
      startTime: '09:45 AM',
      endTime: '11:15 AM',
      rawDate: '2026-09-01',
      timestamp: '9/1/2026, 11:15:00 AM'
    },
    {
      jobId: 'SPN-001',
      product: 'Spoon',
      stage: 'QC',
      machine: 'QC-Desk',
      shift: 'DAY',
      action: 'Completed QC Inspection (6 Crates, Scrap: 2 KG)',
      worker: 'QC_RAMESH',
      user: 'qc_user',
      startTime: '11:30 AM',
      endTime: '12:30 PM',
      rawDate: '2026-09-01',
      timestamp: '9/1/2026, 12:30:00 PM'
    },
    {
      jobId: 'ORD-001',
      product: '3-in-1 Kit (Tissue, Spoon, Fork)',
      stage: 'Dispatch',
      machine: 'WAREHOUSE',
      action: '🚚 Dispatched 10 Boxes | Bill: INV-2026-001 | GT: GJ-03-AK-9922',
      worker: 'DISPATCH',
      user: 'disp_user',
      rawDate: '2026-09-01',
      timestamp: '9/1/2026, 02:45:00 PM'
    }
  ],
  scrapSales: [
    {
      soldKg: 200,
      buyerNote: 'EcoRecycle Corp Batch A',
      date: '2026-08-31',
      time: '04:00 PM',
      user: 'admin'
    }
  ],
  users: DEFAULT_USERS,
  deptWorkers: DEPT_WORKERS,
  seriesConfig: {
    orderSeq: 3,
    productSeqs: {
      'Spoon': 2,
      'Fork': 2,
      'Knife': 2,
      'Dessert Spoon': 2
    }
  },
  whatsappConfig: {
    phone: '',
    apiKey: '',
    autoSend: false,
    lastSentKey: ''
  },
  shiftConfig: {
    dayStart: '08:00',
    dayEnd: '20:00',
    nightStart: '20:00',
    nightEnd: '08:00'
  },
  maintenanceContacts: DEFAULT_MAINTENANCE_CONTACTS,
  maintenanceIncidents: [
    {
      id: 'MNT-001',
      machine: 'Forming-2',
      stage: 'Forming',
      reason: 'Mechanical Heater / Tooling Issue',
      description: 'Upper mould heater band temperature dropping below 180C',
      reportedBy: 'FORM_OP2',
      maintenancePhone: '+91 98251 67890',
      priority: 'Urgent',
      status: 'REPAIRED_READY',
      breakdownStartTime: '2026-09-02T09:15:00.000Z',
      breakdownDate: '2026-09-02',
      repairStartTime: '2026-09-02T09:25:00.000Z',
      repairedAt: '2026-09-02T09:55:00.000Z',
      acknowledgedAt: '2026-09-02T10:00:00.000Z',
      totalDowntimeMinutes: 40,
      technicianName: 'Kishan Patel (Sr. Electrical)',
      actionTaken: 'Replaced burnt 1500W band heater coil and recalibrated PID temp sensor. Verified 220C stable.',
      spareParts: [
        { name: 'Band Heater Element 1500W', qty: 1, unit: 'Nos', notes: 'Upper mould right side' },
        { name: 'Thermocouple K-Type Sensor', qty: 1, unit: 'Nos', notes: 'Re-wired' }
      ],
      whatsAppAlertSent: true
    },
    {
      id: 'MNT-002',
      machine: 'Cutting-2',
      stage: 'Cutting',
      reason: 'Die Alignment & Sharpness Check',
      description: 'Edge burr observed on knife roll cut pieces',
      reportedBy: 'CUT_OP2',
      maintenancePhone: '+91 98250 12345',
      priority: 'Normal',
      status: 'REPAIRED_READY',
      breakdownStartTime: '2026-09-01T14:10:00.000Z',
      breakdownDate: '2026-09-01',
      repairStartTime: '2026-09-01T14:18:00.000Z',
      repairedAt: '2026-09-01T14:42:00.000Z',
      acknowledgedAt: '2026-09-01T14:45:00.000Z',
      totalDowntimeMinutes: 32,
      technicianName: 'Ramesh Sharma (Head Mech)',
      actionTaken: 'Sharpened punch blade edge and adjusted shear gap clearance by 0.05mm.',
      spareParts: [
        { name: 'High-Speed Cutting Blade Sharpened', qty: 1, unit: 'Nos', notes: 'Rotated blade #2' }
      ],
      whatsAppAlertSent: true
    }
  ],
  machineReadyAlerts: [],
  customerComplaints: DEFAULT_CUSTOMER_COMPLAINTS,
  materialRequisitions: DEFAULT_MATERIAL_REQUISITIONS
};
