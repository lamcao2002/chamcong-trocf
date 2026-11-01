import 'server-only';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { getServerEnv } from '@/lib/env';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

// Giữ một kết nối duy nhất khi Next.js nạp lại module ở chế độ dev
const globalForDb = globalThis as unknown as { __db?: Db; __sql?: postgres.Sql };

function createClient() {
  const env = getServerEnv();
  const client = postgres(env.DATABASE_URL, {
    // Supabase Transaction pooler không hỗ trợ prepared statement
    prepare: false,
    max: env.APP_ENV === 'local' ? 5 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { TimeZone: env.APP_TIMEZONE },
  });
  return { client, db: drizzle(client, { schema }) };
}

export function getDb(): Db {
  if (!globalForDb.__db) {
    const { client, db } = createClient();
    globalForDb.__sql = client;
    globalForDb.__db = db;
  }
  return globalForDb.__db;
}

/** Kiểm tra CSDL còn trả lời; dùng cho /api/v1/health. */
export async function pingDb(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const started = Date.now();
  try {
    await getDb().execute(sql`select 1`);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Lỗi không rõ' };
  }
}
