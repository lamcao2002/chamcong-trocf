'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Empty } from 'antd';
import { UndoOutlined } from '@ant-design/icons';
import { UnsavedBar } from '@/components/common/UnsavedBar';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { formatDayLabel } from '@/lib/format';
import type { ScheduleView } from '@/lib/services/schedule';
import { ScheduleDrawer, type CellDraft } from './ScheduleDrawer';
import styles from './schedule.module.css';

type Employee = ScheduleView['employees'][number];

const draftKey = (employeeId: string, date: string) => `${employeeId}|${date}`;

function sameCell(a: CellDraft, b: CellDraft) {
  const ids = (cell: CellDraft) => [...cell.shiftIds].sort().join();
  return a.isOff === b.isOff && ids(a) === ids(b);
}

type SchedulePanelProps = { schedule: ScheduleView; today: string };

/** Màn A4: lưới tuần, sửa trên bản nháp trên máy, bấm Lưu mới gửi các ô đã đổi (US14–US16). */
export function SchedulePanel({ schedule, today }: SchedulePanelProps) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, CellDraft>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  // Dữ liệu mới về (đã lưu hoặc đổi tuần) thì bản nháp không còn giá trị
  useEffect(() => setDraft({}), [schedule]);

  const shiftCode = (id: string) => schedule.shifts.find((shift) => shift.id === id)?.code ?? '';
  const savedCell = (employee: Employee, date: string): CellDraft => {
    const cell = employee.cells.find((row) => row.date === date)!;
    return { shiftIds: cell.shiftIds, isOff: cell.isOff };
  };
  const cellOf = (employee: Employee, date: string) =>
    draft[draftKey(employee.id, date)] ?? savedCell(employee, date);

  const change = (employee: Employee, date: string, next: CellDraft) => {
    const key = draftKey(employee.id, date);
    setDraft(({ [key]: _previous, ...rest }) =>
      sameCell(next, savedCell(employee, date)) ? rest : { ...rest, [key]: next },
    );
  };

  const save = async () => {
    const cells = Object.entries(draft).map(([key, cell]) => {
      const [employeeId, date] = key.split('|');
      return { employeeId, date, ...cell };
    });
    setPosting(true);
    const result = await apiRequest('/api/v1/schedule', 'PUT', { cells });
    setPosting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Đã lưu lịch');
    startRefresh(() => router.refresh());
  };

  const editing = schedule.employees.find(({ id }) => id === editingId) ?? null;

  if (schedule.employees.length === 0) {
    return (
      <div className={styles.card}>
        <Empty description="Không có nhân viên nào để xếp" />
      </div>
    );
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.headRow}>
          <span className={styles.nameHead}>Nhân viên</span>
          {schedule.dates.map((date) => {
            const holiday = schedule.holidays.find((row) => row.date === date);
            return (
              <span
                key={date}
                title={holiday?.name}
                className={`${styles.dayHead} ${date === today ? styles.today : ''} ${holiday ? styles.holiday : ''}`}
              >
                {formatDayLabel(date)}
              </span>
            );
          })}
        </div>

        {schedule.employees.map((employee) => (
          <div key={employee.id} className={styles.row}>
            <button type="button" className={styles.person} onClick={() => setEditingId(employee.id)}>
              <span className={styles.personName}>{employee.name}</span>
              <span className={styles.personSub}>
                {employee.positionName ?? 'Chưa có vị trí'}
                {employee.shiftMode === 'fixed' ? ' · Ca cố định' : ''}
              </span>
            </button>
            {employee.cells.map(({ date, defaultShiftIds, editable }) => {
              const cell = cellOf(employee, date);
              const usesDefault = cell.shiftIds.length === 0 && !cell.isOff && defaultShiftIds.length > 0;
              const shown = usesDefault ? defaultShiftIds : cell.shiftIds;
              const dirty = draft[draftKey(employee.id, date)] !== undefined;
              const label = cell.isOff
                ? 'Nghỉ'
                : shown.length > 0
                  ? shown.map(shiftCode).join(', ')
                  : 'Chưa xếp';
              return (
                <button
                  key={date}
                  type="button"
                  disabled={!editable}
                  aria-label={`${employee.name}, ${formatDayLabel(date)}: ${label}${dirty ? ', chưa lưu' : ''}`}
                  className={`${styles.cell} ${usesDefault ? styles.fixed : ''} ${cell.isOff ? styles.off : ''}`}
                  onClick={() => setEditingId(employee.id)}
                >
                  {dirty ? <span className={styles.dirtyDot} aria-hidden /> : null}
                  {cell.isOff ? 'Nghỉ' : null}
                  {cell.isOff
                    ? null
                    : shown.map((id) => (
                        <span key={id} className={styles.chip}>
                          {shiftCode(id)}
                        </span>
                      ))}
                  {!cell.isOff && shown.length === 0 && editable ? <span aria-hidden>+</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <ScheduleDrawer
        employee={editing}
        shifts={schedule.shifts}
        holidays={schedule.holidays}
        cellOf={cellOf}
        onChange={change}
        onClose={() => setEditingId(null)}
      />

      <UnsavedBar
        count={Object.keys(draft).length}
        label="ô chưa lưu"
        tone="light"
        discardIcon={<UndoOutlined />}
        saving={posting || refreshing}
        onSave={() => void save()}
        onDiscard={() => setDraft({})}
      />
    </>
  );
}
