import 'server-only';
import { and, asc, count, eq, inArray, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { ApiError, notFound } from '@/lib/api/errors';
import { isUniqueViolation } from '@/lib/api/server';
import { writeAudit, type Tx } from '@/lib/audit';
import { hashPin } from '@/lib/auth/pin';
import {
  canAssignRole,
  canEditEmployee,
  canSeePay,
  scopeToCompany,
  type AuthContext,
} from '@/lib/auth/policy';
import type { Role } from '@/lib/auth/roles';
import { getDb } from '@/lib/db/client';
import {
  adjustments,
  approvals,
  attendanceLogs,
  auditLogs,
  dayRecords,
  employeeLocations,
  employeePositions,
  employees,
  employeeShifts,
  explanations,
  locations,
  notifications,
  payrollPeriods,
  payslips,
  positions,
  requests,
  scheduleCells,
  scheduleDrafts,
  sessions,
  shifts,
} from '@/lib/db/schema';
import { generatePin } from '@/lib/domain/pin';
import type {
  EmployeeBulkInput,
  EmployeeCreateInput,
  EmployeeDeleteInput,
  EmployeePatchInput,
} from '@/lib/validation/employee';
import { actorOf } from './actor';
import { vietnamToday } from '@/lib/domain/date';
import { lockEmployees, recomputeOpenPeriod } from './recompute';
import { assertOwned } from './references';

/** Không có `pin_hash` và bộ đếm PIN: mọi đọc nhân viên ra API đều qua danh sách cột này. */
const PUBLIC_COLUMNS = {
  id: employees.id,
  email: employees.email,
  name: employees.name,
  status: employees.status,
  leftDate: employees.leftDate,
  deviceBoundAt: employees.deviceBoundAt,
  contract: employees.contract,
  onboardDate: employees.onboardDate,
  role: employees.role,
  managerId: employees.managerId,
  positionId: employees.positionId,
  payOverride: employees.payOverride,
};

/** Trường làm đổi ngày công của người đó. */
const EMPLOYEE_RULES = ['positionId', 'onboardDate', 'status', 'payOverride'] as const;

const EMAIL_TAKEN = new ApiError(409, 'Email đã có người dùng', { email: 'Email đã có người dùng' });

function findEmployee(ctx: AuthContext, id: string) {
  return and(eq(employees.id, id), scopeToCompany(ctx, employees.companyId));
}

async function withOverrides<T extends { id: string; payOverride: unknown }>(ctx: AuthContext, rows: T[]) {
  const db = getDb();
  const [shiftRows, locationRows, extraRows] = await Promise.all([
    db
      .select({ employeeId: employeeShifts.employeeId, shiftId: employeeShifts.shiftId })
      .from(employeeShifts)
      .innerJoin(shifts, eq(shifts.id, employeeShifts.shiftId))
      .where(scopeToCompany(ctx, shifts.companyId)),
    db
      .select({ employeeId: employeeLocations.employeeId, locationId: employeeLocations.locationId })
      .from(employeeLocations)
      .innerJoin(locations, eq(locations.id, employeeLocations.locationId))
      .where(scopeToCompany(ctx, locations.companyId)),
    db
      .select({
        employeeId: employeePositions.employeeId,
        positionId: employeePositions.positionId,
        payAmount: employeePositions.payAmount,
      })
      .from(employeePositions)
      .innerJoin(positions, eq(positions.id, employeePositions.positionId))
      .where(scopeToCompany(ctx, positions.companyId)),
  ]);

  return rows.map((row) => {
    const shiftIds = shiftRows.filter((entry) => entry.employeeId === row.id).map((entry) => entry.shiftId);
    const locationIds = locationRows
      .filter((entry) => entry.employeeId === row.id)
      .map((entry) => entry.locationId);
    return {
      ...row,
      // Không còn dòng ghi đè nghĩa là theo vị trí; UI hiểu null là công tắc tắt
      shiftIds: shiftIds.length > 0 ? shiftIds : null,
      locationIds: locationIds.length > 0 ? locationIds : null,
      extraPositionIds: extraRows
        .filter((entry) => entry.employeeId === row.id)
        .map((entry) => entry.positionId),
      payOverride: canSeePay(ctx.employee.role) ? row.payOverride : null,
      extraPayAmounts: canSeePay(ctx.employee.role)
        ? Object.fromEntries(
            extraRows.flatMap((entry) =>
              entry.employeeId === row.id && entry.payAmount !== null
                ? [[entry.positionId, entry.payAmount] as const]
                : [],
            ),
          )
        : {},
    };
  });
}

export async function listEmployees(
  ctx: AuthContext,
  filters: { status?: 'active' | 'left'; positionId?: string } = {},
) {
  const conditions: SQL[] = [scopeToCompany(ctx, employees.companyId)];
  if (filters.status) conditions.push(eq(employees.status, filters.status));
  if (filters.positionId) conditions.push(eq(employees.positionId, filters.positionId));

  const rows = await getDb()
    .select(PUBLIC_COLUMNS)
    .from(employees)
    .where(and(...conditions))
    .orderBy(asc(employees.name));
  return withOverrides(ctx, rows);
}

export type EmployeeView = Awaited<ReturnType<typeof listEmployees>>[number];

export async function getEmployee(ctx: AuthContext, id: string) {
  const rows = await getDb().select(PUBLIC_COLUMNS).from(employees).where(findEmployee(ctx, id));
  if (rows.length === 0) throw notFound('nhân viên');
  return (await withOverrides(ctx, rows))[0]!;
}

function assertCanAssign(ctx: AuthContext, role: Role | undefined) {
  if (role && !canAssignRole(ctx.employee.role, role)) {
    throw new ApiError(403, 'Bạn không được cấp quyền này', { role: 'Bạn không được cấp quyền này' });
  }
}

async function assertReferences(
  tx: Tx,
  ctx: AuthContext,
  input: Pick<
    EmployeePatchInput,
    'positionId' | 'managerId' | 'shiftIds' | 'locationIds' | 'extraPositionIds'
  >,
) {
  await assertOwned(tx, ctx, positions, [input.positionId], 'positionId');
  await assertOwned(tx, ctx, positions, input.extraPositionIds ?? [], 'extraPositionIds');
  await assertOwned(tx, ctx, employees, [input.managerId], 'managerId');
  await assertOwned(tx, ctx, shifts, input.shiftIds ?? [], 'shiftIds');
  await assertOwned(tx, ctx, locations, input.locationIds ?? [], 'locationIds');
}

/**
 * Vị trí phụ không gồm vị trí chính; người chưa có vị trí chính thì không giữ vị trí phụ nào. Không
 * gửi danh sách hay mức riêng thì giữ cái đang có.
 */
async function replaceExtraPositions(
  tx: Tx,
  employeeId: string,
  primaryId: string | null,
  { extraPositionIds, extraPayAmounts }: Pick<EmployeePatchInput, 'extraPositionIds' | 'extraPayAmounts'>,
) {
  const mine = eq(employeePositions.employeeId, employeeId);
  const current = await tx.select().from(employeePositions).where(mine);
  const ids = primaryId
    ? (extraPositionIds ?? current.map(({ positionId }) => positionId)).filter((id) => id !== primaryId)
    : [];
  const payOf = (positionId: string) =>
    extraPayAmounts !== undefined
      ? (extraPayAmounts[positionId] ?? null)
      : (current.find((row) => row.positionId === positionId)?.payAmount ?? null);

  await tx.delete(employeePositions).where(mine);
  if (ids.length > 0) {
    await tx
      .insert(employeePositions)
      .values(ids.map((positionId) => ({ employeeId, positionId, payAmount: payOf(positionId) })));
  }
}

async function replaceOverrides(
  tx: Tx,
  employeeId: string,
  input: Pick<EmployeePatchInput, 'shiftIds' | 'locationIds'>,
) {
  if (input.shiftIds !== undefined) {
    await tx.delete(employeeShifts).where(eq(employeeShifts.employeeId, employeeId));
    if (input.shiftIds?.length) {
      await tx.insert(employeeShifts).values(input.shiftIds.map((shiftId) => ({ employeeId, shiftId })));
    }
  }
  if (input.locationIds !== undefined) {
    await tx.delete(employeeLocations).where(eq(employeeLocations.employeeId, employeeId));
    if (input.locationIds?.length) {
      await tx
        .insert(employeeLocations)
        .values(input.locationIds.map((locationId) => ({ employeeId, locationId })));
    }
  }
}

/** Tạo nhân viên; PIN gốc chỉ trả về đúng lần này. */
export async function createEmployee(
  ctx: AuthContext,
  { shiftIds, locationIds, extraPositionIds, extraPayAmounts, ...fields }: EmployeeCreateInput,
) {
  assertCanAssign(ctx, fields.role);
  const pin = generatePin();
  const pinHash = await hashPin(pin);

  try {
    return await getDb().transaction(async (tx) => {
      await assertReferences(tx, ctx, { ...fields, shiftIds, locationIds, extraPositionIds });
      const [created] = await tx
        .insert(employees)
        .values({ ...fields, companyId: ctx.company.id, pinHash })
        .returning({ id: employees.id });
      await replaceOverrides(tx, created!.id, { shiftIds, locationIds });
      await replaceExtraPositions(tx, created!.id, fields.positionId, { extraPositionIds, extraPayAmounts });
      await writeAudit(tx, actorOf(ctx), {
        action: 'employee.create',
        entity: 'employee',
        entityId: created!.id,
        after: { ...fields, shiftIds, locationIds, extraPositionIds, extraPayAmounts },
      });
      return { id: created!.id, pin };
    });
  } catch (error) {
    throw isUniqueViolation(error) ? EMAIL_TAKEN : error;
  }
}

/** Thêm cả lô trong một transaction: dòng nào lỗi thì không tạo ai, để PIN đã hiện luôn khớp thực tế. */
export async function createEmployeesBulk(ctx: AuthContext, input: EmployeeBulkInput) {
  const pins = input.employees.map(() => generatePin());
  const pinHashes = await Promise.all(pins.map(hashPin));
  const emails = input.employees.map(({ email }) => email);

  try {
    return await getDb().transaction(async (tx) => {
      await assertOwned(
        tx,
        ctx,
        positions,
        input.employees.map(({ positionId }) => positionId),
        'positionId',
      );
      const taken = await tx
        .select({ email: employees.email })
        .from(employees)
        .where(and(scopeToCompany(ctx, employees.companyId), inArray(employees.email, emails)));
      if (taken.length > 0) {
        const list = taken.map(({ email }) => email).join(', ');
        throw new ApiError(409, `Email đã có người dùng: ${list}`);
      }

      const onboardDate = vietnamToday();
      const created = await tx
        .insert(employees)
        .values(
          input.employees.map((employee, index) => ({
            ...employee,
            companyId: ctx.company.id,
            pinHash: pinHashes[index]!,
            onboardDate,
          })),
        )
        .returning({
          id: employees.id,
          name: employees.name,
          email: employees.email,
          positionId: employees.positionId,
        });
      await writeAudit(tx, actorOf(ctx), {
        action: 'employee.bulk_create',
        entity: 'employee',
        after: { count: created.length, employees: created },
      });

      const pinByEmail = new Map(emails.map((email, index) => [email, pins[index]!]));
      return created.map(({ id, name, email }) => ({ id, name, email, pin: pinByEmail.get(email)! }));
    });
  } catch (error) {
    throw isUniqueViolation(error) ? EMAIL_TAKEN : error;
  }
}

export async function updateEmployee(
  ctx: AuthContext,
  id: string,
  { shiftIds, locationIds, extraPositionIds, extraPayAmounts, ...fields }: EmployeePatchInput,
) {
  assertCanAssign(ctx, fields.role);

  try {
    await getDb().transaction(async (tx) => {
      const [before] = await tx
        .select(PUBLIC_COLUMNS)
        .from(employees)
        .where(findEmployee(ctx, id))
        .for('update');
      if (!before) throw notFound('nhân viên');
      if (!canEditEmployee(ctx.employee, before)) {
        throw new ApiError(403, 'Bạn không được sửa Quản trị viên');
      }

      const isSelf = id === ctx.employee.id;
      if (isSelf && fields.status === 'left')
        throw new ApiError(409, 'Không thể tự chuyển mình sang Đã nghỉ');
      if (isSelf && fields.role && fields.role !== before.role) {
        throw new ApiError(409, 'Không thể tự đổi quyền của mình', {
          role: 'Không thể tự đổi quyền của mình',
        });
      }
      if (fields.managerId === id) {
        throw new ApiError(400, 'Không thể tự quản lý mình', { managerId: 'Không thể tự quản lý mình' });
      }

      await assertReferences(tx, ctx, { ...fields, shiftIds, locationIds, extraPositionIds });
      // Giữ ngày cũ khi PATCH lặp lại `left`, để công đến ngày nghỉ thật không bị đổi
      const statusChanged = fields.status !== undefined && fields.status !== before.status;
      const leftDate = statusChanged ? { leftDate: fields.status === 'left' ? vietnamToday() : null } : {};
      // Người nghỉ trả lại máy: giữ mã thì người sau dùng lại điện thoại đó sẽ bị chặn oan
      const device = fields.status === 'left' ? { deviceHash: null, deviceBoundAt: null } : {};
      if (Object.keys(fields).length > 0) {
        await tx
          .update(employees)
          .set({ ...fields, ...leftDate, ...device })
          .where(findEmployee(ctx, id));
      }
      await replaceOverrides(tx, id, { shiftIds, locationIds });
      const primaryId = fields.positionId !== undefined ? fields.positionId : before.positionId;
      await replaceExtraPositions(tx, id, primaryId, { extraPositionIds, extraPayAmounts });
      // Đã nghỉ: đá ra ngay trên mọi máy, không chờ phiên hết hạn (US13)
      if (fields.status === 'left') await tx.delete(sessions).where(eq(sessions.employeeId, id));

      await writeAudit(tx, actorOf(ctx), {
        action: 'employee.update',
        entity: 'employee',
        entityId: id,
        before,
        after: { ...fields, ...leftDate, shiftIds, locationIds, extraPositionIds, extraPayAmounts },
      });
      const touchesCong =
        shiftIds !== undefined ||
        extraPositionIds !== undefined ||
        EMPLOYEE_RULES.some((key) => fields[key] !== undefined && fields[key] !== before[key]);
      if (touchesCong) await recomputeOpenPeriod(tx, ctx.company.id, [id]);
    });
  } catch (error) {
    throw isUniqueViolation(error) ? EMAIL_TAKEN : error;
  }
}

/** Tạo PIN mới, mở khoá và đăng xuất mọi máy; PIN gốc chỉ trả về đúng lần này (US12). */
export async function resetEmployeePin(ctx: AuthContext, id: string) {
  const pin = generatePin();
  const pinHash = await hashPin(pin);

  await getDb().transaction(async (tx) => {
    const [before] = await tx
      .select(PUBLIC_COLUMNS)
      .from(employees)
      .where(findEmployee(ctx, id))
      .for('update');
    if (!before) throw notFound('nhân viên');
    if (!canEditEmployee(ctx.employee, before)) throw new ApiError(403, 'Bạn không được sửa Quản trị viên');

    await tx
      .update(employees)
      .set({ pinHash, failedPinAttempts: 0, lockedUntil: null })
      .where(findEmployee(ctx, id));
    await tx.delete(sessions).where(eq(sessions.employeeId, id));
    await writeAudit(tx, actorOf(ctx), { action: 'employee.reset_pin', entity: 'employee', entityId: id });
  });
  return pin;
}

/** Dữ liệu của chính người đó, xoá cùng hồ sơ; số lượng hiện trong hộp xác nhận. */
async function ownedCounts(db: Pick<Tx, 'select'>, id: string) {
  const counted = async (table: PgTable & { employeeId: PgColumn }) =>
    (await db.select({ total: count() }).from(table).where(eq(table.employeeId, id)))[0]?.total ?? 0;
  const [punches, days, requestRows, payslipRows, adjustmentRows] = await Promise.all([
    counted(attendanceLogs),
    counted(dayRecords),
    counted(requests),
    counted(payslips),
    counted(adjustments),
  ]);
  return {
    punches,
    days,
    requests: requestRows,
    payslips: payslipRows,
    adjustments: adjustmentRows,
  };
}

async function assertCanDelete(db: Pick<Tx, 'select'>, ctx: AuthContext, id: string) {
  if (id === ctx.employee.id) throw new ApiError(409, 'Không thể tự xoá tài khoản của mình');
  const [target] = await db
    .select({ id: employees.id, name: employees.name, email: employees.email, role: employees.role })
    .from(employees)
    .where(findEmployee(ctx, id));
  if (!target) throw notFound('nhân viên');
  return target;
}

/** Những gì sẽ mất nếu xoá, để Quản trị viên đọc trước khi bấm. */
export async function deletionImpact(ctx: AuthContext, id: string) {
  const db = getDb();
  const target = await assertCanDelete(db, ctx, id);
  return { name: target.name, email: target.email, ...(await ownedCounts(db, id)) };
}

export type DeletionImpact = Awaited<ReturnType<typeof deletionImpact>>;

/**
 * Xoá hẳn một nhân viên và mọi dữ liệu của người đó. Quyết định người đó đã đưa ra cho người khác
 * (duyệt công, duyệt đơn, công bố lương) được giữ và bỏ tên: xoá chúng sẽ làm đổi công và lương của
 * người còn lại. Nhật ký giữ một dòng ghi ai đã xoá ai.
 */
export async function deleteEmployee(ctx: AuthContext, id: string, { email }: EmployeeDeleteInput) {
  await getDb().transaction(async (tx) => {
    await lockEmployees(tx, [id]);
    const target = await assertCanDelete(tx, ctx, id);
    if (email !== target.email) {
      throw new ApiError(400, 'Email xác nhận không khớp', { email: 'Gõ đúng email của nhân viên này' });
    }
    await tx.select({ id: employees.id }).from(employees).where(eq(employees.id, id)).for('update');
    const counts = await ownedCounts(tx, id);

    // Lần chấm tổng hợp trỏ tới đơn, nên xoá lần chấm trước đơn
    for (const table of [
      notifications,
      attendanceLogs,
      explanations,
      approvals,
      dayRecords,
      adjustments,
      payslips,
      scheduleCells,
      scheduleDrafts,
      requests,
    ] as const) {
      await tx.delete(table).where(eq(table.employeeId, id));
    }
    await tx.delete(auditLogs).where(eq(auditLogs.entityId, id));

    await tx.update(employees).set({ managerId: null }).where(eq(employees.managerId, id));
    await tx.update(requests).set({ decidedBy: null }).where(eq(requests.decidedBy, id));
    await tx.update(requests).set({ targetEmployeeId: null }).where(eq(requests.targetEmployeeId, id));
    await tx.update(approvals).set({ by: null }).where(eq(approvals.by, id));
    await tx.update(adjustments).set({ by: null }).where(eq(adjustments.by, id));
    await tx.update(payrollPeriods).set({ publishedBy: null }).where(eq(payrollPeriods.publishedBy, id));
    await tx.update(auditLogs).set({ actorId: null }).where(eq(auditLogs.actorId, id));

    // Ca riêng, địa điểm riêng, vị trí phụ và phiên đăng nhập tự xoá theo khoá ngoại
    await tx.delete(employees).where(eq(employees.id, id));
    await writeAudit(tx, actorOf(ctx), {
      action: 'employee.delete',
      entity: 'employee',
      before: { name: target.name, role: target.role, ...counts },
    });
  });
}
