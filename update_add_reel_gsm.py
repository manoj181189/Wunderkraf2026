import os

filepath = 'src/components/views/SlittingView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """                <input
                  type="text"
                  value={addReelGsm}
                  onChange={(e) => setAddReelGsm(e.target.value)}
                  placeholder="e.g. 280 GSM"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                />"""

replacement = """                <input
                  type="text"
                  value={(jobs.find(j => j.id === addReelJobId)?.planId && productionPlans.find(p => p.id === jobs.find(j => j.id === addReelJobId)?.planId)?.targetGsm) || addReelGsm}
                  onChange={(e) => setAddReelGsm(e.target.value)}
                  placeholder="e.g. 280 GSM"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  disabled={!!(jobs.find(j => j.id === addReelJobId)?.planId)}
                />"""

if target in content:
    content = content.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced add reel GSM successfully")
else:
    print("Target not found")
