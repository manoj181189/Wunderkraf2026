import os

with open('src/components/views/AdminSettingsView.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

output = []
for i, line in enumerate(lines):
    output.append(line)
    if "          {/* Section 5: Target GSM */}" in line:
        output.insert(-1, """
          {/* Section 6: Scrap Limits (%) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0 flex items-center gap-2">
                  <span>🗑️ Standard Scrap Limit (%)</span>
                </h4>
              </div>
            </div>
            <form onSubmit={handleAddScrapLimit} className="flex items-center gap-2 max-w-xl">
              <input
                type="number"
                step="0.1"
                value={newScrapLimitInput}
                onChange={(e) => setNewScrapLimitInput(e.target.value)}
                placeholder="Enter Limit % (e.g. 2.5)"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none uppercase"
              />
              <button type="submit" className="px-4 py-2 bg-[#2b6cb0] hover:bg-[#1a365d] text-white rounded-xl text-xs font-extrabold">Add Limit %</button>
            </form>
            <div className="flex flex-wrap gap-2 pt-2">
              {scrapLimitsList.map((val) => (
                <div key={val} className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700">
                  {val}%
                  <button type="button" onClick={() => handleDeleteScrapLimit(val)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 7: Scrap Tolerance (KG) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide m-0 flex items-center gap-2">
                  <span>⚖️ Tolerance Weight Limit (KG)</span>
                </h4>
              </div>
            </div>
            <form onSubmit={handleAddTolerance} className="flex items-center gap-2 max-w-xl">
              <input
                type="number"
                value={newToleranceInput}
                onChange={(e) => setNewToleranceInput(e.target.value)}
                placeholder="Enter Tolerance KG (e.g. 15)"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none uppercase"
              />
              <button type="submit" className="px-4 py-2 bg-[#2b6cb0] hover:bg-[#1a365d] text-white rounded-xl text-xs font-extrabold">Add Tolerance</button>
            </form>
            <div className="flex flex-wrap gap-2 pt-2">
              {scrapToleranceKgList.map((val) => (
                <div key={val} className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700">
                  {val} KG
                  <button type="button" onClick={() => handleDeleteTolerance(val)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">×</button>
                </div>
              ))}
            </div>
          </div>
""")

with open('src/components/views/AdminSettingsView.tsx', 'w', encoding='utf-8') as f:
    f.writelines(output)
