import { describe, expect, it } from 'vitest';
import {
  BRAND_PRESETS,
  DEFAULT_BRAND,
  brandSoft,
  buildAntdTheme,
  darken,
  headerGradient,
  lighten,
  normalizeBrand,
  themeCssVars,
} from './tokens';

describe('normalizeBrand', () => {
  it('giữ màu hex hợp lệ, viết hoa', () => {
    expect(normalizeBrand('#7b5236')).toBe('#7B5236');
  });

  it('rơi về màu mặc định khi giá trị trống hoặc sai', () => {
    expect(normalizeBrand(undefined)).toBe(DEFAULT_BRAND);
    expect(normalizeBrand('')).toBe(DEFAULT_BRAND);
    expect(normalizeBrand('red')).toBe(DEFAULT_BRAND);
    expect(normalizeBrand('#abc')).toBe(DEFAULT_BRAND);
  });
});

describe('darken', () => {
  it('0 giữ nguyên, 1 thành đen', () => {
    expect(darken('#7B5236', 0)).toBe('#7B5236');
    expect(darken('#7B5236', 1)).toBe('#000000');
  });

  it('làm tối theo tỉ lệ từng kênh màu', () => {
    // 0x7B=123 → 96 (0x60), 0x52=82 → 64 (0x40), 0x36=54 → 42 (0x2A): khớp gradient bản tham khảo #60402A
    expect(darken('#7B5236', 0.22)).toBe('#60402A');
  });
});

describe('headerGradient', () => {
  it('dùng góc 120deg từ màu thương hiệu sang màu tối hơn', () => {
    expect(headerGradient('#7B5236')).toBe('linear-gradient(120deg, #7B5236 0%, #60402A 100%)');
  });
});

describe('buildAntdTheme', () => {
  it('đặt colorPrimary theo màu công ty', () => {
    expect(buildAntdTheme('#3b63c4').token?.colorPrimary).toBe('#3B63C4');
  });

  it('mặc định dùng màu sản phẩm', () => {
    expect(buildAntdTheme().token?.colorPrimary).toBe(DEFAULT_BRAND);
  });

  it('mọi màu có sẵn đều hợp lệ', () => {
    for (const preset of BRAND_PRESETS) {
      expect(normalizeBrand(preset)).toBe(preset);
    }
  });
});

describe('lighten', () => {
  it('giữ nguyên ở 0, ra trắng ở 1', () => {
    expect(lighten('#7B5236', 0)).toBe('#7B5236');
    expect(lighten('#7B5236', 1)).toBe('#FFFFFF');
  });
});

describe('brandSoft', () => {
  it('khớp --brand-soft đo được trên bản gốc', () => {
    expect(brandSoft('#7B5236')).toBe('#F2EEEB');
  });
});

describe('themeCssVars', () => {
  it('đổi màu theo công ty và rơi về mặc định khi màu sai', () => {
    expect(themeCssVars('#7b5236')['--brand']).toBe('#7B5236');
    expect(themeCssVars('red')['--brand']).toBe(DEFAULT_BRAND);
  });

  it('có đủ kích thước khung', () => {
    expect(themeCssVars()).toMatchObject({ '--sidebar-w': '205px', '--bottom-nav-h': '70px' });
  });
});
