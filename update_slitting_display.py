import os
filepath = 'src/components/views/SlittingView.tsx'
with open(filepath, 'r') as f: content = f.read()

target = """          {selectedPlanId && (
            <div className="bg-indigo-50 p-2.5 rounded-lg border border-indigo-150 text-[11px] text-indigo-950 font-medium grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                Target Layers: <b className="text-indigo-900">{productionPlans.find(p => p.id === selectedPlanId)?.targetLayers} Layers</b>
              </div>
              <div>
                Target Length: <b className="text-indigo-900">{productionPlans.find(p => p.id === selectedPlanId)?.targetLengthMeters} Meters</b>
              </div>
              <div>
                Scrap Limit: <b className="text-indigo-900">≤ {productionPlans.find(p => p.id === selectedPlanId)?.targetScrapLimitPct}%</b>
              </div>
            </div>
          )}"""

replacement = """          {selectedPlanId && (() => {
            const sp = productionPlans.find(p => p.id === selectedPlanId);
            return sp ? (
            <div className="bg-indigo-50 p-2.5 rounded-lg border border-indigo-150 text-[11px] text-indigo-950 font-medium flex flex-col gap-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  Target Layers: <b className="text-indigo-900">{sp.targetLayers} Layers</b>
                </div>
                <div>
                  Target Length: <b className="text-indigo-900">{sp.targetLengthMeters} Meters</b>
                </div>
                <div>
                  Scrap Limit: <b className="text-indigo-900">≤ {sp.targetScrapLimitPct}%</b>
                </div>
              </div>
              {sp.printedRollRequired && (
                <div className="pt-2 mt-1 border-t border-indigo-200 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="text-indigo-800">
                    Printed Layers: <b className="text-indigo-950">{sp.printedLayersCount || 2}</b>
                  </div>
                  <div className="text-indigo-800">
                    Plain Layers: <b className="text-indigo-950">{sp.plainLayersCount || (sp.targetLayers - (sp.printedLayersCount || 2))}</b>
                  </div>
                  <div className="text-indigo-800">
                    Brand/Design: <b className="text-indigo-950">{sp.printedRollDesign || 'N/A'}</b>
                  </div>
                </div>
              )}
            </div>
          ) : null;
          })()}"""

content = content.replace(target, replacement)
with open(filepath, 'w') as f: f.write(content)
