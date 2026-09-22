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
  'Spoon': { cuttingPcs: 11000, formingPcs: 7000 },
  'Fork': { cuttingPcs: 9000, formingPcs: 6500 },
  'Knife': { cuttingPcs: 11000, formingPcs: 7500 },
  'Dessert Spoon': { cuttingPcs: 22000, formingPcs: 22000 }
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


export const DEFAULT_FLOOR_WORKERS: FloorWorker[] = [
  // 1. Bhavisha Ben
  { id: 'FW-001', staffId: 'EMP00037', name: 'Bhavisha Ben', designation: 'Operator', role: 'OPERATOR', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 2. Manishaben Taviyal
  { id: 'FW-002', staffId: 'CO-EMP107', name: 'Manishaben Taviyal', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 3. Chudasama Vaishali Bharatbhai
  { id: 'FW-003', staffId: 'EMP00118', name: 'Chudasama Vaishali Bharatbhai', designation: 'Helper', role: 'HELPER', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 4. Vishal Solanki
  { id: 'FW-004', staffId: 'EMP00105', name: 'Vishal Solanki', designation: 'Helper', role: 'HELPER', department: 'Cutting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 5. Sondarva Balubhai
  { id: 'FW-005', staffId: 'EMP00008', name: 'Sondarva Balubhai', designation: 'Operator', role: 'OPERATOR', department: 'Cutting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 6. Somli katara
  { id: 'FW-006', staffId: 'CO-EMP139', name: 'Somli katara', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 7. Sunita Vadakhiya
  { id: 'FW-007', staffId: 'CO-EMP138', name: 'Sunita Vadakhiya', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 8. Vadakhiya Prakash
  { id: 'FW-008', staffId: 'CO-EMP137', name: 'Vadakhiya Prakash', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 9. Anilkumar Gabhrubhai Kavad
  { id: 'FW-009', staffId: 'EMP00113', name: 'Anilkumar Gabhrubhai Kavad', designation: 'Manager', role: 'MANAGER', department: 'QC', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 10. Ajitbhai Vala
  { id: 'FW-010', staffId: 'EMP00005', name: 'Ajitbhai Vala', designation: 'Supervisor', role: 'SUPERVISOR', department: 'Production', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 11. Manjuben Babariya
  { id: 'FW-011', staffId: 'BA-EMP001', name: 'Manjuben Babariya', designation: 'Helper', role: 'HELPER', department: 'Housekeeping', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 12. Dayaben
  { id: 'FW-012', staffId: 'EMP00065', name: 'Dayaben', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 13. Hansa Ben Bharat Bhai Dobariya
  { id: 'FW-013', staffId: 'EMP00025', name: 'Hansa Ben Bharat Bhai Dobariya', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 14. Bhathubhai Motibhai Garasiya
  { id: 'FW-014', staffId: 'CO-EMP113', name: 'Bhathubhai Motibhai Garasiya', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 15. Amishbhai
  { id: 'FW-015', staffId: 'EMP00059', name: 'Amishbhai', designation: 'Supervisor', role: 'SUPERVISOR', department: 'Cutting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 16. Sadadiya Tushar Kishorbhai
  { id: 'FW-016', staffId: 'EMP00016', name: 'Sadadiya Tushar Kishorbhai', designation: 'Operator', role: 'OPERATOR', department: 'Cutting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 17. Sandipbhai Kamriya
  { id: 'FW-017', staffId: 'EMP00001', name: 'Sandipbhai Kamriya', designation: 'Manager', role: 'MANAGER', department: 'Production', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 18. Kamlaben Varsakhiya
  { id: 'FW-018', staffId: 'EMP00115', name: 'Kamlaben Varsakhiya', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 19. Drashtiben Taviyal
  { id: 'FW-019', staffId: 'CO-EMP115', name: 'Drashtiben Taviyal', designation: 'Helper', role: 'HELPER', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 20. Devuben Chavda
  { id: 'FW-020', staffId: 'EMP00094', name: 'Devuben Chavda', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 21. Sharda Rameshbhai Mavi
  { id: 'FW-021', staffId: 'EMP00116', name: 'Sharda Rameshbhai Mavi', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 22. Priyanka kumari
  { id: 'FW-022', staffId: 'CO-EMP004', name: 'Priyanka kumari', designation: 'Operator', role: 'OPERATOR', department: 'Printing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 23. Kanak Sinh Chauhan
  { id: 'FW-023', staffId: 'EMP00109', name: 'Kanak Sinh Chauhan', designation: 'Technician', role: 'TECHNICIAN', department: 'Maintenance', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 24. Amitbhai Dabhi
  { id: 'FW-024', staffId: 'EMP00002', name: 'Amitbhai Dabhi', designation: 'Technician', role: 'TECHNICIAN', department: 'Maintenance', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 25. Badhiya Abhay Rameshbhai
  { id: 'FW-025', staffId: 'EMP00028', name: 'Badhiya Abhay Rameshbhai', designation: 'Operator', role: 'OPERATOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 26. Jasvanti Vaghela
  { id: 'FW-026', staffId: 'EMP00107', name: 'Jasvanti Vaghela', designation: 'Helper', role: 'HELPER', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 27. Kalpesh Mansing Taviyal
  { id: 'FW-027', staffId: 'CO-EMP111', name: 'Kalpesh Mansing Taviyal', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 28. Chintan Rathod
  { id: 'FW-028', staffId: 'EMP00067', name: 'Chintan Rathod', designation: 'Executive', role: 'EXECUTIVE', department: 'HR', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 29. Bhadarka Shilpaben
  { id: 'FW-029', staffId: 'EMP00009', name: 'Bhadarka Shilpaben', designation: 'Sr-helper', role: 'HELPER', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 30. Kanta Ben Bhathubhai Garasiya
  { id: 'FW-030', staffId: 'CO-EMP114', name: 'Kanta Ben Bhathubhai Garasiya', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 31. Girja devi
  { id: 'FW-031', staffId: 'CO-EMP015', name: 'Girja devi', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 32. Rinki Haribhai
  { id: 'FW-032', staffId: 'CO-EMP002', name: 'Rinki Haribhai', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 33. Khushali
  { id: 'FW-033', staffId: 'EMP00013', name: 'Khushali', designation: 'Operator', role: 'OPERATOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 34. Vikash Falud
  { id: 'FW-034', staffId: 'EMP00093', name: 'Vikash Falud', designation: 'Operator', role: 'OPERATOR', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 35. Saroj ben
  { id: 'FW-035', staffId: 'EMP00036', name: 'Saroj ben', designation: 'Operator', role: 'OPERATOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 36. Teraiya Hetvi
  { id: 'FW-036', staffId: 'EMP00112', name: 'Teraiya Hetvi', designation: 'Executive', role: 'EXECUTIVE', department: 'HR', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 37. Rinki KM
  { id: 'FW-037', staffId: 'CO-EMP005', name: 'Rinki KM', designation: 'Operator', role: 'OPERATOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 38. Sarita KM
  { id: 'FW-038', staffId: 'CO-EMP006', name: 'Sarita KM', designation: 'Operator', role: 'OPERATOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 39. Suman Kumari
  { id: 'FW-039', staffId: 'CO-EMP014', name: 'Suman Kumari', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 40. Rajni bhai Patel
  { id: 'FW-040', staffId: 'EMP00003', name: 'Rajni bhai Patel', designation: 'Supervisor', role: 'SUPERVISOR', department: 'Production', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 41. Arvindbhai Pateliya
  { id: 'FW-041', staffId: 'CO-EMP146', name: 'Arvindbhai Pateliya', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 42. Amar Sanjay Bhai
  { id: 'FW-042', staffId: 'EMP00071', name: 'Amar Sanjay Bhai', designation: 'Operator', role: 'OPERATOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 43. Naynaben Katara
  { id: 'FW-043', staffId: 'CO-EMP119', name: 'Naynaben Katara', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 44. Sarang Rathod
  { id: 'FW-044', staffId: 'EMP00004', name: 'Sarang Rathod', designation: 'Supervisor', role: 'SUPERVISOR', department: 'Production', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 45. Sohilbhai Garasiya
  { id: 'FW-045', staffId: 'CO-EMP120', name: 'Sohilbhai Garasiya', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 46. Divya Raval
  { id: 'FW-046', staffId: 'CO-EMP136', name: 'Divya Raval', designation: 'Helper', role: 'HELPER', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 47. Aman Kumar Ishvardayal yadav
  { id: 'FW-047', staffId: 'EMP00086', name: 'Aman Kumar Ishvardayal yadav', designation: 'Operator', role: 'OPERATOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 48. Rahul Garla
  { id: 'FW-048', staffId: 'EMP00092', name: 'Rahul Garla', designation: 'Operator', role: 'OPERATOR', department: 'Cutting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 49. Bhedi Chirag
  { id: 'FW-049', staffId: 'CO-EMP135', name: 'Bhedi Chirag', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 50. Sonukumar Ishvardayal Jadav
  { id: 'FW-050', staffId: 'EMP00027', name: 'Sonukumar Ishvardayal Jadav', designation: 'Operator', role: 'OPERATOR', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 51. Manish Bansal
  { id: 'FW-051', staffId: 'EMP00010', name: 'Manish Bansal', designation: 'Operator', role: 'OPERATOR', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 52. laxmi haribhai
  { id: 'FW-052', staffId: 'CO-EMP003', name: 'laxmi haribhai', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 53. Manjuben Bariya
  { id: 'FW-053', staffId: 'CO-EMP148', name: 'Manjuben Bariya', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 54. Pateliya Lilaben
  { id: 'FW-054', staffId: 'CO-EMP145', name: 'Pateliya Lilaben', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 55. shitalben Parghi
  { id: 'FW-055', staffId: 'CO-EMP110', name: 'shitalben Parghi', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 56. Prakashbhai Bariya
  { id: 'FW-056', staffId: 'CO-EMP147', name: 'Prakashbhai Bariya', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 57. Bhanuben Pariya
  { id: 'FW-057', staffId: 'EMP00114', name: 'Bhanuben Pariya', designation: 'Helper', role: 'HELPER', department: 'Housekeeping', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 58. Bagda Manisha
  { id: 'FW-058', staffId: 'EMP00119', name: 'Bagda Manisha', designation: 'Helper', role: 'HELPER', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 59. Dabhi shital Amitbhai
  { id: 'FW-059', staffId: 'EMP00062', name: 'Dabhi shital Amitbhai', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 60. Parmar Jinal
  { id: 'FW-060', staffId: 'EMP00019', name: 'Parmar Jinal', designation: 'Helper', role: 'HELPER', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 61. Nakum Priti
  { id: 'FW-061', staffId: 'EMP00043', name: 'Nakum Priti', designation: 'Production Executive', role: 'EXECUTIVE', department: 'Production', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 62. Girvatbhai taviyad
  { id: 'FW-062', staffId: 'CO-EMP108', name: 'Girvatbhai taviyad', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 63. Gulguli Kashyap
  { id: 'FW-063', staffId: 'CO-EMP007', name: 'Gulguli Kashyap', designation: 'Helper', role: 'HELPER', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 64. shilpa ben Vaghela
  { id: 'FW-064', staffId: 'EMP00106', name: 'shilpa ben Vaghela', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 65. Parmar Bhavana Haribhai
  { id: 'FW-065', staffId: 'EMP00060', name: 'Parmar Bhavana Haribhai', designation: 'Operator', role: 'OPERATOR', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 66. Bhayabhai Jethabhai parmar
  { id: 'FW-066', staffId: 'EMP00023', name: 'Bhayabhai Jethabhai parmar', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 67. Nayna Shamjibhai Vaniya
  { id: 'FW-067', staffId: 'EMP00051', name: 'Nayna Shamjibhai Vaniya', designation: 'Helper', role: 'HELPER', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 68. Bagiya Chetna
  { id: 'FW-068', staffId: 'EMP00045', name: 'Bagiya Chetna', designation: 'Quality Executive', role: 'EXECUTIVE', department: 'QC', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 69. Jasmita Bagiya
  { id: 'FW-069', staffId: 'EMP00041', name: 'Jasmita Bagiya', designation: 'Operator', role: 'OPERATOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 70. Sondarva Ajay
  { id: 'FW-070', staffId: 'EMP00123', name: 'Sondarva Ajay', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 71. Bipin Bariya
  { id: 'FW-071', staffId: 'CO-EMP155', name: 'Bipin Bariya', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 72. Bariya Shakuntala
  { id: 'FW-072', staffId: 'CO-EMP153', name: 'Bariya Shakuntala', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 73. Rekhaben Solanki
  { id: 'FW-073', staffId: 'EMP00104', name: 'Rekhaben Solanki', designation: 'Helper', role: 'HELPER', department: 'Shorting', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 74. Bariya Rohit
  { id: 'FW-074', staffId: 'CO-EMP152', name: 'Bariya Rohit', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 75. Charel Tinaben
  { id: 'FW-075', staffId: 'CO-EMP151', name: 'Charel Tinaben', designation: 'Helper', role: 'HELPER', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 76. Bariya Atul
  { id: 'FW-076', staffId: 'CO-EMP154', name: 'Bariya Atul', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 77. Vadhel Harshita
  { id: 'FW-077', staffId: 'EMP00015', name: 'Vadhel Harshita', designation: 'Operator', role: 'OPERATOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 78. Beerendra Bansal
  { id: 'FW-078', staffId: 'EMP00120', name: 'Beerendra Bansal', designation: 'Operator', role: 'OPERATOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 79. Poonam Vaghela
  { id: 'FW-079', staffId: 'EMP00074', name: 'Poonam Vaghela', designation: 'Operator', role: 'OPERATOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 80. Sejalben bhupatbhai
  { id: 'FW-080', staffId: 'EMP00075', name: 'Sejalben bhupatbhai', designation: 'Operator', role: 'OPERATOR', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 81. Katara Alpesh Bhai
  { id: 'FW-081', staffId: 'CO-EMP156', name: 'Katara Alpesh Bhai', designation: 'Helper', role: 'HELPER', department: 'Packing', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
  // 82. Chuhan Mital
  { id: 'FW-082', staffId: 'EMP00121', name: 'Chuhan Mital', designation: 'Helper', role: 'HELPER', department: 'Forming', shift: 'DAY', isPresent: true, inTime: '08:00 AM' },
];

export const DEPT_WORKERS: Record<string, string[]> = {
  'Packing': [
    "Bhavisha Ben",
    "Vadakhiya Prakash",
    "Bhathubhai Motibhai Garasiya",
    "Kalpesh Mansing Taviyal",
    "Vikash Falud",
    "Arvindbhai Pateliya",
    "Bhedi Chirag",
    "Sonukumar Ishvardayal Jadav",
    "Manish Bansal",
    "Prakashbhai Bariya",
    "Girvatbhai taviyad",
    "Parmar Bhavana Haribhai",
    "Bhayabhai Jethabhai parmar",
    "Sondarva Ajay",
    "Bipin Bariya",
    "Bariya Rohit",
    "Bariya Atul",
    "Katara Alpesh Bhai"
  ],
  'Shorting': [
    "Manishaben Taviyal",
    "Somli katara",
    "Sunita Vadakhiya",
    "Dayaben",
    "Hansa Ben Bharat Bhai Dobariya",
    "Kamlaben Varsakhiya",
    "Devuben Chavda",
    "Sharda Rameshbhai Mavi",
    "Kanta Ben Bhathubhai Garasiya",
    "Girja devi",
    "Rinki Haribhai",
    "Suman Kumari",
    "Naynaben Katara",
    "Sohilbhai Garasiya",
    "laxmi haribhai",
    "Manjuben Bariya",
    "Pateliya Lilaben",
    "shitalben Parghi",
    "Dabhi shital Amitbhai",
    "shilpa ben Vaghela",
    "Bariya Shakuntala",
    "Rekhaben Solanki"
  ],
  'Forming': [
    "Chudasama Vaishali Bharatbhai",
    "Drashtiben Taviyal",
    "Badhiya Abhay Rameshbhai",
    "Jasvanti Vaghela",
    "Bhadarka Shilpaben",
    "Khushali",
    "Saroj ben",
    "Rinki KM",
    "Sarita KM",
    "Amar Sanjay Bhai",
    "Divya Raval",
    "Aman Kumar Ishvardayal yadav",
    "Bagda Manisha",
    "Parmar Jinal",
    "Gulguli Kashyap",
    "Nayna Shamjibhai Vaniya",
    "Jasmita Bagiya",
    "Charel Tinaben",
    "Vadhel Harshita",
    "Beerendra Bansal",
    "Poonam Vaghela",
    "Sejalben bhupatbhai",
    "Chuhan Mital"
  ],
  'Cutting': [
    "Vishal Solanki",
    "Sondarva Balubhai",
    "Amishbhai",
    "Sadadiya Tushar Kishorbhai",
    "Rahul Garla"
  ],
  'QC': [
    "Anilkumar Gabhrubhai Kavad",
    "Bagiya Chetna"
  ],
  'Q C': [
    "Anilkumar Gabhrubhai Kavad",
    "Bagiya Chetna"
  ],
  'Production': [
    "Ajitbhai Vala",
    "Sandipbhai Kamriya",
    "Rajni bhai Patel",
    "Sarang Rathod",
    "Nakum Priti"
  ],
  'Housekeeping': [
    "Manjuben Babariya",
    "Bhanuben Pariya"
  ],
  'Printing': [
    "Priyanka kumari"
  ],
  'Maintenance': [
    "Kanak Sinh Chauhan",
    "Amitbhai Dabhi"
  ],
  'HR': [
    "Chintan Rathod",
    "Teraiya Hetvi"
  ],
  'H R': [
    "Chintan Rathod",
    "Teraiya Hetvi"
  ],
  'Slitting': [
    "Amishbhai",
    "Sandipbhai Kamriya"
  ]
};


export const PAPER_BRANDS = ['Orient Paper', 'BILT'];

export const TARGET_LAYERS_DEFAULT = [8, 9];
export const TARGET_GSM_DEFAULT = [
  '60 GSM',
  '120 GSM'
];

export const GLUE_BRANDS = [
  'Pidilite FS35'
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
    operator: 'Sondarva Balubhai',
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
    operator: 'Badhiya Abhay Rameshbhai',
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
  { id: 'M-REEL-ITC-001', brand: 'ITC', gsm: '120 GSM', weightKg: 250, lengthMeters: 1400, status: 'In-Use', allocatedJobId: 'JOB-SPN-101', allocatedDate: '2026-09-09' },
];

export const DEFAULT_USERS: Record<string, { pass: string; perms: string[]; name?: string; role?: string; phone?: string }> = {
  'admin': {
    pass: '1811',
    perms: ['*'],
    name: 'Master Administrator',
    role: 'Administrator'
  }
};

export const DEFAULT_MAINTENANCE_CONTACTS = [
  { id: 'MC-1', name: 'Amit Dabhi (Ele & Mech)', phone: '+91 90167 05480', role: 'Mechanical & Tooling', dept: 'Mechanical' },
  { id: 'MC-2', name: 'kannak  (Mech & hydrau)', phone: '+91 81405 00909', role: 'Hydraulic & Air Pressure', dept: 'Pneumatic' }
];

export const DEFAULT_DEPARTMENT_HEADS = [
  { id: 'DH-1', name: 'amish Slit-Head', phone: '+91 95749 66920', role: 'Slitting Department Head', dept: 'Slitting' },
  { id: 'DH-2', name: 'Amish Cut-Master', phone: '+91 95749 66920', role: 'Cutting Department Head', dept: 'Cutting' },
  { id: 'DH-3', name: 'sarang Form-Lead', phone: '+91 95106 48353', role: 'Forming Department Head', dept: 'Forming' },
  { id: 'DH-4', name: 'Chetna (Lead QC)', phone: '+91 84693 34979', role: 'Quality Control Head', dept: 'QC' },
  { id: 'DH-5', name: 'Sarang rathod', phone: '+91 95106 48353', role: 'Packing & Dispatch In-Charge', dept: 'Packing' },
  { id: 'DH-6', name: 'Manoj', phone: '+91 90339 12511', role: 'Chief Maintenance Engineer', dept: 'Maintenance' },
  { id: 'DH-7', name: 'Sandip (Plant Head)', phone: '+91 99047 58452', role: 'Plant Production Manager', dept: 'Plant Admin' },
  { id: 'DH-8', name: 'Chintan Rathod', phone: '+91 95868 26394', role: 'Purchase & Stores Officer', dept: 'Purchase' }
];

export const DEFAULT_COORDINATION_MATRIX: CoordinationMatrixItem[] = [
  {
    id: 'CM-1',
    roleName: 'Maintenance Head',
    contactName: 'Gohel manoj',
    phone: '+91 90339 12511',
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
    contactName: 'Amit Dabhi (Ele & Mech)',
    phone: '+91 90167 05480',
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
    contactName: 'Sadip',
    phone: '+91 99047 58452',
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
    contactName: 'Anil',
    phone: '+91 74349 78365',
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
  'Amit Dabhi (Ele & Mech)',
  'kannak  (Mech & hydrau)'
];

export const COMMON_SPARE_PARTS = [
  'Vaccum sucker',
];

export const DEFAULT_OPERATIONAL_PAUSE_REASONS = [
  'Operator Lunch Break (दोपहर का भोजन - 45 Min)',
  'Operator Tea Break (चाय का विराम - 15 Min)',
  'Shift Handover / Briefing (शिफ्ट बदलाव)',
  'Routine Tool Cleaning / Die & Punch Setting',
  'Waiting for Raw Material / Roll / Crates',
  'Temporary Production Halt / Intercom Call',
  'Other Operational Pause'
];

export const DEFAULT_BREAKDOWN_REASONS_MAP: Record<string, string[]> = {
  'Cutting': [
    'Blade Wear & Dull Cutters',
    'Die Alignment Error',
    'Paper Feed Jam / Web Slippage',
    'Sensor Fault / Safety Barrier Trip',
    'Motor Overload / Inverter Drive Trip'
  ],
  'Forming': [
    'Temperature Deviation (Mould Heater)',
    'Hydraulic / Pneumatic Pressure Loss',
    'Speed Mismatch / Cycle Timing Error',
    'Mould Tooling & Teflon Strip Damage',
    'Paper Forming Wrinkle / Tear'
  ],
  'QC': [
    'Leak Test Fail (Water Penetration)',
    'Burst / Compression Test Fail',
    'Dimension Out-of-Tolerance (Angle/Depth)',
    'Visual Blemish / Print Ink Smudge / Spot',
    'Rim Curl / Edge Flange Defect'
  ],
  'Slitting': [
    'Rewind Tension / Core Slippage',
    'Slitting Circular Blade Dull / Burr',
    'Jumbo Reel Unwind Chuck Loose',
    'Web Alignment Guide Sensor Drift'
  ],
  'Packing': [
    'Tape Dispenser / Box Sealer Jam',
    'Pouch Sealing Temperature Drift',
    'Weighing Scale Sensor Drift',
    'Conveyor Belt Slippage / Stoppage'
  ],
  'General': [
    'Mechanical Heater / Tooling Issue',
    'Electrical / Sensor Fault',
    'Pneumatic / Hydraulic Pressure Drop',
    'Routine Cleaning & Preventative Check',
    'Other Technical Breakdown'
  ]
};

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
    actionTakenBy: 'Anilkumar Gabhrubhai Kavad & Plant Head'
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
    requestedBy: 'Kanak Sinh Chauhan (Technician)',
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
    requestedBy: 'Sonukumar Ishvardayal Jadav',
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
    requestedBy: 'Sondarva Balubhai',
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
    requestedBy: 'Sandipbhai Kamriya',
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
  machinesMaster: MACHINES,
  pcsPerKgMaster: DEFAULT_PCS_PER_KG_MAP,
  maxPiecesPerSlitRoll: 55000,
  strictAuditRollYield: false,
  maintenanceTechniciansMaster: [
    'Kanak Sinh Chauhan (Technician)',
    'Amitbhai Dabhi (Technician)'
  ],
  maintenanceSparePartsMaster: [
    'Vaccum sucker'
  ],
  maintenancePauseReasonsMaster: DEFAULT_OPERATIONAL_PAUSE_REASONS,
  maintenanceBreakdownReasonsMaster: DEFAULT_BREAKDOWN_REASONS_MAP,
  autoNotifyDeptHeadsOnCritical: true,
  departmentHeads: DEFAULT_DEPARTMENT_HEADS,
  crateCapacityMaster: DEFAULT_CRATE_CAPACITY_MASTER,
  floorWorkers: DEFAULT_FLOOR_WORKERS,
  glueBrands: GLUE_BRANDS,
  targetLayersMaster: TARGET_LAYERS_DEFAULT,
  targetGsmMaster: TARGET_GSM_DEFAULT,
  scrapLimitsMaster: {
    'Slitting': 2.0,
    'Cutting': 2.5,
    'Forming': 1.5
  },
  glueUsageLogs: [],
  productionPlans: [],
  motherReelInventory: [],
  coordinationMatrix: DEFAULT_COORDINATION_MATRIX,
  shiftHandovers: []
};
