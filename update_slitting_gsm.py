import os
import re

filepath = 'src/components/views/SlittingView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """            <select
              value={gsm}
              onChange={(e) => setGsm(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
            >"""

replacement = """            <select
              value={selectedPlanId ? (productionPlans.find(p => p.id === selectedPlanId)?.targetGsm || gsm) : gsm}
              onChange={(e) => setGsm(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              disabled={!!selectedPlanId}
            >"""

if target in content:
    content = content.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced gsm successfully")
else:
    print("Target not found")
