import os

filepath = 'src/components/views/SlittingView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """    // Compare actual length (meters) against planned target length
    const actualLen = parseFloat(actualSlitLengthMeters) || 0;
    const targetLen = job.planId
      ? (productionPlans.find((p) => p.id === job.planId)?.targetLengthMeters || 0)
      : 0;

    if (targetLen > 0 && actualLen < targetLen && !bypassWarning) {
      setIsLengthWarningModalOpen(true);
      return;
    }"""

replacement = """    // Compare actual length (meters) against planned target length
    const actualLen = parseFloat(actualSlitLengthMeters) || 0;
    const targetLen = job.planId
      ? (productionPlans.find((p) => p.id === job.planId)?.targetLengthMeters || 0)
      : 0;

    // Check for ±5% deviation
    if (targetLen > 0 && !bypassWarning) {
      const minLength = targetLen * 0.95;
      const maxLength = targetLen * 1.05;
      if (actualLen < minLength || actualLen > maxLength) {
        setIsLengthWarningModalOpen(true);
        return;
      }
    }"""

if target in content:
    content = content.replace(target, replacement)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced deviation successfully")
else:
    print("Target not found")
