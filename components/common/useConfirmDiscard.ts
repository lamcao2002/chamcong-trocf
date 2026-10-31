'use client';

import { useCallback } from 'react';
import { App } from 'antd';

/** Hỏi trước khi bỏ thay đổi; trả về true nếu người dùng đồng ý bỏ. */
export function useConfirmDiscard() {
  const { modal } = App.useApp();

  return useCallback(
    (options?: { count?: number; title?: string; okText?: string }) =>
      new Promise<boolean>((resolve) => {
        const { count, title, okText } = options ?? {};
        modal.confirm({
          title: title ?? (count ? `Bỏ ${count} thay đổi chưa lưu?` : 'Bỏ thay đổi chưa lưu?'),
          content: title
            ? 'Thao tác này không hoàn tác được.'
            : 'Những gì bạn vừa sửa sẽ mất và không khôi phục được.',
          okText: okText ?? 'Bỏ thay đổi',
          okButtonProps: { danger: true },
          cancelText: 'Giữ lại',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      }),
    [modal],
  );
}
