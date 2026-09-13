const fs = require('fs');
const file = 'src/components/views/MaintenanceView.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Remove Coordination Matrix from bottom
const coordMatrixStart = /\{\/\* Department Heads Coordination Matrix \*\/\}/;
// It ends just before "</div>\n        </div>\n      )}\n    </div>\n  );\n};\n\nexport default MaintenanceView;"
const coordMatrixRegex = /\{\/\* Department Heads Coordination Matrix \*\/\}.*?(?=\s*<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*\);\s*\}\s*;\s*export default MaintenanceView;)/s;
code = code.replace(coordMatrixRegex, '');

// Also change the grid layout since there's only one card now in that tab
code = code.replace('<div className="grid grid-cols-1 md:grid-cols-2 gap-5">', '<div className="grid grid-cols-1 md:grid-cols-1 gap-5 max-w-3xl">');

// 2. Pass availableTechnicians to AttendingTechnicianModal
const modalRegex = /<AttendingTechnicianModal\s+isOpen=\{!!attendingModalIncident\}\s+onClose=\{\(\) => setAttendingModalIncident\(null\)\}\s+machineName=\{attendingModalIncident\.machine\}\s+incidentId=\{attendingModalIncident\.id\}\s+reason=\{attendingModalIncident\.reason\}\s+currentAttendant=\{attendingModalIncident\.technicianName \|\| attendingModalIncident\.attendedBy\}\s+onConfirmAttend=\{handleConfirmAttend\}\s+\/>/;
const newModal = `<AttendingTechnicianModal
          isOpen={!!attendingModalIncident}
          onClose={() => setAttendingModalIncident(null)}
          machineName={attendingModalIncident.machine}
          incidentId={attendingModalIncident.id}
          reason={attendingModalIncident.reason}
          currentAttendant={attendingModalIncident.technicianName || attendingModalIncident.attendedBy}
          availableTechnicians={contacts.map(c => c.name)}
          onConfirmAttend={handleConfirmAttend}
        />`;
code = code.replace(modalRegex, newModal);

fs.writeFileSync(file, code);
console.log("Success");
