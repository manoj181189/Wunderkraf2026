import os

filepath = 'src/components/views/CuttingView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-blue-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                      Selected Job #{selectedPendingJob.id}
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm">{selectedPendingJob.product}</span>
                  </div>"""

replacement = """                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-blue-200/80 pb-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-blue-900 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                        Selected Job #{selectedPendingJob.id}
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">{selectedPendingJob.product}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                      <span>Layers: <b className="text-slate-800">{selectedPendingJob.targetLayers || 'N/A'}</b></span>
                      <span>GSM: <b className="text-slate-800">{selectedPendingJob.targetGsm || selectedPendingJob.gsm || 'N/A'}</b></span>
                    </div>
                  </div>"""

if target in content:
    content = content.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced preview card in cutting successfully")
else:
    print("Target not found")
