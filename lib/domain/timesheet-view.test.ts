import { describe, expect, it } from 'vitest';
import { pickWeek, rangeDays, resolveRange, timesheetSearch, weekCellText, weeksIn } from './timesheet-view';

const TODAY = '2026-11-02';

describe('resolveRange', () => {
  it('mặc định theo ngày chốt của công ty, trùng kỳ lương', () => {
    const range = resolveRange({}, 25, TODAY);
    expect(range).toMatchObject({ mode: 'payroll', isPayrollRange: true, suggestedStart: 26 });
    expect(range.period).toEqual({ key: '2026-11', from: '2026-10-26', to: '2026-11-25' });
  });

  it('Kỳ lệch chỉ đổi khoảng xem, ngày bắt đầu khác kỳ lương thì báo không trùng', () => {
    const range = resolveRange({ start: 16 }, null, TODAY);
    expect(range).toMatchObject({ mode: 'shifted', isPayrollRange: false, start: 16 });
    expect(range.period).toMatchObject({ from: '2026-10-16', to: '2026-11-15' });
  });

  it('Kỳ lệch trùng ngày bắt đầu của công ty vẫn là kỳ lương', () => {
    expect(resolveRange({ start: 26 }, 25, TODAY).isPayrollRange).toBe(true);
    expect(resolveRange({ start: 1 }, null, TODAY).isPayrollRange).toBe(true);
  });

  it('bắt đầu ngày 1 là tròn tháng, tháng ngắn không làm hỏng kỳ', () => {
    expect(resolveRange({ start: 1 }, 25, TODAY).period).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(resolveRange({ start: 31, period: '2026-03' }, null, TODAY).period).toMatchObject({
      from: '2026-03-01',
      to: '2026-03-30',
    });
  });

  it('Tự chọn không có kỳ trước, kỳ sau và không bao giờ là kỳ lương', () => {
    expect(resolveRange({ from: '2026-10-05', to: '2026-10-09' }, null, TODAY)).toMatchObject({
      mode: 'custom',
      previousKey: null,
      nextKey: null,
      isPayrollRange: false,
    });
  });

  it('kỳ chưa tới thì không có link sang kỳ sau', () => {
    expect(resolveRange({}, null, TODAY).nextKey).toBeNull();
    expect(resolveRange({ period: '2026-10' }, null, TODAY).nextKey).toBe('2026-11');
  });

  it('gợi ý ngày 26 khi công ty tính tròn tháng', () => {
    expect(resolveRange({}, null, TODAY).suggestedStart).toBe(26);
  });
});

describe('weeksIn', () => {
  it('tuần từ thứ Hai, hai đầu cắt theo kỳ, đủ mọi ngày', () => {
    const weeks = weeksIn('2026-10-01', '2026-10-31');
    expect(weeks[0]).toEqual({ from: '2026-10-01', to: '2026-10-04' });
    expect(weeks[1]).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(weeks.at(-1)).toEqual({ from: '2026-10-26', to: '2026-10-31' });
    expect(weeks.reduce((sum, { from, to }) => sum + rangeDays(from, to), 0)).toBe(31);
  });

  it('kỳ bắt đầu đúng Chủ nhật thì tuần đầu một ngày', () => {
    expect(weeksIn('2026-11-01', '2026-11-30')[0]).toEqual({ from: '2026-11-01', to: '2026-11-01' });
  });
});

describe('pickWeek', () => {
  const weeks = weeksIn('2026-10-01', '2026-11-30');

  it('ưu tiên tuần được yêu cầu, rồi tuần chứa hôm nay, rồi tuần đầu', () => {
    expect(pickWeek(weeks, '2026-10-05', TODAY).from).toBe('2026-10-05');
    expect(pickWeek(weeks, undefined, TODAY).from).toBe('2026-11-02');
    expect(pickWeek(weeks, 'khong-co', '2027-01-01').from).toBe('2026-10-01');
  });
});

describe('weekCellText', () => {
  const row = {
    status: 'du' as const,
    inAt: new Date('2026-11-02T06:59:00Z'),
    outAt: new Date('2026-11-02T15:04:00Z'),
    cong: 1,
    lateMin: 0,
    earlyMin: 0,
    otProposed: 0,
  };

  it('bình thường hiện giờ theo Việt Nam', () => {
    expect(weekCellText(row)).toBe('13:59–22:04');
  });

  it('có vấn đề thì trạng thái chữ thay cho giờ', () => {
    expect(weekCellText({ ...row, status: 'muon', lateMin: 7 })).toBe('muộn 7p · 1c');
    expect(weekCellText({ ...row, status: 'muon', earlyMin: 12 })).toBe('sớm 12p · 1c');
    expect(weekCellText({ ...row, status: 'ot_cho', otProposed: 92 })).toBe('sau ca 92p');
    expect(weekCellText({ ...row, status: 'thieu_gio' })).toBe('thiếu giờ vào/ra');
    expect(weekCellText({ ...row, status: 'dang_lam', outAt: null })).toBe('13:59 · đang làm');
  });
});

describe('timesheetSearch', () => {
  it('bỏ tham số trống, không tham số thì chuỗi rỗng', () => {
    expect(timesheetSearch({})).toBe('');
    expect(timesheetSearch({ period: '2026-11', start: 26, view: undefined })).toBe(
      '?period=2026-11&start=26',
    );
  });
});
