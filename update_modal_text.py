import os

filepath = 'src/components/views/SlittingView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """                <h3 className="text-sm font-extrabold text-amber-950 m-0">Target Length Warning</h3>
                <p className="text-[11px] text-slate-500 m-0">Output length is less than the planned target length</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-150 rounded-xl text-xs text-amber-900 leading-relaxed space-y-2">
              <p>
                The entered actual slitted length of <b className="font-extrabold text-amber-950">{parseFloat(actualSlitLengthMeters) || 0} meters</b> is <span className="font-bold text-amber-800">LESS</span> than the planned target slitting length of <b className="font-extrabold text-amber-950">{activeBatchObj.job.planId ? (productionPlans.find(p => p.id === activeBatchObj.job.planId)?.targetLengthMeters || 1200) : 1200} meters</b> for this Job.
              </p>
              <p className="font-medium text-amber-800">
                Are you sure you want to proceed and save this run with a shorter slitted length?
              </p>
            </div>"""

replacement = """                <h3 className="text-sm font-extrabold text-amber-950 m-0">Target Length Variance Warning</h3>
                <p className="text-[11px] text-slate-500 m-0">Output length deviates by more than ±5% from target</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-150 rounded-xl text-xs text-amber-900 leading-relaxed space-y-2">
              <p>
                The entered actual slitted length of <b className="font-extrabold text-amber-950">{parseFloat(actualSlitLengthMeters) || 0} meters</b> deviates from the planned target slitting length of <b className="font-extrabold text-amber-950">{activeBatchObj.job.planId ? (productionPlans.find(p => p.id === activeBatchObj.job.planId)?.targetLengthMeters || 1200) : 1200} meters</b> for this Job by more than ±5%.
              </p>
              <p className="font-medium text-amber-800">
                Are you sure you want to proceed and save this run with this deviation?
              </p>
            </div>"""

if target in content:
    content = content.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced modal text successfully")
else:
    print("Target not found")
