import { AuditLog } from '../types';

export const logAuditTrail = (
  userId: string,
  action: string,
  stage: string,
  machine: string,
  payload: Record<string, any>,
  complianceReference: AuditLog['complianceReference'] = 'INTERNAL'
): AuditLog => {
  return {
    id: `AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    userId,
    action,
    stage,
    machine,
    payload,
    complianceReference,
  };
};
