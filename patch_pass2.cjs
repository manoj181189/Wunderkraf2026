const fs = require('fs');

function replaceInFile(file, fn) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const updated = fn(content);
  if (updated !== content) {
    fs.writeFileSync(file, updated);
    console.log(`Updated ${file}`);
  }
}

// 1. AttendingTechnicianModal.tsx:56
replaceInFile('src/components/AttendingTechnicianModal.tsx', (s) => {
  return s.replace(
    /onConfirmAttend\(effectiveTech, attendNotes\.trim\(\);/g,
    "onConfirmAttend(effectiveTech, attendNotes.trim());"
  );
});

// 2. CapacityView.tsx:52
replaceInFile('src/components/CapacityView.tsx', (s) => {
  return s.replace(
    /Array\.from\(bookedHoursMap\.values\.reduce\(\(sum, h\) => sum \+ h, 0\);/g,
    "Array.from(bookedHoursMap.values()).reduce((sum, h) => sum + h, 0);"
  );
});

// 3. LotGenealogyModal.tsx:73
replaceInFile('src/components/LotGenealogyModal.tsx', (s) => {
  return s.replace(
    /const stageLog = jobLogs\.filter\(\(l\) => l\.stage\?\.toLowerCase\(\)\.includes\(stageName\.toLowerCase\(\)\.slice\[0\];/g,
    "const stageLog = jobLogs.filter((l) => l.stage?.toLowerCase().includes(stageName.toLowerCase()))[0];"
  ).replace(
    /l\.stage\?\.toLowerCase\(\)\.includes\(stageName\.toLowerCase\(\)\.slice\[0\];/g,
    "l.stage?.toLowerCase().includes(stageName.toLowerCase()))[0];"
  );
});

// 4. OpeningStockModal.tsx:438
replaceInFile('src/components/OpeningStockModal.tsx', (s) => {
  return s.replace(
    /onChange=\{\(e\) => setLotRef\(e\.target\.value\.toUpperCase\(\)\}/g,
    "onChange={(e) => setLotRef(e.target.value.toUpperCase())}"
  );
});

// 5. SelfPasswordModal.tsx:29
replaceInFile('src/components/SelfPasswordModal.tsx', (s) => {
  return s.replace(
    /onSavePassword\(newPass\.trim\(\);/g,
    "onSavePassword(newPass.trim());"
  );
});

// 6. ShiftHandoverModal.tsx:479
replaceInFile('src/components/ShiftHandoverModal.tsx', (s) => {
  return s.replace(
    /<select[^>]*>[\s\S]*?<\/select>/,
    (match) => match
  );
});

// 7. StockDetailModal.tsx:542
replaceInFile('src/components/StockDetailModal.tsx', (s) => {
  return s.replace(
    /\{\s*=>\s*\{/g,
    "{(() => {"
  ).replace(
    /const reels = getJobAllReels\(j\);/g,
    "const reels = getJobAllReels(j);"
  );
});

// 8. AdminSettingsView.tsx:441
replaceInFile('src/components/views/AdminSettingsView.tsx', (s) => {
  return s.replace(
    /const \[deptWorkersState, setDeptWorkersState\] = useState<Record<string, string\[\]>> => \{/g,
    "const [deptWorkersState, setDeptWorkersState] = useState<Record<string, string[]>>(() => {"
  );
});

// 9. AnalyticsView.tsx:120
replaceInFile('src/components/views/AnalyticsView.tsx', (s) => {
  return s.replace(
    /list = list\.filter\(\(e\) => e\.stage\.toLowerCase\(\) === operatorDept\.toLowerCase\(\);/g,
    "list = list.filter((e) => e.stage.toLowerCase() === operatorDept.toLowerCase());"
  );
});

// 10. CuttingView.tsx:564
replaceInFile('src/components/views/CuttingView.tsx', (s) => {
  return s.replace(
    /if \(w\.name\.toUpperCase\(\) === operator\.trim\(\)\.toUpperCase\(\)\s*\{/g,
    "if (w.name.toUpperCase() === operator.trim().toUpperCase()) {"
  );
});

// 11. ExecutiveManpowerView.tsx:118
replaceInFile('src/components/views/ExecutiveManpowerView.tsx', (s) => {
  return s.replace(
    /efficiency: Number\(baseEfficiency\.toFixed\(2\),\s*totalScrap: Number\(totalScrap\.toFixed\(2\),/g,
    "efficiency: Number(baseEfficiency.toFixed(2)),\n        totalScrap: Number(totalScrap.toFixed(2)),"
  );
});

// 12. MaintenanceAuditView.tsx:243
replaceInFile('src/components/views/MaintenanceAuditView.tsx', (s) => {
  return s.replace(
    /\(l\.worker && l\.worker\.toLowerCase\(\)\.includes\(logSearch\.toLowerCase\(\)\s*\|\|\s*\(l\.machine && l\.machine\.toLowerCase\(\)\.includes\(logSearch\.toLowerCase\(\)\s*\|\|\s*\(l\.user && l\.user\.toLowerCase\(\)\.includes\(logSearch\.toLowerCase\(\);/g,
    "(l.worker && l.worker.toLowerCase().includes(logSearch.toLowerCase())) ||\n      (l.machine && l.machine.toLowerCase().includes(logSearch.toLowerCase())) ||\n      (l.user && l.user.toLowerCase().includes(logSearch.toLowerCase()));"
  ).replace(
    /\(l\.user && l\.user\.toLowerCase\(\)\.includes\(logSearch\.toLowerCase\(\);/g,
    "(l.user && l.user.toLowerCase().includes(logSearch.toLowerCase()));"
  );
});

// 13. MaintenanceView.tsx:302
replaceInFile('src/components/views/MaintenanceView.tsx', (s) => {
  return s.replace(
    /const repairDurationMins = Math\.max\(1, Math\.round\(\(stopMs - new Date\(repairStartIso\)\.getTime\(\)\) \/ 60000\);/g,
    "const repairDurationMins = Math.max(1, Math.round((stopMs - new Date(repairStartIso).getTime()) / 60000));"
  );
});

// 14. SlittingView.tsx:657
replaceInFile('src/components/views/SlittingView.tsx', (s) => {
  return s.replace(
    /const finalScrapPercent = inputWeight > 0 \? Number\(\(\(finalScrapKg \/ inputWeight\) \* 100\)\.toFixed : 0;/g,
    "const finalScrapPercent = inputWeight > 0 ? Number(((finalScrapKg / inputWeight) * 100).toFixed(2)) : 0;"
  );
});

// 15. StockMatrixView.tsx:44
replaceInFile('src/components/views/StockMatrixView.tsx', (s) => {
  return s.replace(
    /const filteredProducts = productList\.filter\(\(prod\) =>\s*prod\.toLowerCase\(\)\.includes\(searchTerm\.toLowerCase\(\)\.trim\(\)\)/g,
    "const filteredProducts = productList.filter((prod) =>\n    prod.toLowerCase().includes(searchTerm.toLowerCase().trim())\n  );"
  );
});

// 16. audioRecorder.ts:109
replaceInFile('src/lib/audioRecorder.ts', (s) => {
  return s.replace(
    /this\.stream\.getTracks\(\)\.forEach\(\(t\) => t\.stop;/g,
    "this.stream.getTracks().forEach((t) => t.stop());"
  );
});

// 17. productionAudit.ts:389
replaceInFile('src/lib/productionAudit.ts', (s) => {
  return s.replace(
    /: events\.filter\(\(e\) => e\.operator\.toLowerCase\(\) === selectedOperator\.toLowerCase\(\);/g,
    ": events.filter((e) => e.operator.toLowerCase() === selectedOperator.toLowerCase());"
  );
});

// 18. mrpEngine.ts:155
replaceInFile('src/utils/mrpEngine.ts', (s) => {
  return s.replace(
    /grossRequirement: Number\(entry\.grossQty\.toFixed\(2\),/g,
    "grossRequirement: Number(entry.grossQty.toFixed(2)),"
  );
});

console.log('Finished patch_pass2!');
