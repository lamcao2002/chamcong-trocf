import type { Suggestion } from '@/lib/engine/types';

export const MAX_BULK_APPROVALS = 500;

/** Đề xuất của engine thành trường trong bản ghi duyệt; OT gửi con số tổng của ngày. */
export function decisionOf(suggestion: Suggestion, otProposed: number): Record<string, unknown> {
  switch (suggestion.kind) {
    case 'approve_ot':
      return { otMinutes: otProposed };
    case 'approve_gps':
      return { approveGps: true };
    case 'approve_cong':
      return { approveMissing: true };
    case 'confirm_shift':
    case 'approve_shift':
      return { confirmShiftId: suggestion.shiftId };
  }
}

type Target = { employeeId: string; date: string; shiftId: string | null };
type Picked = Target & { suggestion: Suggestion | null; otProposed: number };

export type ApprovalGroup = Target & { decision: Record<string, unknown>; count: number };

const MOVES_SHIFT = new Set<Suggestion['kind']>(['confirm_shift', 'approve_shift']);

/**
 * Gộp các việc cùng nhân viên × ngày × ca thành một quyết định, vì mỗi ca chỉ có một bản ghi duyệt.
 * Xác nhận ca làm OT được tính lại theo ca mới, nên số OT đang thấy không còn đúng: bỏ OT lại cho
 * quản lý xem sau khi tính lại, thay vì duyệt một con số cũ.
 */
export function groupDecisions(items: readonly Picked[]): ApprovalGroup[] {
  const groups = new Map<string, Picked[]>();
  for (const item of items) {
    const key = `${item.employeeId}|${item.date}|${item.shiftId ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.values()].map((group) => {
    const movesShift = group.some(({ suggestion }) => suggestion && MOVES_SHIFT.has(suggestion.kind));
    const kept = group.filter(({ suggestion }) => !(movesShift && suggestion?.kind === 'approve_ot'));
    const { employeeId, date, shiftId } = group[0]!;
    return {
      employeeId,
      date,
      shiftId,
      decision: Object.assign(
        {},
        ...kept.map(({ suggestion, otProposed }) => (suggestion ? decisionOf(suggestion, otProposed) : {})),
      ) as Record<string, unknown>,
      count: kept.length,
    };
  });
}
