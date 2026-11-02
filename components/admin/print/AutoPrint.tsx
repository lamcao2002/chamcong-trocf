'use client';

import { useEffect } from 'react';
import { Button } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import styles from './print.module.css';

/** Mở hộp in ngay khi trang sẵn sàng; nút để in lại, không xuất hiện trên giấy. */
export function AutoPrint() {
  useEffect(() => {
    window.print();
  }, []);

  return (
    <div className={styles.toolbar}>
      <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
        In hoặc lưu PDF
      </Button>
    </div>
  );
}
