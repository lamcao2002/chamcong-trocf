import { describe, expect, it } from 'vitest';
import {
  activeTotals,
  attendanceIssues,
  crossedThreshold,
  evidenceLine,
  extraNote,
  issueLabel,
  overThreshold,
  penaltyValueLabel,
} from './penalties';

describe('activeTotals', () => {
  it('bỏ phiếu đã huỷ', () => {
    expect(
      activeTotals([
        { scars: 1, amount: 0, cancelledAt: null },
        { scars: 2, amount: 50_000, cancelledAt: null },
        { scars: 5, amount: 100_000, cancelledAt: '2026-11-20T10:00:00Z' },
      ]),
    ).toEqual({ scars: 3, amount: 50_000, count: 2 });
  });

  it('không có phiếu là 0', () => {
    expect(activeTotals([])).toEqual({ scars: 0, amount: 0, count: 0 });
  });
});

describe('crossedThreshold', () => {
  it.each([
    [2, 3, 3, true],
    [1, 4, 3, true],
    [3, 4, 3, false],
    [0, 2, 3, false],
    [0, 5, null, false],
  ])('trước %i, sau %i, ngưỡng %s → %s', (before, after, threshold, expected) => {
    expect(crossedThreshold(before, after, threshold)).toBe(expected);
  });

  it('overThreshold', () => {
    expect(overThreshold(3, 3)).toBe(true);
    expect(overThreshold(2, 3)).toBe(false);
    expect(overThreshold(9, null)).toBe(false);
  });
});

describe('penaltyValueLabel', () => {
  it.each([
    [{ scars: 2, amount: 50_000 }, '2 sẹo · 50.000đ'],
    [{ scars: 1, amount: 0 }, '1 sẹo'],
    [{ scars: 0, amount: 30_000 }, '30.000đ'],
  ])('%o → %s', (value, label) => {
    expect(penaltyValueLabel(value)).toBe(label);
  });
});

describe('attendanceIssues', () => {
  const day = {
    shiftId: 'ca',
    inAt: new Date('2026-11-20T10:14:00Z'),
    outAt: new Date('2026-11-20T15:00:00Z'),
    lateMin: 0,
    earlyMin: 0,
    waivedLate: false,
    waivedEarly: false,
    missing: 0,
  };

  it.each([
    ['đủ giờ', {}, []],
    ['muộn', { lateMin: 14 }, ['muon']],
    ['muộn đã miễn', { lateMin: 14, waivedLate: true }, []],
    ['về sớm', { earlyMin: 10 }, ['ve_som']],
    ['về sớm đã miễn', { earlyMin: 10, waivedEarly: true }, []],
    ['muộn và về sớm', { lateMin: 5, earlyMin: 10 }, ['muon', 've_som']],
    ['quên chấm vào', { inAt: null, missing: 1 }, ['quen_vao']],
    // Duyệt công đóng cờ thiếu nhưng giữ `missing`, lỗi vẫn còn
    ['quên chấm ra, đã duyệt công', { outAt: null, missing: 1 }, ['quen_ra']],
    ['đang làm dở', { outAt: null }, []],
    ['vắng hẳn', { inAt: null, outAt: null }, []],
    ['không gắn ca', { shiftId: null, lateMin: 14 }, []],
  ] as const)('%s', (_name, overrides, expected) => {
    expect(attendanceIssues({ ...day, ...overrides })).toEqual(expected);
  });

  it('nhãn lỗi', () => {
    expect(issueLabel('muon', { lateMin: 14, earlyMin: 0 })).toBe('Muộn 14 phút');
    expect(issueLabel('ve_som', { lateMin: 0, earlyMin: 10 })).toBe('Về sớm 10 phút');
    expect(issueLabel('quen_ra', { lateMin: 0, earlyMin: 0 })).toBe('Quên chấm ra');
  });
});

describe('evidenceLine', () => {
  it('ghi giờ theo Việt Nam, thiếu lần chấm thì gạch', () => {
    expect(
      evidenceLine({
        shiftCode: 'TOI',
        shiftHours: '17:00–22:00',
        inAt: '2026-11-20T10:14:00Z',
        outAt: null,
        issueLabel: 'Quên chấm ra',
      }),
    ).toBe('Ca TOI (17:00–22:00): Vào 17:14, Ra — · Quên chấm ra');
  });
});

describe('extraNote', () => {
  const evidence = {
    shiftCode: 'TOI',
    shiftHours: '17:00–22:00',
    inAt: null,
    outAt: null,
    issueLabel: 'Quên chấm vào',
  };
  it('trùng dòng chấm công thì không hiện lại', () => {
    expect(extraNote({ note: evidenceLine(evidence), evidence })).toBeNull();
    expect(extraNote({ note: 'Camera quầy có ghi lại', evidence })).toBe('Camera quầy có ghi lại');
    expect(extraNote({ note: 'Bỏ ca', evidence: null })).toBe('Bỏ ca');
  });
});
