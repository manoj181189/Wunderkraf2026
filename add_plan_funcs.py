import os

with open('src/components/views/AdminSettingsView.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

output = []
for i, line in enumerate(lines):
    output.append(line)
    if "const handleSelectOrderToEdit = (ordId: string) => {" in line:
        output.insert(-1, """
  const handleSelectPlanToEdit = (planId: string) => {
    setSelectedPlanIdToEdit(planId);
    const p = (state.productionPlans || []).find((x) => x.id === planId);
    setPlanEditForm(p ? JSON.parse(JSON.stringify(p)) : null);
  };
""")

    if "const handleSaveJobEdit = (e: React.FormEvent) => {" in line:
        output.insert(-1, """
  const handleSavePlanEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planEditForm || !selectedPlanIdToEdit) return;

    if (!confirm('Are you sure you want to FORCE-UPDATE this Production Plan? This action affects scheduling metrics directly.')) {
      return;
    }

    const cleanId = planEditForm.id.trim().toUpperCase();
    if (!cleanId) return alert('Plan ID cannot be empty');

    const updatedPlans = (state.productionPlans || []).map((p) => {
      if (p.id === selectedPlanIdToEdit) {
        return {
          ...p,
          ...planEditForm,
          id: cleanId,
          targetLayers: Number(planEditForm.targetLayers) || p.targetLayers,
          targetLengthMeters: Number(planEditForm.targetLengthMeters) || p.targetLengthMeters,
          targetScrapLimitPct: Number(planEditForm.targetScrapLimitPct) || p.targetScrapLimitPct,
          targetScrapLimitKg: planEditForm.targetScrapLimitKg !== undefined ? Number(planEditForm.targetScrapLimitKg) : p.targetScrapLimitKg,
          targetQuantity: planEditForm.targetQuantity !== undefined ? Number(planEditForm.targetQuantity) : p.targetQuantity,
        };
      }
      return p;
    });

    const logEntry: LogEntry = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      action: `Admin Master Overwrite: Updated Plan [${selectedPlanIdToEdit}] -> ID: ${cleanId}, Status: ${planEditForm.status}`,
      user: currentUser?.name || 'Admin',
      stage: 'Admin Master',
      jobId: cleanId,
      product: planEditForm.product
    };

    onSaveState({
      ...state,
      productionPlans: updatedPlans,
      logs: [logEntry, ...(state.logs || [])]
    });

    alert(`✅ Master Update Applied successfully for Plan: ${cleanId}`);
    setSelectedPlanIdToEdit(cleanId);
  };

  const handleDeletePlan = (planId: string) => {
    if (!confirm(`⚠️ DANGER: You are about to permanently delete Plan [${planId}]. This action cannot be undone.\n\nAre you absolutely sure?`)) {
      return;
    }

    if (!confirm(`Final Confirmation: Delete Plan [${planId}]?`)) return;

    const updatedPlans = (state.productionPlans || []).filter((p) => p.id !== planId);
    
    const logEntry: LogEntry = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      action: `Admin Master Deletion: Deleted Plan [${planId}]`,
      user: currentUser?.name || 'Admin',
      stage: 'Admin Master',
      jobId: planId,
    };

    onSaveState({
      ...state,
      productionPlans: updatedPlans,
      logs: [logEntry, ...(state.logs || [])]
    });

    alert(`🚨 Plan [${planId}] DELETED permanently.`);
    setSelectedPlanIdToEdit('');
    setPlanEditForm(null);
  };
""")

with open('src/components/views/AdminSettingsView.tsx', 'w', encoding='utf-8') as f:
    f.writelines(output)
