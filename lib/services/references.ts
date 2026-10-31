import 'server-only';
import { and, inArray } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { ApiError } from '@/lib/api/errors';
import type { Tx } from '@/lib/audit';
import { scopeToCompany, type AuthContext } from '@/lib/auth/policy';

type OwnedTable = PgTable & { id: PgColumn; companyId: PgColumn };

/**
 * Mọi ID nhận từ client phải thuộc công ty đang đăng nhập. Không kiểm tra thì khoá ngoại vẫn qua
 * được, và người dùng có thể gắn dữ liệu sang công ty khác.
 */
export async function assertOwned(
  tx: Tx,
  ctx: AuthContext,
  table: OwnedTable,
  ids: readonly (string | null | undefined)[],
  field: string,
) {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return;

  const found = await tx
    .select({ id: table.id })
    .from(table as PgTable)
    .where(and(inArray(table.id, wanted), scopeToCompany(ctx, table.companyId)));
  if (found.length !== wanted.length) {
    throw new ApiError(400, 'Dữ liệu tham chiếu không hợp lệ', { [field]: 'Giá trị không hợp lệ' });
  }
}
