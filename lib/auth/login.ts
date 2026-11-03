import 'server-only';
import { and, eq, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { writeAudit } from '@/lib/audit';
import { companies, employees, sessions } from '@/lib/db/schema';
import type { LoginInput } from '@/lib/validation/auth';
import { hashPin, verifyPin } from './pin';
import {
  LOGIN_POLICY,
  SESSION_POLICY,
  canOpen,
  generateSessionToken,
  hashSessionToken,
  type SessionKind,
} from './session-policy';

export type LoginResult =
  | {
      ok: true;
      token: string;
      user: { id: string; name: string; email: string; role: string };
      company: { code: string; name: string };
    }
  | { ok: false; reason: 'invalid_credentials' | 'no_admin_access' };

let dummyHash: Promise<string> | undefined;

const NO_EMPLOYEE = '00000000-0000-0000-0000-000000000000';

/**
 * Giữ chỗ một lần thử trước khi so PIN; trả false nếu tài khoản đang khoá hoặc không có. Tăng bộ đếm
 * trong một câu UPDATE vì đọc rồi mới tăng thì gửi song song sẽ thử được nhiều PIN hơn giới hạn.
 * Lần thử trong lúc khoá không được tính, nên thời hạn khoá không bị kéo dài thêm.
 */
async function reserveAttempt(employee: { id: string; companyId: string } | undefined) {
  const attempts = sql`${employees.failedPinAttempts} + 1`;
  const reachedLimit = sql`${attempts} >= ${LOGIN_POLICY.maxAttempts}`;
  return getDb().transaction(async (tx) => {
    const [reserved] = await tx
      .update(employees)
      .set({
        failedPinAttempts: sql`case when ${reachedLimit} then 0 else ${attempts} end`,
        lockedUntil: sql`case when ${reachedLimit} then now() + make_interval(mins => ${LOGIN_POLICY.lockMinutes}) end`,
      })
      .where(
        and(
          // Vẫn chạy câu này khi không có tài khoản, để thời gian phản hồi giống nhau
          eq(employees.id, employee?.id ?? NO_EMPLOYEE),
          or(isNull(employees.lockedUntil), lte(employees.lockedUntil, sql`now()`)),
        ),
      )
      .returning({ lockedUntil: employees.lockedUntil });

    if (employee && reserved?.lockedUntil) {
      await writeAudit(
        tx,
        { companyId: employee.companyId, actorId: employee.id },
        { action: 'auth.lock', entity: 'employee', entityId: employee.id, after: reserved },
      );
    }
    return Boolean(reserved);
  });
}

/** Kiểm tra PIN + tạo phiên. Nhân viên Đã nghỉ bị coi như không tồn tại (US03). */
export async function login(kind: SessionKind, input: LoginInput): Promise<LoginResult> {
  const db = getDb();
  const [found] = await db
    .select({ employee: employees, company: companies })
    .from(employees)
    .innerJoin(companies, eq(companies.id, employees.companyId))
    .where(
      and(
        eq(companies.code, input.companyCode),
        eq(employees.email, input.email),
        eq(employees.status, 'active'),
      ),
    );

  const open = await reserveAttempt(found?.employee);

  // Vẫn băm khi không có tài khoản hoặc đang khoá, để phản hồi không lộ email tồn tại hay PIN đúng
  dummyHash ??= hashPin('0000');
  const pinHash = found && open ? found.employee.pinHash : await dummyHash;
  const pinMatches = await verifyPin(pinHash, input.pin);
  if (!found || !open || !pinMatches) return { ok: false, reason: 'invalid_credentials' };

  const { employee, company } = found;
  await db
    .update(employees)
    .set({ failedPinAttempts: 0, lockedUntil: null })
    .where(eq(employees.id, employee.id));
  if (!canOpen(kind, employee.role)) return { ok: false, reason: 'no_admin_access' };

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_POLICY[kind].maxAgeSeconds * 1000);
  await db.transaction(async (tx) => {
    await tx
      .delete(sessions)
      .where(and(eq(sessions.employeeId, employee.id), lt(sessions.expiresAt, new Date())));
    const [session] = await tx
      .insert(sessions)
      .values({
        companyId: company.id,
        employeeId: employee.id,
        tokenHash: hashSessionToken(token),
        kind,
        expiresAt,
      })
      .returning({ id: sessions.id });
    await writeAudit(
      tx,
      { companyId: company.id, actorId: employee.id },
      { action: 'auth.login', entity: 'session', entityId: session!.id, after: { kind } },
    );
  });

  return {
    ok: true,
    token,
    user: { id: employee.id, name: employee.name, email: employee.email, role: employee.role },
    company: { code: company.code, name: company.name },
  };
}

/** Xoá phiên theo token; token không còn hiệu lực thì không làm gì. */
export async function logout(token: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [session] = await tx
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(token)))
      .returning();
    if (!session) return;
    await writeAudit(
      tx,
      { companyId: session.companyId, actorId: session.employeeId },
      { action: 'auth.logout', entity: 'session', entityId: session.id, before: { kind: session.kind } },
    );
  });
}
