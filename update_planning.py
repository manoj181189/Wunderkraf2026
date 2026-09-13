import os
import re

filepath = 'src/components/views/PlanningDeskView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add state hooks
state_add = """  const [formPrintedRollRequired, setFormPrintedRollRequired] = useState(false);
  const [formPrintedRollDesign, setFormPrintedRollDesign] = useState('');
  const [formPrintedRollIcon, setFormPrintedRollIcon] = useState('Sparkles');
  const [formPrintedLayersCount, setFormPrintedLayersCount] = useState(2);"""

content = content.replace(
    "  const [formPrintedRollRequired, setFormPrintedRollRequired] = useState(false);\n  const [formPrintedRollDesign, setFormPrintedRollDesign] = useState('');\n  const [formPrintedRollIcon, setFormPrintedRollIcon] = useState('Sparkles');",
    state_add
)

# Update reset logic in handleOpenNewPlanModal
reset_add = """    setFormPrintedRollRequired(false);
    setFormPrintedRollDesign('');
    setFormPrintedRollIcon('Sparkles');
    setFormPrintedLayersCount(2);"""

content = content.replace(
    "    setFormPrintedRollRequired(false);\n    setFormPrintedRollDesign('');\n    setFormPrintedRollIcon('Sparkles');",
    reset_add
)
if "setFormPrintedLayersCount(2)" not in content:
  # handle the case where the exact match failed
  content = content.replace(
      "setFormPrintedRollRequired(plan.printedRollRequired || false);",
      "setFormPrintedRollRequired(plan.printedRollRequired || false);\n    setFormPrintedLayersCount(plan.printedLayersCount || 2);"
  )
  content = content.replace(
      "setFormPrintedRollRequired(false);",
      "setFormPrintedRollRequired(false);\n    setFormPrintedLayersCount(2);"
  )


# Save logic - edit plan
save_edit = """          printedRollRequired: formPrintedRollRequired || undefined,
          printedRollDesign: formPrintedRollRequired ? formPrintedRollDesign : undefined,
          printedRollIcon: formPrintedRollRequired ? formPrintedRollIcon : undefined,
          printedLayersCount: formPrintedRollRequired ? formPrintedLayersCount : undefined,
          plainLayersCount: formPrintedRollRequired ? (formTargetLayers - formPrintedLayersCount) : undefined"""

content = content.replace(
    "          printedRollRequired: formPrintedRollRequired || undefined,\n          printedRollDesign: formPrintedRollRequired ? formPrintedRollDesign : undefined,\n          printedRollIcon: formPrintedRollRequired ? formPrintedRollIcon : undefined",
    save_edit
)

# Save logic - new plan
save_new = """        printedRollRequired: formPrintedRollRequired || undefined,
        printedRollDesign: formPrintedRollRequired ? formPrintedRollDesign : undefined,
        printedRollIcon: formPrintedRollRequired ? formPrintedRollIcon : undefined,
        printedLayersCount: formPrintedRollRequired ? formPrintedLayersCount : undefined,
        plainLayersCount: formPrintedRollRequired ? (formTargetLayers - formPrintedLayersCount) : undefined"""

content = content.replace(
    "        printedRollRequired: formPrintedRollRequired || undefined,\n        printedRollDesign: formPrintedRollRequired ? formPrintedRollDesign : undefined,\n        printedRollIcon: formPrintedRollRequired ? formPrintedRollIcon : undefined",
    save_new
)

# Update UI for form
old_ui = """                {formPrintedRollRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6 animate-in fade-in duration-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Printed Design Name:
                      </label>
                      <input
                        type="text"
                        value={formPrintedRollDesign}
                        onChange={(e) => setFormPrintedRollDesign(e.target.value)}
                        placeholder="e.g. Tata Tea Gold 250g"
                        className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-md text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Display Icon:
                      </label>
                      <select
                        value={formPrintedRollIcon}
                        onChange={(e) => setFormPrintedRollIcon(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-md text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                      >
                        <option value="Sparkles">✨ Sparkles</option>
                        <option value="Coffee">☕ Coffee / Tea</option>
                        <option value="ShoppingBag">🛍️ Shopping Bag</option>
                        <option value="Droplets">💧 Droplet</option>
                        <option value="Tag">🏷️ Tag</option>
                        <option value="Boxes">📦 Box</option>
                      </select>
                    </div>
                  </div>
                )}"""

new_ui = """                {formPrintedRollRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pl-6 animate-in fade-in duration-200">
                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Printed Brand / Design Name:
                      </label>
                      <input
                        type="text"
                        value={formPrintedRollDesign}
                        onChange={(e) => setFormPrintedRollDesign(e.target.value)}
                        placeholder="e.g. ITC Printed Brand"
                        className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-md text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Printed Layers:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={formTargetLayers}
                        value={formPrintedLayersCount}
                        onChange={(e) => setFormPrintedLayersCount(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-md text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Plain Layers:
                      </label>
                      <input
                        type="number"
                        disabled
                        value={formTargetLayers - formPrintedLayersCount}
                        className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-xs font-bold text-slate-500 cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}"""

content = content.replace(old_ui, new_ui)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated PlanningDeskView.tsx")
