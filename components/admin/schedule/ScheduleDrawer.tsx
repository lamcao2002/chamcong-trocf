'use client';

import { Button, Divider, Drawer, Flex, Grid, Select, Switch, Tag, Typography } from 'antd';
import { positionOfShift } from '@/lib/domain/shift-positions';
import { formatDayLabel } from '@/lib/format';
import type { ScheduleView } from '@/lib/services/schedule';
import { tokens } from '@/lib/theme/tokens';

export type CellValue = { shiftIds: string[]; isOff: boolean; positions: Record<string, string> };

type Employee = ScheduleView['employees'][number];

type ScheduleDrawerProps = {
  employee: Employee | null;
  shifts: ScheduleView['shifts'];
  holidays: ScheduleView['holidays'];
  positions: ScheduleView['positions'];
  firstDraftDate: string;
  cellOf: (employee: Employee, date: string) => CellValue;
  onChange: (employee: Employee, date: string, next: CellValue) => void;
  onClose: () => void;
};

/** Thêm một ca vào ô với vị trí đã chọn; ô Cho nghỉ thành ô làm việc. */
export function withShift(cell: CellValue, shiftId: string, positionId: string | null): CellValue {
  const shiftIds = cell.isOff ? [shiftId] : [...new Set([...cell.shiftIds, shiftId])];
  const positions = cell.isOff ? {} : { ...cell.positions };
  if (positionId) positions[shiftId] = positionId;
  return { isOff: false, shiftIds, positions };
}

export function withoutShift(cell: CellValue, shiftId: string): CellValue {
  const { [shiftId]: _removed, ...positions } = cell.positions;
  return { isOff: false, shiftIds: cell.shiftIds.filter((id) => id !== shiftId), positions };
}

/** Xếp cả tuần của một người: bật/tắt từng ca, một ngày nhiều ca, vị trí của từng ca, Cho nghỉ (US14, US16). */
export function ScheduleDrawer({
  employee,
  shifts,
  holidays,
  positions,
  firstDraftDate,
  cellOf,
  onChange,
  onClose,
}: ScheduleDrawerProps) {
  const desktop = Grid.useBreakpoint().lg ?? false;
  const choices = shifts.filter(({ id }) => employee?.allowedShiftIds.includes(id));
  const positionOptions = (employee?.positionIds ?? []).map((id) => ({
    value: id,
    label: positions.find((position) => position.id === id)?.name ?? '?',
  }));
  const multi = positionOptions.length > 1;

  return (
    <Drawer
      open={employee !== null}
      title={employee?.name}
      placement={desktop ? 'right' : 'bottom'}
      width={desktop ? tokens.formDrawerWidth : '100%'}
      height="100%"
      destroyOnHidden
      onClose={onClose}
      footer={
        <Flex justify="flex-end">
          <Button type="primary" onClick={onClose}>
            Xong
          </Button>
        </Flex>
      }
      styles={{ footer: { paddingBottom: 'max(12px, env(safe-area-inset-bottom))' } }}
    >
      {multi ? (
        <Typography.Paragraph type="secondary">
          Làm được nhiều vị trí: chọn vị trí cho từng ca, mặc định là {positionOptions[0]!.label}.
        </Typography.Paragraph>
      ) : null}
      {employee?.cells.map(({ date, defaultShiftIds, editable }, index) => {
        const cell = cellOf(employee, date);
        const holiday = holidays.find((row) => row.date === date);
        const fixedNames = shifts.filter(({ id }) => defaultShiftIds.includes(id)).map(({ name }) => name);
        const toggle = (shiftId: string, on: boolean) =>
          onChange(
            employee,
            date,
            on ? withShift(cell, shiftId, employee.positionId) : withoutShift(cell, shiftId),
          );
        const chosen = shifts.filter(({ id }) => cell.shiftIds.includes(id));

        return (
          <div key={date}>
            {index > 0 ? <Divider style={{ margin: '12px 0' }} /> : null}
            <Flex justify="space-between" align="center" gap={8}>
              <Typography.Text strong>
                {formatDayLabel(date)}
                {holiday ? ` · ${holiday.name}` : ''}
                {date >= firstDraftDate ? null : (
                  <Typography.Text type="secondary"> · có hiệu lực ngay</Typography.Text>
                )}
              </Typography.Text>
              <Flex align="center" gap={6}>
                <Typography.Text type="secondary">Cho nghỉ</Typography.Text>
                <Switch
                  size="small"
                  aria-label={`Cho nghỉ ${formatDayLabel(date)}`}
                  checked={cell.isOff}
                  disabled={!editable}
                  onChange={(isOff) => onChange(employee, date, { shiftIds: [], isOff, positions: {} })}
                />
              </Flex>
            </Flex>
            {editable ? null : (
              <Typography.Text type="secondary">Ngoài thời gian làm việc của nhân viên</Typography.Text>
            )}
            {fixedNames.length > 0 && cell.shiftIds.length === 0 && !cell.isOff ? (
              <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                Ca cố định: {fixedNames.join(', ')}, không cần xếp
              </Typography.Paragraph>
            ) : null}
            <Flex wrap gap={6} style={{ marginTop: 8 }}>
              {choices.map(({ id, code, startTime, endTime }) => (
                <Tag.CheckableTag
                  key={id}
                  checked={cell.shiftIds.includes(id)}
                  onChange={(on) => {
                    if (editable) toggle(id, on);
                  }}
                >
                  {code} {startTime}–{endTime}
                </Tag.CheckableTag>
              ))}
              {choices.length === 0 ? (
                <Typography.Text type="secondary">Vị trí này chưa có ca được làm</Typography.Text>
              ) : null}
            </Flex>
            {multi && editable
              ? chosen.map(({ id, code }) => (
                  <Flex key={id} align="center" gap={8} style={{ marginTop: 8 }}>
                    <Typography.Text style={{ minWidth: 48 }}>Ca {code}</Typography.Text>
                    <Select
                      size="small"
                      aria-label={`Vị trí ca ${code}, ${formatDayLabel(date)}`}
                      value={positionOfShift(cell.positions, id, employee.positionId)}
                      options={positionOptions}
                      onChange={(positionId: string) =>
                        onChange(employee, date, {
                          ...cell,
                          positions: { ...cell.positions, [id]: positionId },
                        })
                      }
                      style={{ minWidth: 140 }}
                    />
                  </Flex>
                ))
              : null}
          </div>
        );
      })}
    </Drawer>
  );
}
