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

export const PAPER_BRANDS = ['ITC', 'CENTURY', 'JK PAPER', 'WEST COAST', 'EMAMI', 'APP (ASIA PULP)'];

export const TARGET_LAYERS_DEFAULT = [4, 6, 8, 9, 10, 12, 14, 16];
export const TARGET_GSM_DEFAULT = [
  '60 GSM',
  '80 GSM',
  '100 GSM',
  '120 GSM',
  '140 GSM',
  '160 GSM',
  '180 GSM',
  '200 GSM',
  '220 GSM',
  '250 GSM',
  '280 GSM',
  '300 GSM',
  '320 GSM',
  '350 GSM'
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
  jobs: [
    {
      id: 'SPN-001',
      product: 'Spoon',
      paperBrand: 'ITC',
      reelNo: 'RL-ITC-9921',
      gsm: '280 GSM',
      customRemark: 'Export Heavy GSM 280',
      stage: 'QC Completed',
      availableRolls: 4,
      availableCuttingCrates: 2,
      availableFormingCrates: 1,
      availableQcCrates: 6,
      inputWeightKg: 200,
      outputWeightKg: 188,
      scrapKg: 12,
      scrapPercent: 6.0,
      runningBatches: [
        {
          batchId: 'B-1011',
          stage: 'Forming',
          machine: 'Forming-1',
          shift: 'DAY',
          startTime: '09:00 AM',
          status: 'Running',
          reelNo: 'RL-ITC-9921',
          gsm: '280 GSM',
          issuedQty: 2,
          producedQty: 0,
          inputWeightKg: 200,
          outputWeightKg: 188,
          scrapKg: 12,
          scrapPercent: 6.0,
          worker: 'FORM_OP1',
          user: 'form_user'
        }
      ]
    },
    {
      id: 'SPN-002',
      product: 'Spoon',
      paperBrand: 'CENTURY',
      reelNo: 'RL-CEN-7890',
      gsm: '300 GSM',
      customRemark: 'Heavy Sturdy 300 GSM Export Quality',
      stage: 'Slitting Completed',
      availableRolls: 5,
      availableCuttingCrates: 0,
      availableFormingCrates: 0,
      availableQcCrates: 0,
      inputWeightKg: 220,
      outputWeightKg: 206,
      scrapKg: 14,
      scrapPercent: 6.36,
      runningBatches: []
    },
    {
      id: 'FRK-001',
      product: 'Fork',
      paperBrand: 'CENTURY',
      reelNo: 'RL-CEN-4412',
      gsm: '240 GSM',
      customRemark: 'Standard 240 GSM',
      stage: 'Cutting Completed',
      availableRolls: 3,
      availableCuttingCrates: 4,
      availableFormingCrates: 2,
      availableQcCrates: 5,
      inputWeightKg: 195,
      outputWeightKg: 183,
      scrapKg: 12,
      scrapPercent: 6.15,
      runningBatches: [
        {
          batchId: 'B-1022',
          stage: 'Cutting',
          machine: 'Cutting-1',
          shift: 'DAY',
          startTime: '08:45 AM',
          status: 'Running',
          reelNo: 'RL-CEN-4412',
          gsm: '240 GSM',
          issuedQty: 2,
          producedQty: 0,
          inputWeightKg: 195,
          outputWeightKg: 183,
          scrapKg: 12,
          scrapPercent: 6.15,
          worker: 'CUT_OP1',
          user: 'cut_user'
        }
      ]
    },
    {
      id: 'KNF-001',
      product: 'Knife',
      paperBrand: 'JK PAPER',
      reelNo: 'RL-JKP-7703',
      gsm: '300 GSM',
      customRemark: 'Reinforced Edge 300 GSM',
      stage: 'Slitting Completed',
      availableRolls: 6,
      availableCuttingCrates: 3,
      availableFormingCrates: 0,
      availableQcCrates: 4,
      inputWeightKg: 210,
      outputWeightKg: 197,
      scrapKg: 13,
      scrapPercent: 6.19,
      runningBatches: []
    },
    {
      id: 'DSP-001',
      product: 'Dessert Spoon',
      paperBrand: 'ITC',
      reelNo: 'RL-ITC-5589',
      gsm: '240 GSM',
      customRemark: 'Ice cream mini spoon',
      stage: 'QC Completed',
      availableRolls: 2,
      availableCuttingCrates: 1,
      availableFormingCrates: 0,
      availableQcCrates: 3,
      inputWeightKg: 180,
      outputWeightKg: 170,
      scrapKg: 10,
      scrapPercent: 5.56,
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
      action: 'Finished Cutting Batch B-1002 (8 Crates = 80,000 Flat Blanks, Scrap: 14 KG)',
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
      stage: 'Forming',
      machine: 'Forming-1',
      shift: 'DAY',
      action: 'Finished Forming Batch B-1003 (7 Crates = 35,000 3D Pieces, Defect Pieces: 120)',
      worker: 'FORM_OP1',
      user: 'form_user',
      startTime: '11:30 AM',
      endTime: '01:00 PM',
      rawDate: '2026-09-01',
      timestamp: '9/1/2026, 01:00:00 PM'
    },
    {
      jobId: 'SPN-001',
      product: 'Spoon',
      stage: 'QC',
      machine: 'QC-Desk',
      shift: 'DAY',
      action: 'Completed QC Inspection (6 Crates = 30,000 Pieces, Scrap: 2 KG)',
      worker: 'QC_RAMESH',
      user: 'qc_user',
      startTime: '01:30 PM',
      endTime: '02:30 PM',
      rawDate: '2026-09-01',
      timestamp: '9/1/2026, 02:30:00 PM'
    },
    {
      jobId: 'ORD-001',
      product: '3-in-1 Kit (Tissue, Spoon, Fork)',
      stage: 'Packing',
      machine: 'Packing-1',
      shift: 'DAY',
      action: 'Packed 50 Boxes (= 5,000 Pieces)',
      worker: 'PACK_SURESH',
      user: 'pack_user',
      startTime: '02:45 PM',
      endTime: '04:15 PM',
      rawDate: '2026-09-01',
      timestamp: '9/1/2026, 04:15:00 PM'
    },
    {
      jobId: 'FRK-001',
      product: 'Fork',
      stage: 'Cutting',
      machine: 'Cutting-1',
      shift: 'DAY',
      action: 'Finished Cutting Batch B-1004 (7 Crates = 70,000 Flat Blanks, Scrap: 11 KG)',
      worker: 'CUT_OP1',
      user: 'cut_user',
      startTime: '09:00 AM',
      endTime: '11:30 AM',
      rawDate: '2026-09-03',
      timestamp: '9/3/2026, 11:30:00 AM'
    },
    {
      jobId: 'FRK-001',
      product: 'Fork',
      stage: 'Cutting',
      machine: 'Cutting-2',
      shift: 'NIGHT',
      action: 'Finished Cutting Batch B-1005 (6 Crates = 60,000 Flat Blanks, Scrap: 9 KG)',
      worker: 'CUT_OP2',
      user: 'cut_user',
      startTime: '09:00 PM',
      endTime: '11:00 PM',
      rawDate: '2026-09-04',
      timestamp: '9/4/2026, 11:00:00 PM'
    },
    {
      jobId: 'FRK-001',
      product: 'Fork',
      stage: 'Forming',
      machine: 'Forming-2',
      shift: 'DAY',
      action: 'Finished Forming Batch B-1006 (6 Crates = 30,000 3D Pieces, Defect Pieces: 80)',
      worker: 'FORM_OP2',
      user: 'form_user',
      startTime: '10:00 AM',
      endTime: '12:30 PM',
      rawDate: '2026-09-04',
      timestamp: '9/4/2026, 12:30:00 PM'
    },
    {
      jobId: 'SPN-002',
      product: 'Spoon',
      stage: 'Cutting',
      machine: 'Cutting-1',
      shift: 'DAY',
      action: 'Finished Cutting Batch B-1007 (9 Crates = 90,000 Flat Blanks, Scrap: 15 KG)',
      worker: 'CUT_OP1',
      user: 'cut_user',
      startTime: '08:30 AM',
      endTime: '11:00 AM',
      rawDate: '2026-09-05',
      timestamp: '9/5/2026, 11:00:00 AM'
    },
    {
      jobId: 'SPN-002',
      product: 'Spoon',
      stage: 'Forming',
      machine: 'Forming-1',
      shift: 'DAY',
      action: 'Finished Forming Batch B-1008 (8 Crates = 40,000 3D Pieces, Defect Pieces: 140)',
      worker: 'FORM_OP1',
      user: 'form_user',
      startTime: '11:30 AM',
      endTime: '02:00 PM',
      rawDate: '2026-09-05',
      timestamp: '9/5/2026, 02:00:00 PM'
    },
    {
      jobId: 'KNF-001',
      product: 'Knife',
      stage: 'Cutting',
      machine: 'Cutting-2',
      shift: 'DAY',
      action: 'Finished Cutting Batch B-1009 (5 Crates = 50,000 Flat Blanks, Scrap: 8 KG)',
      worker: 'VIKRAM_CUT',
      user: 'cut_user',
      startTime: '09:15 AM',
      endTime: '11:15 AM',
      rawDate: '2026-09-06',
      timestamp: '9/6/2026, 11:15:00 AM'
    },
    {
      jobId: 'KNF-001',
      product: 'Knife',
      stage: 'Forming',
      machine: 'Forming-3',
      shift: 'DAY',
      action: 'Finished Forming Batch B-1010 (5 Crates = 25,000 3D Pieces, Defect Pieces: 60)',
      worker: 'FORM_OP3',
      user: 'form_user',
      startTime: '11:45 AM',
      endTime: '01:30 PM',
      rawDate: '2026-09-06',
      timestamp: '9/6/2026, 01:30:00 PM'
    },
    {
      jobId: 'SPN-001',
      product: 'Spoon',
      stage: 'Cutting',
      machine: 'Cutting-1',
      shift: 'DAY',
      action: 'Finished Cutting Batch B-0988 (10 Crates = 100,000 Flat Blanks, Scrap: 16 KG)',
      worker: 'CUT_OP1',
      user: 'cut_user',
      startTime: '08:30 AM',
      endTime: '11:30 AM',
      rawDate: '2026-08-30',
      timestamp: '8/30/2026, 11:30:00 AM'
    },
    {
      jobId: 'SPN-001',
      product: 'Spoon',
      stage: 'Forming',
      machine: 'Forming-1',
      shift: 'DAY',
      action: 'Finished Forming Batch B-0989 (9 Crates = 45,000 3D Pieces, Defect Pieces: 150)',
      worker: 'FORM_OP1',
      user: 'form_user',
      startTime: '12:00 PM',
      endTime: '02:30 PM',
      rawDate: '2026-08-30',
      timestamp: '8/30/2026, 02:30:00 PM'
    },
    {
      jobId: 'FRK-001',
      product: 'Fork',
      stage: 'Cutting',
      machine: 'Cutting-2',
      shift: 'DAY',
      action: 'Finished Cutting Batch B-0975 (8 Crates = 80,000 Flat Blanks, Scrap: 12 KG)',
      worker: 'CUT_OP2',
      user: 'cut_user',
      startTime: '09:00 AM',
      endTime: '11:45 AM',
      rawDate: '2026-08-23',
      timestamp: '8/23/2026, 11:45:00 AM'
    },
    {
      jobId: 'SPN-001',
      product: 'Spoon',
      stage: 'Cutting',
      machine: 'Cutting-1',
      shift: 'DAY',
      action: 'Finished Cutting Batch B-0950 (11 Crates = 110,000 Flat Blanks, Scrap: 18 KG)',
      worker: 'CUT_OP1',
      user: 'cut_user',
      startTime: '08:00 AM',
      endTime: '11:45 AM',
      rawDate: '2026-08-10',
      timestamp: '8/10/2026, 11:45:00 AM'
    },
    {
      jobId: 'FRK-001',
      product: 'Fork',
      stage: 'Cutting',
      machine: 'Cutting-1',
      shift: 'DAY',
      action: 'Finished Cutting Batch B-0880 (12 Crates = 120,000 Flat Blanks, Scrap: 19 KG)',
      worker: 'CUT_OP1',
      user: 'cut_user',
      startTime: '08:30 AM',
      endTime: '12:00 PM',
      rawDate: '2026-06-15',
      timestamp: '6/15/2026, 12:00:00 PM'
    },
    {
      jobId: 'SPN-001',
      product: 'Spoon',
      stage: 'Cutting',
      machine: 'Cutting-2',
      shift: 'DAY',
      action: 'Finished Cutting Batch B-0740 (10 Crates = 100,000 Flat Blanks, Scrap: 15 KG)',
      worker: 'CUT_OP2',
      user: 'cut_user',
      startTime: '09:00 AM',
      endTime: '12:15 PM',
      rawDate: '2026-03-20',
      timestamp: '3/20/2026, 12:15:00 PM'
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
      id: 'SCR-1001',
      partyName: 'EcoRecycle Corp Batch A',
      weightKg: 200,
      ratePerKg: 18,
      totalAmount: 3600,
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
  materialRequisitions: DEFAULT_MATERIAL_REQUISITIONS,
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
  glueUsageLogs: DEFAULT_GLUE_USAGE_LOGS,
  productionPlans: DEFAULT_PRODUCTION_PLANS,
  motherReelInventory: DEFAULT_MOTHER_REELS,
  coordinationMatrix: DEFAULT_COORDINATION_MATRIX,
  shiftHandovers: []
};
