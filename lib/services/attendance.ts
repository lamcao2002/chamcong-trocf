import 'server-only';
import { and, asc, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';
import { writeAudit, type Tx } from '@/lib/audit';
import type { AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import {
  attendanceLogs,
  dayRecords,
  employeeLocations,
  employees,
  locations,
  positionLocations,
  positions,
  scheduleCells,
  shifts,
} from '@/lib/db/schema';
import { vietnamToday } from '@/lib/domain/date';
import { nearestZone } from '@/lib/domain/geo';
import { expectedShifts } from '@/lib/engine/expected-shifts';
import { addDays, atMinute } from '@/lib/engine/time';
import type { EngineShift } from '@/lib/engine/types';
import type { PunchInput } from '@/lib/validation/attendance';
import { actorOf } from './actor';
import { bindDevice, type DeviceCheck } from './device';
import { loadEmployeeRules, recomputeDays } from './recompute';
import { allowedShiftIds } from './schedule';
import { positionsOf } from './staff-positions';

/** Lần vào không có lần ra quá mốc này thì coi là quên RA CA, nút quay lại VÀO CA. */
const OPEN_PUNCH_MS = 18 * 60 * 60 * 1000;

type Reader = Pick<Tx, 'select'>;

/**
 * Địa điểm được chấm: ghi đè Địa điểm riêng thắng địa điểm của vị trí; `anyLocation` là ở đâu cũng
 * được. Người làm nhiều vị trí chấm được ở mọi địa điểm của các vị trí đó.
 */
async function allowedLocations(db: Reader, employeeId: string, positionId: string | null) {
  const columns = {
    id: locations.id,
    name: locations.name,
    lat: locations.lat,
    lng: locations.lng,
    radiusM: locations.radiusM,
  };
  const own = await db
    .select(columns)
    .from(employeeLocations)
    .innerJoin(locations, eq(locations.id, employeeLocations.locationId))
    .where(eq(employeeLocations.employeeId, employeeId));
  if (own.length > 0) return { anyLocation: false, locations: own };
  const held = (await positionsOf(db, [{ id: employeeId, positionId }])).get(employeeId) ?? [];
  if (held.length === 0) return { anyLocation: false, locations: [] };

  const [flags, inherited] = await Promise.all([
    db.select({ anyLocation: positions.anyLocation }).from(positions).where(inArray(positions.id, held)),
    db
      .select(columns)
      .from(positionLocations)
      .innerJoin(locations, eq(locations.id, positionLocations.locationId))
      .where(inArray(positionLocations.positionId, held)),
  ]);
  const unique = inherited.filter((row, index) => inherited.findIndex(({ id }) => id === row.id) === index);
  return { anyLocation: flags.some(({ anyLocation }) => anyLocation), locations: unique };
}

/** Dữ liệu màn Chấm công: ca hôm nay, ca được chọn, địa điểm, dòng thời gian (US17, US20). */
export async function getAppHome(ctx: AuthContext, now: Date = new Date()) {
  const db = getDb();
  const employeeId = ctx.employee.id;
  const date = vietnamToday(now);
  const library = (await db
    .select()
    .from(shifts)
    .where(eq(shifts.companyId, ctx.company.id))) as EngineShift[];
  const [employee] = await db
    .select({ positionId: employees.positionId })
    .from(employees)
    .where(eq(employees.id, employeeId));
  const positionId = employee?.positionId ?? null;

  const [rules, allowed, zone, cell, punches] = await Promise.all([
    loadEmployeeRules(db, [employeeId]),
    allowedShiftIds(db, [{ id: employeeId, positionId }]),
    allowedLocations(db, employeeId, positionId),
    db
      .select({ shiftIds: scheduleCells.shiftIds, isOff: scheduleCells.isOff })
      .from(scheduleCells)
      .where(and(eq(scheduleCells.employeeId, employeeId), eq(scheduleCells.date, date))),
    db
      .select()
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.employeeId, employeeId),
          gte(attendanceLogs.at, new Date(now.getTime() - OPEN_PUNCH_MS)),
        ),
      )
      .orderBy(asc(attendanceLogs.at)),
  ]);

  const rule = rules.get(employeeId)!;
  const today = expectedShifts({ date, employee: rule, schedule: cell[0] ?? null, shifts: library });
  const last = punches[punches.length - 1];
  const dayStart = atMinute(date, 0);
  const shiftView = ({ id, code, name, startTime, endTime }: EngineShift) => ({
    id,
    code,
    name,
    startTime: startTime.slice(0, 5),
    endTime: endTime.slice(0, 5),
  });
  const nameOf = (shiftId: string | null) => library.find(({ id }) => id === shiftId)?.name ?? null;

  return {
    date,
    now: now.toISOString(),
    shiftMode: rule.shiftMode,
    isOff: today.reason === 'off',
    shifts: today.shifts.map(shiftView),
    choices: library.filter(({ id }) => allowed.get(employeeId)?.includes(id)).map(shiftView),
    anyLocation: zone.anyLocation,
    locations: zone.locations,
    nextAction: last?.type === 'in' ? ('out' as const) : ('in' as const),
    /** Ca đã chọn lúc vào: RA CA giữ nguyên ca này. */
    openShiftId: last?.type === 'in' ? last.chosenShiftId : null,
    timeline: punches
      .filter(({ at }) => at >= dayStart || at === last?.at)
      .map(({ id, at, type, inZone, distanceM, chosenShiftId }) => ({
        id,
        at: at.toISOString(),
        type,
        inZone,
        distanceM,
        shiftName: nameOf(chosenShiftId),
      })),
  };
}

