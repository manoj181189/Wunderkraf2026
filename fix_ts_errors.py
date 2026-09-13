import os

# Fix AdminSettingsView.tsx
file_admin = 'src/components/views/AdminSettingsView.tsx'
with open(file_admin, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "  ProductCrateCapacity,\n  CoordinationMatrixItem\n} from '../../types';",
    "  ProductCrateCapacity,\n  CoordinationMatrixItem,\n  ProductionPlan\n} from '../../types';"
)

with open(file_admin, 'w', encoding='utf-8') as f:
    f.write(content)

# Fix FormingView.tsx
file_forming = 'src/components/views/FormingView.tsx'
with open(file_forming, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("machineId={", "machine={")

# Add handleConfirmCrew to FormingView if missing
if "const handleConfirmCrew" not in content:
    find_str = "const handleConfirmShiftHandover = (handoverData: any) => {"
    add_str = """
  const handleConfirmCrew = (operator: string, helpers: string[]) => {
    if (!activeBatchObj) return;
    const { job, batch } = activeBatchObj;

    const updatedJobs = jobs.map((j) => {
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
      logs: [newLog, ...state.logs]
    });
    alert('Crew assigned!');
  };
"""
    idx = content.find(find_str)
    if idx != -1:
        content = content[:idx] + add_str + "\n  " + content[idx:]

with open(file_forming, 'w', encoding='utf-8') as f:
    f.write(content)


# Fix MasterExecutiveDashboard.tsx
file_master = 'src/components/views/MasterExecutiveDashboard.tsx'
with open(file_master, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "held: state.jobs.filter((j) => j.runningBatches?.some((b) => b.machine.startsWith('Slitting') && b.status === 'Held')).map((j) => ({ job: j.id, op: j.runningBatches?.find((b) => b.machine.startsWith('Slitting') && b.status === 'Held')?.worker || 'UNKNOWN', reason: j.runningBatches?.find((b) => b.machine.startsWith('Slitting') && b.status === 'Held')?.holdReason, helpers: j.runningBatches?.find((b) => b.machine.startsWith('Slitting') && b.status === 'Held')?.helpers || [] }))",
    "held: state.jobs.filter((j) => j.runningBatches?.some((b) => b.machine.startsWith('Slitting') && b.status === 'Held')).map((j) => ({ job: j.id, op: j.runningBatches?.find((b) => b.machine.startsWith('Slitting') && b.status === 'Held')?.worker || 'UNKNOWN', reason: j.runningBatches?.find((b) => b.machine.startsWith('Slitting') && b.status === 'Held')?.holdReason }))"
)
content = content.replace(
    "held: state.jobs.filter((j) => j.runningBatches?.some((b) => b.machine.startsWith('Cutting') && b.status === 'Held')).map((j) => ({ job: j.id, op: j.runningBatches?.find((b) => b.machine.startsWith('Cutting') && b.status === 'Held')?.worker || 'UNKNOWN', reason: j.runningBatches?.find((b) => b.machine.startsWith('Cutting') && b.status === 'Held')?.holdReason, helpers: j.runningBatches?.find((b) => b.machine.startsWith('Cutting') && b.status === 'Held')?.helpers || [] }))",
    "held: state.jobs.filter((j) => j.runningBatches?.some((b) => b.machine.startsWith('Cutting') && b.status === 'Held')).map((j) => ({ job: j.id, op: j.runningBatches?.find((b) => b.machine.startsWith('Cutting') && b.status === 'Held')?.worker || 'UNKNOWN', reason: j.runningBatches?.find((b) => b.machine.startsWith('Cutting') && b.status === 'Held')?.holdReason }))"
)
content = content.replace(
    "held: state.jobs.filter((j) => j.runningBatches?.some((b) => b.machine.startsWith('Forming') && b.status === 'Held')).map((j) => ({ job: j.id, op: j.runningBatches?.find((b) => b.machine.startsWith('Forming') && b.status === 'Held')?.worker || 'UNKNOWN', reason: j.runningBatches?.find((b) => b.machine.startsWith('Forming') && b.status === 'Held')?.holdReason, helpers: j.runningBatches?.find((b) => b.machine.startsWith('Forming') && b.status === 'Held')?.helpers || [] }))",
    "held: state.jobs.filter((j) => j.runningBatches?.some((b) => b.machine.startsWith('Forming') && b.status === 'Held')).map((j) => ({ job: j.id, op: j.runningBatches?.find((b) => b.machine.startsWith('Forming') && b.status === 'Held')?.worker || 'UNKNOWN', reason: j.runningBatches?.find((b) => b.machine.startsWith('Forming') && b.status === 'Held')?.holdReason }))"
)

with open(file_master, 'w', encoding='utf-8') as f:
    f.write(content)


# Fix SlittingView.tsx
file_slitting = 'src/components/views/SlittingView.tsx'
with open(file_slitting, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("machineId={", "machine={")

with open(file_slitting, 'w', encoding='utf-8') as f:
    f.write(content)

