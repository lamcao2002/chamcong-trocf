'use client';

import { Button, Divider, Drawer, Flex, Grid, Switch, Tag, Typography } from 'antd';
import { formatDayLabel } from '@/lib/format';
import type { ScheduleView } from '@/lib/services/schedule';
import { tokens } from '@/lib/theme/tokens';

export type CellDraft = { shiftIds: string[]; isOff: boolean };

type Employee = ScheduleView['employees'][number];

type ScheduleDrawerProps = {
  employee: Employee | null;
  shifts: ScheduleView['shifts'];
  holidays: ScheduleView['holidays'];
  cellOf: (employee: Employee, date: string) => CellDraft;
  onChange: (employee: Employee, date: string, next: CellDraft) => void;
  onClose: () => void;
};

/** Xếp cả tuần của một người: bật/tắt từng ca, một ngày nhiều ca, Cho nghỉ (US14, US16). */
export function ScheduleDrawer({
  employee,
  shifts,
  holidays,
  cellOf,
  onChange,
  onClose,
}: ScheduleDrawerProps) {
  const desktop = Grid.useBreakpoint().lg ?? false;
  const choices = shifts.filter(({ id }) => employee?.allowedShiftIds.includes(id));

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
      {employee?.cells.map(({ date, defaultShiftIds, editable }, index) => {
        const cell = cellOf(employee, date);
        const holiday = holidays.find((row) => row.date === date);
        const fixedNames = shifts.filter(({ id }) => defaultShiftIds.includes(id)).map(({ name }) => name);
        const toggle = (shiftId: string, on: boolean) =>
          onChange(employee, date, {
            isOff: false,
            shiftIds: on ? [...cell.shiftIds, shiftId] : cell.shiftIds.filter((id) => id !== shiftId),
          });

        return (
          <div key={date}>
            {index > 0 ? <Divider style={{ margin: '12px 0' }} /> : null}
            <Flex justify="space-between" align="center" gap={8}>
              <Typography.Text strong>
                {formatDayLabel(date)}
                {holiday ? ` · ${holiday.name}` : ''}
              </Typography.Text>
              <Flex align="center" gap={6}>
                <Typography.Text type="secondary">Cho nghỉ</Typography.Text>
                <Switch
                  size="small"
                  aria-label={`Cho nghỉ ${formatDayLabel(date)}`}
                  checked={cell.isOff}
                  disabled={!editable}
                  onChange={(isOff) => onChange(employee, date, { shiftIds: [], isOff })}
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
          </div>
        );
      })}
    </Drawer>
  );
}
