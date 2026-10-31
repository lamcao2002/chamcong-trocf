'use client';

import { useRef, type ReactNode } from 'react';
import { Button, Drawer, Flex, Grid } from 'antd';
import { tokens } from '@/lib/theme/tokens';
import { useConfirmDiscard } from './useConfirmDiscard';
import { useLeaveGuard } from './useLeaveGuard';

type FormDrawerProps = {
  open: boolean;
  title: ReactNode;
  /** Có thay đổi chưa lưu: mọi cách đóng và rời trang đều hỏi xác nhận. */
  dirty?: boolean;
  saving?: boolean;
  submitLabel?: string;
  /** Nút phụ bên trái chân drawer, vd "Xoá vị trí". */
  footerExtra?: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
};

/** Drawer chứa form: desktop trượt từ phải, dưới 992px trượt lên toàn màn hình; chân drawer cố định. */
export function FormDrawer({
  open,
  title,
  dirty = false,
  saving = false,
  submitLabel = 'Lưu',
  footerExtra,
  onClose,
  onSubmit,
  children,
}: FormDrawerProps) {
  const desktop = Grid.useBreakpoint().lg ?? false;
  const confirmDiscard = useConfirmDiscard();
  const asking = useRef(false);
  useLeaveGuard(open && dirty);

  const requestClose = async () => {
    if (saving || asking.current) return;
    if (dirty) {
      asking.current = true;
      const confirmed = await confirmDiscard();
      asking.current = false;
      if (!confirmed) return;
    }
    onClose();
  };

  return (
    <Drawer
      open={open}
      title={title}
      placement={desktop ? 'right' : 'bottom'}
      width={desktop ? tokens.formDrawerWidth : '100%'}
      height="100%"
      destroyOnHidden
      onClose={() => void requestClose()}
      footer={
        <Flex justify="space-between" align="center" gap={8}>
          <span>{footerExtra}</span>
          <Flex gap={8}>
            <Button disabled={saving} onClick={() => void requestClose()}>
              Huỷ
            </Button>
            <Button type="primary" loading={saving} onClick={onSubmit}>
              {submitLabel}
            </Button>
          </Flex>
        </Flex>
      }
      styles={{ footer: { paddingBottom: 'max(12px, env(safe-area-inset-bottom))' } }}
    >
      {children}
    </Drawer>
  );
}