export type AppHome = Awaited<ReturnType<typeof getAppHome>>;

/** Chấm vào/ra: giờ và trong/ngoài vùng đều tính ở server (US18, US19), tính lại trong cùng giao dịch. */
export async function punch(
  ctx: AuthContext,
  input: PunchInput,
  device: DeviceCheck | null = null,
  now: Date = new Date(),
) {
  const employeeId = ctx.employee.id;
  const companyId = ctx.company.id;
  const chosenShiftId = input.chosenShiftId ?? null;
  const date = vietnamToday(now);

  return getDb().transaction(async (tx) => {
    if (device?.bind) await bindDevice(tx, ctx, device.token);
    const [employee] = await tx
      .select({ positionId: employees.positionId })
      .from(employees)
      .where(eq(employees.id, employeeId));
    const positionId = employee?.positionId ?? null;

    if (chosenShiftId) {
      const allowed = await allowedShiftIds(tx, [{ id: employeeId, positionId }]);
      if (!allowed.get(employeeId)?.includes(chosenShiftId)) {
        throw new ApiError(400, 'Ca này không nằm trong ca bạn được làm', {
          chosenShiftId: 'Ca không hợp lệ',
        });
      }
    }

    const zone = await allowedLocations(tx, employeeId, positionId);
    const nearest = nearestZone(input, zone.locations);
    const inZone = zone.anyLocation || (nearest?.inZone ?? false);
    const distanceM = nearest ? Math.round(nearest.distanceM) : null;

    const [log] = await tx
      .insert(attendanceLogs)
      .values({
        companyId,
        employeeId,
        at: now,
        type: input.type,
        chosenShiftId,
        lat: input.lat,
        lng: input.lng,
        accuracyM: input.accuracy,
        inZone,
        distanceM,
        locationId: nearest?.location.id ?? null,
      })
      .returning();
    await writeAudit(tx, actorOf(ctx), {
      action: 'attendance.punch',
      entity: 'attendance_log',
      entityId: log!.id,
      after: { type: input.type, inZone, distanceM, chosenShiftId },
    });
    // Ca đêm: lần chấm sáng nay có thể thuộc ngày hôm qua
    await recomputeDays(tx, { companyId, employeeIds: [employeeId], from: addDays(date, -1), to: date }, now);

    const mark = input.type === 'in' ? dayRecords.inAt : dayRecords.outAt;
    const [record] = await tx
      .select({
        status: dayRecords.status,
        lateMin: dayRecords.lateMin,
        earlyMin: dayRecords.earlyMin,
        otProposed: dayRecords.otProposed,
        cong: dayRecords.cong,
        shiftName: shifts.name,
      })
      .from(dayRecords)
      .leftJoin(shifts, eq(shifts.id, dayRecords.shiftId))
      .where(
        and(
          eq(dayRecords.employeeId, employeeId),
          inArray(dayRecords.date, [addDays(date, -1), date]),
          isNotNull(mark),
        ),
      )
      .orderBy(desc(mark))
      .limit(1);

    return {
      at: now.toISOString(),
      type: input.type,
      inZone,
      distanceM,
      locationName: nearest?.location.name ?? null,
      record: record ?? null,
    };
  });
}

export type PunchResult = Awaited<ReturnType<typeof punch>>;
