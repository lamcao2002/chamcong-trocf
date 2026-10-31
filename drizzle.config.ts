import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Thứ tự ưu tiên giống Next.js: .env.local ghi đè .env
config({ path: ['.env.local', '.env'], quiet: true });

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  throw new Error('Thiếu DATABASE_URL (hoặc DATABASE_URL_DIRECT). Xem .env.example.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
