const fs = require('fs');
const file = 'src/components/views/AdminSettingsView.tsx';
const code = fs.readFileSync(file, 'utf8');

const lines = code.split('\n');
const startIdx = 4771; // line 4772 is 4771 index
const endIdx = 4852; // line 4853 is 4852 index

const newContent = `
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h5 className="text-xs font-black text-slate-900 uppercase m-0 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-emerald-600" />
                  WhatsApp API Configuration
                </h5>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Target WhatsApp Number (With Country Code)</label>
                    <input type="text" value={waPhone} onChange={e => setWaPhone(e.target.value)} placeholder="+919876543210" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">API Key / Token</label>
                    <input type="password" value={waApiKey} onChange={e => setWaApiKey(e.target.value)} placeholder="Enter API Key" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none" />
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                <h5 className="text-xs font-black text-indigo-900 uppercase m-0 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  Automated Reporting Triggers
                </h5>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={waAutoDay} onChange={e => setWaAutoDay(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-xs font-bold text-indigo-900">Auto-Send Day Shift Report</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={waAutoNight} onChange={e => setWaAutoNight(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-xs font-bold text-indigo-900">Auto-Send Night Shift Report</span>
                  </label>
                </div>
                <div className="pt-2 border-t border-indigo-200">
                  <button type="button" onClick={handleSaveWhatsAppConfig} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow transition">Save WhatsApp Configuration</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: MAINTENANCE MASTER & RIGHTS STATE */}
      {/* ========================================================================= */}
      {activeTab === 'maintenance_master' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
                🔧 Maintenance Desk Master & Rights Suite
              </h4>
              <p className="text-xs text-slate-500 m-0">
                Admin controls for Maintenance Desk permissions, technician directory, spare parts catalogue, and roll yield limits.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveMaintenanceMaster}
              className="px-4 py-2 bg-[#1a365d] hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Maintenance Masters</span>
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Maintenance Rights Assignment */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h5 className="text-xs font-black text-slate-900 uppercase m-0 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-blue-600" />
                  Maintenance Rights Quick-Grant
                </h5>
              </div>
              <p className="text-[11px] text-slate-600 m-0">
                Select an active user to immediately grant or revoke full Maintenance Desk operational rights:
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {Object.keys(usersRecord).map((userKey) => {
                  const u = usersRecord[userKey];
                  if (u.role === 'ADMIN') return null;
                  const hasRights = u.perms.includes('MAINTENANCE_LOGS') && u.perms.includes('MAINTENANCE_RESOLVE');
                  return (
                    <div key={userKey} className="flex flex-col gap-2 p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{u.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{userKey}</span>
                        </div>
                        <span className={\`px-1.5 py-0.5 rounded text-[10px] font-black \${hasRights ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}\`}>
                          {hasRights ? 'GRANTED' : 'NO ACCESS'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={hasRights}
                          onClick={() => handleGrantAllMaintenanceRightsToUser(userKey)}
                          className={\`flex-1 py-1 rounded text-[10px] font-bold transition \${hasRights ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer'}\`}
                        >
                          Grant Access
                        </button>
                        <button
                          type="button"
                          disabled={!hasRights}
                          onClick={() => handleRevokeMaintenanceRightsFromUser(userKey)}
                          className={\`flex-1 py-1 rounded text-[10px] font-bold transition \${!hasRights ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer'}\`}
                        >
                          Revoke Access
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Technicians Master Directory */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
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
            </div>

            {/* 3. Spare Parts & Settings */}
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h5 className="text-xs font-black text-slate-900 uppercase m-0 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-purple-600" />
                    Common Spare Parts Catalogue
                  </h5>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPartName}
                    onChange={(e) => setNewPartName(e.target.value)}
                    placeholder="e.g. 50mm Heater Band"
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddSparePart}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {maintSpareParts.map((part, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
                      <span className="font-bold text-slate-800">{part}</span>
                      <button type="button" onClick={() => handleRemoveSparePart(idx)} className="text-slate-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h5 className="text-xs font-black text-slate-900 uppercase m-0 flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-slate-600" />
                    Production Limits
                  </h5>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Max Pieces Per Slit Roll</label>
                  <input type="number" value={maxRollPieces} onChange={(e) => setMaxRollPieces(Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800" />
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={strictRollAudit} onChange={e => setStrictRollAudit(e.target.checked)} className="rounded" />
                  <span className="text-xs font-bold text-slate-800">Strict Roll Audit Yield Validation</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
`;

const newCode = lines.slice(0, startIdx).join('\n') + '\n' + newContent + '\n' + lines.slice(endIdx + 1).join('\n');
fs.writeFileSync(file, newCode);
console.log("Fixed!");
