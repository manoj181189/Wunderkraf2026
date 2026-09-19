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
