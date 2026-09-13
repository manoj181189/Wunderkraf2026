const fs = require('fs');
const file = 'src/components/views/AdminSettingsView.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Update Imports
code = code.replace(
  'DEFAULT_COORDINATION_MATRIX',
  'DEFAULT_COORDINATION_MATRIX,\n  DEFAULT_MAINTENANCE_CONTACTS'
);

// We need the MaintenanceContact type
const typeImportRegex = /import type \{([^}]+)\} from '\.\.\/\.\.\/types';/;
const typeMatch = code.match(typeImportRegex);
if (typeMatch && !typeMatch[1].includes('MaintenanceContact')) {
  code = code.replace(typeMatch[1], typeMatch[1] + ', MaintenanceContact');
}

// 2. Add maintenanceContacts state, replacing maintTechs
const maintTechsStateRegex = /const \[maintTechs, setMaintTechs\] = useState<string\[\]>\(\(\) => \{.*?\n\s*\}\);/s;
const newMaintState = `const [maintenanceContacts, setMaintenanceContacts] = useState<MaintenanceContact[]>(() => {
    return state.maintenanceContacts && state.maintenanceContacts.length > 0
      ? state.maintenanceContacts
      : DEFAULT_MAINTENANCE_CONTACTS;
  });
  const [newTechPhone, setNewTechPhone] = useState('');
  const [newTechRole, setNewTechRole] = useState('');
  const [newTechDept, setNewTechDept] = useState('Mechanical');`;
code = code.replace(maintTechsStateRegex, newMaintState);

// 3. Update handlers
const handleAddTechRegex = /const handleAddTech = \(\) => \{.*?\n\s*setNewTechName\(''\);\n\s*\};/s;
const newHandleAddTech = `const handleAddTech = () => {
    if (!newTechName.trim() || !newTechPhone.trim() || !newTechRole.trim()) {
      alert('Name, Phone, and Role are required!');
      return;
    }
    const newContact: MaintenanceContact = {
      id: \`MC-\${Date.now()}\`,
      name: newTechName.trim(),
      phone: newTechPhone.trim(),
      role: newTechRole.trim(),
      dept: newTechDept
    };
    setMaintenanceContacts([...maintenanceContacts, newContact]);
    setNewTechName('');
    setNewTechPhone('');
    setNewTechRole('');
  };`;
code = code.replace(handleAddTechRegex, newHandleAddTech);

const handleRemoveTechRegex = /const handleRemoveTech = \(idx: number\) => \{\n\s*setMaintTechs\(maintTechs\.filter\(\(\_, i\) => i !== idx\)\);\n\s*\};/s;
const newHandleRemoveTech = `const handleRemoveTech = (idx: number) => {
    setMaintenanceContacts(maintenanceContacts.filter((_, i) => i !== idx));
  };`;
code = code.replace(handleRemoveTechRegex, newHandleRemoveTech);

const saveStateRegex = /maintenanceTechniciansMaster: maintTechs,/;
const newSaveState = `maintenanceContacts: maintenanceContacts,
      maintenanceTechniciansMaster: maintenanceContacts.map(c => c.name),`; // keep string array for backward compatibility if any modal still uses it (though we updated it)
code = code.replace(saveStateRegex, newSaveState);

// 4. Update UI Block
const uiBlockRegex = /<div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">.*?Maintenance Technicians Directory.*?<\/div>\s*<\/div>\s*<\/div>/s;

const newUIBlock = `<div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h5 className="text-xs font-black text-slate-900 uppercase m-0 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Maintenance Team Directory ({maintenanceContacts.length})
                </h5>
              </div>
              <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newTechName}
                    onChange={(e) => setNewTechName(e.target.value)}
                    placeholder="Name (e.g. Mukesh Kumar)"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
                  />
                  <input
                    type="text"
                    value={newTechPhone}
                    onChange={(e) => setNewTechPhone(e.target.value)}
                    placeholder="Phone (e.g. +91 98...)"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
                  />
                  <input
                    type="text"
                    value={newTechRole}
                    onChange={(e) => setNewTechRole(e.target.value)}
                    placeholder="Role (e.g. Sr. Fitter)"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
                  />
                  <select
                    value={newTechDept}
                    onChange={(e) => setNewTechDept(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none"
                  >
                    <option value="Mechanical">Mechanical</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Pneumatic">Pneumatic</option>
                    <option value="Tooling">Tooling</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddTech}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Team Member
                </button>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {maintenanceContacts.map((tech, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col p-2 bg-white rounded-lg border border-slate-200 text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1">
                      <span className="font-extrabold text-slate-800">{tech.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTech(idx)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                      <div><span className="font-bold text-slate-700">Phone:</span> {tech.phone}</div>
                      <div><span className="font-bold text-slate-700">Dept:</span> {tech.dept}</div>
                      <div className="col-span-2"><span className="font-bold text-slate-700">Role:</span> {tech.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>`;

code = code.replace(uiBlockRegex, newUIBlock);

fs.writeFileSync(file, code);
console.log("Success Admin Settings Update");
