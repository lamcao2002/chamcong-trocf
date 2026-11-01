import { describe, expect, it } from 'vitest';
import { daySymbol } from './symbols';

const day = (status: Parameters<typeof daySymbol>[0][number]['status'], otApproved = 0) => ({
  status,
  otApproved,
});

describe('daySymbol', () => {
  it('14 trạng thái ra đúng ký hiệu', () => {
    const expected = [
      ['vang', 'V'],
      ['thieu_gio', '!'],
      ['ngoai_vung', 'G'],
      ['sai_ca', 'C'],
      ['ngoai_lich', 'C'],
      ['ot_cho', '+'],
      ['muon', 'M'],
      ['nua_cong', '½'],
      ['du', ''],
      ['nghi_phep', 'P'],
      ['le', 'L'],
      ['chua_toi', ''],
      ['dang_lam', ''],
      ['nghi', ''],
    ] as const;
    for (const [status, label] of expected) expect(daySymbol([day(status)]).label).toBe(label);
  });

  it('đủ công có OT đã duyệt khác đủ công thường', () => {
    expect(daySymbol([day('du', 30)]).key).toBe('ot_duyet');
    expect(daySymbol([day('du')]).key).toBe('du');
  });

  it('ngày nhiều ca lấy ca cần xử lý nhất', () => {
    expect(daySymbol([day('du'), day('thieu_gio')]).key).toBe('thieu');
    expect(daySymbol([day('muon'), day('vang')]).key).toBe('vang');
  });

  it('không có dòng nào là ô trống', () => {
    expect(daySymbol([]).key).toBe('trong');
  });
});
