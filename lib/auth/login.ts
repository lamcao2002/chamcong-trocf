import 'server-only';
import { and, eq, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { writeAudit } from '@/lib/audit';
import { companies, employees, sessions } from '@/lib/db/schema';
import type { LoginInput } from '@/lib/validation/auth';
import { hashPin, verifyPin } from './pin';
import {
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

  // Vẫn băm khi không có tài khoản, để thời gian phản hồi không lộ email nào tồn tại
  dummyHash ??= hashPin('0000');
  const pinMatches = await verifyPin(found?.employee.pinHash ?? (await dummyHash), input.pin);
  if (!found || !pinMatches) return { ok: false, reason: 'invalid_credentials' };

  const { employee, company } = found;
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
