'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Empty, Segmented } from 'antd';
import { CheckOutlined, CloseOutlined, SendOutlined, UndoOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { UnsavedBar } from '@/components/common/UnsavedBar';
import { useConfirmDiscard } from '@/components/common/useConfirmDiscard';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { positionOfShift, positionShort, sameScheduleCell } from '@/lib/domain/shift-positions';
import { addDays } from '@/lib/engine/time';
import { formatDate, formatDayLabel } from '@/lib/format';
import type { ScheduleView } from '@/lib/services/schedule';
import { ScheduleByShift } from './ScheduleByShift';
import { ScheduleDrawer, type CellValue } from './ScheduleDrawer';
import styles from './schedule.module.css';

type Employee = ScheduleView['employees'][number];
type View = 'employee' | 'shift';

const VIEW_KEY = 'xep-ca-view';

const editKey = (employeeId: string, date: string) => `${employeeId}|${date}`;

/** Kiểu xem là tiện ích riêng từng máy: không đọc được bộ nhớ thì về Theo nhân viên. */
function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'shift' ? 'shift' : 'employee';
  } catch {
    return 'employee';
  }
}

type SchedulePanelProps = { schedule: ScheduleView; today: string };

/**
 * Màn A4: lưới tuần theo nhân viên hoặc theo ca, sửa trên máy, bấm Lưu mới gửi các ô đã đổi
 * (US14–US16). Từ ngày mai trở đi lưu vào nháp, bấm Công bố nhân viên mới thấy.
 */
