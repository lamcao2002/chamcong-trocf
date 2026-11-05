'use client';

import { useEffect, useState } from 'react';
import { Flex, Form, Input, InputNumber, Segmented, Skeleton, Switch, Typography } from 'antd';
import { FormDrawer } from '@/components/common/FormDrawer';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { MAX_PAY_FACTOR } from '@/lib/domain/approval';
import { dayStatusLabel, formatDecimal } from '@/lib/format';
import type { DayDetail } from '@/lib/services/day';

export type AdjustTarget = {
  employeeId: string;
  date: string;
  shiftId: string | null;
  title: string;
  onSaved: () => void;
};

type Values = {
  cong: string;
  /** Giờ OT đã duyệt, âm là trừ giờ; NULL = chưa quyết định, OT chờ vẫn chờ. */
  otHours: number | null;
  /** NULL = mặc định 1. */
  payFactor: number | null;
  approveMissing: boolean;
  waiveLate: boolean;
  waiveEarly: boolean;
};

/** Khớp giới hạn ±1440 phút của `approvalSchema.otMinutes`. */
const MAX_OT_HOURS = 24;

const CONG_OPTIONS = [
  { value: 'system', label: 'Theo hệ thống' },
  { value: '1', label: '1' },
  { value: '0.5', label: '0,5' },
  { value: '0', label: '0' },
];

const EMPTY: Values = {
  cong: 'system',
  otHours: 0,
  payFactor: null,
  approveMissing: false,
  waiveLate: false,
  waiveEarly: false,
};

const toHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/**
 * Ô giờ OT mặc định 0. Ca còn OT chờ duyệt thì để trống: lưu quyết định khác không vô tình chốt OT
 * thành 0, gõ 0 mới là không tính OT.
 */
function initialOtHours(detail: DayDetail, shiftId: string | null, otMinutes: number | null) {
  if (otMinutes !== null) return toHours(otMinutes);
  const record = detail.records.find((row) => row.shiftId === shiftId);
  if (record?.otState === 'cho_duyet') return null;
  return toHours(record?.otApproved ?? 0);
}

function initialValues(detail: DayDetail, shiftId: string | null): Values {
  const approval = detail.approvals.find((row) => row.shiftId === shiftId);
  if (!approval) return { ...EMPTY, otHours: initialOtHours(detail, shiftId, null) };
  return {
    cong: approval.congOverride === null ? 'system' : String(approval.congOverride),
    otHours: initialOtHours(detail, shiftId, approval.otMinutes),
    payFactor: approval.payFactor,
    approveMissing: approval.approveMissing,
    waiveLate: approval.waiveLate,
    waiveEarly: approval.waiveEarly,
  };
}

/** Chỉ gửi trường đã đổi: quyết định khác trong bản ghi duyệt được giữ nguyên. */
function changes(before: Values, after: Values) {
  return {
    ...(after.cong === before.cong
      ? {}
      : { congOverride: after.cong === 'system' ? null : Number(after.cong) }),
    ...(after.otHours === before.otHours
      ? {}
      : { otMinutes: after.otHours === null ? null : Math.round(after.otHours * 60) }),
    ...(after.payFactor === before.payFactor ? {} : { payFactor: after.payFactor }),
    ...(after.approveMissing === before.approveMissing ? {} : { approveMissing: after.approveMissing }),
    ...(after.waiveLate === before.waiveLate ? {} : { waiveLate: after.waiveLate }),
    ...(after.waiveEarly === before.waiveEarly ? {} : { waiveEarly: after.waiveEarly }),
  };
}

type AdjustDrawerProps = { target: AdjustTarget | null; onClose: () => void };

