import { describe, expect, it } from 'vitest';
import { normalizePositions, positionOfShift, positionShort, sameScheduleCell } from './shift-positions';

const PC = 'pha-che';
const PV = 'phuc-vu';

describe('vị trí của ca', () => {
  it('ca chưa ghi vị trí là vị trí chính', () => {
    expect(positionOfShift({}, 'S', PC)).toBe(PC);
    expect(positionOfShift({ S: PV }, 'S', PC)).toBe(PV);
    expect(positionOfShift(null, 'S', null)).toBeNull();
  });

  it('ghi rõ mọi ca, bỏ ca không còn trong ô', () => {
    expect(normalizePositions(['S', 'C'], { C: PV, T: PV }, PC)).toEqual({ S: PC, C: PV });
    expect(normalizePositions(['S'], {}, null)).toEqual({});
  });

  it('so ô theo cả vị trí, không theo thứ tự ca', () => {
    const base = { shiftIds: ['S', 'C'], isOff: false, positions: {} };
    expect(sameScheduleCell(base, { shiftIds: ['C', 'S'], isOff: false, positions: { S: PC } }, PC)).toBe(
      true,
    );
    expect(sameScheduleCell(base, { shiftIds: ['S', 'C'], isOff: false, positions: { C: PV } }, PC)).toBe(
      false,
    );
    expect(sameScheduleCell(base, { shiftIds: [], isOff: true }, PC)).toBe(false);
  });

  it('viết tắt tên vị trí', () => {
    expect(positionShort('Phục vụ')).toBe('PV');
    expect(positionShort('Pha chế')).toBe('PC');
    expect(positionShort('Bếp')).toBe('BẾ');
  });
});
