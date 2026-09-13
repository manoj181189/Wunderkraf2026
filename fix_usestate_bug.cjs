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

replaceInFile('src/components/BomView.tsx', (s) => s.replace(/useState;/g, 'useState(\'\');'));
replaceInFile('src/components/LiveMaintenanceTracker.tsx', (s) => s.replace(/useState;/g, 'useState(0);'));
replaceInFile('src/components/NewProductionOrderModal.tsx', (s) => s.replace(/useState;/g, 'useState(\'\');'));
replaceInFile('src/components/TechnicianAttendModal.tsx', (s) => s.replace(/useState;/g, 'useState(0);'));
replaceInFile('src/components/VoiceTranscriberModal.tsx', (s) => s.replace(/useState;/g, 'useState(0);'));
replaceInFile('src/components/views/MaintenanceView.tsx', (s) => s.replace(/useState;/g, 'useState(0);'));
replaceInFile('src/components/views/PackingView.tsx', (s) => s.replace(/useState;/g, 'useState(\'\');'));
replaceInFile('src/components/views/PlanningDeskView.tsx', (s) => s.replace(/useState;/g, 'useState(\'\');'));

console.log('Finished fixing useState bug!');
