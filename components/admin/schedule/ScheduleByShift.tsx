'use client';

import { useState } from 'react';
import { Button, Divider, Drawer, Empty, Flex, Grid, Select, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { positionOfShift, positionShort } from '@/lib/domain/shift-positions';
import { formatDayLabel } from '@/lib/format';
import type { ScheduleView } from '@/lib/services/schedule';
import { tokens } from '@/lib/theme/tokens';
import { withShift, withoutShift, type CellValue } from './ScheduleDrawer';
import styles from './schedule.module.css';

type Employee = ScheduleView['employees'][number];
type Shift = ScheduleView['shifts'][number];

export type ShiftViewProps = {
  schedule: ScheduleView;
  today: string;
  cellOf: (employee: Employee, date: string) => CellValue;
  isDirty: (employee: Employee, date: string) => boolean;
  isDraft: (employee: Employee, date: string) => boolean;
  onChange: (employee: Employee, date: string, next: CellValue) => void;
  /** Nhận hoặc từ chối đăng ký qua API; khoá khi còn ô chưa lưu vì tải lại sẽ mất chúng. */
  onDecide: (ids: string[], decision: 'approve' | 'reject', positionId?: string | null) => void;
  busy: boolean;
  hasEdits: boolean;
};

type Slot = { shift: Shift; date: string };

/** Ô hẹp trên điện thoại chỉ đủ tên gọi (chữ cuối của họ tên), máy tính hiện đủ họ tên. */
function NameOf({ name }: { name: string }) {
  const given = name.trim().split(/\s+/).pop() ?? name;
  return (
    <>
      <span className={styles.nameShort}>{given}</span>
      <span className={styles.nameFull}>{name}</span>
    </>
  );
}

/** Ai đang ở ca này ngày này: ô trống không Cho nghỉ thì tính ca cố định mặc định. */
function assignedTo(schedule: ScheduleView, cellOf: ShiftViewProps['cellOf'], { shift, date }: Slot) {
  return schedule.employees.flatMap((employee) => {
    const cell = cellOf(employee, date);
    const defaults = employee.cells.find((row) => row.date === date)?.defaultShiftIds ?? [];
    const fixed = cell.shiftIds.length === 0 && !cell.isOff && defaults.includes(shift.id);
    if (!fixed && !cell.shiftIds.includes(shift.id)) return [];
    return [{ employee, fixed, positionId: positionOfShift(cell.positions, shift.id, employee.positionId) }];
  });
}

const pendingFor = (schedule: ScheduleView, { shift, date }: Slot) =>
  schedule.registrations.filter((row) => row.date === date && row.shiftId === shift.id && !row.inDraft);

/** Màn A4 kiểu Theo ca: hàng là ca, cột là ngày, mỗi ô là người đã xếp và người đăng ký chờ nhận. */
export function ScheduleByShift(props: ShiftViewProps) {
  const { schedule, today, cellOf, isDirty, isDraft } = props;
  const [slot, setSlot] = useState<{ shiftId: string; date: string } | null>(null);
  const positionName = (id: string | null) => schedule.positions.find((row) => row.id === id)?.name ?? '';
  const open = slot
    ? { shift: schedule.shifts.find(({ id }) => id === slot.shiftId)!, date: slot.date }
    : null;

  if (schedule.shifts.length === 0) {
    return (
      <div className={styles.card}>
        <Empty description="Chưa có ca nào" />
      </div>
    );
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.headRow}>
          <span className={styles.nameHead}>Ca</span>
          {schedule.dates.map((date) => (
            <span key={date} className={`${styles.dayHead} ${date === today ? styles.today : ''}`}>
              {formatDayLabel(date)}
            </span>
          ))}
        </div>
        {schedule.shifts.map((shift) => (
          <div key={shift.id} className={styles.row}>
            <div className={styles.person}>
              <span className={styles.personName}>
                {shift.code} · {shift.name}
              </span>
              <span className={styles.personSub}>
                {shift.startTime}–{shift.endTime}
              </span>
            </div>
            {schedule.dates.map((date) => {
              const people = assignedTo(schedule, cellOf, { shift, date });
              const pending = pendingFor(schedule, { shift, date });
              const dirty = people.some(({ employee }) => isDirty(employee, date));
              const draft = people.some(({ employee }) => isDraft(employee, date));
              const counts = [...new Set(people.map(({ positionId }) => positionId))].map((id) => ({
                id,
                total: people.filter(({ positionId }) => positionId === id).length,
              }));
              const label = [
                `${shift.code}, ${formatDayLabel(date)}: ${people.length} người`,
                ...counts.map(({ id, total }) => `${total} ${positionName(id) || 'chưa có vị trí'}`),
                pending.length > 0
                  ? `${pending.length} đăng ký chờ nhận: ${pending.map(({ employeeName }) => employeeName).join(', ')}`
                  : '',
                dirty ? 'chưa lưu' : draft ? 'nháp' : '',
              ]
                .filter(Boolean)
                .join(', ');
              return (
                <button
                  key={date}
                  type="button"
                  aria-label={label}
                  className={`${styles.cell} ${styles.slot} ${draft && !dirty ? styles.draft : ''}`}
                  onClick={() => setSlot({ shiftId: shift.id, date })}
                >
                  {dirty ? <span className={styles.dirtyDot} aria-hidden /> : null}
                  <span className={styles.slotNames} aria-hidden>
                    {people.map(({ employee, positionId }) => (
                      <span key={employee.id} className={styles.slotName}>
                        <NameOf name={employee.name} />
                        {employee.positionIds.length > 1 && positionId ? (
                          <span className={styles.slotRole}>
                            {' '}
                            · {positionShort(positionName(positionId))}
                          </span>
                        ) : null}
                      </span>
                    ))}
                    {pending.map(({ id, employeeName }) => (
                      <span key={id} className={`${styles.slotName} ${styles.slotPending}`}>
                        <NameOf name={employeeName} />
                      </span>
                    ))}
                    {people.length === 0 && pending.length === 0 ? (
                      <span className={styles.slotEmpty}>+</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <SlotDrawer {...props} slot={open} onClose={() => setSlot(null)} />
    </>
  );
}

type SlotDrawerProps = ShiftViewProps & { slot: Slot | null; onClose: () => void };

/** Một ca của một ngày: đổi vị trí, gỡ người, nhận đăng ký, thêm người được làm ca này. */
function SlotDrawer({
  schedule,
  cellOf,
  isDraft,
  onChange,
  onDecide,
  busy,
  hasEdits,
  slot,
  onClose,
}: SlotDrawerProps) {
  const desktop = Grid.useBreakpoint().lg ?? false;
  const [adding, setAdding] = useState<string>();
  const [addPosition, setAddPosition] = useState<string>();
  const [choice, setChoice] = useState<Record<string, string>>({});

  const positionOptions = (employee: Employee) =>
    employee.positionIds.map((id) => ({
      value: id,
      label: schedule.positions.find((row) => row.id === id)?.name ?? '?',
    }));
  const people = slot ? assignedTo(schedule, cellOf, slot) : [];
  const pending = slot ? pendingFor(schedule, slot) : [];
  const editableOn = (employee: Employee) =>
    employee.cells.find((row) => row.date === slot?.date)?.editable ?? false;
  const candidates = slot
    ? schedule.employees.filter(
        (employee) =>
          employee.allowedShiftIds.includes(slot.shift.id) &&
          editableOn(employee) &&
          !people.some((row) => row.employee.id === employee.id),
      )
    : [];
  const addingEmployee = schedule.employees.find(({ id }) => id === adding);

  const close = () => {
    setAdding(undefined);
    setAddPosition(undefined);
    setChoice({});
    onClose();
  };

  return (
    <Drawer
      open={slot !== null}
      title={slot ? `Ca ${slot.shift.code} · ${formatDayLabel(slot.date)}` : ''}
      placement={desktop ? 'right' : 'bottom'}
      width={desktop ? tokens.formDrawerWidth : '100%'}
      height="100%"
      destroyOnHidden
      onClose={close}
      footer={
        <Flex justify="flex-end">
          <Button type="primary" onClick={close}>
            Xong
          </Button>
        </Flex>
      }
      styles={{ footer: { paddingBottom: 'max(12px, env(safe-area-inset-bottom))' } }}
    >
      {slot ? (
        <>
          <Typography.Paragraph type="secondary">
            {slot.shift.name} · {slot.shift.startTime}–{slot.shift.endTime}
          </Typography.Paragraph>

          <Typography.Title level={5}>
            Đã xếp ({people.length})
            {people.length > 0 ? (
              <Typography.Text type="secondary" style={{ fontWeight: 400, fontSize: 14 }}>
                {' · '}
                {[...new Set(people.map(({ positionId }) => positionId))]
                  .map(
                    (id) =>
                      `${people.filter((row) => row.positionId === id).length} ${
                        schedule.positions.find((row) => row.id === id)?.name ?? 'chưa có vị trí'
                      }`,
                  )
                  .join(' · ')}
              </Typography.Text>
            ) : null}
          </Typography.Title>
          {people.length === 0 ? <Typography.Text type="secondary">Chưa có ai.</Typography.Text> : null}
          <Flex vertical gap={8}>
            {people.map(({ employee, fixed, positionId }) => {
              const cell = cellOf(employee, slot.date);
              const editable = editableOn(employee) && !fixed;
              return (
                <Flex key={employee.id} align="center" justify="space-between" gap={8} wrap>
                  <span>
                    <strong>{employee.name}</strong>
                    {fixed ? <Tag style={{ marginLeft: 6 }}>Ca cố định</Tag> : null}
                    {isDraft(employee, slot.date) ? <Tag style={{ marginLeft: 6 }}>Nháp</Tag> : null}
                  </span>
                  <Flex align="center" gap={6}>
                    {employee.positionIds.length > 1 && editable ? (
                      <Select
                        size="small"
                        aria-label={`Vị trí của ${employee.name}`}
                        value={positionId}
                        options={positionOptions(employee)}
                        onChange={(next: string) =>
                          onChange(employee, slot.date, {
                            ...cell,
                            positions: { ...cell.positions, [slot.shift.id]: next },
                          })
                        }
                        style={{ minWidth: 130 }}
                      />
                    ) : (
                      <Typography.Text type="secondary">
                        {schedule.positions.find((row) => row.id === positionId)?.name ?? ''}
                      </Typography.Text>
                    )}
                    {editable ? (
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label={`Gỡ ${employee.name} khỏi ca`}
                        onClick={() => onChange(employee, slot.date, withoutShift(cell, slot.shift.id))}
                      />
                    ) : null}
                  </Flex>
                </Flex>
              );
            })}
          </Flex>

          {pending.length > 0 ? (
            <>
              <Divider style={{ margin: '16px 0 12px' }} />
              <Typography.Title level={5}>Đăng ký chờ nhận ({pending.length})</Typography.Title>
              {hasEdits ? (
                <Typography.Paragraph type="secondary">
                  Lưu hoặc bỏ các ô đang sửa trước khi nhận.
                </Typography.Paragraph>
              ) : null}
              <Flex vertical gap={8}>
                {pending.map(({ id, employeeId, employeeName }) => {
                  const employee = schedule.employees.find((row) => row.id === employeeId);
                  const options = employee ? positionOptions(employee) : [];
                  return (
                    <Flex key={id} align="center" justify="space-between" gap={8} wrap>
                      <strong>{employeeName}</strong>
                      <Flex align="center" gap={6}>
                        {options.length > 1 ? (
                          <Select
                            size="small"
                            aria-label={`Vị trí khi nhận ${employeeName}`}
                            value={choice[id] ?? options[0]!.value}
                            options={options}
                            onChange={(next: string) => setChoice((all) => ({ ...all, [id]: next }))}
                            style={{ minWidth: 130 }}
                          />
                        ) : null}
                        <Button
                          size="small"
                          type="primary"
                          icon={<CheckOutlined />}
                          disabled={busy || hasEdits}
                          onClick={() => onDecide([id], 'approve', choice[id] ?? null)}
                        >
                          Nhận
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<CloseOutlined />}
                          aria-label={`Từ chối ${employeeName}`}
                          disabled={busy}
                          onClick={() => onDecide([id], 'reject')}
                        />
                      </Flex>
                    </Flex>
                  );
                })}
              </Flex>
            </>
          ) : null}

          <Divider style={{ margin: '16px 0 12px' }} />
          <Typography.Title level={5}>Thêm người</Typography.Title>
          {candidates.length === 0 ? (
            <Typography.Text type="secondary">Không còn ai làm được ca này.</Typography.Text>
          ) : (
            <Flex gap={6} wrap>
              <Select
                aria-label="Chọn nhân viên"
                placeholder="Chọn nhân viên"
                value={adding}
                options={candidates.map(({ id, name }) => ({ value: id, label: name }))}
                onChange={(id: string) => {
                  setAdding(id);
                  setAddPosition(undefined);
                }}
                showSearch
                optionFilterProp="label"
                style={{ flex: '1 1 160px' }}
              />
              {addingEmployee && addingEmployee.positionIds.length > 1 ? (
                <Select
                  aria-label="Vị trí"
                  value={addPosition ?? addingEmployee.positionIds[0]}
                  options={positionOptions(addingEmployee)}
                  onChange={(id: string) => setAddPosition(id)}
                  style={{ flex: '1 1 120px' }}
                />
              ) : null}
              <Button
                icon={<PlusOutlined />}
                disabled={!addingEmployee}
                onClick={() => {
                  if (!addingEmployee) return;
                  const cell = cellOf(addingEmployee, slot.date);
                  const positionId = addPosition ?? addingEmployee.positionId;
                  onChange(addingEmployee, slot.date, withShift(cell, slot.shift.id, positionId));
                  setAdding(undefined);
                  setAddPosition(undefined);
                }}
              >
                Thêm
              </Button>
            </Flex>
          )}
        </>
      ) : null}
    </Drawer>
  );
}
