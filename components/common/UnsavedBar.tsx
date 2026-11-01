'use client';

import type { ReactNode } from 'react';
import { Button } from 'antd';
import { useConfirmDiscard } from './useConfirmDiscard';
import { useLeaveGuard } from './useLeaveGuard';
import styles from './UnsavedBar.module.css';

type UnsavedBarProps = {
  /** Số thay đổi; bằng 0 thì thanh ẩn và hết chặn rời trang. */
  count: number;
  /** Phần chữ sau số, vd "ô chưa lưu" ở Xếp ca. */
  label?: string;
  saveLabel?: string;
  /** Icon thay chữ Huỷ, vd ↶ ở Xếp ca. */
  discardIcon?: ReactNode;
  saving?: boolean;
  /** `dark`: Cài đặt; `light` viền vàng: Xếp ca. */
  tone?: 'dark' | 'light';
  onSave: () => void;
  onDiscard: () => void;
};

/** Thanh nổi "N thay đổi chưa lưu · Huỷ · Lưu"; có thanh là trang đã được chặn rời trang. */
export function UnsavedBar({
  count,
  label = 'thay đổi chưa lưu',
  saveLabel = 'Lưu',
  discardIcon,
  saving = false,
  tone = 'dark',
  onSave,
  onDiscard,
}: UnsavedBarProps) {
  const confirmDiscard = useConfirmDiscard();
  useLeaveGuard(count > 0);

  if (count <= 0) return null;

  const discard = async () => {
    if (await confirmDiscard({ count })) onDiscard();
  };

  return (
    <>
      <div className={styles.spacer} aria-hidden />
      <div role="status" className={`${styles.bar} ${styles[tone]}`}>
        <span className={styles.text}>
          {count} {label}
        </span>
        <span className={styles.actions}>
          <Button
            type="text"
            className={styles.discard}
            disabled={saving}
            icon={discardIcon}
            aria-label="Huỷ thay đổi"
            onClick={() => void discard()}
          >
            {discardIcon ? null : 'Huỷ'}
          </Button>
          <Button type="primary" loading={saving} onClick={onSave}>
            {saveLabel}
          </Button>
        </span>
      </div>
    </>
  );
}
