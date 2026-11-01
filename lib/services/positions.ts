import 'server-only';
import { and, asc, count, eq } from 'drizzle-orm';
import { ApiError, notFound } from '@/lib/api/errors';
import { writeAudit, type Tx } from '@/lib/audit';
import { scopeToCompany, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { employees, locations, positionLocations, positions, positionShifts, shifts } from '@/lib/db/schema';
import type { PositionInput } from '@/lib/validation/position';
import { actorOf } from './actor';
import { recomputeOpenPeriod, rulesChanged } from './recompute';
import { assertOwned } from './references';

export async function listPositions(ctx: AuthContext) {
  const db = getDb();
  const [rows, shiftRows, locationRows, headcounts] = await Promise.all([
    db
      .select()
      .from(positions)
      .where(scopeToCompany(ctx, positions.companyId))
      .orderBy(asc(positions.createdAt), asc(positions.name)),
    db
      .select({ positionId: positionShifts.positionId, shiftId: positionShifts.shiftId })
      .from(positionShifts)
      .innerJoin(shifts, eq(shifts.id, positionShifts.shiftId))
      .where(scopeToCompany(ctx, shifts.companyId)),
    db
      .select({ positionId: positionLocations.positionId, locationId: positionLocations.locationId })
      .from(positionLocations)
      .innerJoin(locations, eq(locations.id, positionLocations.locationId))
      .where(scopeToCompany(ctx, locations.companyId)),
    db
      .select({ positionId: employees.positionId, total: count() })
      .from(employees)
      .where(and(scopeToCompany(ctx, employees.companyId), eq(employees.status, 'active')))
      .groupBy(employees.positionId),
  ]);

  return rows.map((position) => ({
    ...position,
    shiftIds: shiftRows.filter((row) => row.positionId === position.id).map((row) => row.shiftId),
    locationIds: locationRows.filter((row) => row.positionId === position.id).map((row) => row.locationId),
    headcount: headcounts.find((row) => row.positionId === position.id)?.total ?? 0,
  }));
}

/** Trường làm đổi ngày công; đổi tên hay mức lương thì khỏi tính lại. */
const POSITION_RULES = [
  'shiftMode',
  'fixedShiftId',
  'workDays',
  'otWeekday',
  'otSaturday',
  'otOffday',
  'otHoliday',
] as const;

export type PositionView = Awaited<ReturnType<typeof listPositions>>[number];

function findPosition(ctx: AuthContext, id: string) {
  return and(eq(positions.id, id), scopeToCompany(ctx, positions.companyId));
}

async function assertReferences(tx: Tx, ctx: AuthContext, input: PositionInput) {
  await assertOwned(tx, ctx, shifts, input.shiftIds, 'shiftIds');
  await assertOwned(tx, ctx, locations, input.locationIds, 'locationIds');
}

async function replaceLinks(tx: Tx, positionId: string, input: PositionInput) {
  await tx.delete(positionShifts).where(eq(positionShifts.positionId, positionId));
  await tx.delete(positionLocations).where(eq(positionLocations.positionId, positionId));
  await tx.insert(positionShifts).values(input.shiftIds.map((shiftId) => ({ positionId, shiftId })));
  if (input.locationIds.length > 0) {
    await tx
      .insert(positionLocations)
      .values(input.locationIds.map((locationId) => ({ positionId, locationId })));
  }
}

export async function createPosition(ctx: AuthContext, { shiftIds, locationIds, ...fields }: PositionInput) {
  const input = { ...fields, shiftIds, locationIds };
  return getDb().transaction(async (tx) => {
    await assertReferences(tx, ctx, input);
    const [position] = await tx
      .insert(positions)
      .values({ ...fields, companyId: ctx.company.id })
      .returning();
    await replaceLinks(tx, position!.id, input);
    await writeAudit(tx, actorOf(ctx), {
      action: 'position.create',
      entity: 'position',
      entityId: position!.id,
      after: input,
    });
    return position!;
  });
}

export async function updatePosition(
  ctx: AuthContext,
  id: string,
  { shiftIds, locationIds, ...fields }: PositionInput,
) {
  const input = { ...fields, shiftIds, locationIds };
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(positions).where(findPosition(ctx, id)).for('update');
    if (!before) throw notFound('vị trí');

    await assertReferences(tx, ctx, input);
    const [position] = await tx.update(positions).set(fields).where(findPosition(ctx, id)).returning();
    await replaceLinks(tx, id, input);
    await writeAudit(tx, actorOf(ctx), {
      action: 'position.update',
      entity: 'position',
      entityId: id,
      before,
      after: input,
    });
    if (rulesChanged(before, position!, POSITION_RULES)) {
      const holders = await tx
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.positionId, id));
      await recomputeOpenPeriod(
        tx,
        ctx.company.id,
        holders.map((holder) => holder.id),
      );
    }
    return position!;
  });
}

export async function deletePosition(ctx: AuthContext, id: string) {
  await getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(positions).where(findPosition(ctx, id)).for('update');
    if (!before) throw notFound('vị trí');

    const [holder] = await tx
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.positionId, id))
      .limit(1);
    if (holder) throw new ApiError(409, 'Vị trí đang có nhân viên nên không xoá được');

    await tx.delete(positions).where(findPosition(ctx, id));
    await writeAudit(tx, actorOf(ctx), {
      action: 'position.delete',
      entity: 'position',
      entityId: id,
      before,
    });
  });
}
