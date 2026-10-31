import 'server-only';
import { cache } from 'react';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db/client';
import { companies, employees, sessions } from '@/lib/db/schema';
import type { AuthContext } from './policy';
import { SESSION_POLICY, canOpen, hashSessionToken, type SessionKind } from './session-policy';

/**
 * Phiên hiện tại theo cookie của `kind`, hoặc null. Đọc lại CSDL mỗi request nên nhân viên vừa
 * chuyển Đã nghỉ hay bị hạ quyền sẽ mất phiên ngay (US13). Không chọn `pin_hash`.
 */
export const getSession = cache(async (kind: SessionKind): Promise<AuthContext | null> => {
  const token = (await cookies()).get(SESSION_POLICY[kind].cookie)?.value;
  if (!token) return null;

  const [found] = await getDb()
    .select({
      employee: { id: employees.id, name: employees.name, email: employees.email, role: employees.role },
      company: {
        id: companies.id,
        code: companies.code,
        name: companies.name,
        appName: companies.appName,
        brandColor: companies.brandColor,
      },
    })
    .from(sessions)
    .innerJoin(employees, eq(employees.id, sessions.employeeId))
    .innerJoin(companies, eq(companies.id, sessions.companyId))
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        eq(sessions.kind, kind),
        gt(sessions.expiresAt, new Date()),
        eq(employees.status, 'active'),
      ),
    );

  if (!found || !canOpen(kind, found.employee.role)) return null;
  return { kind, ...found };
});
