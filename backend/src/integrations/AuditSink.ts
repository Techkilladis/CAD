import { Prisma } from '@prisma/client';

// AWS replacement: CloudWatch Logs / Kinesis Firehose -> S3 (keep Postgres as the queryable store if desired).
export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

export type AuditDb = Pick<Prisma.TransactionClient, 'auditLog'>;

export interface AuditSink {
  write(db: AuditDb, entry: AuditEntry): Promise<void>;
}

/** Local implementation: writes to the AuditLog table using the caller's client/transaction. */
export class PostgresAuditSink implements AuditSink {
  async write(db: AuditDb, entry: AuditEntry): Promise<void> {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        metadata: entry.metadata ?? Prisma.JsonNull,
      },
    });
  }
}

export const auditSink: AuditSink = new PostgresAuditSink();
