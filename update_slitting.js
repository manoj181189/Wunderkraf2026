const fs = require('fs');
let code = fs.readFileSync('./src/components/views/SlittingView.tsx', 'utf8');

// 1. Add import StationCrewModal
code = code.replace(
  "import { ShiftHandoverModal } from '../ShiftHandoverModal';",
  "import { ShiftHandoverModal } from '../ShiftHandoverModal';\nimport { StationCrewModal } from '../StationCrewModal';"
);

// 2. Add state
code = code.replace(
  "const [isShiftHandoverModalOpen, setIsShiftHandoverModalOpen] = useState(false);",
  "const [isShiftHandoverModalOpen, setIsShiftHandoverModalOpen] = useState(false);\n  const [assignedHelpers, setAssignedHelpers] = useState<string[]>([]);\n  const [isCrewModalOpen, setIsCrewModalOpen] = useState(false);"
);

// 3. Add handleConfirmCrew
const crewFn = `
  const handleConfirmCrew = (operator: string, helpers: string[]) => {
    setOperatorName(operator);
    setAssignedHelpers(helpers);
    setIsCrewModalOpen(false);

    if (activeBatchObj) {
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

      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newLog: LogEntry = {
        jobId: job.id,
        product: job.product,
        stage: 'Slitting',
        machine: 'Slitting-1',
        action: \`👥 Station Crew Assigned: Operator [\${operator}] with \${helpers.length} Helpers (\${helpers.join(', ')}) on Slitting-1 for Batch [\${batch.batchId}]\`,
        worker: operator,
        user: 'slit_supervisor',
        rawDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      };

      onSaveState({
        ...state,
        jobs: updatedJobs,
        logs: [newLog, ...(state.logs || [])]
      });
    }
  };
`;
code = code.replace(
  "const handleStartNewReel = (e: React.FormEvent) => {",
  crewFn + "\n  const handleStartNewReel = (e: React.FormEvent) => {"
);

// 4. In handleStartNewReel, add helpers
code = code.replace(
  "worker: operatorName.trim().toUpperCase(),\n      shift",
  "worker: operatorName.trim().toUpperCase(),\n      helpers: assignedHelpers,\n      helperCount: assignedHelpers.length,\n      shift"
);

// 5. In handleConfirmShiftHandover
code = code.replace(
  "relievedByOperator: string;\n    sliceProducedQty: number;",
  "relievedByOperator: string;\n    sliceProducedQty: number;\n    helpers?: string[];"
);

code = code.replace(
  "const newSlice: OperatorRunSlice = {\n      sliceId: `SLICE-SLIT-${Date.now()}`,\n      operator: batch.worker,\n      relievedByOperator: handoverData.relievedByOperator,",
  "const nextHelpers = handoverData.helpers && handoverData.helpers.length > 0 ? handoverData.helpers : assignedHelpers;\n    const newSlice: OperatorRunSlice = {\n      sliceId: `SLICE-SLIT-${Date.now()}`,\n      operator: batch.worker,\n      relievedByOperator: handoverData.relievedByOperator,"
);

code = code.replace(
  "worker: handoverData.relievedByOperator,\n          slices:",
  "worker: handoverData.relievedByOperator,\n          helpers: nextHelpers,\n          helperCount: nextHelpers.length,\n          slices:"
);

code = code.replace(
  "setOperatorName(handoverData.relievedByOperator);",
  "setOperatorName(handoverData.relievedByOperator);\n    if (handoverData.helpers && handoverData.helpers.length > 0) setAssignedHelpers(handoverData.helpers);"
);

// 6. UI for Helper selection and Crew button
const crewButton = `
              <div className="flex flex-col gap-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">Operator & Crew <span className="text-rose-600">*</span>:</label>
                <div className="flex items-center justify-between bg-white border border-slate-300 px-3 py-2 rounded-lg">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{operatorName || 'Select Operator'}</span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {assignedHelpers.length > 0 ? \`\${assignedHelpers.length} Helpers (\${assignedHelpers.join(', ')})\` : 'No Helpers Assigned'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCrewModalOpen(true)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded transition cursor-pointer"
                  >
                    Change Crew
                  </button>
                </div>
              </div>
`;

code = code.replace(
  /<div className="flex flex-col gap-1\.5">\s*<label className="block text-xs font-bold text-slate-700 uppercase">Operator Name <span className="text-rose-600">\*Mandatory<\/span>:<\/label>\s*<input\s*type="text"\s*value=\{operatorName\}\s*onChange=\{\(e\) => setOperatorName\(e\.target\.value\)\}\s*placeholder="Type Operator Name\.\.\."\s*className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 outline-none"\s*required\s*\/>\s*<\/div>/g,
  crewButton
);

// 7. In active batch operator block (read-only)
const activeCrewInfo = `
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Operator:</span>
                    <span className="text-sm font-extrabold text-blue-950 uppercase">{activeBatchObj.batch.worker}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">
                      🤝 {activeBatchObj.batch.helpers && activeBatchObj.batch.helpers.length > 0
                        ? \`\${activeBatchObj.batch.helpers.length} Helpers (\${activeBatchObj.batch.helpers.join(', ')})\`
                        : assignedHelpers.length > 0
                        ? \`\${assignedHelpers.length} Helpers (\${assignedHelpers.join(', ')})\`
                        : 'No Helpers'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCrewModalOpen(true)}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-extrabold flex items-center gap-0.5 cursor-pointer underline"
                    >
                      Update Crew
                    </button>
                  </div>
`;

code = code.replace(
  /<div className="mb-3">\s*<span className="text-\[10px\] text-slate-400 uppercase font-bold block">Operator:<\/span>\s*<span className="text-sm font-extrabold text-blue-950 uppercase">\{activeBatchObj\.batch\.worker\}<\/span>\s*<\/div>/g,
  activeCrewInfo
);

// 8. Add StationCrewModal near EOF
code = code.replace(
  "{/* Shift Handover Modal */}",
  `{/* Station Crew Assignment Modal */}
      <StationCrewModal
        isOpen={isCrewModalOpen}
        onClose={() => setIsCrewModalOpen(false)}
        machineId="Slitting-1"
        defaultOperator={activeBatchObj?.batch.worker || operatorName}
        defaultHelpers={activeBatchObj?.batch.helpers || assignedHelpers}
        state={state}
        onConfirmCrew={handleConfirmCrew}
      />

      {/* Shift Handover Modal */}`
);

fs.writeFileSync('./src/components/views/SlittingView.tsx', code);
