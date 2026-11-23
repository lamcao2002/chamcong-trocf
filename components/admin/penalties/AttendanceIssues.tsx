'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Radio, Spin, Switch } from 'antd';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import type { PenaltyEvidence, PenaltyIssue } from '@/lib/domain/penalties';
import { formatClock, formatDate } from '@/lib/format';
import type { AttendanceDayView, PenaltyListView } from '@/lib/services/penalties';
import { themeCssVars } from '@/lib/theme/tokens';
import styles from './penalties.module.css';

type IssueRow = PenaltyListView['issues'][number];
type DayShift = AttendanceDayView[number];

/** Giá trị ô "Gắn với lỗi": `shiftId|issue`, rỗng là không gắn. */
export const attachKey = ({ shiftId, issue }: { shiftId: string; issue: PenaltyIssue }) =>
  `${shiftId}|${issue}`;

export function parseAttach(value: string | undefined) {
  const [shiftId, issue] = (value ?? '').split('|');
  return shiftId && issue ? { shiftId, issue: issue as PenaltyIssue } : { shiftId: null, issue: null };
}

export function evidenceOf(
  row: Pick<DayShift, 'shiftCode' | 'shiftHours' | 'inAt' | 'outAt'>,
  issueLabel: string,
): PenaltyEvidence {
  return {
    shiftCode: row.shiftCode,
    shiftHours: row.shiftHours,
    inAt: row.inAt,
    outAt: row.outAt,
    issueLabel,
  };
}

/** Lỗi đang chọn còn phạt được thì trả bằng chứng của nó. */
function pickedEvidence(shifts: AttendanceDayView, value: string) {
  const { shiftId, issue } = parseAttach(value);
  const row = shifts.find((shift) => shift.shiftId === shiftId);
  const found = row?.issues.find((item) => item.issue === issue && !item.penalized);
  return row && found ? evidenceOf(row, found.label) : null;
}

const punches = ({ inAt, outAt }: { inAt: string | null; outAt: string | null }) =>
  `Vào ${inAt ? formatClock(inAt) : '—'} · Ra ${outAt ? formatClock(outAt) : '—'}`;

type DayAttendanceProps = {
  employeeId?: string;
  date?: string;
  /** Do `Form.Item` truyền vào. */
  value?: string;
  onChange?: (value: string) => void;
  /** Báo ca và nhãn lỗi vừa chọn, để điền sẵn ghi chú. */
  onPick?: (evidence: PenaltyEvidence | null) => void;
};

/** Chấm công của người và ngày đang chọn trong form phạt; FormDrawer không có biến màu nên tự đặt. */
export function DayAttendance(props: DayAttendanceProps) {
  return (
    <div style={themeCssVars()}>
      <DayAttendanceBody {...props} />
    </div>
  );
}

/** Chọn một lỗi của ngày để gắn vào phiếu. */
function DayAttendanceBody({ employeeId, date, value = '', onChange, onPick }: DayAttendanceProps) {
  const [shifts, setShifts] = useState<AttendanceDayView | null>(null);
  const [error, setError] = useState<string>();
  // Form mở sẵn một lỗi (từ gợi ý, từ Bảng công): tải xong thì điền ghi chú, lỗi đã phạt thì bỏ chọn
  const preset = useRef({ value, onChange, onPick });
  preset.current = { value, onChange, onPick };

  useEffect(() => {
    setShifts(null);
    setError(undefined);
    if (!employeeId || !date) return;
    let live = true;
    void apiRequest<{ shifts: AttendanceDayView }>(
      `/api/v1/penalties/attendance?employeeId=${employeeId}&date=${date}`,
      'GET',
    ).then((result) => {
      if (!live) return;
      if (!result.ok) return setError(result.error);
      setShifts(result.shifts);
      const { value: chosen, onChange: change, onPick: picked } = preset.current;
      if (!chosen) return;
      const evidence = pickedEvidence(result.shifts, chosen);
      if (!evidence) change?.('');
      picked?.(evidence);
    });
    return () => {
      live = false;
    };
  }, [employeeId, date]);

  if (!employeeId || !date) return <p className={styles.muted}>Chọn nhân viên và ngày để xem chấm công.</p>;
  if (error) return <p className={styles.error}>{error}</p>;
  if (!shifts) return <Spin size="small" />;
  if (shifts.length === 0) return <p className={styles.muted}>Ngày này không có ca nào đã chấm công.</p>;

  const pick = (next: string) => {
    onChange?.(next);
    onPick?.(pickedEvidence(shifts, next));
  };

  return (
    <Radio.Group
      value={value}
      onChange={(event) => pick(event.target.value as string)}
      className={styles.attach}
    >
      <Radio value="">Không gắn với chấm công</Radio>
      {shifts.map((shift) => (
        <div key={shift.shiftId} className={styles.attachShift}>
          <span>
            <strong>
              Ca {shift.shiftCode} {shift.shiftHours}
            </strong>{' '}
            <span className={styles.muted}>{punches(shift)}</span>
          </span>
          {shift.issues.length === 0 ? <span className={styles.muted}>Không có lỗi</span> : null}
          {shift.issues.map((item) => (
            <Radio
              key={item.issue}
              value={attachKey({ ...shift, issue: item.issue })}
              disabled={item.penalized}
            >
              {item.label}
              {item.penalized ? ' (đã phạt)' : ''}
            </Radio>
          ))}
        </div>
      ))}
    </Radio.Group>
  );
}

