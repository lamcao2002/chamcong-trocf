'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Drawer, Flex, Grid, Skeleton, Tag, Typography } from 'antd';
import { AdjustDrawer, type AdjustTarget } from '@/components/admin/AdjustDrawer';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { dayStatusLabel, formatClock, formatDate, formatDecimal } from '@/lib/format';
import type { DayDetail } from '@/lib/services/day';
import { tokens } from '@/lib/theme/tokens';

export type DayTarget = { employeeId: string; name: string; date: string };

type DayDrawerProps = { target: DayTarget | null; onClose: () => void; onChanged: () => void };

/** Một ngày một người: lần chấm gốc, hệ thống tính, điều chỉnh, Hoàn duyệt (US28). */
export function DayDrawer({ target, onClose, onChanged }: DayDrawerProps) {
  const desktop = Grid.useBreakpoint().lg ?? false;
  const toast = useToast();
  const { modal } = App.useApp();
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [adjusting, setAdjusting] = useState<AdjustTarget | null>(null);

  const load = useCallback(
    async (day: DayTarget) => {
      const result = await apiRequest<{ day: DayDetail }>(`/api/v1/day/${day.employeeId}/${day.date}`, 'GET');
      if (result.ok) setDetail(result.day);
      else toast.error(result.error);
    },
    [toast],
  );

  useEffect(() => {
    setDetail(null);
    if (target) void load(target);
  }, [target, load]);

  const afterChange = () => {
    if (target) void load(target);
    onChanged();
  };

  const revoke = (approvalId: string) => {
    modal.confirm({
      title: 'Hoàn duyệt ngày này?',
      content: 'Ngày công trở về kết quả hệ thống, các quyết định của ca này bị thu hồi.',
      okText: 'Hoàn duyệt',
      okButtonProps: { danger: true },
      cancelText: 'Giữ lại',
      onOk: async () => {
        const result = await apiRequest(`/api/v1/approvals/${approvalId}`, 'DELETE');
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success('Đã hoàn duyệt');
        afterChange();
      },
    });
  };

  const shiftName = (shiftId: string | null) =>
    detail?.shifts.find(({ id }) => id === shiftId)?.name ?? 'Không gắn ca';

  return (
    <Drawer
      open={target !== null}
      title={target ? `${target.name} · ${formatDate(target.date)}` : ''}
      placement={desktop ? 'right' : 'bottom'}
      width={desktop ? tokens.formDrawerWidth : '100%'}
      height="92%"
      destroyOnHidden
      onClose={onClose}
    >
      {!detail ? (
        <Skeleton active />
      ) : (
        <Flex vertical gap={16}>
          {detail.records.length === 0 ? (
            <Typography.Text type="secondary">Ngày này không có ngày công.</Typography.Text>
          ) : null}
          {detail.records.map((record) => {
            const approval = detail.approvals.find(({ shiftId }) => shiftId === record.shiftId);
            return (
              <div key={record.shiftId ?? 'none'}>
                <Flex justify="space-between" align="center" gap={8}>
                  <Typography.Text strong>{shiftName(record.shiftId)}</Typography.Text>
                  <Tag color={record.needsReview ? 'warning' : 'default'}>
                    {dayStatusLabel(record.status)}
                  </Tag>
                </Flex>
                <Typography.Paragraph style={{ margin: '6px 0' }}>
                  Vào {record.inAt ? formatClock(record.inAt) : '—'} · Ra{' '}
                  {record.outAt ? formatClock(record.outAt) : '—'} · {record.workedMin} phút ·{' '}
                  {formatDecimal(record.cong)} công
                  <br />
                  Muộn {record.lateMin}p{record.waivedLate ? ' (đã tha)' : ''} · Sớm {record.earlyMin}p
                  {record.waivedEarly ? ' (đã tha)' : ''} · OT {record.otApproved}/{record.otProposed}p
                </Typography.Paragraph>
                <Flex wrap gap={8}>
                  <Button
                    onClick={() =>
                      setAdjusting({
                        employeeId: detail.employee.id,
                        date: detail.date,
                        shiftId: record.shiftId,
                        title: `${detail.employee.name} · ${formatDate(detail.date)}`,
                        onSaved: () => {
                          toast.success('Đã lưu duyệt');
                          afterChange();
                        },
                      })
                    }
                  >
                    Điều chỉnh
                  </Button>
                  {approval ? (
                    <Button danger onClick={() => revoke(approval.id)}>
                      Hoàn duyệt
                    </Button>
                  ) : null}
                </Flex>
              </div>
            );
          })}
          {detail.punches.length > 0 ? (
            <div>
              <Typography.Text strong>Lần chấm</Typography.Text>
              {detail.punches.map(({ at, type, inZone, synthetic }) => (
                <Typography.Paragraph key={`${String(at)}${type}`} style={{ margin: '4px 0 0' }}>
                  {type === 'in' ? 'Vào' : 'Ra'} {formatClock(at)}
                  {inZone === false ? ' · ngoài vùng' : ''}
                  {synthetic ? ' · từ đơn quên chấm' : ''}
                </Typography.Paragraph>
              ))}
            </div>
          ) : null}
        </Flex>
      )}
      <AdjustDrawer target={adjusting} onClose={() => setAdjusting(null)} />
    </Drawer>
  );
}
