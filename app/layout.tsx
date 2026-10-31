import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Be_Vietnam_Pro } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { Providers } from './providers';
import { DEFAULT_BRAND, tokens } from '@/lib/theme/tokens';
import './globals.css';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
});

export const metadata: Metadata = {
  title: {
    default: 'Chấm công',
    template: '%s · Chấm công',
  },
  description: 'Chấm công, xếp ca, tính lương cho cửa hàng và quán nhỏ.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: DEFAULT_BRAND,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body style={{ background: tokens.bgApp }}>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
