'use client';

import { useState } from 'react';
import { Button, Empty, Select, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { penaltyValueLabel } from '@/lib/domain/penalties';
import { formatDate, formatMoney } from '@/lib/format';
import type { PenaltyListView, PenaltyRuleView } from '@/lib/services/penalties';
import { attachKey, IssueList } from './AttendanceIssues';
import { PenaltyDrawer, usePenaltyForm } from './PenaltyForm';
import styles from './penalties.module.css';

type IssueRow = PenaltyListView['issues'][number];

type PenaltiesTabProps = {
  list: PenaltyListView;
  rules: PenaltyRuleView[];
  onOpenRules: () => void;
};

/** Tổng sẹo, tiền theo người trong kỳ, các phiếu phạt, form phạt và huỷ phạt. */
export function PenaltiesTab({ list, rules, onOpenRules }: PenaltiesTabProps) {
  const { people, penalties, staff, scarThreshold, issues, dismissed } = list;
  const [person, setPerson] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const penaltyForm = usePenaltyForm({ rules, staff, onOpenRules });
  const shown = person ? penalties.filter((row) => row.employeeId === person) : penalties;
  const shownIssues = person ? issues.filter((row) => row.employeeId === person) : issues;
  const shownDismissed = person ? dismissed.filter((row) => row.employeeId === person) : dismissed;
  const open = penalties.find(({ id }) => id === openId) ?? null;

  const startPenalty = (employeeId?: string, issue?: IssueRow) =>
    penaltyForm.start(
      issue ? { employeeId: issue.employeeId, date: issue.date, attach: attachKey(issue) } : { employeeId },
    );

  return (
    <>
      <div className={styles.filters}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => startPenalty(person ?? undefined)}>
          Phạt nhân viên
        </Button>
        <Select
          aria-label="Lọc theo nhân viên"
          allowClear
          placeholder="Tất cả nhân viên"
          value={person}
          options={people.map(({ employeeId, name }) => ({ value: employeeId, label: name }))}
          onChange={(value: string | undefined) => setPerson(value ?? null)}
          style={{ flex: '1 1 180px', maxWidth: 260 }}
        />
      </div>
      <p className={styles.muted}>
        Sẹo đếm theo kỳ lương
        {scarThreshold ? `, đủ ${scarThreshold} sẹo thì cảnh báo` : ''}. Tiền phạt chỉ ghi nhận, không tự trừ
        lương: muốn trừ thì thêm ở Lương → Thưởng/phạt.
      </p>

      {people.length > 0 ? (
        <ul className={styles.people} aria-label="Tổng theo người">
          {people.map((row) => (
            <li key={row.employeeId}>
              <button
                type="button"
                className={`${styles.person} ${person === row.employeeId ? styles.personOn : ''}`}
                aria-pressed={person === row.employeeId}
                onClick={() => setPerson(person === row.employeeId ? null : row.employeeId)}
              >
                <span className={styles.rowMain}>
                  <strong>{row.name}</strong>
                  <span className={styles.muted}>
                    {row.count > 0 ? `${row.count} lần phạt` : 'Đã huỷ hết'}
                  </span>
                </span>
                <span className={styles.rowSide}>
                  <span className={row.overThreshold ? styles.scarsOver : styles.value}>
                    {row.scars}
                    {scarThreshold ? `/${scarThreshold}` : ''} sẹo
                  </span>
                  {row.amount > 0 ? <span className={styles.muted}>{formatMoney(row.amount)}</span> : null}
                  {row.overThreshold ? <Tag color="error">Đủ ngưỡng</Tag> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <IssueList
        issues={shownIssues}
        dismissed={shownDismissed}
        onPenalize={(row) => startPenalty(undefined, row)}
      />

      <h3 className={styles.groupTitle}>Phiếu phạt</h3>
      {shown.length === 0 ? (
        <Empty description="Kỳ này chưa có phiếu phạt" />
      ) : (
        <ul className={styles.list}>
          {shown.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`${styles.row} ${row.cancelledAt ? styles.cancelled : ''}`}
                aria-label={`Phiếu phạt ${row.employeeName} ${row.ruleName}`}
                onClick={() => setOpenId(row.id)}
              >
                <span className={styles.rowMain}>
                  <strong className={styles.strike}>
                    {row.employeeName} · {row.ruleName}
                  </strong>
                  <span className={styles.muted}>
                    {formatDate(row.date)} · {row.note}
                  </span>
                </span>
                <span className={styles.rowSide}>
                  <span className={`${styles.value} ${styles.strike}`}>{penaltyValueLabel(row)}</span>
                  {row.cancelledAt ? <Tag>Đã huỷ</Tag> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {penaltyForm.element}

      <PenaltyDrawer penalty={open} onClose={() => setOpenId(null)} />
    </>
  );
}