type IssueListProps = {
  issues: IssueRow[];
  dismissed: PenaltyListView['dismissed'];
  onPenalize: (row: IssueRow) => void;
};

/** Lỗi chấm công trong kỳ chưa có phiếu: Phạt mở form đã điền sẵn, Bỏ qua ẩn khỏi gợi ý. */
export function IssueList({ issues, dismissed, onPenalize }: IssueListProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const keyOf = (row: IssueRow) => `${row.employeeId}|${row.date}|${attachKey(row)}`;

  const dismiss = async (row: IssueRow) => {
    setBusy(keyOf(row));
    const { employeeId, date, shiftId, issue } = row;
    const result = await apiRequest('/api/v1/penalty-dismissals', 'POST', {
      employeeId,
      date,
      shiftId,
      issue,
    });
    setBusy(null);
    if (!result.ok) return toast.error(result.error);
    toast.success('Đã bỏ qua lỗi này');
    router.refresh();
  };

  const restore = async (row: PenaltyListView['dismissed'][number]) => {
    setBusy(keyOf(row));
    const result = await apiRequest(`/api/v1/penalty-dismissals/${row.dismissalId}`, 'DELETE');
    setBusy(null);
    if (!result.ok) return toast.error(result.error);
    toast.success('Đã đưa lỗi về danh sách chưa xử lý');
    router.refresh();
  };

  const line = (row: IssueRow) => (
    <span className={styles.rowMain}>
      <strong>
        {row.employeeName} · {row.issueLabel}
      </strong>
      <span className={styles.muted}>
        {formatDate(row.date)} · Ca {row.shiftCode} {row.shiftHours} · {punches(row)}
      </span>
    </span>
  );

  return (
    <section aria-label="Lỗi chấm công chưa xử lý">
      <h3 className={styles.groupTitle}>Lỗi chấm công chưa xử lý ({issues.length})</h3>
      {issues.length === 0 ? (
        <p className={styles.muted}>Không còn lỗi đi muộn, về sớm hay quên chấm nào chưa xử lý.</p>
      ) : (
        <ul className={styles.list}>
          {issues.map((row) => (
            <li key={keyOf(row)} className={styles.issue}>
              {line(row)}
              <span className={styles.issueActions}>
                <Button
                  size="small"
                  type="primary"
                  aria-label={`Phạt ${row.employeeName} ${row.issueLabel} ${formatDate(row.date)}`}
                  onClick={() => onPenalize(row)}
                >
                  Phạt
                </Button>
                <Button
                  size="small"
                  loading={busy === keyOf(row)}
                  aria-label={`Bỏ qua ${row.employeeName} ${row.issueLabel} ${formatDate(row.date)}`}
                  onClick={() => void dismiss(row)}
                >
                  Bỏ qua
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {dismissed.length > 0 ? (
        <label className={styles.toggle}>
          <Switch size="small" checked={showDismissed} onChange={setShowDismissed} />
          Hiện lỗi đã bỏ qua ({dismissed.length})
        </label>
      ) : null}
      {showDismissed ? (
        <ul className={styles.list}>
          {dismissed.map((row) => (
            <li key={keyOf(row)} className={`${styles.issue} ${styles.cancelled}`}>
              {line(row)}
              <span className={styles.issueActions}>
                <Button size="small" loading={busy === keyOf(row)} onClick={() => void restore(row)}>
                  Khôi phục
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
