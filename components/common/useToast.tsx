'use client';

import { useMemo } from 'react';
import { App, theme } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';

const SUCCESS_SECONDS = 2.5;
const ERROR_SECONDS = 5;

/** Thông báo ngắn giữa trên màn hình: `toast.success('Đã lưu.')`, `toast.error('Lưu không được.')`. */
export function useToast() {
  const { message } = App.useApp();
  const { colorPrimary } = theme.useToken().token;

  return useMemo(
    () => ({
      success: (text: string) => {
        void message.open({
          type: 'success',
          content: <strong>{text}</strong>,
          icon: <CheckCircleFilled style={{ color: colorPrimary }} />,
          duration: SUCCESS_SECONDS,
        });
      },
      error: (text: string) => {
        void message.open({ type: 'error', content: <strong>{text}</strong>, duration: ERROR_SECONDS });
      },
    }),
    [message, colorPrimary],
  );
}
