/**
 * Tạo một công ty mới và Quản trị viên đầu tiên.
 * Dùng: npm run company:create -- --ma=QUANA --ten="Cà phê A" --admin-ten="Nguyễn Văn A" --admin-email=a@quan.vn
 *
 * CSDL ngoài máy này phải thêm CONFIRM_DB (script báo giá trị cần gõ). PIN tự sinh và chỉ in một lần,
 * không nhận qua tham số để không nằm lại trong lịch sử shell.
 */
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hashPin } from '../lib/auth/pin';
import * as schema from '../lib/db/schema';
import { assertConfirmedTarget, databaseLabel } from '../lib/db/target';
import { vietnamToday } from '../lib/domain/date';
import { generatePin } from '../lib/domain/pin';
import { migrationUrl, parseServerEnv } from '../lib/env';
import { companyCreateSchema } from '../lib/validation/company';

config({ path: ['.env.local', '.env'], quiet: true });

function readInput() {
  const { values } = parseArgs({
    options: {
      ma: { type: 'string' },
      ten: { type: 'string' },
      'admin-ten': { type: 'string' },
      'admin-email': { type: 'string' },
    },
  });
  const parsed = companyCreateSchema.safeParse({
    code: values.ma,
    name: values.ten,
    adminName: values['admin-ten'],
    adminEmail: values['admin-email'],
  });
  if (parsed.success) return parsed.data;
  throw new Error(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
}

async function main() {
  const input = readInput();
  const env = parseServerEnv(process.env);
  const url = migrationUrl(env);
  assertConfirmedTarget(url, process.env.CONFIRM_DB);

  const pin = generatePin();
  const pinHash = await hashPin(pin);
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await drizzle(client, { schema }).transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(eq(schema.companies.code, input.code));
      if (existing) throw new Error(`Mã công ty ${input.code} đã có người dùng.`);

      const [company] = await tx
        .insert(schema.companies)
        .values({ code: input.code, name: input.name })
        .returning();
      const [admin] = await tx
        .insert(schema.employees)
        .values({
          companyId: company!.id,
          email: input.adminEmail,
          name: input.adminName,
          pinHash,
          role: 'admin',
          onboardDate: vietnamToday(),
        })
        .returning({ id: schema.employees.id, email: schema.employees.email, name: schema.employees.name });
      await tx.insert(schema.auditLogs).values({
        companyId: company!.id,
        actorId: null,
        action: 'company.create',
        entity: 'company',
        entityId: company!.id,
        after: { code: company!.code, name: company!.name, admin },
      });
    });
  } finally {
    await client.end();
  }

  console.info(`Đã tạo "${input.name}" trên ${databaseLabel(url)}.`);
  console.info(`Mã công ty: ${input.code}`);
  console.info(`Quản trị viên: ${input.adminEmail}`);
  console.info(`PIN (chỉ hiện một lần): ${pin}`);
}

main().catch((error: unknown) => {
  console.error('Tạo công ty lỗi:', error instanceof Error ? error.message : error);
  process.exit(1);
});
