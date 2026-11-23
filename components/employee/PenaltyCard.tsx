'use client';

import { useEffect, useState } from 'react';
import { Select, Tag } from 'antd';
import { apiRequest } from '@/lib/api/client';
import { evidenceLine, extraNote, penaltyValueLabel } from '@/lib/domain/penalties';
import { formatDate, formatMoney } from '@/lib/format';
import type { MyPenaltiesView } from '@/lib/services/penalties';
import styles from './EmployeeScreen.module.css';

const periodLabel = (key: string) => `Tháng ${key.slice(5, 7)}/${key.slice(0, 4)}`;

/** Tab Tôi: sẹo và tiền phạt của kỳ, các phiếu phạt kèm bằng chứng; phiếu đã huỷ gạch ngang. */
export function PenaltyCard({ reloadKey }: { reloadKey: number }) {
  const [view, setView] = useState<MyPenaltiesView | null>(null);
  const [period, setPeriod] = useState<string | null>(null);

  useEffect(() => {
    const query = period ? `?period=${period}` : '';
    void apiRequest<{ penalties: MyPenaltiesView }>(`/api/v1/app/penalties${query}`, 'GET').then((result) => {
      if (result.ok) setView(result.penalties);
    });
  }, [period, reloadKey]);

  if (!view) return null;
  const { scars, amount, scarThreshold, overThreshold, penalties } = view;

  return (
    <section className={`${styles.card} ${styles.followCard}`} aria-label="Phạt">
      <div className={styles.requestRow}>
        <strong>Phạt</strong>
        {view.periods.length > 1 ? (
          <Select
            size="small"
            aria-label="Chọn kỳ"
            value={view.period.key}
            options={view.periods.map(({ key }) => ({ value: key, label: periodLabel(key) }))}
            onChange={setPeriod}
            style={{ minWidth: 130 }}
          />
        ) : (
          <span className={styles.timelineSub}>{periodLabel(view.period.key)}</span>
        )}
      </div>
      <div className={styles.penStats}>
        <div className={`${styles.penStat} ${overThreshold ? styles.penOver : ''}`}>
          <strong>
            {scars}
            {scarThreshold ? <span>/{scarThreshold}</span> : null}
          </strong>
          <span>sẹo</span>
        </div>
        <div className={styles.penStat}>
          <strong>{formatMoney(amount)}</strong>
          <span>tiền phạt</span>
        </div>
      </div>
      {overThreshold ? (
        <p className={styles.penWarn}>Bạn đã đủ ngưỡng {scarThreshold} sẹo của kỳ này.</p>
      ) : null}
      {penalties.length === 0 ? (
        <p className={styles.muted}>Chưa bị phạt kỳ này.</p>
      ) : (
        <ul className={styles.requestList}>
          {penalties.map((row) => (
            <li key={row.id} className={row.cancelledAt ? styles.penCancelled : undefined}>
              <div className={styles.requestRow}>
                <span>
                  <span className={styles.penStrike}>{row.ruleName}</span> ·{' '}
                  {formatDate(row.date).slice(0, 5)}
                </span>
                {row.cancelledAt ? (
                  <Tag>Đã huỷ</Tag>
                ) : (
                  <span className={styles.penValue}>{penaltyValueLabel(row)}</span>
                )}
              </div>
              {row.evidence ? (
                <p className={styles.timelineSub}>Chấm công: {evidenceLine(row.evidence)}</p>
              ) : null}
              <p className={styles.timelineSub}>
                {[extraNote(row), row.byName ?? 'Quản lý'].filter(Boolean).join(' · ')}
              </p>
              {row.cancelledAt ? <p className={styles.timelineSub}>Lý do huỷ: {row.cancelReason}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
