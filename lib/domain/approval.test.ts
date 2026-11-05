import { describe, expect, it } from 'vitest';
import type { Suggestion } from '@/lib/engine/types';
import { absenceDecision, decisionOf, groupDecisions } from './approval';

const suggestion = (kind: Suggestion['kind'], extra: Partial<Suggestion> = {}): Suggestion => ({
  kind,
  label: 'Duyệt',
  why: '',
  ...extra,
});
const item = (kind: Suggestion['kind'], over: object = {}, extra: Partial<Suggestion> = {}) => ({
  employeeId: 'a',
  date: '2026-11-02',
  shiftId: 's1',
  suggestion: suggestion(kind, extra),
  otProposed: 90,
  ...over,
});

describe('decisionOf', () => {
  it('OT gửi tổng của ngày, không phải phần còn chờ', () => {
    expect(decisionOf(suggestion('approve_ot', { otMinutes: 30 }), 90)).toEqual({ otMinutes: 90 });
  });
});

describe('groupDecisions', () => {
  it('nhiều việc cùng ca gộp một quyết định', () => {
    const [group, ...rest] = groupDecisions([item('approve_gps'), item('approve_ot')]);
    expect(rest).toHaveLength(0);
    expect(group).toMatchObject({ count: 2, decision: { approveGps: true, otMinutes: 90 } });
  });

  it('khác người, khác ngày hoặc khác ca là bản ghi riêng; ca trống không lẫn với ca có', () => {
    const groups = groupDecisions([
      item('approve_gps'),
      item('approve_gps', { employeeId: 'b' }),
      item('approve_gps', { date: '2026-11-03' }),
      item('approve_gps', { shiftId: 's2' }),
      item('approve_gps', { shiftId: null }),
    ]);
    expect(groups).toHaveLength(5);
  });

  it.each(['confirm_shift', 'approve_shift'] as const)(
    '%s cùng ca thì không duyệt OT cùng lúc, vì OT sẽ tính lại theo ca mới',
    (kind) => {
      const [group] = groupDecisions([item(kind, {}, { shiftId: 's9' }), item('approve_ot')]);
      expect(group).toMatchObject({ count: 1, decision: { confirmShiftId: 's9' } });
      expect(group!.decision).not.toHaveProperty('otMinutes');
    },
  );
});

describe('absenceDecision', () => {
  it('xác nhận vắng là 0 công, cho đủ công là 1 công như ca đi làm đủ', () => {
    expect(absenceDecision('confirm')).toEqual({ congOverride: 0 });
    expect(absenceDecision('full')).toEqual({ congOverride: 1 });
  });

  it('việc Vắng đã chọn cách xử lý đi vào quyết định của nhóm', () => {
    const [group] = groupDecisions([
      {
        employeeId: 'a',
        date: '2026-11-02',
        shiftId: 's1',
        suggestion: null,
        otProposed: 0,
        decision: { congOverride: 0 },
      },
    ]);
    expect(group).toMatchObject({ count: 1, decision: { congOverride: 0 } });
  });
});
