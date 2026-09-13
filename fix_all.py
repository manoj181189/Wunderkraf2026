import os
import re

# 1. AdminSettingsView
file_admin = 'src/components/views/AdminSettingsView.tsx'
with open(file_admin, 'r') as f: content = f.read()
content = content.replace("title: 'Remove", "isOpen: true, title: 'Remove")
with open(file_admin, 'w') as f: f.write(content)

# 2. FormingView
file_forming = 'src/components/views/FormingView.tsx'
with open(file_forming, 'r') as f: content = f.read()

# Replace missing handleConfirmCrew (again, it seems it was overwritten or I messed up)
impl = """
  const handleConfirmCrew = (operator: string, helpers: string[]) => {
    if (!activeBatchObj) return;
    const { job, batch } = activeBatchObj;

    const updatedJobs = state.jobs.map((j) => {
      if (j.id !== job.id) return j;
      return {
        ...j,
        runningBatches: (j.runningBatches || []).map((b) => {
          if (b.batchId !== batch.batchId) return b;
          return {
            ...b,
            worker: operator.trim().toUpperCase(),
            helpers: helpers,
            helperCount: helpers.length
          };
        })
      };
    });

    const newLog = {
      jobId: job.id,
      product: job.product,
      stage: 'Forming',
      machine: selectedMachine,
      shift: batch.shift,
      action: `👥 Station Crew Assigned: Operator [${operator}] with ${helpers.length} Helpers (${helpers.join(', ')}) on ${selectedMachine} for Batch [${batch.batchId}]`,
      worker: operator,
      user: 'form_supervisor',
      rawDate: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    onSaveState({
      ...state,
      jobs: updatedJobs,
      logs: [newLog, ...(state.logs || [])]
    });
    alert('Crew assigned successfully!');
  };
"""

if "const handleConfirmCrew =" not in content:
    content = content.replace("const handleConfirmShiftHandover = (handoverData: any) => {", impl + "\n  const handleConfirmShiftHandover = (handoverData: any) => {")

# Add missing props
content = content.replace(
    """<StationCrewModal
        isOpen={isCrewModalOpen}
        onClose={() => setIsCrewModalOpen(false)}
        machine={selectedMachine}
        state={state}
        onConfirmCrew={handleConfirmCrew}
      />""",
    """<StationCrewModal
        isOpen={isCrewModalOpen}
        onClose={() => setIsCrewModalOpen(false)}
        machine={selectedMachine}
        stage="Forming"
        shift={activeBatchObj?.batch.shift || 'DAY'}
        currentOperator={activeBatchObj?.batch.worker || ''}
        currentHelpers={activeBatchObj?.batch.helpers || []}
        state={state}
        onConfirmCrew={handleConfirmCrew}
      />"""
)

with open(file_forming, 'w') as f: f.write(content)

# 3. MasterExecutiveDashboard
file_master = 'src/components/views/MasterExecutiveDashboard.tsx'
with open(file_master, 'r') as f: content = f.read()

content = re.sub(r'helpers:\s*[^,]+,?\s*', '', content)

with open(file_master, 'w') as f: f.write(content)

# 4. SlittingView
file_slit = 'src/components/views/SlittingView.tsx'
with open(file_slit, 'r') as f: content = f.read()
content = content.replace("machineId={", "machine={")
content = content.replace(
    """<StationCrewModal
        isOpen={isCrewModalOpen}
        onClose={() => setIsCrewModalOpen(false)}
        machine={selectedMachine}
        state={state}
        onConfirmCrew={handleConfirmCrew}
      />""",
    """<StationCrewModal
        isOpen={isCrewModalOpen}
        onClose={() => setIsCrewModalOpen(false)}
        machine={selectedMachine}
        stage="Slitting"
        shift={activeBatchObj?.batch.shift || 'DAY'}
        currentOperator={activeBatchObj?.batch.worker || ''}
        currentHelpers={activeBatchObj?.batch.helpers || []}
        state={state}
        onConfirmCrew={handleConfirmCrew}
      />"""
)

with open(file_slit, 'w') as f: f.write(content)

print("Fixed everything")
