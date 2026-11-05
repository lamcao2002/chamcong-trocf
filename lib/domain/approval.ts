import type { Suggestion } from '@/lib/engine/types';

export const MAX_BULK_APPROVALS = 500;

/** Hệ số tiền của một ca đặt khi duyệt công; cột `numeric(4,2)` chứa được tới 99,99. */
export const MAX_PAY_FACTOR = 10;

/** Nhãn việc Vắng trong duyệt loạt: Vắng không có đề xuất, người duyệt chọn cách xử lý khi bấm. */
export const ABSENCE_LABEL = 'Vắng';
export const ABSENCE_CHOICES = ['confirm', 'full'] as const;
export type AbsenceChoice = (typeof ABSENCE_CHOICES)[number];

/**
 * Xác nhận vắng là 0 công nhưng hết cần duyệt; cho đủ công là 1 công như ca đi làm đủ, kể cả ca ghép
 * (T24). Không dùng công kỳ vọng: 0,5 của ca ghép chỉ dành cho phép và lễ.
 */
export function absenceDecision(choice: AbsenceChoice): Record<string, unknown> {
  return { congOverride: choice === 'confirm' ? 0 : 1 };
}

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
/** `decision` dùng cho việc không có đề xuất (Vắng) mà người duyệt đã chọn cách xử lý. */
type Picked = Target & {
  suggestion: Suggestion | null;
  otProposed: number;
  decision?: Record<string, unknown>;
};

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
        ...kept.map(({ suggestion, otProposed, decision }) =>
          suggestion ? decisionOf(suggestion, otProposed) : (decision ?? {}),
        ),
      ) as Record<string, unknown>,
      count: kept.length,
    };
  });
}
