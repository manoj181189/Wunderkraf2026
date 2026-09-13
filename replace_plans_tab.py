import os

with open('src/components/views/AdminSettingsView.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "masterSubTab === 'plans' && (" in line:
        if start_idx == -1:
            start_idx = i
    if "masterSubTab === 'logs' && (" in line:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_content = """
          {/* ------------------------------------------------------------- */}
          {/* SUB-TAB D: PPC / PLANNING MASTER OVERWRITE */}
          {/* ------------------------------------------------------------- */}
          {masterSubTab === 'plans' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Select Production Plan to Edit / Overwrite:
                  </label>
                  <select
                    value={selectedPlanIdToEdit}
                    onChange={(e) => handleSelectPlanToEdit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  >
                    {(state.productionPlans || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} - {p.product} (Job: {p.jobId}) - Status: {p.status}
                      </option>
                    ))}
                  </select>
                </div>
                {planEditForm && (
                  <button
                    type="button"
                    onClick={() => handleDeletePlan(planEditForm.id)}
                    className="mt-4 px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 font-extrabold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Plan
                  </button>
                )}
              </div>

              {planEditForm ? (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-blue-900 uppercase mb-1">
                        Plan ID:
                      </label>
                      <input
                        type="text"
                        value={planEditForm.id}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, id: e.target.value })}
                        className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-xs font-bold text-slate-800 bg-blue-50/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Job ID (Linked Job):
                      </label>
                      <input
                        type="text"
                        value={planEditForm.jobId}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, jobId: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Plan Status:
                      </label>
                      <select
                        value={planEditForm.status}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, status: e.target.value as any })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      >
                        <option value="Scheduled">Scheduled (PLANNED)</option>
                        <option value="In-Progress">In-Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Product:
                      </label>
                      <select
                        value={planEditForm.product}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, product: e.target.value as any })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      >
                        {productsList.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Layers:</label>
                      <input
                        type="number"
                        value={planEditForm.targetLayers || 0}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, targetLayers: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Length (M):</label>
                      <input
                        type="number"
                        value={planEditForm.targetLengthMeters || 0}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, targetLengthMeters: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target GSM:</label>
                      <input
                        type="text"
                        value={planEditForm.targetGsm || ''}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, targetGsm: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Paper Brand:</label>
                      <input
                        type="text"
                        value={planEditForm.paperBrand || ''}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, paperBrand: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Glue Brand:</label>
                      <input
                        type="text"
                        value={planEditForm.adhesiveBrand || ''}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, adhesiveBrand: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Scrap Limit (%):</label>
                      <input
                        type="number"
                        step={0.1}
                        value={planEditForm.targetScrapLimitPct || 0}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, targetScrapLimitPct: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Qty (Pcs):</label>
                      <input
                        type="number"
                        value={planEditForm.targetQuantity || 0}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, targetQuantity: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Allocated Machine:</label>
                      <input
                        type="text"
                        value={planEditForm.assignedMachine || ''}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, assignedMachine: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleSavePlanEdit}
                      className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Save Master Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-6">Select a Production Plan above to edit</div>
              )}
            </div>
          )}
"""
    output = lines[:start_idx] + [new_content] + lines[end_idx:]
    with open('src/components/views/AdminSettingsView.tsx', 'w', encoding='utf-8') as f:
        f.writelines(output)
