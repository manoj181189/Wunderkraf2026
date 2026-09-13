import os

filepath = 'src/components/views/SlittingView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Product:</label>
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value as ProductType)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
            >
              {productList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>"""

replacement = """        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Target Product:</label>
            {selectedPlanId ? (
              <div className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-500 cursor-not-allowed flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>{product}</span>
              </div>
            ) : (
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value as ProductType)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
              >
                {productList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </div>"""

if target in content:
    content = content.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced successfully")
else:
    print("Target not found")
