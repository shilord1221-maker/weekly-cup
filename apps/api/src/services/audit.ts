import { prisma } from '@/db.js';

interface AuditParams {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}

export async function logAudit(params: AuditParams) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload as any,
    },
  });
}
