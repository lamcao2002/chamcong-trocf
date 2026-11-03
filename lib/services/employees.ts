import 'server-only';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
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
  employeeLocations,
  employees,
  employeeShifts,
  locations,
  positions,
  sessions,
  shifts,
} from '@/lib/db/schema';
import { generatePin } from '@/lib/domain/pin';
import type { EmployeeBulkInput, EmployeeCreateInput, EmployeePatchInput } from '@/lib/validation/employee';
import { actorOf } from './actor';
import { vietnamToday } from '@/lib/domain/date';
import { recomputeOpenPeriod } from './recompute';
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
  const [shiftRows, locationRows] = await Promise.all([
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
      payOverride: canSeePay(ctx.employee.role) ? row.payOverride : null,
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
  input: Pick<EmployeePatchInput, 'positionId' | 'managerId' | 'shiftIds' | 'locationIds'>,
) {
  await assertOwned(tx, ctx, positions, [input.positionId], 'positionId');
  await assertOwned(tx, ctx, employees, [input.managerId], 'managerId');
  await assertOwned(tx, ctx, shifts, input.shiftIds ?? [], 'shiftIds');
  await assertOwned(tx, ctx, locations, input.locationIds ?? [], 'locationIds');
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
  { shiftIds, locationIds, ...fields }: EmployeeCreateInput,
) {
  assertCanAssign(ctx, fields.role);
  const pin = generatePin();
  const pinHash = await hashPin(pin);

  try {
    return await getDb().transaction(async (tx) => {
      await assertReferences(tx, ctx, { ...fields, shiftIds, locationIds });
      const [created] = await tx
        .insert(employees)
        .values({ ...fields, companyId: ctx.company.id, pinHash })
        .returning({ id: employees.id });
      await replaceOverrides(tx, created!.id, { shiftIds, locationIds });
      await writeAudit(tx, actorOf(ctx), {
        action: 'employee.create',
        entity: 'employee',
        entityId: created!.id,
        after: { ...fields, shiftIds, locationIds },
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
  { shiftIds, locationIds, ...fields }: EmployeePatchInput,
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

      await assertReferences(tx, ctx, { ...fields, shiftIds, locationIds });
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
      // Đã nghỉ: đá ra ngay trên mọi máy, không chờ phiên hết hạn (US13)
      if (fields.status === 'left') await tx.delete(sessions).where(eq(sessions.employeeId, id));

      await writeAudit(tx, actorOf(ctx), {
        action: 'employee.update',
        entity: 'employee',
        entityId: id,
        before,
        after: { ...fields, ...leftDate, shiftIds, locationIds },
      });
      const touchesCong =
        shiftIds !== undefined ||
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
