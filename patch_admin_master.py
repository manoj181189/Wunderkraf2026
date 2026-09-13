import os
import re

filepath = 'src/components/views/AdminSettingsView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add states for editing
states_to_add = """  const [editingTargetLayerIdx, setEditingTargetLayerIdx] = useState<number | null>(null);
  const [editingTargetLayerVal, setEditingTargetLayerVal] = useState<string>('');
  
  const [editingGlueBrandIdx, setEditingGlueBrandIdx] = useState<number | null>(null);
  const [editingGlueBrandName, setEditingGlueBrandName] = useState('');
"""

if "const [editingTargetLayerIdx" not in content:
    content = content.replace(
        "const [newTargetLayerInput, setNewTargetLayerInput] = useState('');",
        "const [newTargetLayerInput, setNewTargetLayerInput] = useState('');\n" + states_to_add
    )

# 2. Add Handlers for Save Edit
handlers_to_add = """
  const handleSaveEditGlueBrand = (index: number) => {
    const cleanName = editingGlueBrandName.trim().toUpperCase();
    if (!cleanName) return setEditingGlueBrandIdx(null);
    const oldName = glueBrandsList[index];
    if (cleanName !== oldName && glueBrandsList.includes(cleanName)) {
      alert('Glue brand already exists!');
      return;
    }
    const updated = [...glueBrandsList];
    updated[index] = cleanName;
    setGlueBrandsList(updated);
    onSaveState({ ...state, glueBrands: updated });
    setEditingGlueBrandIdx(null);
  };

  const handleSaveEditTargetLayer = (index: number) => {
    const val = parseInt(editingTargetLayerVal);
    if (isNaN(val) || val <= 0) return setEditingTargetLayerIdx(null);
    const oldVal = targetLayersList[index];
    if (val !== oldVal && targetLayersList.includes(val)) {
      alert('Target layer already exists!');
      return;
    }
    const updated = [...targetLayersList];
    updated[index] = val;
    updated.sort((a,b) => a-b);
    setTargetLayersList(updated);
    onSaveState({ ...state, targetLayersMaster: updated });
    setEditingTargetLayerIdx(null);
  };
"""

if "const handleSaveEditGlueBrand" not in content:
    content = content.replace(
        "const handleDeleteGlueBrand = (brand: string) => {",
        handlers_to_add + "\n  const handleDeleteGlueBrand = (brand: string) => {"
    )

# 3. Modify Delete Handlers to use setConfirmModal
old_delete_glue = """  const handleDeleteGlueBrand = (brand: string) => {
    if(confirm(`Remove ${brand}?`)) {
      const updated = glueBrandsList.filter(b => b !== brand);
      setGlueBrandsList(updated);
      onSaveState({ ...state, glueBrands: updated });
    }
  };"""

new_delete_glue = """  const handleDeleteGlueBrand = (brand: string) => {
    setConfirmModal({
      title: 'Remove Glue Brand',
      message: `Are you sure you want to remove ${brand} from the master list?`,
      confirmText: 'Remove',
      confirmColor: 'bg-rose-600',
      onConfirm: () => {
        const updated = glueBrandsList.filter(b => b !== brand);
        setGlueBrandsList(updated);
        onSaveState({ ...state, glueBrands: updated });
        setConfirmModal(null);
      }
    });
  };"""

content = content.replace(old_delete_glue, new_delete_glue)

old_delete_layer = """  const handleDeleteTargetLayer = (val: number) => {
    if(confirm(`Remove ${val} Layers?`)) {
      const updated = targetLayersList.filter(b => b !== val);
      setTargetLayersList(updated);
      onSaveState({ ...state, targetLayersMaster: updated });
    }
  };"""

new_delete_layer = """  const handleDeleteTargetLayer = (val: number) => {
    setConfirmModal({
      title: 'Remove Target Layer',
      message: `Are you sure you want to remove ${val} Layers from the master list?`,
      confirmText: 'Remove',
      confirmColor: 'bg-rose-600',
      onConfirm: () => {
        const updated = targetLayersList.filter(b => b !== val);
        setTargetLayersList(updated);
        onSaveState({ ...state, targetLayersMaster: updated });
        setConfirmModal(null);
      }
    });
  };"""

content = content.replace(old_delete_layer, new_delete_layer)

old_delete_scrap = """  const handleDeleteScrapLimit = (val: number) => {
    onSaveState({
      ...state,
      scrapLimitsMaster: scrapLimitsList.filter((s) => s !== val)
    });
  };"""

