import { FactoryState, FloorWorker } from '../types';

export function autoRegisterWorker(
  state: FactoryState,
  workerName: string,
  department: string,
  machine: string,
  shift: 'DAY' | 'NIGHT'
): { floorWorkers: FloorWorker[], deptWorkers: Record<string, string[]> } {
  if (!workerName || !workerName.trim()) {
    return { floorWorkers: state.floorWorkers || [], deptWorkers: state.deptWorkers || {} };
  }

  const cleanName = workerName.trim().toUpperCase();
  let updatedFloorWorkers = [...(state.floorWorkers || [])];
  let updatedDeptWorkers = { ...(state.deptWorkers || {}) };
  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const existingIndex = updatedFloorWorkers.findIndex(w => w.name.toUpperCase() === cleanName);
  
  if (existingIndex === -1) {
    updatedFloorWorkers.push({
      id: `EMP-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      name: cleanName,
      department: department,
      role: 'OPERATOR',
      shift: shift,
      assignedMachine: machine,
      isPresent: true,
      shiftStatus: 'PRESENT',
      inTime: nowTime
    });

    const currentDeptList = updatedDeptWorkers[department] || [];
    if (!currentDeptList.includes(cleanName)) {
      updatedDeptWorkers[department] = [...currentDeptList, cleanName];
    }
  } else {
    updatedFloorWorkers[existingIndex] = {
      ...updatedFloorWorkers[existingIndex],
      assignedMachine: machine,
      isPresent: true,
      shiftStatus: 'PRESENT'
    };
  }

  return { floorWorkers: updatedFloorWorkers, deptWorkers: updatedDeptWorkers };
}

export function autoRegisterCrew(
  state: FactoryState,
  operatorName: string,
  helpers: string[],
  department: string,
  machine: string,
  shift: 'DAY' | 'NIGHT' | string
): { floorWorkers: FloorWorker[], deptWorkers: Record<string, string[]> } {
  let updatedState = { ...state };
  let { floorWorkers, deptWorkers } = autoRegisterWorker(updatedState, operatorName, department, machine, shift as any);
  
  updatedState.floorWorkers = floorWorkers;
  updatedState.deptWorkers = deptWorkers;

  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  helpers.forEach((helperName) => {
    if (!helperName || !helperName.trim()) return;
    const cleanHelper = helperName.trim().toUpperCase();
    
    let updatedFloorWorkers = [...(updatedState.floorWorkers || [])];
    let updatedDeptWorkers = { ...(updatedState.deptWorkers || {}) };
    
    const existingIndex = updatedFloorWorkers.findIndex(w => w.name.toUpperCase() === cleanHelper);
    if (existingIndex === -1) {
      updatedFloorWorkers.push({
        id: `EMP-${Date.now()}-${Math.floor(Math.random()*1000)}`,
        name: cleanHelper,
        department: department,
        role: 'HELPER',
        shift: shift,
        assignedMachine: machine,
        pairedWithOperator: operatorName.trim().toUpperCase(),
        isPresent: true,
        shiftStatus: 'PRESENT',
        inTime: nowTime
      });

      const currentDeptList = updatedDeptWorkers[department] || [];
      if (!currentDeptList.includes(cleanHelper)) {
        updatedDeptWorkers[department] = [...currentDeptList, cleanHelper];
      }
    } else {
      updatedFloorWorkers[existingIndex] = {
        ...updatedFloorWorkers[existingIndex],
        role: 'HELPER',
        assignedMachine: machine,
        pairedWithOperator: operatorName.trim().toUpperCase(),
        isPresent: true,
        shiftStatus: 'PRESENT'
      };
    }
    
    updatedState.floorWorkers = updatedFloorWorkers;
    updatedState.deptWorkers = updatedDeptWorkers;
  });

  return { floorWorkers: updatedState.floorWorkers, deptWorkers: updatedState.deptWorkers };
}
