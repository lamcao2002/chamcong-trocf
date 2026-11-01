import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { ApiError, notFound } from '@/lib/api/errors';
import { isUniqueViolation } from '@/lib/api/server';
import { writeAudit } from '@/lib/audit';
import { scopeToCompany, type AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import {
  attendanceLogs,
  dayRecords,
  employeeShifts,
  positions,
  positionShifts,
  scheduleCells,
  shifts,
} from '@/lib/db/schema';
import { isOvernight } from '@/lib/domain/shift';
import type { ShiftInput } from '@/lib/validation/shift';
import { actorOf } from './actor';

const NOT_FOUND = 'ca';

const toHhmm = (time: string | null) => time?.slice(0, 5) ?? null;

const CODE_TAKEN = new ApiError(409, 'Mã ca đã tồn tại', { code: 'Mã ca đã tồn tại' });

// Viết tay tên bảng: Drizzle bỏ tiền tố bảng trong truy vấn một bảng, "id" sẽ trỏ nhầm vào bảng của truy vấn con
const OUTER_SHIFT_ID = sql.raw('"shifts"."id"');

/** Ca đã có lịch hoặc lần chấm thì mã không được đổi (US05). */
const hasHistory = sql<boolean>`(
  exists (select 1 from ${scheduleCells} where ${OUTER_SHIFT_ID} = any(${scheduleCells.shiftIds}))
  or exists (select 1 from ${attendanceLogs} where ${attendanceLogs.chosenShiftId} = ${OUTER_SHIFT_ID})
  or exists (select 1 from ${dayRecords} where ${dayRecords.shiftId} = ${OUTER_SHIFT_ID})
)`;

export async function listShifts(ctx: AuthContext) {
  const db = getDb();
  const [rows, usage] = await Promise.all([
    db
      .select({ shift: shifts, codeLocked: hasHistory })
      .from(shifts)
      .where(scopeToCompany(ctx, shifts.companyId))
      .orderBy(asc(shifts.startTime), asc(shifts.code)),
    db
      .select({ shiftId: positionShifts.shiftId, name: positions.name })
      .from(positionShifts)
      .innerJoin(positions, eq(positions.id, positionShifts.positionId))
      .where(scopeToCompany(ctx, positions.companyId)),
  ]);

  return rows.map(({ shift, codeLocked }) => ({
    ...shift,
    startTime: toHhmm(shift.startTime)!,
    endTime: toHhmm(shift.endTime)!,
    breakStart: toHhmm(shift.breakStart),
    breakEnd: toHhmm(shift.breakEnd),
    codeLocked,
    positionNames: usage.filter((entry) => entry.shiftId === shift.id).map((entry) => entry.name),
  }));
}

export type ShiftView = Awaited<ReturnType<typeof listShifts>>[number];

function findShift(ctx: AuthContext, id: string) {
  return and(eq(shifts.id, id), scopeToCompany(ctx, shifts.companyId));
}

export async function createShift(ctx: AuthContext, input: ShiftInput) {
  try {
    return await getDb().transaction(async (tx) => {
      const [shift] = await tx
        .insert(shifts)
        .values({
          ...input,
          companyId: ctx.company.id,
          overnight: isOvernight(input.startTime, input.endTime),
        })
        .returning();
      await writeAudit(tx, actorOf(ctx), {
        action: 'shift.create',
        entity: 'shift',
        entityId: shift!.id,
        after: shift,
      });
      return shift!;
    });
  } catch (error) {
    throw isUniqueViolation(error) ? CODE_TAKEN : error;
  }
}

export async function updateShift(ctx: AuthContext, id: string, input: ShiftInput) {
  try {
    return await getDb().transaction(async (tx) => {
      const [before] = await tx
        .select({ shift: shifts, codeLocked: hasHistory })
        .from(shifts)
        .where(findShift(ctx, id))
        .for('update', { of: shifts });
      if (!before) throw notFound(NOT_FOUND);
      if (before.codeLocked && before.shift.code !== input.code) {
        const message = 'Mã không đổi được vì ca đã có lịch hoặc lần chấm';
        throw new ApiError(409, message, { code: message });
      }

      const [shift] = await tx
        .update(shifts)
        .set({ ...input, overnight: isOvernight(input.startTime, input.endTime) })
        .where(findShift(ctx, id))
        .returning();
      await writeAudit(tx, actorOf(ctx), {
        action: 'shift.update',
        entity: 'shift',
        entityId: id,
        before: before.shift,
        after: shift,
      });
      return shift!;
    });
  } catch (error) {
    throw isUniqueViolation(error) ? CODE_TAKEN : error;
  }
}

export async function deleteShift(ctx: AuthContext, id: string) {
  await getDb().transaction(async (tx) => {
    const [before] = await tx
      .select({ shift: shifts, codeLocked: hasHistory })
      .from(shifts)
      .where(findShift(ctx, id))
      .for('update', { of: shifts });
    if (!before) throw notFound(NOT_FOUND);

    const [position] = await tx
      .select({ id: positionShifts.positionId })
      .from(positionShifts)
      .where(eq(positionShifts.shiftId, id))
      .limit(1);
    const [override] = await tx
      .select({ id: employeeShifts.employeeId })
      .from(employeeShifts)
      .where(eq(employeeShifts.shiftId, id))
      .limit(1);
    if (before.codeLocked || position || override) {
      throw new ApiError(409, 'Ca đang được dùng ở vị trí, nhân viên hoặc lịch nên không xoá được');
    }

    await tx.delete(shifts).where(findShift(ctx, id));
    await writeAudit(tx, actorOf(ctx), {
      action: 'shift.delete',
      entity: 'shift',
      entityId: id,
      before: before.shift,
    });
  });
}
