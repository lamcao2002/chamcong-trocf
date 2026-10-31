import { z } from 'zod';

/**
 * Biến môi trường phía server. Không import file này trong component client.
 *
 * - DATABASE_URL: chuỗi kết nối app dùng khi chạy. Với Supabase là Transaction pooler (cổng 6543).
 * - DATABASE_URL_DIRECT: kết nối trực tiếp (cổng 5432) cho migration; bỏ trống thì dùng DATABASE_URL.
 */
const postgresUrl = z
  .string()
  .trim()
  .refine((value) => /^postgres(ql)?:\/\//.test(value), {
    message: 'Phải là chuỗi kết nối PostgreSQL (postgres:// hoặc postgresql://)',
  });

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  DATABASE_URL: postgresUrl,
  DATABASE_URL_DIRECT: postgresUrl.optional(),
  APP_TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),
  /** Chuỗi bí mật ký phiên đăng nhập (S1-07), tối thiểu 32 ký tự. */
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET cần ít nhất 32 ký tự').optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Đọc và kiểm tra env; ném lỗi tiếng Việt liệt kê đủ các biến sai. */
export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  // Chuỗi rỗng coi như không đặt, để .env.example để trống không làm hỏng giá trị mặc định
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined && value !== ''));
  const result = serverEnvSchema.safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Biến môi trường không hợp lệ:\n${issues}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Env đã kiểm tra, đọc lười để `next build` không cần CSDL. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** Chuỗi kết nối dùng cho migration: ưu tiên kết nối trực tiếp. */
export function migrationUrl(env: ServerEnv): string {
  return env.DATABASE_URL_DIRECT ?? env.DATABASE_URL;
}
