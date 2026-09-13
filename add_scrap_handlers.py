import os

with open('src/components/views/AdminSettingsView.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

output = []
for i, line in enumerate(lines):
    output.append(line)
    if "const [newTargetGsmInput, setNewTargetGsmInput] = useState('');" in line:
        output.append("  const [newScrapLimitInput, setNewScrapLimitInput] = useState('');\n")
        output.append("  const [newToleranceInput, setNewToleranceInput] = useState('');\n")
        output.append("  const scrapLimitsList = state.scrapLimitsMaster && state.scrapLimitsMaster.length > 0 ? state.scrapLimitsMaster : [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];\n")
        output.append("  const scrapToleranceKgList = state.scrapToleranceKgMaster && state.scrapToleranceKgMaster.length > 0 ? state.scrapToleranceKgMaster : [5, 10, 15, 20, 25, 30, 40, 50];\n")

    if "const handleAddTargetGsm = (e: React.FormEvent) => {" in line:
        output.insert(-1, """
  const handleAddScrapLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScrapLimitInput.trim()) return;
    const val = Number(newScrapLimitInput);
    if (isNaN(val)) return;
    if (scrapLimitsList.includes(val)) return alert('Already exists');
    onSaveState({
      ...state,
      scrapLimitsMaster: [...scrapLimitsList, val].sort((a,b) => a-b)
    });
    setNewScrapLimitInput('');
  };

  const handleDeleteScrapLimit = (val: number) => {
    onSaveState({
      ...state,
      scrapLimitsMaster: scrapLimitsList.filter((s) => s !== val)
    });
  };

  const handleAddTolerance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToleranceInput.trim()) return;
    const val = Number(newToleranceInput);
    if (isNaN(val)) return;
    if (scrapToleranceKgList.includes(val)) return alert('Already exists');
    onSaveState({
      ...state,
      scrapToleranceKgMaster: [...scrapToleranceKgList, val].sort((a,b) => a-b)
    });
    setNewToleranceInput('');
  };

  const handleDeleteTolerance = (val: number) => {
    onSaveState({
      ...state,
      scrapToleranceKgMaster: scrapToleranceKgList.filter((s) => s !== val)
    });
  };
""")

with open('src/components/views/AdminSettingsView.tsx', 'w', encoding='utf-8') as f:
    f.writelines(output)
