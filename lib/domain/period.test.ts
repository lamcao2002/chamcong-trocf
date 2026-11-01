import { describe, expect, it } from 'vitest';
import { nextPeriod, periodByKey, periodOf, previousPeriod } from './period';

describe('periodOf', () => {
  it('để trống ngày chốt là tròn tháng', () => {
    expect(periodOf('2026-10-15', null)).toEqual({ key: '2026-10', from: '2026-10-01', to: '2026-10-31' });
    expect(periodOf('2028-02-29', null).to).toBe('2028-02-29');
  });

  it('ngày 25 là kỳ 26 tháng trước đến 25 tháng này', () => {
    const october = { key: '2026-10', from: '2026-09-26', to: '2026-10-25' };
    expect(periodOf('2026-10-25', 25)).toEqual(october);
    expect(periodOf('2026-09-26', 25)).toEqual(october);
    expect(periodOf('2026-10-26', 25).key).toBe('2026-11');
  });

  it('kỳ vắt qua năm', () => {
    expect(periodOf('2026-12-30', 25)).toEqual({ key: '2027-01', from: '2026-12-26', to: '2027-01-25' });
  });

  it('tháng ngắn chốt vào ngày cuối tháng, không có ngày nào bị bỏ sót', () => {
    expect(periodOf('2026-02-28', 31)).toEqual({ key: '2026-02', from: '2026-02-01', to: '2026-02-28' });
    expect(periodOf('2026-03-01', 30)).toEqual({ key: '2026-03', from: '2026-03-01', to: '2026-03-30' });
    expect(periodOf('2026-03-31', 30).key).toBe('2026-04');
  });

  it('các kỳ nối liền nhau suốt nhiều năm', () => {
    for (const cutoff of [null, 1, 15, 28, 29, 30, 31]) {
      let period = periodOf('2026-01-15', cutoff);
      for (let index = 0; index < 60; index += 1) {
        const next = nextPeriod(period, cutoff);
        expect(previousPeriod(next, cutoff)).toEqual(period);
        expect(periodByKey(next.key, cutoff)).toEqual(next);
        expect(next.from > period.to).toBe(true);
        period = next;
      }
    }
  });
});
