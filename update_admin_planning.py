import os

filepath = 'src/components/views/AdminSettingsView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Qty (Pcs):</label>
                      <input
                        type="number"
                        value={planEditForm.targetQuantity || 0}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, targetQuantity: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                  </div>"""

new_block = """                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Qty (Pcs):</label>
                      <input
                        type="number"
                        value={planEditForm.targetQuantity || 0}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, targetQuantity: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="adminPrintedRollRequired"
                        checked={planEditForm.printedRollRequired || false}
                        onChange={(e) => setPlanEditForm({ ...planEditForm, printedRollRequired: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                      />
                      <label htmlFor="adminPrintedRollRequired" className="text-xs font-extrabold text-slate-700 uppercase">
                        Requires Printed Roll?
                      </label>
                    </div>
                    {planEditForm.printedRollRequired && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Printed Brand / Design Name</label>
                          <input
                            type="text"
                            value={planEditForm.printedRollDesign || ''}
                            onChange={(e) => setPlanEditForm({ ...planEditForm, printedRollDesign: e.target.value })}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Printed Layers</label>
                          <input
                            type="number"
                            min={1}
                            value={planEditForm.printedLayersCount || 2}
                            onChange={(e) => setPlanEditForm({ 
                              ...planEditForm, 
                              printedLayersCount: Number(e.target.value),
                              plainLayersCount: planEditForm.targetLayers - Number(e.target.value) 
                            })}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Plain Layers</label>
                          <input
                            type="number"
                            disabled
                            value={planEditForm.plainLayersCount || (planEditForm.targetLayers - (planEditForm.printedLayersCount || 2))}
                            className="w-full px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-500 cursor-not-allowed"
                          />
                        </div>
                      </div>
                    )}
                  </div>"""

content = content.replace(old_block, new_block)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated AdminSettingsView.tsx")
