import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { ApiError, notFound } from '@/lib/api/errors';
import { writeAudit, type Tx } from '@/lib/audit';
import { scopeToCompany, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { attendanceLogs, locations, positionLocations, positions } from '@/lib/db/schema';
import type { LocationInput } from '@/lib/validation/location';
import { actorOf } from './actor';
import { assertOwned } from './references';

export async function listLocations(ctx: AuthContext) {
  const db = getDb();
  const [rows, links] = await Promise.all([
    db
      .select()
      .from(locations)
      .where(scopeToCompany(ctx, locations.companyId))
      .orderBy(asc(locations.createdAt), asc(locations.name)),
    db
      .select({ locationId: positionLocations.locationId, positionId: positionLocations.positionId })
      .from(positionLocations)
      .innerJoin(positions, eq(positions.id, positionLocations.positionId))
      .where(scopeToCompany(ctx, positions.companyId)),
  ]);

  return rows.map((location) => ({
    ...location,
    positionIds: links.filter((link) => link.locationId === location.id).map((link) => link.positionId),
  }));
}

export type LocationView = Awaited<ReturnType<typeof listLocations>>[number];

function findLocation(ctx: AuthContext, id: string) {
  return and(eq(locations.id, id), scopeToCompany(ctx, locations.companyId));
}

async function replacePositions(tx: Tx, locationId: string, positionIds: string[]) {
  await tx.delete(positionLocations).where(eq(positionLocations.locationId, locationId));
  if (positionIds.length > 0) {
    await tx.insert(positionLocations).values(positionIds.map((positionId) => ({ positionId, locationId })));
  }
}

export async function createLocation(ctx: AuthContext, { positionIds, ...fields }: LocationInput) {
  return getDb().transaction(async (tx) => {
    await assertOwned(tx, ctx, positions, positionIds, 'positionIds');
    const [location] = await tx
      .insert(locations)
      .values({ ...fields, companyId: ctx.company.id })
      .returning();
    await replacePositions(tx, location!.id, positionIds);
    await writeAudit(tx, actorOf(ctx), {
      action: 'location.create',
      entity: 'location',
      entityId: location!.id,
      after: { ...location, positionIds },
    });
    return location!;
  });
}

export async function updateLocation(
  ctx: AuthContext,
  id: string,
  { positionIds, ...fields }: LocationInput,
) {
  return getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(locations).where(findLocation(ctx, id)).for('update');
    if (!before) throw notFound('địa điểm');

    await assertOwned(tx, ctx, positions, positionIds, 'positionIds');
    const [location] = await tx.update(locations).set(fields).where(findLocation(ctx, id)).returning();
    await replacePositions(tx, id, positionIds);
    await writeAudit(tx, actorOf(ctx), {
      action: 'location.update',
      entity: 'location',
      entityId: id,
      before,
      after: { ...location, positionIds },
    });
    return location!;
  });
}

export async function deleteLocation(ctx: AuthContext, id: string) {
  await getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(locations).where(findLocation(ctx, id)).for('update');
    if (!before) throw notFound('địa điểm');

    const [punch] = await tx
      .select({ id: attendanceLogs.id })
      .from(attendanceLogs)
      .where(eq(attendanceLogs.locationId, id))
      .limit(1);
    if (punch) throw new ApiError(409, 'Địa điểm đã có lần chấm công nên không xoá được');

    await tx.delete(locations).where(findLocation(ctx, id));
    await writeAudit(tx, actorOf(ctx), {
      action: 'location.delete',
      entity: 'location',
      entityId: id,
      before,
    });
  });
}