/** Điều chỉnh khác: số công, giờ OT, hệ số lương, duyệt thiếu giờ, tha muộn/sớm, ghi chú (US26, US28). */
export function AdjustDrawer({ target, onClose }: AdjustDrawerProps) {
  const toast = useToast();
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [before, setBefore] = useState<Values>(EMPTY);
  const [values, setValues] = useState<Values>(EMPTY);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setDetail(null);
    setNote('');
    void apiRequest<{ day: DayDetail }>(`/api/v1/day/${target.employeeId}/${target.date}`, 'GET').then(
      (result) => {
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const initial = initialValues(result.day, target.shiftId);
        setDetail(result.day);
        setBefore(initial);
        setValues(initial);
      },
    );
  }, [target, toast]);

  const changed = changes(before, values);
  const dirty = Object.keys(changed).length > 0;
  const record = detail?.records.find(({ shiftId }) => shiftId === target?.shiftId);
  const set = (patch: Partial<Values>) => setValues((current) => ({ ...current, ...patch }));

  const save = async () => {
    if (!target) return;
    const { employeeId, date, shiftId, onSaved } = target;
    setSaving(true);
    const result = await apiRequest('/api/v1/approvals', 'POST', {
      employeeId,
      date,
      shiftId,
      ...changed,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onClose();
    onSaved();
  };

  return (
    <FormDrawer
      open={target !== null}
      title={target?.title ?? ''}
      dirty={dirty}
      saving={saving}
      submitLabel="Lưu duyệt"
      submitDisabled={!dirty}
      onClose={onClose}
      onSubmit={() => void save()}
    >
      {detail ? (
        <Form layout="vertical" requiredMark={false}>
          {record ? (
            <Typography.Paragraph type="secondary">
              Hệ thống ghi nhận: {dayStatusLabel(record.status)} · {String(record.cong).replace('.', ',')}{' '}
              công
              {record.otProposed > 0 ? ` · OT đề xuất ${formatDecimal(toHours(record.otProposed))} giờ` : ''}
              {record.payFactor === 1 ? '' : ` · hệ số ${String(record.payFactor).replace('.', ',')}`}
            </Typography.Paragraph>
          ) : null}
          <Form.Item label="Số công">
            <Segmented options={CONG_OPTIONS} value={values.cong} onChange={(cong) => set({ cong })} />
          </Form.Item>
          <Form.Item
            label="Số giờ OT được duyệt"
            extra="Nhập được số thập phân (1,5 = 1 giờ 30 phút) và số âm để trừ giờ. Để trống là chưa quyết định."
          >
            <InputNumber
              min={-MAX_OT_HOURS}
              max={MAX_OT_HOURS}
              step={0.5}
              decimalSeparator=","
              placeholder="0"
              addonAfter="giờ"
              style={{ width: '100%' }}
              aria-label="Số giờ OT được duyệt"
              value={values.otHours}
              onChange={(otHours) => set({ otHours })}
            />
          </Form.Item>
          <Form.Item
            label="Hệ số lương"
            extra="Nhân cả giờ ca và giờ OT, chỉ áp cho nhân viên lương giờ. Để trống là 1."
          >
            <InputNumber
              min={0}
              max={MAX_PAY_FACTOR}
              step={0.5}
              decimalSeparator=","
              placeholder="1"
              style={{ width: '100%' }}
              aria-label="Hệ số lương"
              value={values.payFactor}
              onChange={(payFactor) => set({ payFactor })}
            />
          </Form.Item>
          {(
            [
              ['approveMissing', 'Duyệt thiếu giờ'],
              ['waiveLate', 'Tha muộn'],
              ['waiveEarly', 'Tha về sớm'],
            ] as const
          ).map(([field, label]) => (
            <Flex key={field} justify="space-between" align="center" style={{ marginBottom: 16 }}>
              <span>{label}</span>
              <Switch aria-label={label} checked={values[field]} onChange={(on) => set({ [field]: on })} />
            </Flex>
          ))}
          <Form.Item label="Ghi chú">
            <Input.TextArea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Form.Item>
        </Form>
      ) : (
        <Skeleton active />
      )}
    </FormDrawer>
  );
}
