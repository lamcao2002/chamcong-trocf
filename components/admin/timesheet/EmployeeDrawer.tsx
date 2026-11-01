'use client';

import { useEffect, useState } from 'react';
import { Drawer, Flex, Grid, Skeleton, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { dayStatusLabel, formatClock, formatDate, formatDecimal } from '@/lib/format';
import type { EmployeeTimesheetView } from '@/lib/services/timesheet';
import { tokens } from '@/lib/theme/tokens';

export type EmployeeTarget = { id: string; name: string; period: string };

type Row = EmployeeTimesheetView['rows'][number];

const COLUMNS: TableColumnsType<Row> = [
  { title: 'Ngày', dataIndex: 'date', render: (date: string) => formatDate(date).slice(0, 5) },
  { title: 'Ca', dataIndex: 'shiftName', render: (name: string | null) => name ?? '—' },
  {
    title: 'Trạng thái',
    key: 'status',
    render: (_, { status, needsReview }) => (
      <Tag color={needsReview ? 'warning' : 'default'}>{dayStatusLabel(status)}</Tag>
    ),
  },
  { title: 'Vào', dataIndex: 'inAt', render: (at: string | null) => (at ? formatClock(at) : '—') },
  { title: 'Ra', dataIndex: 'outAt', render: (at: string | null) => (at ? formatClock(at) : '—') },
  { title: 'Công', dataIndex: 'cong', align: 'right', render: formatDecimal },
];

type EmployeeDrawerProps = { target: EmployeeTarget | null; onClose: () => void };

/** Bảng công cả kỳ của một người (US28). */
export function EmployeeDrawer({ target, onClose }: EmployeeDrawerProps) {
  const desktop = Grid.useBreakpoint().lg ?? false;
  const toast = useToast();
  const [view, setView] = useState<EmployeeTimesheetView | null>(null);

  useEffect(() => {
    setView(null);
    if (!target) return;
    const url = `/api/v1/timesheet/${target.id}?period=${target.period}`;
    void apiRequest<{ timesheet: EmployeeTimesheetView }>(url, 'GET').then((result) => {
      if (result.ok) setView(result.timesheet);
      else toast.error(result.error);
    });
  }, [target, toast]);

  return (
    <Drawer
      open={target !== null}
      title={target?.name}
      placement={desktop ? 'right' : 'bottom'}
      width={desktop ? tokens.formDrawerWidth + 120 : '100%'}
      height="92%"
      destroyOnHidden
      onClose={onClose}
    >
      {view ? (
        <Flex vertical gap={12}>
          <Typography.Text>
            {formatDecimal(view.totals.cong)} công · muộn {view.totals.lateMin}p · thiếu {view.totals.missing}{' '}
            · OT {view.totals.otApproved}p{view.totals.otPending > 0 ? ` +${view.totals.otPending}?` : ''}
          </Typography.Text>
          <Table
            size="small"
            rowKey={({ date, shiftId }) => `${date}-${shiftId}`}
            columns={COLUMNS}
            dataSource={view.rows}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: 'Kỳ này chưa có ngày công' }}
          />
        </Flex>
      ) : (
        <Skeleton active />
      )}
    </Drawer>
  );
}
