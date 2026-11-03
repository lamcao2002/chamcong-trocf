import 'server-only';
import type { Db } from '@/lib/db/client';
import { auditLogs } from '@/lib/db/schema';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type Actor = { companyId: string; actorId: string | null };

type AuditEntry = {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: object | null;
  after?: object | null;
};

/** Không bao giờ ghi PIN vào nhật ký, kể cả dạng băm. */
function redact(snapshot: object | null | undefined) {
  if (!snapshot) return snapshot;
  const { pinHash: _pinHash, deviceHash: _deviceHash, ...rest } = snapshot as Record<string, unknown>;
  return rest;
}

/** Ghi một dòng `audit_logs`, gọi trong cùng transaction với thao tác ghi. */
export async function writeAudit(tx: Tx, actor: Actor, entry: AuditEntry) {
  await tx.insert(auditLogs).values({
    ...actor,
    ...entry,
    before: redact(entry.before),
    after: redact(entry.after),
  });
}

export type { Tx };
