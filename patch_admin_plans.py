import os

filepath = 'src/components/views/AdminSettingsView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = "  // ==========================================\n  // MASTER DATA OVERWRITE: PACKING ORDERS\n  // =========================================="

new_code = """  // ==========================================
  // MASTER DATA OVERWRITE: PRODUCTION PLANS
  // ==========================================
  const handleSavePlanEdit = () => {
    if (!planEditForm) return;
    const updatedPlans = (state.productionPlans || []).map((p) => {
      if (p.id === selectedPlanIdToEdit) {
        return { ...planEditForm };
      }
      return p;
    });

    const newLog: LogEntry = {
      jobId: planEditForm.id,
      product: planEditForm.product,
      stage: 'Admin Master',
      machine: 'MASTER-OVERWRITE',
      shift: 'DAY',
      action: `🛠️ Master Overwrite on Production Plan [${planEditForm.id}]`,
      worker: 'ADMIN',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      productionPlans: updatedPlans,
      logs: [...state.logs, newLog]
    });
    alert('Production Plan master data overwritten successfully!');
  };

  const handleDeletePlan = (planId: string) => {
    if (!window.confirm(`Are you absolutely sure you want to hard delete Production Plan ${planId}? This cannot be undone.`)) {
      return;
    }
    const updatedPlans = (state.productionPlans || []).filter((p) => p.id !== planId);
    
    const newLog: LogEntry = {
      jobId: planId,
      product: 'N/A',
      stage: 'Admin Master',
      machine: 'HARD-DELETE',
      shift: 'DAY',
      action: `🗑️ Hard Deleted Production Plan [${planId}]`,
      worker: 'ADMIN',
      user: 'admin',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString()
    };

    onSaveState({
      ...state,
      productionPlans: updatedPlans,
      logs: [...state.logs, newLog]
    });
    setPlanEditForm(null);
    setSelectedPlanIdToEdit('');
    alert('Plan deleted!');
  };

  // ==========================================
  // MASTER DATA OVERWRITE: PACKING ORDERS
  // =========================================="""

if target in content:
    content = content.replace(target, new_code)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patch applied successfully.")
else:
    print("Target not found.")

