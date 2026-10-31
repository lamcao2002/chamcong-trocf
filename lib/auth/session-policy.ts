import { createHash, randomBytes } from 'node:crypto';
import type { sessionKindEnum } from '@/lib/db/schema';
import type { Role } from './roles';

export type SessionKind = (typeof sessionKindEnum.enumValues)[number];

const DAY_SECONDS = 24 * 60 * 60;

/** US04: phiên quản trị 14 ngày, nhân viên 90 ngày. Hai cookie riêng vì một máy có thể mở cả /app và /m. */
export const SESSION_POLICY: Record<SessionKind, { cookie: string; maxAgeSeconds: number }> = {
  admin: { cookie: 'cc_admin_session', maxAgeSeconds: 14 * DAY_SECONDS },
  app: { cookie: 'cc_app_session', maxAgeSeconds: 90 * DAY_SECONDS },
};

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Giá trị lưu ở `sessions.token_hash`; token có 256 bit ngẫu nhiên nên SHA-256 là đủ, không cần argon2. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Trang quản trị cần quyền trên "app"; app nhân viên thì ai trong công ty cũng vào được. */
export function canOpen(kind: SessionKind, role: Role): boolean {
  return kind === 'app' || role !== 'app';
}

export function sessionCookieOptions(kind: SessionKind, secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_POLICY[kind].maxAgeSeconds,
  } as const;
}
