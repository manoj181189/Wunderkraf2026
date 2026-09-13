import os

with open('src/components/views/AdminSettingsView.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

output = []
for i, line in enumerate(lines):
    output.append(line)
    if "const [jobEditForm, setJobEditForm] = useState<Job | null>(jobToEdit ? JSON.parse(JSON.stringify(jobToEdit)) : null);" in line:
        output.append("\n  // Plan Overwrite state\n")
        output.append("  const [selectedPlanIdToEdit, setSelectedPlanIdToEdit] = useState<string>((state.productionPlans && state.productionPlans[0]?.id) || '');\n")
        output.append("  const planToEdit = (state.productionPlans || []).find((p) => p.id === selectedPlanIdToEdit);\n")
        output.append("  const [planEditForm, setPlanEditForm] = useState<ProductionPlan | null>(planToEdit ? JSON.parse(JSON.stringify(planToEdit)) : null);\n")

    if "const handleSelectJobToEdit = (id: string) => {" in line:
        # Also add handleSelectPlanToEdit around here
        pass

with open('src/components/views/AdminSettingsView.tsx', 'w', encoding='utf-8') as f:
    f.writelines(output)
