import os
filepath = 'src/components/views/FormingView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

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
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added handleConfirmCrew")
