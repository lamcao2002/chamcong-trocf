'use client';

import Link from 'next/link';
import { Button } from 'antd';
import { LeftOutlined, PrinterOutlined, RightOutlined } from '@ant-design/icons';
import { ExportButton } from '@/components/common/ExportButton';
import { formatDate } from '@/lib/format';
import type { PayrollView } from '@/lib/services/payroll';
import { periodTitle } from './payroll-text';
import styles from './payroll.module.css';

/** Hàng chọn kỳ trên dải header: kỳ trước/sau, Kỳ này, in cả kỳ và xuất Excel (US34). */
export function PayrollBar({ payroll }: { payroll: PayrollView }) {
  const { period, previousKey, nextKey, currentKey } = payroll;
  const href = (key: string) => `/app/luong?period=${key}`;

  return (
    <div className={styles.bar}>
      <nav className={styles.barNav} aria-label="Chọn kỳ">
        <Link className={styles.barLink} href={href(previousKey)} aria-label="Kỳ trước">
          <LeftOutlined />
        </Link>
        <span className={styles.barPeriod}>
          <strong>{periodTitle(period.key)}</strong>
          <span>
            {formatDate(period.from).slice(0, 5)} – {formatDate(period.to)}
          </span>
        </span>
        {nextKey ? (
          <Link className={styles.barLink} href={href(nextKey)} aria-label="Kỳ sau">
            <RightOutlined />
          </Link>
        ) : (
          <span className={`${styles.barLink} ${styles.barLinkOff}`} aria-hidden>
            <RightOutlined />
          </span>
        )}
        {period.key === currentKey ? null : (
          <Link className={styles.barLink} href="/app/luong">
            Kỳ này
          </Link>
        )}
      </nav>
      <div className={styles.barActions}>
        <Button
          className={styles.barButton}
          icon={<PrinterOutlined />}
          href={`/app/in-phieu?period=${period.key}`}
          target="_blank"
          rel="noopener"
        >
          In phiếu
        </Button>
        <ExportButton className={styles.barButton} url={`/api/v1/payroll/export?period=${period.key}`} />
      </div>
    </div>
  );
}
