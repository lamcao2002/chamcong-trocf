import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND, tokens } from '@/lib/theme/tokens';

const PUBLIC_DIR = join(process.cwd(), 'public');
const manifest = JSON.parse(readFileSync(join(PUBLIC_DIR, 'm/manifest.webmanifest'), 'utf8')) as {
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; purpose: string }[];
};

/** Rộng và cao của file PNG, đọc từ khối IHDR. */
function pngSize(path: string): string {
  const file = readFileSync(path);
  return `${file.readUInt32BE(16)}x${file.readUInt32BE(20)}`;
}

describe('PWA manifest', () => {
  it('mở thẳng app nhân viên, không có thanh trình duyệt', () => {
    expect(manifest.start_url).toBe('/m');
    expect(manifest.scope).toBe('/m');
    expect(manifest.display).toBe('standalone');
  });

  it('màu khớp design tokens', () => {
    expect(manifest.theme_color).toBe(DEFAULT_BRAND);
    expect(manifest.background_color).toBe(tokens.bgApp);
  });

  it('biểu tượng có thật và đúng kích thước khai báo', () => {
    for (const icon of manifest.icons) expect(pngSize(join(PUBLIC_DIR, icon.src))).toBe(icon.sizes);
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });
});
