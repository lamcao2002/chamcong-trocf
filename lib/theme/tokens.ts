import type { ThemeConfig } from 'antd';

/**
 * Design tokens rút từ docs/website-analysis/05-ui-ux-specifications.md.
 * Màu `brand` đổi theo từng công ty (Cài đặt → Màu chủ đạo); các màu ngữ nghĩa giữ cố định.
 */
export const DEFAULT_BRAND = '#2F9A4C';

/** 9 màu chủ đạo cho người dùng chọn ở trang Cài đặt. */
export const BRAND_PRESETS = [
  '#2F9A4C',
  '#1E8E5A',
  '#0E7C86',
  '#3B63C4',
  '#214098',
  '#6A37B5',
  '#BE185D',
  '#B4532A',
  '#334155',
] as const;

export const tokens = {
  bgApp: '#EEF3F0',
  surface: '#FFFFFF',
  text: '#17201B',
  textMuted: '#65706A',
  border: '#DFE6E1',
  stripeA: '#E3EBE6',
  stripeB: '#F2F6F3',
  danger: { bg: '#FDEAEA', fg: '#B42323' },
  warn: { bg: '#FFF3D9', fg: '#8A5200' },
  ot: { bg: '#F1EAFB', fg: '#6A37B5' },
  info: { bg: '#EAF0FD', fg: '#3B63C4' },
  radius: { card: 18, lg: 14, md: 10, sm: 8, pill: 999 },
  shadowCard: '0 1px 2px rgba(23,40,30,.05), 0 6px 20px rgba(23,40,30,.06)',
  sidebarWidth: 205,
  sidebarCollapsedWidth: 65,
  bottomNavHeight: 70,
  /** [Đề xuất] Bản gốc không đo được bề rộng drawer desktop. */
  formDrawerWidth: 520,
  pageGutter: { desktop: 27, mobile: 18 },
  /** Dưới mốc này: thanh điều hướng dưới thay cho menu trái (khớp breakpoint `lg` của Ant Design). */
  desktopBreakpoint: 992,
} as const;

const HEX = /^#([0-9a-f]{6})$/i;

/** Trả về màu hợp lệ dạng #RRGGBB, rơi về màu mặc định khi giá trị không hợp lệ. */
export function normalizeBrand(color: string | null | undefined): string {
  if (!color) return DEFAULT_BRAND;
  const value = color.trim();
  return HEX.test(value) ? value.toUpperCase() : DEFAULT_BRAND;
}

/** Làm tối một màu hex theo tỉ lệ 0–1 (dùng cho điểm cuối gradient header). */
export function darken(color: string, amount: number): string {
  const hex = normalizeBrand(color).slice(1);
  const ratio = Math.min(Math.max(amount, 0), 1);
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16);
    return Math.round(value * (1 - ratio))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`.toUpperCase();
}

/** Làm nhạt một màu hex về phía trắng theo tỉ lệ 0–1. */
export function lighten(color: string, amount: number): string {
  const hex = normalizeBrand(color).slice(1);
  const ratio = Math.min(Math.max(amount, 0), 1);
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16);
    return Math.round(value + (255 - value) * ratio)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`.toUpperCase();
}

/** Nền nhạt của mục đang chọn (`--brand-soft`, #7B5236 → #F2EEEB). */
export function brandSoft(brand: string): string {
  return lighten(brand, 0.9);
}

/** Gradient dải header (120deg, brand → brand tối hơn ~22%). */
export function headerGradient(brand: string): string {
  const base = normalizeBrand(brand);
  return `linear-gradient(120deg, ${base} 0%, ${darken(base, 0.22)} 100%)`;
}

/** Token dưới dạng biến CSS, gắn ở phần tử gốc để CSS module dùng lại thay vì hardcode. */
export function themeCssVars(brand: string = DEFAULT_BRAND): Record<`--${string}`, string> {
  const base = normalizeBrand(brand);
  return {
    '--brand': base,
    '--brand-soft': brandSoft(base),
    '--header-gradient': headerGradient(base),
    '--bg-app': tokens.bgApp,
    '--surface': tokens.surface,
    '--text': tokens.text,
    '--text-muted': tokens.textMuted,
    '--border': tokens.border,
    '--warn-bg': tokens.warn.bg,
    '--warn-fg': tokens.warn.fg,
    '--radius-card': `${tokens.radius.card}px`,
    '--radius-md': `${tokens.radius.md}px`,
    '--radius-pill': `${tokens.radius.pill}px`,
    '--shadow-card': tokens.shadowCard,
    '--sidebar-w': `${tokens.sidebarWidth}px`,
    '--sidebar-w-collapsed': `${tokens.sidebarCollapsedWidth}px`,
    '--bottom-nav-h': `${tokens.bottomNavHeight}px`,
    '--gutter-desktop': `${tokens.pageGutter.desktop}px`,
    '--gutter-mobile': `${tokens.pageGutter.mobile}px`,
  };
}

/** Cấu hình theme Ant Design cho một màu thương hiệu. */
export function buildAntdTheme(brand: string = DEFAULT_BRAND): ThemeConfig {
  const colorPrimary = normalizeBrand(brand);
  return {
    token: {
      colorPrimary,
      colorLink: colorPrimary,
      colorText: tokens.text,
      colorTextSecondary: tokens.textMuted,
      colorBorder: tokens.border,
      colorBgLayout: tokens.bgApp,
      colorError: tokens.danger.fg,
      colorWarning: tokens.warn.fg,
      colorInfo: tokens.info.fg,
      fontFamily: 'var(--font-be-vietnam-pro), system-ui, sans-serif',
      fontSize: 14,
      borderRadius: tokens.radius.md,
      borderRadiusLG: tokens.radius.lg,
      borderRadiusSM: tokens.radius.sm,
      controlHeight: 40,
    },
    components: {
      Button: { borderRadius: tokens.radius.pill, fontWeight: 600 },
      Card: { borderRadiusLG: tokens.radius.card },
      Tag: { borderRadiusSM: tokens.radius.pill },
      Drawer: { paddingLG: 20 },
      Message: { borderRadiusLG: tokens.radius.pill, contentPadding: '10px 18px' },
      Menu: {
        itemBg: 'transparent',
        itemSelectedBg: brandSoft(colorPrimary),
        itemSelectedColor: colorPrimary,
        itemBorderRadius: tokens.radius.md,
        itemMarginInline: 0,
        // Bề rộng bên trong sidebar thu gọn: trừ padding 12px hai bên và viền 1px
        collapsedWidth: tokens.sidebarCollapsedWidth - 25,
        groupTitleColor: tokens.textMuted,
        groupTitleFontSize: 12,
      },
    },
  };
}
