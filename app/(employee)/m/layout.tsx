import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Chấm công', template: '%s · Chấm công' },
  manifest: '/m/manifest.webmanifest',
  // Khai `icons` ở đây sẽ thay biểu tượng gốc nên phải có cả `icon`
  icons: { icon: '/m/icon-192.png', apple: '/m/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Chấm công', statusBarStyle: 'default' },
};

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  return children;
}
