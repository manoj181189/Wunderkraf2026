const fs = require('fs');
const file = 'src/components/views/AdminSettingsView.tsx';
let code = fs.readFileSync(file, 'utf8');

// Import MaintenanceContact
const typeImportRegex = /import type \{([^}]+)\} from '\.\.\/\.\.\/types';/;
const typeMatch = code.match(typeImportRegex);
if (typeMatch && !typeMatch[1].includes('MaintenanceContact')) {
  code = code.replace(typeMatch[1], typeMatch[1] + ', MaintenanceContact');
}

// Import Phone
const lucideImportRegex = /import \{([^}]+)\} from 'lucide-react';/;
const lucideMatch = code.match(lucideImportRegex);
if (lucideMatch && !lucideMatch[1].includes('Phone')) {
  code = code.replace(lucideMatch[1], lucideMatch[1] + ', Phone');
}

fs.writeFileSync(file, code);
console.log("Imports fixed");