new_delete_scrap = """  const handleDeleteScrapLimit = (val: number) => {
    setConfirmModal({
      title: 'Remove Scrap Limit',
      message: `Remove standard scrap limit ${val}%?`,
      confirmText: 'Remove',
      confirmColor: 'bg-rose-600',
      onConfirm: () => {
        onSaveState({
          ...state,
          scrapLimitsMaster: scrapLimitsList.filter((s) => s !== val)
        });
        setConfirmModal(null);
      }
    });
  };"""

content = content.replace(old_delete_scrap, new_delete_scrap)

old_delete_tol = """  const handleDeleteTolerance = (val: number) => {
    onSaveState({
      ...state,
      scrapToleranceKgMaster: scrapToleranceKgList.filter((s) => s !== val)
    });
  };"""

new_delete_tol = """  const handleDeleteTolerance = (val: number) => {
    setConfirmModal({
      title: 'Remove Tolerance Limit',
      message: `Remove paper scrap tolerance limit ${val} KG?`,
      confirmText: 'Remove',
      confirmColor: 'bg-rose-600',
      onConfirm: () => {
        onSaveState({
          ...state,
          scrapToleranceKgMaster: scrapToleranceKgList.filter((s) => s !== val)
        });
        setConfirmModal(null);
      }
    });
  };"""

content = content.replace(old_delete_tol, new_delete_tol)

# 4. Modify UI for Glue Brands
old_glue_ui = """            <div className="flex flex-wrap gap-2 pt-2">
              {glueBrandsList.map((brand) => (
                <div key={brand} className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700">
                  {brand}
                  <button type="button" onClick={() => handleDeleteGlueBrand(brand)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">×</button>
                </div>
              ))}
            </div>"""

new_glue_ui = """            <div className="flex flex-wrap gap-2 pt-2">
              {glueBrandsList.map((brand, idx) => (
                <div key={brand} className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700">
                  {editingGlueBrandIdx === idx ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingGlueBrandName}
                        onChange={(e) => setEditingGlueBrandName(e.target.value)}
                        className="px-2 py-1 text-xs border border-blue-400 rounded outline-none w-24"
                        autoFocus
                      />
                      <button type="button" onClick={() => handleSaveEditGlueBrand(idx)} className="text-green-600 hover:text-green-800"><Check className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => setEditingGlueBrandIdx(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <>
                      <span>{brand}</span>
                      <div className="flex items-center gap-1 ml-2 border-l border-slate-300 pl-2">
                        <button type="button" onClick={() => { setEditingGlueBrandIdx(idx); setEditingGlueBrandName(brand); }} className="text-blue-500 hover:text-blue-700" title="Edit"><Edit className="w-3 h-3" /></button>
                        <button type="button" onClick={() => handleDeleteGlueBrand(brand)} className="text-rose-500 hover:text-rose-700 font-bold" title="Delete">×</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>"""

content = content.replace(old_glue_ui, new_glue_ui)

# 5. Modify UI for Target Layers
old_layers_ui = """            <div className="flex flex-wrap gap-2 pt-2">
              {targetLayersList.map((val) => (
                <div key={val} className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700">
                  {val} Layers
                  <button type="button" onClick={() => handleDeleteTargetLayer(val)} className="text-rose-500 hover:text-rose-700 font-bold ml-2">×</button>
                </div>
              ))}
            </div>"""

new_layers_ui = """            <div className="flex flex-wrap gap-2 pt-2">
              {targetLayersList.map((val, idx) => (
                <div key={val} className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700">
                  {editingTargetLayerIdx === idx ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editingTargetLayerVal}
                        onChange={(e) => setEditingTargetLayerVal(e.target.value)}
                        className="px-2 py-1 text-xs border border-blue-400 rounded outline-none w-16"
                        autoFocus
                      />
                      <button type="button" onClick={() => handleSaveEditTargetLayer(idx)} className="text-green-600 hover:text-green-800"><Check className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => setEditingTargetLayerIdx(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <>
                      <span>{val} Layers</span>
                      <div className="flex items-center gap-1 ml-2 border-l border-slate-300 pl-2">
                        <button type="button" onClick={() => { setEditingTargetLayerIdx(idx); setEditingTargetLayerVal(val.toString()); }} className="text-blue-500 hover:text-blue-700" title="Edit"><Edit className="w-3 h-3" /></button>
                        <button type="button" onClick={() => handleDeleteTargetLayer(val)} className="text-rose-500 hover:text-rose-700 font-bold" title="Delete">×</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>"""

content = content.replace(old_layers_ui, new_layers_ui)

# 6. Change Label for Tolerance Weight Limit
content = content.replace(
    "<span>⚖️ Tolerance Weight Limit (KG)</span>",
    "<span>⚖️ Paper Scrap Tolerance Limit (KG)</span>"
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Applied successfully.")
