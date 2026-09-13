import os

filepath = 'src/components/views/PlanningDeskView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_table_ui = """                          {plan.printedRollRequired && (
                            <span className="mt-1 font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 shadow-xs inline-flex items-center gap-1 text-[10px]">
                              <span>
                                {plan.printedRollIcon === 'Coffee' && '☕'}
                                {plan.printedRollIcon === 'ShoppingBag' && '🛍️'}
                                {plan.printedRollIcon === 'Droplets' && '💧'}
                                {plan.printedRollIcon === 'Tag' && '🏷️'}
                                {plan.printedRollIcon === 'Boxes' && '📦'}
                                {(!plan.printedRollIcon || plan.printedRollIcon === 'Sparkles') && '✨'}
                              </span>
                              <span>{plan.printedRollDesign}</span>
                            </span>
                          )}"""

new_table_ui = """                          {plan.printedRollRequired && (
                            <span className="mt-1 font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 shadow-xs inline-flex flex-col gap-0.5 text-[10px]">
                              <span className="flex items-center gap-1">
                                {plan.printedRollIcon === 'Coffee' && '☕'}
                                {plan.printedRollIcon === 'ShoppingBag' && '🛍️'}
                                {plan.printedRollIcon === 'Droplets' && '💧'}
                                {plan.printedRollIcon === 'Tag' && '🏷️'}
                                {plan.printedRollIcon === 'Boxes' && '📦'}
                                {(!plan.printedRollIcon || plan.printedRollIcon === 'Sparkles') && '✨'}
                                <span>{plan.printedRollDesign}</span>
                              </span>
                              <span className="text-indigo-700 opacity-80">
                                {plan.printedLayersCount || 2} Printed | {plan.plainLayersCount || (plan.targetLayers - 2)} Plain
                              </span>
                            </span>
                          )}"""

content = content.replace(old_table_ui, new_table_ui)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated table UI")
