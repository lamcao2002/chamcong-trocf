/**
 * Nhận diện CSDL mà script sắp ghi vào. `APP_ENV` chỉ là khai báo, có thể lệch với chuỗi kết nối
 * (`.env.local` để `local` mà URL trỏ production), nên quyết định theo chính chuỗi kết nối.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLocalDatabase(url: string): boolean {
  return LOCAL_HOSTS.has(new URL(url).hostname);
}

/** Tên CSDL không kèm mật khẩu. Giữ cả user vì pooler Supabase dùng chung host giữa các project. */
export function databaseLabel(url: string): string {
  const { username, hostname, pathname } = new URL(url);
  return `${decodeURIComponent(username)}@${hostname}${pathname}`;
}

/** CSDL ngoài máy này chỉ ghi khi người chạy gõ lại đúng tên của nó trong `CONFIRM_DB`. */
export function assertConfirmedTarget(url: string, confirmed: string | undefined) {
  if (isLocalDatabase(url)) return;
  const label = databaseLabel(url);
  if (confirmed !== label) {
    throw new Error(
      `CSDL đích là ${label}. Kiểm tra đúng nơi cần ghi rồi chạy lại với CONFIRM_DB="${label}".`,
    );
  }
}

/** Seed tạo tài khoản dùng PIN chung, nên không bao giờ được chạm dữ liệu thật. */
export function assertSeedTarget(appEnv: string, url: string, confirmed: string | undefined) {
  if (appEnv === 'production') throw new Error('Không seed dữ liệu mẫu lên production.');
  if (appEnv === 'local' && !isLocalDatabase(url)) {
    throw new Error('APP_ENV=local chỉ seed CSDL ở máy này. Seed staging thì đặt APP_ENV=staging.');
  }
  assertConfirmedTarget(url, confirmed);
}
