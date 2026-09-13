const fs = require('fs');
const file = 'src/components/views/AdminSettingsView.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Remove the Top Quick Actions Bar (Zero Data & Clean Setup)
const topBarRegex = /\{\/\* Top Quick Actions Bar \*\/\}.*?\{\/\* Section 1: Paper Mill Brands \*\/\}/s;
code = code.replace(topBarRegex, '{/* Section 1: Paper Mill Brands */}');

// 2. Add state for master password
const stateRegex = /const \[activeTab, setActiveTab\] = useState<AdminTab>\('brand_items_paper'\);/;
code = code.replace(stateRegex, "const [activeTab, setActiveTab] = useState<AdminTab>('brand_items_paper');\n  const [masterPasswordInput, setMasterPasswordInput] = useState(state.adminPassword || '1234');");

// 3. Add function to handle update
const handleSaveUserPermissionsRegex = /const handleSaveUserPermissions = \(\) => \{/;
const updateMasterPasswordFunc = `  const handleUpdateMasterPassword = () => {
    if (!masterPasswordInput.trim()) {
      alert('Password cannot be empty');
      return;
    }
    onSaveState({
      ...state,
      adminPassword: masterPasswordInput
    });
    alert('✅ Master Admin Password updated successfully! This password will now be required for all Factory Resets and Backup Restores.');
  };

  const handleSaveUserPermissions = () => {`;
code = code.replace(handleSaveUserPermissionsRegex, updateMasterPasswordFunc);

// 4. Add UI in users tab
const usersTabRegex = /<div className="flex items-center justify-between flex-wrap gap-2">/;
const newUI = `          {/* Master Admin Password Setup */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black shadow-xs">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-red-900 uppercase m-0 tracking-wide">
                    Master Admin Security Lock
                  </h4>
                  <p className="text-[11px] text-red-700 font-medium m-0 mt-0.5">
                    This password is required to perform Modular Resets, Full Factory Wipes, and JSON Backup Restorations.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4 bg-white p-3 rounded-lg border border-red-100 shadow-sm inline-flex">
                <div className="flex flex-col">
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1">Set Global Master Password</label>
                  <input
                    type="text"
                    value={masterPasswordInput}
                    onChange={(e) => setMasterPasswordInput(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-md text-sm font-black text-slate-900 w-64 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition"
                    placeholder="e.g. 1234 or Admin@123"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUpdateMasterPassword}
                  className="mt-5 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-md shadow-xs transition cursor-pointer"
                >
                  Update Lock
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">`;
code = code.replace(usersTabRegex, newUI);

fs.writeFileSync(file, code);
console.log("Success");
