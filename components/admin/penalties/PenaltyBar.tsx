import Link from 'next/link';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { periodTitle } from '@/components/admin/payroll/payroll-text';
import { formatDate } from '@/lib/format';
import type { PenaltyListView } from '@/lib/services/penalties';
import styles from './penalties.module.css';

/** Chọn kỳ trên dải header; sẹo đếm theo kỳ lương nên kỳ ở đây khớp kỳ của Lương. */
export function PenaltyBar({ list }: { list: PenaltyListView }) {
  const { period, previousKey, nextKey, currentKey } = list;
  const href = (key: string) => `/app/phat?period=${key}`;

  return (
    <nav className={styles.bar} aria-label="Chọn kỳ">
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
        <Link className={styles.barLink} href="/app/phat">
          Kỳ này
        </Link>
      )}
    </nav>
  );
}
