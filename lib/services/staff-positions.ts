import 'server-only';
import { inArray } from 'drizzle-orm';
import type { Tx } from '@/lib/audit';
import { employeePositions } from '@/lib/db/schema';

type Reader = Pick<Tx, 'select'>;

/** Mọi vị trí một người làm được, vị trí chính đứng đầu; người chưa có vị trí chính thì không có vị trí phụ. */
export async function positionsOf(
  db: Reader,
  employeeRows: readonly { id: string; positionId: string | null }[],
) {
  const ids = employeeRows.map(({ id }) => id);
  const extras =
    ids.length === 0
      ? []
      : await db.select().from(employeePositions).where(inArray(employeePositions.employeeId, ids));
  return new Map(
    employeeRows.map(({ id, positionId }): [string, string[]] => {
      if (!positionId) return [id, []];
      const more = extras
        .filter((row) => row.employeeId === id && row.positionId !== positionId)
        .map((row) => row.positionId);
      return [id, [positionId, ...more]];
    }),
  );
}
