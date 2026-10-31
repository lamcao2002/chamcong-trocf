/**
 * Chạy migration trong thư mục ./drizzle lên CSDL của DATABASE_URL_DIRECT (hoặc DATABASE_URL).
 * Dùng: npm run db:migrate   (CI chạy lệnh này trên một PostgreSQL trống)
 */
import { existsSync } from 'node:fs';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { migrationUrl, parseServerEnv } from '../lib/env';

config({ path: ['.env.local', '.env'], quiet: true });

const MIGRATIONS_FOLDER = './drizzle';

async function main() {
  const env = parseServerEnv(process.env);

  if (!existsSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`)) {
    console.info('Chưa có migration nào trong ./drizzle — bỏ qua (S1-04 sẽ tạo migration đầu tiên).');
    return;
  }

  const client = postgres(migrationUrl(env), { max: 1, prepare: false, onnotice: () => {} });
  try {
    const started = Date.now();
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    console.info(`Migration xong sau ${Date.now() - started} ms (${env.APP_ENV}).`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration lỗi:', error instanceof Error ? error.message : error);
  process.exit(1);
});
