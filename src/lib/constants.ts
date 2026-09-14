import { FactoryState, ProductType, CustomerComplaint, MaterialRequisition, ProductCrateCapacity, FloorWorker, GlueUsageEntry, ProductionPlan, MotherReelItem, ShiftHandoverRecord, CoordinationMatrixItem, NumberingSeriesMaster } from '../types';

export const DEFAULT_NUMBERING_MASTER: NumberingSeriesMaster = {
  jobSeries: { prefix: 'WK-LOT', paddingDigits: 3, nextSeq: 101 },
  slitSeries: { prefix: 'SLIT', paddingDigits: 2, nextSeq: 1 },
  cutSeries: { prefix: 'CUT', paddingDigits: 2, nextSeq: 1 },
  qcSeries: { prefix: 'QC', paddingDigits: 2, nextSeq: 1 },
  useGlobalJobPrefix: false
};

export const PRODUCTS: ProductType[] = ['Spoon', 'Fork', 'Knife', 'Dessert Spoon'];

export const DEFAULT_CRATE_CAPACITY_MASTER: Record<string, ProductCrateCapacity> = {
  'Spoon': { cuttingPcs: 10000, formingPcs: 7000 },
  'Fork': { cuttingPcs: 9000, formingPcs: 6500 },
  'Knife': { cuttingPcs: 11000, formingPcs: 7500 },
  'Dessert Spoon': { cuttingPcs: 12000, formingPcs: 8500 }
};

export const DEFAULT_PCS_PER_KG_MAP: Record<string, number> = {
  'Spoon': 450,
  'Fork': 480,
  'Knife': 550,
  'Dessert Spoon': 600,
  'Tea Spoon': 700,
  'Soup Spoon': 350,
  'Spork': 460
};

export const LOCAL_STORAGE_KEY = 'wunderkraf_erp_state_v1';

export const PRODUCT_PREFIX_MAP: Record<string, string> = {
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
  'QC': ['QC_RAMESH', 'QC_DINESH', 'QC_ANIL', 'KAVITA_BEN', 'QC_KAVITA'],
  'Packing': ['PACK_SURESH', 'PACK_MAHESH', 'PACK_SUNIL', 'KAVITA_BEN', 'PACK_KAVITA']
};