export function SchedulePanel({ schedule, today }: SchedulePanelProps) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirmDiscard();
  const [edits, setEdits] = useState<Record<string, CellValue>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<View>('employee');
  const [posting, setPosting] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => setView(readView()), []);
  // Dữ liệu mới về (đã lưu hoặc đổi tuần) thì các ô đang sửa không còn giá trị
  useEffect(() => setEdits({}), [schedule]);

  const changeView = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Không lưu được thì lần sau về kiểu mặc định
    }
  };

  const shiftCode = (id: string) => schedule.shifts.find((shift) => shift.id === id)?.code ?? '';
  const positionName = (id: string | null) => schedule.positions.find((row) => row.id === id)?.name ?? '';
  const savedCell = (employee: Employee, date: string): CellValue => {
    const cell = employee.cells.find((row) => row.date === date)!;
    const saved = cell.draft ?? cell;
    return { shiftIds: saved.shiftIds, isOff: saved.isOff, positions: saved.positions };
  };
  const cellOf = (employee: Employee, date: string) =>
    edits[editKey(employee.id, date)] ?? savedCell(employee, date);
  const isDirty = (employee: Employee, date: string) => edits[editKey(employee.id, date)] !== undefined;
  const isDraft = (employee: Employee, date: string) =>
    Boolean(employee.cells.find((row) => row.date === date)?.draft);

  const change = (employee: Employee, date: string, next: CellValue) => {
    const key = editKey(employee.id, date);
    setEdits(({ [key]: _previous, ...rest }) =>
      sameScheduleCell(next, savedCell(employee, date), employee.positionId)
        ? rest
        : { ...rest, [key]: next },
    );
  };

  const refresh = () => startRefresh(() => router.refresh());

  const save = async () => {
    const cells = Object.entries(edits).map(([key, cell]) => {
      const [employeeId, date] = key.split('|') as [string, string];
      return { employeeId, date, ...cell };
    });
    setPosting(true);
    const result = await apiRequest('/api/v1/schedule', 'PUT', { cells });
    setPosting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const drafted = cells.some(({ date }) => date >= schedule.firstDraftDate);
    toast.success(drafted ? 'Đã lưu nháp. Bấm Công bố để gửi lịch cho nhân viên.' : 'Đã lưu lịch');
    refresh();
  };

  const decide = async (ids: string[], decision: 'approve' | 'reject', positionId?: string | null) => {
    setPosting(true);
    const result = await apiRequest<{ result: { decided: number; drafted: number; skipped: number } }>(
      '/api/v1/schedule/registrations',
      'POST',
      { ids, decision, ...(positionId ? { positionId } : {}) },
    );
    setPosting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { decided, drafted } = result.result;
    if (decision === 'reject') toast.success(`Đã từ chối ${decided} đăng ký`);
    else if (drafted > 0) toast.success(`Đã nhận ${drafted + decided} đăng ký vào nháp`);
    else toast.success(`Đã nhận ${decided} đăng ký`);
    refresh();
  };

  const weekAction = async (action: 'publish' | 'discard') => {
    const publish = action === 'publish';
    const confirmed = await confirm({
      title: publish
        ? `Công bố ${schedule.draftCount} ô nháp của tuần này?`
        : `Bỏ ${schedule.draftCount} ô nháp của tuần này?`,
      content: publish
        ? 'Nhân viên sẽ thấy lịch mới và nhận thông báo. Đăng ký đã nhận vào nháp chuyển sang Đã nhận.'
        : 'Lịch quay về bản đã công bố. Đăng ký đã nhận vào nháp quay về chờ nhận.',
      okText: publish ? 'Công bố' : 'Bỏ nháp',
      danger: !publish,
    });
    if (!confirmed) return;
    setPosting(true);
    const result = await apiRequest<{ result: { cells: number; people: number; registrations: number } }>(
      `/api/v1/schedule/${action}`,
      'POST',
      { week: schedule.week },
    );
    setPosting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { cells, people } = result.result;
    toast.success(publish ? `Đã công bố lịch của ${people} người` : `Đã bỏ ${cells} ô nháp`);
    refresh();
  };

  const registrations = schedule.registrations.filter(({ inDraft }) => !inDraft);
  const hasEdits = Object.keys(edits).length > 0;
  const nextWeek = addDays(schedule.week, 7);
  const editing = schedule.employees.find(({ id }) => id === editingId) ?? null;
  const busy = posting || refreshing;

  if (schedule.employees.length === 0) {
    return (
      <div className={styles.card}>
        <Empty description="Không có nhân viên nào để xếp" />
      </div>
    );
  }

  return (
    <>
      <div className={styles.toolbar}>
        <Segmented<View>
          value={view}
          onChange={changeView}
          options={[
            { value: 'employee', label: 'Theo nhân viên' },
            { value: 'shift', label: 'Theo ca' },
          ]}
        />
      </div>

      {schedule.draftCount > 0 ? (
        <section className={styles.publishBar} aria-label="Lịch nháp">
          <span>
            <strong>{schedule.draftCount} ô nháp</strong> chưa công bố trong tuần này
            {hasEdits ? ' · lưu các ô đang sửa trước khi công bố' : ''}
          </span>
          <span className={styles.registrationActions}>
            <Button
              icon={<UndoOutlined />}
              disabled={busy || hasEdits}
              onClick={() => void weekAction('discard')}
            >
              Bỏ nháp
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              disabled={busy || hasEdits}
              onClick={() => void weekAction('publish')}
            >
              Công bố ({schedule.draftCount})
            </Button>
          </span>
        </section>
      ) : null}

      {schedule.nextWeekRegistrations > 0 ? (
        <p className={styles.notice} role="status">
          Tuần sau ({formatDate(nextWeek).slice(0, 5)} – {formatDate(addDays(nextWeek, 6))}) có{' '}
          <strong>{schedule.nextWeekRegistrations} đăng ký ca</strong> từ app đang chờ nhận.{' '}
          <Link href={`/app/xep-ca?week=${nextWeek}`}>Xem tuần sau</Link>
        </p>
      ) : null}

      {view === 'employee' && registrations.length > 0 ? (
        <section className={styles.registrations} aria-label="Đăng ký ca chờ nhận">
          <div className={styles.registrationsHead}>
            <strong>{registrations.length} đăng ký ca chờ nhận trong tuần này</strong>
            <Button
              size="small"
              type="primary"
              disabled={busy || hasEdits}
              onClick={() =>
                void decide(
                  registrations.map(({ id }) => id),
                  'approve',
                )
              }
            >
              Nhận tất cả {registrations.length}
            </Button>
          </div>
          {hasEdits ? <p className={styles.personSub}>Lưu hoặc bỏ các ô đang sửa trước khi nhận.</p> : null}
          <ul className={styles.registrationList}>
            {registrations.map(({ id, employeeName, date, shiftId }) => (
              <li key={id}>
                <span>
                  <strong>{employeeName}</strong> · {formatDayLabel(date)} · {shiftCode(shiftId)}
                </span>
                <span className={styles.registrationActions}>
                  <Button
                    size="small"
                    icon={<CheckOutlined />}
                    aria-label={`Nhận ${employeeName}, ${formatDayLabel(date)}, ${shiftCode(shiftId)}`}
                    disabled={busy || hasEdits}
                    onClick={() => void decide([id], 'approve')}
                  />
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    aria-label={`Từ chối ${employeeName}, ${formatDayLabel(date)}, ${shiftCode(shiftId)}`}
                    disabled={busy}
                    onClick={() => void decide([id], 'reject')}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === 'shift' ? (
        <ScheduleByShift
          schedule={schedule}
          today={today}
          cellOf={cellOf}
          isDirty={isDirty}
          isDraft={isDraft}
          onChange={change}
          onDecide={(ids, decision, positionId) => void decide(ids, decision, positionId)}
          busy={busy}
          hasEdits={hasEdits}
        />
      ) : (
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

          {schedule.employees.map((employee) => {
            const multi = employee.positionIds.length > 1;
            return (
              <div key={employee.id} className={styles.row}>
                <button type="button" className={styles.person} onClick={() => setEditingId(employee.id)}>
                  <span className={styles.personName}>{employee.name}</span>
                  <span className={styles.personSub}>
                    {employee.positionIds.length > 0
                      ? employee.positionIds.map(positionName).join(' + ')
                      : 'Chưa có vị trí'}
                    {employee.shiftMode === 'fixed' ? ' · Ca cố định' : ''}
                  </span>
                </button>
                {employee.cells.map(({ date, defaultShiftIds, editable }) => {
                  const cell = cellOf(employee, date);
                  const usesDefault = cell.shiftIds.length === 0 && !cell.isOff && defaultShiftIds.length > 0;
                  const shown = usesDefault ? defaultShiftIds : cell.shiftIds;
                  const dirty = isDirty(employee, date);
                  const draft = isDraft(employee, date);
                  const roleOf = (id: string) => {
                    const positionId = positionOfShift(cell.positions, id, employee.positionId);
                    return multi && positionId !== employee.positionId ? positionName(positionId) : '';
                  };
                  const label = cell.isOff
                    ? 'Nghỉ'
                    : shown.length > 0
                      ? shown.map((id) => [shiftCode(id), roleOf(id)].filter(Boolean).join(' ')).join(', ')
                      : 'Chưa xếp';
                  return (
                    <button
                      key={date}
                      type="button"
                      disabled={!editable}
                      aria-label={`${employee.name}, ${formatDayLabel(date)}: ${label}${dirty ? ', chưa lưu' : draft ? ', nháp' : ''}`}
                      className={`${styles.cell} ${usesDefault ? styles.fixed : ''} ${cell.isOff ? styles.off : ''} ${draft && !dirty ? styles.draft : ''}`}
                      onClick={() => setEditingId(employee.id)}
                    >
                      {dirty ? <span className={styles.dirtyDot} aria-hidden /> : null}
                      {cell.isOff ? 'Nghỉ' : null}
                      {cell.isOff
                        ? null
                        : shown.map((id) => {
                            const role = roleOf(id);
                            return (
                              <span key={id} className={styles.chip}>
                                {shiftCode(id)}
                                {role ? `·${positionShort(role)}` : ''}
                              </span>
                            );
                          })}
                      {!cell.isOff && shown.length === 0 && editable ? <span aria-hidden>+</span> : null}
                      {registrations
                        .filter((row) => row.employeeId === employee.id && row.date === date)
                        .map(({ id, shiftId }) => (
                          <span key={id} className={styles.chipPending}>
                            {shiftCode(shiftId)}
                          </span>
                        ))}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <p className={styles.footnote}>
        Từ ngày mai trở đi, bấm Lưu là lưu nháp: nhân viên, Bảng công và Lương chỉ thấy sau khi Công bố. Hôm
        nay và các ngày đã qua có hiệu lực ngay. Ở kiểu Theo ca, tên có viền đứt là người đăng ký chờ nhận.
      </p>

      <ScheduleDrawer
        employee={editing}
        shifts={schedule.shifts}
        holidays={schedule.holidays}
        positions={schedule.positions}
        firstDraftDate={schedule.firstDraftDate}
        cellOf={cellOf}
        onChange={change}
        onClose={() => setEditingId(null)}
      />

      <UnsavedBar
        count={Object.keys(edits).length}
        label="ô chưa lưu"
        tone="light"
        discardIcon={<UndoOutlined />}
        saving={busy}
        onSave={() => void save()}
        onDiscard={() => setEdits({})}
      />
    </>
  );
}
