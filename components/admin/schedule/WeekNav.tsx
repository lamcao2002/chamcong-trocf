import Link from 'next/link';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { addDays } from '@/lib/engine/time';
import { formatDate } from '@/lib/format';
import styles from './schedule.module.css';

const WEEK_DAYS = 7;

type WeekNavProps = { week: string; currentWeek: string };

/** Link thường nên khi còn ô chưa lưu, `useLeaveGuard` tự hỏi xác nhận. */
export function WeekNav({ week, currentWeek }: WeekNavProps) {
  const href = (monday: string) => `/app/xep-ca?week=${monday}`;
  const lastDay = addDays(week, WEEK_DAYS - 1);

  return (
    <nav className={styles.weekNav} aria-label="Chọn tuần">
      <Link className={styles.weekLink} href={href(addDays(week, -WEEK_DAYS))} aria-label="Tuần trước">
        <LeftOutlined />
      </Link>
      <span className={styles.weekLabel}>
        {formatDate(week).slice(0, 5)} – {formatDate(lastDay)}
      </span>
      <Link className={styles.weekLink} href={href(addDays(week, WEEK_DAYS))} aria-label="Tuần sau">
        <RightOutlined />
      </Link>
      {week === currentWeek ? null : (
        <Link className={styles.weekLink} href={href(currentWeek)}>
          Tuần này
        </Link>
      )}
    </nav>
  );
}