export const DEFAULT_FLOOR_WORKERS: FloorWorker[] = [
  // CUTTING DEPARTMENT (With Operators and 2 Helpers explicitly on Cutting-1)
  { id: 'FW-CUT-1', name: 'CUT_OP1', role: 'OPERATOR', department: 'Cutting', assignedMachine: 'Cutting-1', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Primary Operator' },
  { id: 'FW-CUT-2', name: 'CUT_OP2', role: 'OPERATOR', department: 'Cutting', assignedMachine: 'Cutting-2', shift: 'DAY', isPresent: true, inTime: '08:15 AM', notes: 'Primary Operator' },
  { id: 'FW-CUT-3', name: 'VIKRAM_CUT', role: 'OPERATOR', department: 'Cutting', assignedMachine: 'Cutting-1', shift: 'NIGHT', isPresent: false, notes: 'Night Shift Operator' },
  { id: 'FW-CUT-H1', name: 'SUNIL_HELPER', role: 'HELPER', department: 'Cutting', assignedMachine: 'Cutting-1', pairedWithOperator: 'CUT_OP1', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Feed & Crate Stacking' },
  { id: 'FW-CUT-H2', name: 'DINESH_HELPER', role: 'HELPER', department: 'Cutting', assignedMachine: 'Cutting-1', pairedWithOperator: 'CUT_OP1', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Scrap Weighing & Crate Shifting' },
  { id: 'FW-CUT-H3', name: 'MUKESH_HELPER', role: 'HELPER', department: 'Cutting', assignedMachine: 'Cutting-2', pairedWithOperator: 'CUT_OP2', shift: 'DAY', isPresent: true, inTime: '08:15 AM', notes: 'Material Feeding' },
  { id: 'FW-CUT-S1', name: 'Suresh Cut-Master', role: 'SUPERVISOR', department: 'Cutting', shift: 'DAY', isPresent: true, inTime: '07:45 AM', notes: 'Cutting Dept Head' },

  // SLITTING DEPARTMENT
  { id: 'FW-SLIT-1', name: 'RAMESH_SLIT', role: 'OPERATOR', department: 'Slitting', assignedMachine: 'Slitting-1', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Master Slitter' },
  { id: 'FW-SLIT-2', name: 'SURESH_SLIT', role: 'OPERATOR', department: 'Slitting', assignedMachine: 'Slitting-1', shift: 'NIGHT', isPresent: false, notes: 'Night Slitter' },
  { id: 'FW-SLIT-H1', name: 'PRAKASH_HELPER', role: 'HELPER', department: 'Slitting', assignedMachine: 'Slitting-1', pairedWithOperator: 'RAMESH_SLIT', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Jumbo Reel Loading' },
  { id: 'FW-SLIT-S1', name: 'Ramesh Slit-Head', role: 'SUPERVISOR', department: 'Slitting', shift: 'DAY', isPresent: true, inTime: '07:50 AM', notes: 'Slitting Head' },

  // FORMING DEPARTMENT
  { id: 'FW-FORM-1', name: 'FORM_OP1', role: 'OPERATOR', department: 'Forming', assignedMachine: 'Forming-1', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Forming Lead Operator' },
  { id: 'FW-FORM-2', name: 'FORM_OP2', role: 'OPERATOR', department: 'Forming', assignedMachine: 'Forming-2', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Operator' },
  { id: 'FW-FORM-3', name: 'FORM_OP3', role: 'OPERATOR', department: 'Forming', assignedMachine: 'Forming-3', shift: 'DAY', isPresent: true, inTime: '08:30 AM', notes: 'Operator' },
  { id: 'FW-FORM-4', name: 'RAHUL_FORM', role: 'OPERATOR', department: 'Forming', assignedMachine: 'Forming-4', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Operator' },
  { id: 'FW-FORM-H1', name: 'BABLU_HELPER', role: 'HELPER', department: 'Forming', assignedMachine: 'Forming-1', pairedWithOperator: 'FORM_OP1', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Blank Feeding & Ejection' },
  { id: 'FW-FORM-H2', name: 'CHANDAN_HELPER', role: 'HELPER', department: 'Forming', assignedMachine: 'Forming-2', pairedWithOperator: 'FORM_OP2', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Crate Stacking' },
  { id: 'FW-FORM-S1', name: 'Rajesh Form-Lead', role: 'SUPERVISOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '07:45 AM', notes: 'Forming Dept Head' },

  // QC DEPARTMENT
  { id: 'FW-QC-1', name: 'QC_RAMESH', role: 'QC_INSPECTOR', department: 'QC', assignedMachine: 'QC-Desk', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Inspector' },
  { id: 'FW-QC-2', name: 'QC_DINESH', role: 'QC_INSPECTOR', department: 'QC', assignedMachine: 'QC-Desk', shift: 'DAY', isPresent: true, inTime: '08:15 AM', notes: 'Inspector' },
  { id: 'FW-QC-S1', name: 'Amit Verma (Lead QC)', role: 'SUPERVISOR', department: 'QC', shift: 'DAY', isPresent: true, inTime: '07:55 AM', notes: 'QC Quality Head' },

  // PACKING DEPARTMENT
  { id: 'FW-PACK-1', name: 'PACK_SURESH', role: 'OPERATOR', department: 'Packing', assignedMachine: 'Packing-1', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Head Packer' },
  { id: 'FW-PACK-2', name: 'PACK_MAHESH', role: 'OPERATOR', department: 'Packing', assignedMachine: 'Packing-2', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Machine Packer' },
  { id: 'FW-PACK-H1', name: 'SANTOSH_HELPER', role: 'HELPER', department: 'Packing', assignedMachine: 'Packing-1', pairedWithOperator: 'PACK_SURESH', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Carton Taping' },
  { id: 'FW-PACK-H2', name: 'RAJU_HELPER', role: 'HELPER', department: 'Packing', assignedMachine: 'Packing-1', pairedWithOperator: 'PACK_SURESH', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Box Weighing' },
  { id: 'FW-PACK-S1', name: 'Vikram Singh', role: 'SUPERVISOR', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '07:50 AM', notes: 'Packing In-Charge' },

  // MAINTENANCE DEPARTMENT
  { id: 'FW-MNT-1', name: 'Ramesh Sharma (Head Mech)', role: 'MAINTENANCE', department: 'Maintenance', shift: 'DAY', isPresent: true, inTime: '07:30 AM', notes: 'Chief Mech Engineer' },
  { id: 'FW-MNT-2', name: 'Kishan Patel (Sr. Electrical)', role: 'MAINTENANCE', department: 'Maintenance', shift: 'DAY', isPresent: true, inTime: '08:00 AM', notes: 'Electrical & PLC' },
  { id: 'FW-MNT-3', name: 'Dinesh Varma (Pneumatics)', role: 'MAINTENANCE', department: 'Maintenance', shift: 'DAY', isPresent: true, inTime: '08:10 AM', notes: 'Hydraulic & Pneumatic' },
  { id: 'FW-MNT-S1', name: 'Manoj Kumar (Plant Head)', role: 'SUPERVISOR', department: 'Maintenance', shift: 'DAY', isPresent: true, inTime: '07:30 AM', notes: 'Plant Production Manager' }
];

export const PAPER_BRANDS = ['Orient Paper', 'BILT'];

export const TARGET_LAYERS_DEFAULT = [8, 9];
export const TARGET_GSM_DEFAULT = [
  '60 GSM',
  '120 GSM'
];

export const GLUE_BRANDS = [
  'Pidilite Fevicol SH',
  'Pidilite W-10 (Food Grade Adhesive)',
  'Dextrin Eco Adhesive',
  'Paramount Hot Melt Glue',
  'National Adhesives Super-Bond',
  'Henkel Aquence Food-Grade'
];

export const DEFAULT_GLUE_USAGE_LOGS: GlueUsageEntry[] = [
  {
    id: 'GLUE-2026-001',
    date: '2026-09-08',
    time: '10:30 AM',
    shift: 'DAY',
    machine: 'Cutting-1',
    stage: 'Cutting',
    jobId: 'JOB-SPN-101',
    batchId: 'B-1042',
    product: 'Spoon',
    glueBrand: 'Pidilite W-10 (Food Grade Adhesive)',
    quantityKg: 4.5,
    operator: 'CUT_OP1',
    lotOrDrumNo: 'DRUM-W10-88',
    notes: 'Roll layer bonding during high-speed cutting run',
    user: 'cut_user',
    createdAt: '2026-09-08T10:30:00.000Z'
  },
  {
    id: 'GLUE-2026-002',
    date: '2026-09-08',
    time: '02:15 PM',
    shift: 'DAY',
    machine: 'Forming-1',
    stage: 'Forming',
    jobId: 'JOB-SPN-101',
    batchId: 'B-1043',
    product: 'Spoon',
    glueBrand: 'Pidilite Fevicol SH',
    quantityKg: 3.0,
    operator: 'FORM_OP1',
    lotOrDrumNo: 'DRUM-FSH-12',
    notes: 'Edge lamination adhesive reservoir refill',
    user: 'form_user',
    createdAt: '2026-09-08T14:15:00.000Z'
  }
];

export const DEFAULT_PRODUCTION_PLANS: ProductionPlan[] = [
  {
    id: 'PLAN-2026-001',
    jobId: 'JOB-SPN-101',
    product: 'Spoon',
    targetLayers: 8,
    targetLengthMeters: 1200,
    adhesiveBrand: 'Pidilite W-10 (Food Grade Adhesive)',
    targetScrapLimitPct: 2.5,
    targetScrapLimitKg: 15,
    assignedMachine: 'Slitting-1',
    assignedShift: 'DAY',
    plannedDate: '2026-09-09',
    targetQuantity: 70000,
    paperBrand: 'ITC',
    targetGsm: '280 GSM',
    notes: '8-layer high stiffness catering spoon lot',
    status: 'In-Progress',
    createdAt: '2026-09-09T08:00:00.000Z',
    actualLayersUsed: 4,
    actualMetersSlit: 600,
    actualScrapKg: 6.2,
    actualScrapPct: 2.0,
    actualGlueConsumedKg: 4.5
  },
  {
    id: 'PLAN-2026-002',
    jobId: 'JOB-FRK-102',
    product: 'Fork',
    targetLayers: 6,
    targetLengthMeters: 1500,
    adhesiveBrand: 'Henkel Aquence Food-Grade',
    targetScrapLimitPct: 2.0,
    targetScrapLimitKg: 18,
    assignedMachine: 'Slitting-1',
    assignedShift: 'NIGHT',
    plannedDate: '2026-09-09',
    targetQuantity: 85000,
    paperBrand: 'Bilt (Ballarpur)',
    targetGsm: '300 GSM',
    notes: 'Heavy duty fork production run',
    status: 'Scheduled',
    createdAt: '2026-09-09T09:30:00.000Z'
  },
  {
    id: 'PLAN-2026-003',
    jobId: 'JOB-KNF-103',
    product: 'Knife',
    targetLayers: 8,
    targetLengthMeters: 2000,
    adhesiveBrand: 'Fevicol SH Industrial',
    targetScrapLimitPct: 2.8,
    targetScrapLimitKg: 22,
    assignedMachine: 'Slitting-1',
    assignedShift: 'DAY',
    plannedDate: '2026-09-10',
    targetQuantity: 60000,
    paperBrand: 'JK Paper',
    targetGsm: '320 GSM',
    notes: 'Serrated knife edge layer bonding',
    status: 'Scheduled',
    createdAt: '2026-09-09T10:15:00.000Z'
  }
];

export const DEFAULT_MOTHER_REELS: MotherReelItem[] = [
  { id: 'M-REEL-ITC-001', brand: 'ITC', gsm: '280 GSM', weightKg: 250, lengthMeters: 1400, status: 'In-Use', allocatedJobId: 'JOB-SPN-101', allocatedDate: '2026-09-09' },
  { id: 'M-REEL-ITC-002', brand: 'ITC', gsm: '280 GSM', weightKg: 245, lengthMeters: 1380, status: 'Available' },
  { id: 'M-REEL-ITC-003', brand: 'ITC', gsm: '280 GSM', weightKg: 255, lengthMeters: 1420, status: 'Available' },
  { id: 'M-REEL-BLT-004', brand: 'Bilt (Ballarpur)', gsm: '300 GSM', weightKg: 280, lengthMeters: 1500, status: 'Available' },
  { id: 'M-REEL-BLT-005', brand: 'Bilt (Ballarpur)', gsm: '300 GSM', weightKg: 275, lengthMeters: 1480, status: 'Available' },
  { id: 'M-REEL-JK-006', brand: 'JK Paper', gsm: '320 GSM', weightKg: 300, lengthMeters: 1600, status: 'Available' },
  { id: 'M-REEL-TNPL-007', brand: 'TNPL', gsm: '250 GSM', weightKg: 220, lengthMeters: 1300, status: 'Available' },
  { id: 'M-REEL-WST-008', brand: 'West Coast', gsm: '280 GSM', weightKg: 240, lengthMeters: 1350, status: 'Available' }
];

export const DEFAULT_USERS: Record<string, { pass: string; perms: string[]; name?: string; role?: string; phone?: string }> = {
  'admin': {
    pass: 'admin123',
    perms: ['*'],
    name: 'Master Administrator',
    role: 'Administrator'
  },
  'kavita': {
    pass: 'kavita123',
    perms: ['QC', 'Packing'],
    name: 'Kavita Ben (Quality & Packing Inspector)',
    role: 'QC & Packing Inspector'
  },
  'marketing': {
    pass: 'mkt123',
    perms: ['Marketing', 'Orders'],
    name: 'Marketing Incharge',
    role: 'Marketing'
  },
  'disp_user': {
    pass: 'disp123',
    perms: ['Dispatch', 'Orders'],
    name: 'Dispatch Officer',
    role: 'Dispatch'
  },
  'slit_user': {
    pass: 'slit123',
    perms: ['Slitting'],
    name: 'Slitting Operator',
    role: 'Slitting'
  },
  'cut_user': {
    pass: 'cut123',
    perms: ['Cutting'],
    name: 'Cutting Operator',
    role: 'Cutting'
  },
  'form_user': {
    pass: 'form123',
    perms: ['Forming'],
    name: 'Forming Operator',
    role: 'Forming'
  },
  'qc_user': {
    pass: 'qc123',
    perms: ['QC'],
    name: 'QC Inspector',
    role: 'QC'
  },
  'pack_user': {
    pass: 'pack123',
    perms: ['Packing', 'Orders'],
    name: 'Packing Supervisor',
    role: 'Packing'
  },
  'maint_user': {
    pass: 'maint123',
    perms: ['Maintenance'],
    name: 'Maintenance Technician',
    role: 'Maintenance'
  },
  'purchase': {
    pass: 'pur123',
    perms: ['Purchase'],
    name: 'Purchase Officer',
    role: 'Purchase'
  }
};

export const DEFAULT_MAINTENANCE_CONTACTS = [
  { id: 'MC-1', name: 'Ramesh Sharma (Head Mech)', phone: '+91 98250 12345', role: 'Mechanical & Tooling', dept: 'Mechanical' },
  { id: 'MC-2', name: 'Kishan Patel (Sr. Electrical)', phone: '+91 98251 67890', role: 'Heater & PLC Sensors', dept: 'Electrical' },
  { id: 'MC-3', name: 'Dinesh Varma (Pneumatics)', phone: '+91 98252 54321', role: 'Hydraulic & Air Pressure', dept: 'Pneumatic' }
];

export const DEFAULT_DEPARTMENT_HEADS = [
  { id: 'DH-1', name: 'Ramesh Slit-Head', phone: '+91 98250 11001', role: 'Slitting Department Head', dept: 'Slitting' },
  { id: 'DH-2', name: 'Suresh Cut-Master', phone: '+91 98250 22002', role: 'Cutting Department Head', dept: 'Cutting' },
  { id: 'DH-3', name: 'Rajesh Form-Lead', phone: '+91 98250 33003', role: 'Forming Department Head', dept: 'Forming' },
  { id: 'DH-4', name: 'Amit Verma (Lead QC)', phone: '+91 98250 44004', role: 'Quality Control Head', dept: 'QC' },
  { id: 'DH-5', name: 'Vikram Singh', phone: '+91 98250 55005', role: 'Packing & Dispatch In-Charge', dept: 'Packing' },
  { id: 'DH-6', name: 'Ramesh Sharma', phone: '+91 98250 12345', role: 'Chief Maintenance Engineer', dept: 'Maintenance' },
  { id: 'DH-7', name: 'Manoj Kumar (Plant Head)', phone: '+91 98250 99999', role: 'Plant Production Manager', dept: 'Plant Admin' },
  { id: 'DH-8', name: 'Sanjay Patel', phone: '+91 98250 77007', role: 'Purchase & Stores Officer', dept: 'Purchase' }
];

export const DEFAULT_COORDINATION_MATRIX: CoordinationMatrixItem[] = [
  {
    id: 'CM-1',
    roleName: 'Maintenance Head',
    contactName: 'Ramesh Sharma',
    phone: '+91 98250 12345',
    alertCategories: {
      machineBreakdown: true,
      electricalAlert: false,
      productionHandover: true,
      materialIndent: false,
      qcFailure: false
    },
    isActive: true
  },
  {
    id: 'CM-2',
    roleName: 'Electrical Breakdown Head',
    contactName: 'Kishan Patel',
    phone: '+91 98251 67890',
    alertCategories: {
      machineBreakdown: false,
      electricalAlert: true,
      productionHandover: false,
      materialIndent: false,
      qcFailure: false
    },
    isActive: true
  },
  {
    id: 'CM-3',
    roleName: 'Production Manager',
    contactName: 'Suresh Patel',
    phone: '+91 98250 11001',
    alertCategories: {
      machineBreakdown: true,
      electricalAlert: true,
      productionHandover: true,
      materialIndent: true,
      qcFailure: true
    },
    isActive: true
  },
  {
    id: 'CM-4',
    roleName: 'QC Head',
    contactName: 'Amit Verma',
    phone: '+91 98250 44004',
    alertCategories: {
      machineBreakdown: false,
      electricalAlert: false,
      productionHandover: false,
      materialIndent: false,
      qcFailure: true
    },
    isActive: true
  }
];

export const DEFAULT_MAINTENANCE_TECHNICIANS = [
  'Ramesh Sharma (Head Mech)',
  'Kishan Patel (Sr. Electrical)',
  'Dinesh Varma (Pneumatics)',
  'Mukesh Prajapati (Tooling Tech)',
  'Sanjay Mistri (Fitter & Welder)'
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
  jobs: [],
  packJobs: [],
  logs: [],
  scrapSales: [],
  users: DEFAULT_USERS,
  deptWorkers: DEPT_WORKERS,
  seriesConfig: {
    orderSeq: 1,
    productSeqs: {
      'Spoon': 1,
      'Fork': 1,
      'Knife': 1,
      'Dessert Spoon': 1
    },
    numberingMaster: DEFAULT_NUMBERING_MASTER
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
  maintenanceIncidents: [],
  machineReadyAlerts: [],
  customerComplaints: [],
  materialRequisitions: [],
  products: PRODUCTS,
  paperBrands: PAPER_BRANDS,
  productPrefixMap: PRODUCT_PREFIX_MAP,
  maxPiecesPerSlitRoll: 12000,
  strictAuditRollYield: false,
  maintenanceTechniciansMaster: [
    'Ramesh Sharma (Head Mech)',
    'Vijay Patel (Sr Electrical)',
    'Dinesh Mistry (Mould Tooling)',
    'Kiran Gohil (Hydraulic & Pneumatics)'
  ],
  maintenanceSparePartsMaster: [
    'Upper Mould Heater Band (220V/1500W)',
    'High-Speed Cutting Blade Punch Set',
    'Thermocouple K-Type Sensor Cable',
    'Festo 5/2 Directional Solenoid Valve',
    'Hydraulic Piston Rod Oil Seal 45x60x10',
    'NSK High-Precision Deep Groove Ball Bearing',
    'PTFE Non-Stick Mould Liner Strip'
  ],
  autoNotifyDeptHeadsOnCritical: true,
  departmentHeads: DEFAULT_DEPARTMENT_HEADS,
  crateCapacityMaster: DEFAULT_CRATE_CAPACITY_MASTER,
  floorWorkers: DEFAULT_FLOOR_WORKERS,
  glueBrands: GLUE_BRANDS,
  targetLayersMaster: TARGET_LAYERS_DEFAULT,
  targetGsmMaster: TARGET_GSM_DEFAULT,
  glueUsageLogs: [],
  productionPlans: [],
  motherReelInventory: [],
  coordinationMatrix: DEFAULT_COORDINATION_MATRIX,
  shiftHandovers: []
};
