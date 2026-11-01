/**
 * Nạp dữ liệu mẫu "Cà phê Phố Nhỏ" vào CSDL của DATABASE_URL_DIRECT (hoặc DATABASE_URL).
 * Dùng: npm run db:seed   (chạy lại không đổi gì; từ chối production, CSDL ngoài máy phải có CONFIRM_DB)
 *
 * PIN: lấy từ SEED_PIN; riêng APP_ENV=local mặc định 1234.
 */
import { config } from 'dotenv';
import { eq, ne } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hashPin } from '../auth/pin';
import { migrationUrl, parseServerEnv } from '../env';
import * as schema from './schema';
import {
  SEED_COMPANY,
  SEED_EMPLOYEES,
  SEED_HOLIDAYS,
  SEED_LOCATIONS,
  SEED_POSITION_LOCATIONS,
  SEED_POSITIONS,
  SEED_SHIFTS,
} from './seed-data';
import { assertSeedTarget, isLocalDatabase } from './target';

config({ path: ['.env.local', '.env'], quiet: true });

const LOCAL_PIN = '1234';

function resolvePin(appEnv: string): string {
  const pin = process.env.SEED_PIN || (appEnv === 'local' ? LOCAL_PIN : undefined);
  if (!pin) throw new Error(`APP_ENV=${appEnv} cần đặt SEED_PIN.`);
  if (!/^\d{4,8}$/.test(pin)) throw new Error('SEED_PIN phải gồm 4–8 chữ số.');
  return pin;
}

async function main() {
  const env = parseServerEnv(process.env);
  const url = migrationUrl(env);
  assertSeedTarget(env.APP_ENV, url, process.env.CONFIRM_DB);
  const pinHash = await hashPin(resolvePin(env.APP_ENV));

  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const db = drizzle(client, { schema });
    const seeded = await db.transaction(async (tx) => {
      // Có công ty khác trên CSDL ngoài máy nghĩa là đang chứa dữ liệu thật, dù khai báo là staging
      if (!isLocalDatabase(url)) {
        const [other] = await tx
          .select({ code: schema.companies.code })
          .from(schema.companies)
          .where(ne(schema.companies.code, SEED_COMPANY.code))
          .limit(1);
        if (other) throw new Error(`CSDL này đã có công ty ${other.code}, không nạp dữ liệu mẫu.`);
      }

      const [existing] = await tx
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(eq(schema.companies.code, SEED_COMPANY.code));
      if (existing) return false;

      const [company] = await tx.insert(schema.companies).values(SEED_COMPANY).returning();
      const companyId = company!.id;

      const locationRows = await tx
        .insert(schema.locations)
        .values(Object.values(SEED_LOCATIONS).map((location) => ({ ...location, companyId })))
        .returning();
      const locationIdByKey = Object.fromEntries(
        Object.entries(SEED_LOCATIONS).map(([key, { name }]) => [
          key,
          locationRows.find((row) => row.name === name)!.id,
        ]),
      );

      const shiftRows = await tx
        .insert(schema.shifts)
        .values(SEED_SHIFTS.map((shift) => ({ ...shift, companyId })))
        .returning();
      const shiftIdByCode = new Map(shiftRows.map((row) => [row.code, row.id]));

      const positionRows = await tx
        .insert(schema.positions)
        .values(
          SEED_POSITIONS.map(({ shifts, ...position }) => ({
            ...position,
            companyId,
            fixedShiftId: position.shiftMode === 'fixed' ? shiftIdByCode.get(shifts[0]!) : null,
          })),
        )
        .returning();
      const positionIdByName = new Map(positionRows.map((row) => [row.name, row.id]));

      await tx.insert(schema.positionShifts).values(
        SEED_POSITIONS.flatMap(({ name, shifts }) =>
          shifts.map((code) => ({
            positionId: positionIdByName.get(name)!,
            shiftId: shiftIdByCode.get(code)!,
          })),
        ),
      );
      await tx.insert(schema.positionLocations).values(
        positionRows.flatMap((position) =>
          SEED_POSITION_LOCATIONS.map((key) => ({
            positionId: position.id,
            locationId: locationIdByKey[key]!,
          })),
        ),
      );

      const employeeRows = await tx
        .insert(schema.employees)
        .values(
          SEED_EMPLOYEES.map(({ position, manager: _manager, locations: _locations, ...employee }) => ({
            ...employee,
            companyId,
            pinHash,
            positionId: positionIdByName.get(position)!,
          })),
        )
        .returning();
      const employeeIdByEmail = new Map(employeeRows.map((row) => [row.email, row.id]));

      for (const { email, manager } of SEED_EMPLOYEES) {
        if (!manager) continue;
        await tx
          .update(schema.employees)
          .set({ managerId: employeeIdByEmail.get(manager)! })
          .where(eq(schema.employees.id, employeeIdByEmail.get(email)!));
      }

      await tx.insert(schema.employeeLocations).values(
        SEED_EMPLOYEES.flatMap(({ email, locations = [] }) =>
          locations.map((key) => ({
            employeeId: employeeIdByEmail.get(email)!,
            locationId: locationIdByKey[key]!,
          })),
        ),
      );

      await tx.insert(schema.holidays).values(SEED_HOLIDAYS.map((holiday) => ({ ...holiday, companyId })));
      return true;
    });

    console.info(
      seeded
        ? `Đã tạo "${SEED_COMPANY.name}" (mã ${SEED_COMPANY.code}, ${SEED_EMPLOYEES.length} nhân viên).`
        : `Công ty ${SEED_COMPANY.code} đã có — bỏ qua.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Seed lỗi:', error instanceof Error ? error.message : error);
  process.exit(1);
});
