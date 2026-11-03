import { createHash, randomBytes } from 'node:crypto';

export const DEVICE_COOKIE = 'cc_device';

/** Trình duyệt chặn cookie sống quá 400 ngày; mỗi lần chấm đặt lại nên thời hạn tự kéo dài. */
const DEVICE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export function generateDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Giá trị lưu ở `employees.device_hash`; lộ CSDL cũng không giả được cookie của máy. */
export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** httpOnly để script không đọc hay chép được; không xoá khi đăng xuất vì nó thuộc về máy, không thuộc phiên. */
export function deviceCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: DEVICE_MAX_AGE_SECONDS,
  } as const;
}
