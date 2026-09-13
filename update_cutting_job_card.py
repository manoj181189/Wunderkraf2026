import os

filepath = 'src/components/views/CuttingView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Job:</span>
                  <span className="font-extrabold text-sm text-blue-950">
                    {activeBatchObj.job.id} — <span className="text-slate-800">{activeBatchObj.job.product}</span>
                  </span>
                </div>"""

replacement = """                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Job:</span>
                  <span className="font-extrabold text-sm text-blue-950">
                    {activeBatchObj.job.id} — <span className="text-slate-800">{activeBatchObj.job.product}</span>
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600 font-medium">
                    <span>Layers: <b className="text-slate-800">{activeBatchObj.job.targetLayers || 'N/A'}</b></span>
                    <span>GSM: <b className="text-slate-800">{activeBatchObj.job.targetGsm || activeBatchObj.job.gsm || 'N/A'}</b></span>
                  </div>
                </div>"""

if target in content:
    content = content.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced active job card in cutting successfully")
else:
    print("Target not found")
