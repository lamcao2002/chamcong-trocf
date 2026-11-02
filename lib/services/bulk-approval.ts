import 'server-only';
import { ApiError } from '@/lib/api/errors';
import { isUniqueViolation } from '@/lib/api/server';
import type { AuthContext } from '@/lib/auth/policy';
import { getDb } from '@/lib/db/client';
import { groupDecisions } from '@/lib/domain/approval';
import type { BulkApprovalInput } from '@/lib/validation/approval';
import { ALREADY_DECIDED, assertCanDecide, writeApproval } from './approvals';
import { inboxBetween } from './inbox';
import { lockEmployees, recomputeDays } from './recompute';

/**
 * Duyệt nhiều việc theo đề xuất (INB-08, TS-08). Đề xuất lấy lại từ server, client chỉ nêu việc nào và
 * nhãn đã thấy: nhãn lệch nghĩa là số liệu đổi sau khi quản lý xem, việc đó được bỏ qua và báo lại.
 */
export async function approveSuggested(ctx: AuthContext, input: BulkApprovalInput) {
  const { items } = await inboxBetween(ctx, input.from, input.to);
  const current = new Map(items.map((item) => [item.key, item]));
  const picked = input.items.flatMap(({ key, label }) => {
    const item = current.get(key);
    return item?.suggestion?.label === label ? [item] : [];
  });
  const groups = groupDecisions(picked);
  const approved = groups.reduce((sum, { count }) => sum + count, 0);
  const result = { approved, skipped: input.items.length - approved };
  if (groups.length === 0) return result;

  const companyId = ctx.company.id;
  const employeeIds = [...new Set(groups.map(({ employeeId }) => employeeId))];
  try {
    await getDb().transaction(async (tx) => {
      // Khoá trước cả nhóm: tính lại từng ngày ở dưới sẽ khoá lần lượt, dễ chờ vòng tròn với lô khác
      await lockEmployees(tx, employeeIds);
      for (const employeeId of employeeIds) await assertCanDecide(tx, ctx, employeeId);
      for (const { employeeId, date, shiftId, decision } of groups) {
        await writeApproval(tx, ctx, { employeeId, date, shiftId }, decision);
      }

      // Chỉ tính lại đúng ngày được duyệt: khoảng từ đầu tới cuối sẽ đụng cả ngày thuộc kỳ đã công bố
      for (const date of new Set(groups.map((group) => group.date))) {
        const ids = groups.filter((group) => group.date === date).map(({ employeeId }) => employeeId);
        await recomputeDays(tx, { companyId, employeeIds: ids, from: date, to: date });
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError(409, ALREADY_DECIDED);
    throw error;
  }
  return result;
}
