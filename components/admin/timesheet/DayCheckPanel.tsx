'use client';

import { useRouter } from 'next/navigation';
import { Button, Card, DatePicker, Flex, Table, Tag, type TableColumnsType } from 'antd';
import dayjs from 'dayjs';
import { addDays } from '@/lib/engine/time';
import { dayStatusLabel, formatClock } from '@/lib/format';
import type { DayRow } from '@/lib/services/day';
import { tokens } from '@/lib/theme/tokens';

const DATE_FORMAT = 'YYYY-MM-DD';

const COLUMNS: TableColumnsType<DayRow> = [
  {
    title: 'Nhân viên',
    key: 'employee',
    render: (_, { employeeName, positionName }) => (
      <>
        <strong>{employeeName}</strong>
        <br />
        {positionName ?? 'Chưa có vị trí'}
      </>
    ),
  },
  { title: 'Ca', dataIndex: 'shiftName', render: (name: string | null) => name ?? '—' },
  {
    title: 'Trạng thái',
    key: 'status',
    render: (_, { status, needsReview }) => (
      <Tag color={needsReview ? 'warning' : 'default'}>{dayStatusLabel(status)}</Tag>
    ),
  },
  { title: 'Vào', dataIndex: 'inAt', render: (at: Date | null) => (at ? formatClock(at) : '—') },
  { title: 'Ra', dataIndex: 'outAt', render: (at: Date | null) => (at ? formatClock(at) : '—') },
  { title: 'Phút làm', dataIndex: 'workedMin', align: 'right' },
  { title: 'Công', dataIndex: 'cong', align: 'right' },
  { title: 'Muộn', dataIndex: 'lateMin', align: 'right' },
  { title: 'Sớm', dataIndex: 'earlyMin', align: 'right' },
  { title: 'OT đề xuất', dataIndex: 'otProposed', align: 'right' },
  { title: 'OT duyệt', dataIndex: 'otApproved', align: 'right' },
];

type DayCheckPanelProps = { date: string; rows: DayRow[] };

/** Màn tạm chỉ đọc để đối chiếu ngày công với tính tay; Bảng công thật làm ở Sprint 3. */
export function DayCheckPanel({ date, rows }: DayCheckPanelProps) {
  const router = useRouter();
  const go = (next: string) => router.push(`/app/bang-cong?date=${next}`);

  return (
    <Card style={{ boxShadow: tokens.shadowCard }}>
      <Flex wrap gap={8} align="center" style={{ marginBottom: 16 }}>
        <Button onClick={() => go(addDays(date, -1))}>Hôm trước</Button>
        <DatePicker
          allowClear={false}
          format="DD/MM/YYYY"
          aria-label="Chọn ngày"
          value={dayjs(date)}
          onChange={(value) => go(value.format(DATE_FORMAT))}
        />
        <Button onClick={() => go(addDays(date, 1))}>Hôm sau</Button>
      </Flex>
      <Table
        rowKey={({ employeeId, shiftId }) => `${employeeId}-${shiftId}`}
        columns={COLUMNS}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Ngày này chưa có ngày công' }}
      />
    </Card>
  );
}
