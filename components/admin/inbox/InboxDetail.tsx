import type { ReactNode } from 'react';
import { formatClock, formatDate } from '@/lib/format';
import type { InboxItem } from '@/lib/services/inbox';
import styles from './inbox.module.css';

const time = (at: Date | null) => (at ? new Date(at).getTime() : null);

/** Khung sọc là giờ ca, thanh đặc là thời gian có mặt; trục co giãn theo mốc xa nhất. */
function TimeBar({ item }: { item: InboxItem }) {
  const start = time(item.shiftStartAt);
  const end = time(item.shiftEndAt);
  const inAt = time(item.inAt);
  const outAt = time(item.outAt);
  if (start === null || end === null) return null;

  const from = Math.min(start, inAt ?? start, outAt ?? start);
  const to = Math.max(end, inAt ?? end, outAt ?? end);
  const left = (value: number) => `${((value - from) / (to - from)) * 100}%`;
  const width = (a: number, b: number) => `${((b - a) / (to - from)) * 100}%`;

  return (
    <div>
      <div className={styles.bar} role="img" aria-label="Giờ ca và thời gian có mặt">
        <span className={styles.barShift} style={{ left: left(start), width: width(start, end) }} />
        {inAt !== null && outAt !== null ? (
          <span className={styles.barPresent} style={{ left: left(inAt), width: width(inAt, outAt) }} />
        ) : null}
        {inAt !== null && outAt === null ? (
          <span className={styles.barMark} style={{ left: left(inAt) }} />
        ) : null}
        {outAt !== null && inAt === null ? (
          <span className={styles.barMark} style={{ left: left(outAt) }} />
        ) : null}
      </div>
      <div className={styles.barLegend}>
        <span>
          Ca {formatClock(item.shiftStartAt!)}–{formatClock(item.shiftEndAt!)}
        </span>
        <span>
          Vào {item.inAt ? formatClock(item.inAt) : '—'} · Ra {item.outAt ? formatClock(item.outAt) : '—'}
        </span>
      </div>
    </div>
  );
}

/** Chi tiết một việc: thanh giờ, bằng chứng, lý do hệ thống đề xuất (US25). */
export function InboxDetail({ item, actions }: { item: InboxItem; actions: ReactNode }) {
  const dates =
    item.date === item.toDate
      ? formatDate(item.date)
      : `${formatDate(item.date)} – ${formatDate(item.toDate)}`;

  return (
    <div className={styles.detail}>
      <div>
        <h2 className={styles.detailName}>{item.employeeName}</h2>
        <p className={styles.muted}>
          {[item.positionName, dates, item.shiftName].filter(Boolean).join(' · ')}
        </p>
      </div>
      <span className={styles.kind}>{item.kindLabel}</span>
      <p className={styles.description}>{item.description}</p>
      <TimeBar item={item} />
      {item.suggestion ? (
        <div className={styles.why}>
          <strong>Vì sao hệ thống đề xuất</strong>
          <p>{item.suggestion.why}</p>
          <span className={styles.proposal}>Đề xuất: {item.suggestion.label}</span>
        </div>
      ) : null}
      {item.evidence.length > 0 ? (
        <ul className={styles.evidence}>
          {item.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {actions}
    </div>
  );
}
