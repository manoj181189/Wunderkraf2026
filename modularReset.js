export const modularResetLogic = `
  const handleModularReset = async (categoryId: string, categoryName: string) => {
    // Step 1 - Mandatory Pre-Reset Auto-Download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const cleanName = categoryName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = \`Wunderkraf_AutoBackup_PreReset_\${cleanName}_\${timestamp}.json\`;
    
    try {
      exportDatabaseBackup(state, fileName);
    } catch (err) {
      alert('⚠️ Failed to generate backup! Reset aborted to prevent data loss.');
      return;
    }

    // Step 2 - Mandatory 2-step confirmation prompt
    const confirmText = prompt(\`Safety Backup Downloaded to your device!\n\nType 'CONFIRM RESET' to wipe \${categoryName}.\`);
    if (confirmText !== 'CONFIRM RESET') {
      alert('❌ Reset confirmation failed. Aborted.');
      return;
    }

    // Step 3 - Master Password Verification Modal
    const pass = prompt(\`Enter Admin Master Password to Confirm Reset for \${categoryName}:\`);
    if (pass !== (state.adminPassword || '1234')) {
      alert('❌ Access Denied: Incorrect Master Password. Reset aborted.');
      return;
    }

    // Step 4 - Perform granular wipe
    let newState = { ...state };
    switch (categoryId) {
      case 'slitting':
        newState = {
          ...state,
          jobs: state.jobs.filter(j => j.stage !== 'Slitting').map(j => ({
            ...j,
            availableRolls: 0,
            runningBatches: j.runningBatches?.filter(b => b.stage !== 'Slitting' && !b.machine.startsWith('Slitting'))
          })),
          logs: state.logs.filter(l => l.stage !== 'Slitting')
        };
        break;
      case 'cutting':
        newState = {
          ...state,
          jobs: state.jobs.filter(j => j.stage !== 'Cutting').map(j => ({
            ...j,
            availableCuttingCrates: 0,
            totalCutPieces: 0,
            runningBatches: j.runningBatches?.filter(b => b.stage !== 'Cutting' && !b.machine.startsWith('Cutting'))
          })),
          logs: state.logs.filter(l => l.stage !== 'Cutting')
        };
        break;
      case 'forming':
        newState = {
          ...state,
          jobs: state.jobs.filter(j => j.stage !== 'Forming').map(j => ({
            ...j,
            availableFormingCrates: 0,
            totalFormedPieces: 0,
            runningBatches: j.runningBatches?.filter(b => b.stage !== 'Forming' && !b.machine.startsWith('Forming'))
          })),
          logs: state.logs.filter(l => l.stage !== 'Forming')
        };
        break;
      case 'qc':
        newState = {
          ...state,
          jobs: state.jobs.filter(j => j.stage !== 'QC').map(j => ({
            ...j,
            availableQcCrates: 0,
            runningBatches: j.runningBatches?.filter(b => b.stage !== 'QC' && !b.machine.startsWith('QC'))
          })),
          logs: state.logs.filter(l => l.stage !== 'QC' && l.stage !== 'Quality Control' && l.jobId !== 'DIRECT-QC')
        };
        break;
      case 'packing':
        newState = {
          ...state,
          packJobs: [],
          logs: state.logs.filter(l => l.stage !== 'Packing')
        };
        break;
      case 'master':
        newState = {
          ...state,
          paperBrands: INITIAL_STATE.paperBrands,
          glueBrands: INITIAL_STATE.glueBrands,
          targetGsmMaster: INITIAL_STATE.targetGsmMaster,
          targetLayersMaster: INITIAL_STATE.targetLayersMaster,
          maintenanceSparePartsMaster: INITIAL_STATE.maintenanceSparePartsMaster,
          products: INITIAL_STATE.products
        };
        break;
      case 'maintenance':
        newState = {
          ...state,
          maintenanceIncidents: [],
          maintenanceTechniciansMaster: INITIAL_STATE.maintenanceTechniciansMaster,
          machineReadyAlerts: [],
          logs: state.logs.filter(l => l.stage !== 'Maintenance')
        };
        break;
      case 'full':
        newState = {
          ...INITIAL_STATE,
          users: state.users,
          adminPassword: state.adminPassword
        };
        break;
    }

    onSaveState(newState);
    alert(\`✅ \${categoryName} reset successfully. Backup saved in Downloads.\`);
  };
`;
