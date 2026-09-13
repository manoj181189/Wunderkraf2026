const fs = require('fs');
const file = 'src/components/views/AdminSettingsView.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldTab5Regex = /\{\/\* TAB 5: DATABASE BACKUP & JSON RESTORE \*\/\}.*?\{\/\* ========================================================================= \*\/\}\n\s*\{\/\* TAB 6:/s;

const newTab5 = `{/* TAB 5: DATABASE BACKUP, RESTORE & MODULAR RESET */}
      {/* ========================================================================= */}
      {activeTab === 'backup_restore' && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0">
              Database Storage Health, Archival & Safe Recovery
            </h4>
            <p className="text-xs text-slate-500 m-0">
              High-capacity IndexedDB persistence with mandatory auto-backup safety protocols.
            </p>
          </div>

          {/* Storage Health & Resilience Telemetry Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-[#1a365d] rounded-2xl p-5 text-white shadow-md border border-slate-700">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center font-black">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Persistence Engine</div>
                  <div className="text-base font-black text-white flex items-center gap-2">
                    <span>{storageHealth?.engine || 'IndexedDB (Enterprise High-Capacity)'}</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                      ACTIVE & PROTECTED
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRunPruning}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-blue-400/30"
                title="Archive historical records older than 30 days to free up operational memory"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Run Archival & Auto-Prune</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block">Current Footprint</span>
                <span className="font-extrabold text-white text-sm">
                  {storageHealth?.usedBytes ? \`\${(storageHealth.usedBytes / 1024).toFixed(1)} KB\` : '< 1 MB'}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Quota: {storageHealth?.quotaBytes ? \`\${Math.round(storageHealth.quotaBytes / (1024 * 1024))} MB\` : '1024 MB'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Operational Records</span>
                <span className="font-extrabold text-white text-sm">
                  {(state.jobs?.length || 0) + (state.packJobs?.length || 0)} Total
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {state.jobs?.length || 0} Jobs, {state.packJobs?.length || 0} Orders
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Audit Logs</span>
                <span className="font-extrabold text-white text-sm">{state.logs?.length || 0} Entries</span>
                <span className="text-[10px] text-slate-400 block">Zero Data Loss Policy</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Cold Archival Records</span>
                <span className="font-extrabold text-white text-sm">
                  {(state.archivedJobs?.length || 0) + (state.archivedLogs?.length || 0)} Archived
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {state.archivedJobs?.length || 0} Jobs, {state.archivedLogs?.length || 0} Logs
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-3 shadow-xs">
                  <Download className="w-5 h-5" />
                </div>
                <h5 className="text-sm font-black text-slate-900 uppercase m-0">Manual Backup Export</h5>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Download a complete factory snapshot containing metadata, production jobs, pack orders, and full audit logs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportDatabaseBackup(state)}
                className="mt-5 w-full py-2.5 bg-[#2b6cb0] hover:bg-[#1a365d] text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" /> Download Full JSON Backup
              </button>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-5 flex flex-col justify-between shadow-[inset_0_2px_10px_rgba(16,185,129,0.05)]">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-3 shadow-xs border border-emerald-200">
                  <Upload className="w-5 h-5" />
                </div>
                <h5 className="text-sm font-black text-emerald-950 uppercase m-0">Restore Factory Backup / Undo Reset</h5>
                <p className="text-xs text-emerald-700/80 mt-1.5 leading-relaxed font-medium">
                  Select ANY previously saved JSON backup (including pre-reset Auto-Backups). Restoring validates JSON integrity and requires the Admin Password.
                </p>
              </div>
              <label className="mt-5 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm">
                <Upload className="w-4 h-4" /> Secure JSON Upload & Restore
                <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
              </label>
            </div>
          </div>

          <div className="mt-6 border border-rose-200 bg-rose-50/30 rounded-2xl overflow-hidden">
            <div className="bg-rose-100/50 border-b border-rose-200 p-4">
              <h5 className="text-sm font-black text-rose-950 flex items-center gap-2 uppercase">
                <RotateCcw className="w-4 h-4 text-rose-600" /> Modular Reset Console
              </h5>
              <p className="text-[11px] font-medium text-rose-700 mt-1 leading-tight">
                Mandatory Auto-Backup applies to all actions. A factory state snapshot will be downloaded to your device before any deletion is finalized. Requires Master Admin Password.
              </p>
            </div>
            
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { id: 'slitting', title: 'Slitting Floor Data', desc: 'Clear Slit Jobs, slit rolls buffer, and slitting activity logs only.' },
                { id: 'cutting', title: 'Cutting Floor Data', desc: 'Clear Cut Crates, cutting batches, and cutting scrap logs only.' },
                { id: 'forming', title: 'Forming Floor Data', desc: 'Clear Forming batches, line logs FM-01 to FM-04, and heater telemetry.' },
                { id: 'qc', title: 'QC & Inspection Data', desc: 'Clear QC vouchers, inspected crate balances, and defect Pareto logs.' },
                { id: 'packing', title: 'Packing & Dispatch Data', desc: 'Clear packed cartons, pallet records, and dispatch challan logs.' },
                { id: 'master', title: 'Master Configs & Brands', desc: 'Reset glue/paper brands, custom GSMs, spare parts to defaults.' },
                { id: 'maintenance', title: 'Maintenance & Incidents', desc: 'Clear breakdown history, technician attend logs, and tickets.' },
              ].map(cat => (
                <div key={cat.id} className="bg-white border border-rose-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition group">
                  <div className="mb-2">
                    <h6 className="text-xs font-extrabold text-slate-800 m-0 group-hover:text-rose-700 transition">{cat.title}</h6>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{cat.desc}</p>
                  </div>
                  <button
                    onClick={() => handleModularReset(cat.id, cat.title)}
                    className="w-full py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 font-bold text-[10px] rounded-lg transition"
                  >
                    Wipe {cat.title.split(' ')[0]}
                  </button>
                </div>
              ))}
              
              <div className="bg-rose-600 border border-rose-800 rounded-xl p-3.5 shadow-md hover:shadow-lg transition group text-white md:col-span-2 lg:col-span-1">
                <div className="mb-2">
                  <h6 className="text-xs font-black m-0 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Complete Factory Wipe
                  </h6>
                  <p className="text-[10px] text-rose-200 mt-0.5 leading-tight">Master hard reset of all production state, keeping only Admin credentials.</p>
                </div>
                <button
                  onClick={() => handleModularReset('full', 'Complete Factory Wipe')}
                  className="w-full py-1.5 bg-rose-900 hover:bg-black text-white font-black text-[10px] rounded-lg transition border border-rose-950"
                >
                  DANGER: FULL WIPE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* TAB 6:`;

if (oldTab5Regex.test(code)) {
  code = code.replace(oldTab5Regex, newTab5);
  fs.writeFileSync(file, code);
  console.log("Success");
} else {
  console.log("Regex mismatch");
}
