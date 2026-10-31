'use client';

import type { ReactNode } from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { buildAntdTheme } from '@/lib/theme/tokens';

dayjs.locale('vi');

type ProvidersProps = {
  children: ReactNode;
  /** Màu chủ đạo của công ty; Sprint 1 dùng mặc định, lấy từ CSDL sau khi có đăng nhập (S1-16). */
  brand?: string;
};

export function Providers({ children, brand }: ProvidersProps) {
  return (
    <ConfigProvider locale={viVN} theme={buildAntdTheme(brand)}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}
