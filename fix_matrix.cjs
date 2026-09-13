const fs = require('fs');
const file = 'src/components/views/MaintenanceView.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /\{\/\*\s*Department Heads Coordination Roster\s*\*\/\}.*?(?=\s*<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*\);\s*\}\s*;\s*export default MaintenanceView;)/s;
code = code.replace(regex, '');

fs.writeFileSync(file, code);
console.log("Matrix removed");
