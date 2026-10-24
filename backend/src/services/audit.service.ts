import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { auditSink } from '../integrations/AuditSink';

type Db = Prisma.TransactionClient | typeof prisma;

/** Writes an audit row through the AuditSink. Call with the active `tx` so it commits atomically with the change. */
export async function log(
  db: Db,
  entry: {
    userId?: string | null;
    action: string;
    entity: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await auditSink.write(db, {
    userId: entry.userId ?? null,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    metadata: entry.metadata as Prisma.InputJsonValue | undefined,
  });
}

export const AuditService = { log };
