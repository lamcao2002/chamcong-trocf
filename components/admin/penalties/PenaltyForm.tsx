'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Drawer, Flex, Form, Grid, Input, InputNumber, Select, Typography } from 'antd';
import { MoneyInput } from '@/components/admin/config/MoneyInput';
import { FormDrawer } from '@/components/common/FormDrawer';
import { useCrudDrawer } from '@/components/common/useCrudDrawer';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { vietnamToday } from '@/lib/domain/date';
import {
  evidenceLine,
  extraNote,
  MAX_SCARS,
  MIN_PENALTY_NOTE,
  OTHER_RULE,
  penaltyValueLabel,
  type PenaltyEvidence,
} from '@/lib/domain/penalties';
import { formatClock, formatDate } from '@/lib/format';
import type { PenaltyListView, PenaltyRuleView } from '@/lib/services/penalties';
import { themeCssVars, tokens } from '@/lib/theme/tokens';
import { penaltySchema, type PenaltyInput } from '@/lib/validation/penalty';
import { DayAttendance, parseAttach } from './AttendanceIssues';
import styles from './penalties.module.css';

/** Giá trị của mục Khác trong ô chọn quy định; gửi lên là `ruleId: null`. */
const OTHER = 'other';

type FormValues = Omit<PenaltyInput, 'ruleId' | 'shiftId' | 'issue'> & {
  ruleId: string;
  /** Lỗi chấm công gắn vào phiếu, `shiftId|issue`; rỗng là không gắn. */
  attach: string;
};

/** Điền sẵn khi mở form: người, ngày, lỗi chấm công (`shiftId|issue`). */
export type PenaltyPrefill = { employeeId?: string; date?: string; attach?: string };

type PenaltyFormOptions = {
  rules: readonly PenaltyRuleView[];
  staff: readonly { id: string; name: string }[];
  /** Link "Xem tab Quy định" khi chưa có quy định; bỏ trống thì dẫn sang trang Phạt. */
  onOpenRules?: () => void;
  onSaved?: () => void;
};

/**
 * Form Phạt nhân viên dùng chung cho trang Phạt và drawer ngày ở Bảng công. Chọn lỗi chấm công thì
 * ghi chú được điền sẵn dòng bằng chứng; người dùng đã tự sửa ghi chú thì không ghi đè.
 */
export function usePenaltyForm({ rules, staff, onOpenRules, onSaved }: PenaltyFormOptions) {
  const router = useRouter();
  const drawer = useCrudDrawer<FormValues>({
    baseUrl: '/api/v1/penalties',
    schema: penaltySchema,
    label: 'phiếu phạt',
    toBody: ({ ruleId, attach, ...values }) => ({
      ...values,
      ...parseAttach(attach),
      ruleId: ruleId === OTHER ? null : ruleId,
      otherReason: ruleId === OTHER ? values.otherReason : null,
      scars: values.scars ?? 0,
      amount: values.amount ?? 0,
    }),
    onSaved,
  });
  const ruleId = Form.useWatch('ruleId', { form: drawer.form, preserve: true }) as string | undefined;
  const employeeId = Form.useWatch('employeeId', drawer.form) as string | undefined;
  const date = Form.useWatch('date', drawer.form) as string | undefined;
  const autoNote = useRef('');

  const start = ({ employeeId, date, attach = '' }: PenaltyPrefill = {}) => {
    autoNote.current = '';
    drawer.openWith({
      employeeId,
      date: date ?? vietnamToday(),
      attach,
      ruleId: rules[0]?.id ?? OTHER,
      scars: rules[0]?.scars ?? 1,
      amount: rules[0]?.amount ?? 0,
      note: '',
    });
  };

  const fillNote = (evidence: PenaltyEvidence | null) => {
    const note = (drawer.form.getFieldValue('note') as string | undefined) ?? '';
    if (note.trim() && note !== autoNote.current) return;
    autoNote.current = evidence ? evidenceLine(evidence) : '';
    drawer.form.setFieldValue('note', autoNote.current);
  };

  // Chọn quy định thì điền sẵn sẹo và tiền của quy định đó; vẫn sửa được cho lần này
  const handleValuesChange = (changed: Partial<FormValues>) => {
    drawer.handleValuesChange(changed);
    // Đổi người hoặc ngày thì lỗi đã chọn không còn đúng
    if (changed.employeeId !== undefined || changed.date !== undefined) {
      drawer.form.setFieldValue('attach', '');
      fillNote(null);
    }
    if (changed.ruleId === undefined) return;
    const rule = rules.find(({ id }) => id === changed.ruleId);
    if (rule) drawer.form.setFieldsValue({ scars: rule.scars, amount: rule.amount });
  };

  const openRules = onOpenRules ?? (() => router.push('/app/phat?tab=quy-dinh'));

  const element = (
    <FormDrawer
      open={drawer.open}
      title="Phạt nhân viên"
      dirty={drawer.dirty}
      saving={drawer.saving}
      submitLabel="Ghi phiếu phạt"
      onClose={drawer.close}
      onSubmit={() => void drawer.submit()}
    >
      <Form
        form={drawer.form}
        layout="vertical"
        requiredMark={false}
        initialValues={drawer.initialValues}
        onValuesChange={handleValuesChange}
      >
        <Form.Item label="Nhân viên" name="employeeId">
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn nhân viên"
            options={staff.map(({ id, name }) => ({ value: id, label: name }))}
          />
        </Form.Item>
        <Form.Item label="Ngày vi phạm" name="date">
          <Input type="date" max={vietnamToday()} />
        </Form.Item>
        <Form.Item
          label="Chấm công ngày này"
          name="attach"
          extra="Gắn với một lỗi thì giờ chấm công được lưu vào phiếu làm bằng chứng."
        >
          <DayAttendance employeeId={employeeId} date={date} onPick={fillNote} />
        </Form.Item>
        <Form.Item
          label="Quy định"
          name="ruleId"
          extra={
            rules.length === 0 ? (
              <>
                Chưa có quy định nào.{' '}
                <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={openRules}>
                  Xem tab Quy định
                </Button>
              </>
            ) : null
          }
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={[
              ...rules.map((rule) => ({
                value: rule.id,
                label: `${rule.name} (${penaltyValueLabel(rule)})`,
              })),
              { value: OTHER, label: `${OTHER_RULE} (tự ghi lý do)` },
            ]}
          />
        </Form.Item>
        {ruleId === OTHER ? (
          <Form.Item label="Lý do phạt" name="otherReason">
            <Input maxLength={120} placeholder="VD: Bỏ ca không báo trước" />
          </Form.Item>
        ) : null}
        <Flex gap={12} wrap>
          <Form.Item label="Số sẹo" name="scars" style={{ flex: '1 1 120px' }}>
            <InputNumber min={0} max={MAX_SCARS} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Tiền phạt" name="amount" style={{ flex: '2 1 180px' }}>
            <MoneyInput />
          </Form.Item>
        </Flex>
        <Form.Item
          label="Bằng chứng / chú thích"
          name="note"
          extra={`Bắt buộc, ít nhất ${MIN_PENALTY_NOTE} ký tự: chuyện gì, lúc nào, ai chứng kiến. Nhân viên đọc được ghi chú này.`}
        >
          <Input.TextArea rows={4} maxLength={1000} />
        </Form.Item>
      </Form>
      <p className={styles.muted}>Tiền phạt không tự trừ lương.</p>
    </FormDrawer>
  );

  return { start, element };
}

/** Xem một phiếu phạt; người đã phạt hoặc Quản trị viên huỷ được, phải ghi lý do. */
type Penalty = PenaltyListView['penalties'][number];

type PenaltyDrawerProps = {
  penalty: Pick<
    Penalty,
    | 'id'
    | 'employeeName'
    | 'ruleName'
    | 'date'
    | 'scars'
    | 'amount'
    | 'note'
    | 'evidence'
    | 'byName'
    | 'cancelledAt'
    | 'cancelledByName'
    | 'cancelReason'
    | 'cancellable'
  > | null;
  onClose: () => void;
  onChanged?: () => void;
};

export function PenaltyDrawer({ penalty, onClose, onChanged }: PenaltyDrawerProps) {
  const desktop = Grid.useBreakpoint().lg ?? false;
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const close = () => {
    setReason('');
    setError(undefined);
    onClose();
  };

  const cancel = async () => {
    if (!penalty) return;
    if (!reason.trim()) {
      setError('Ghi lý do huỷ');
      return;
    }
    setSaving(true);
    const result = await apiRequest(`/api/v1/penalties/${penalty.id}/cancel`, 'POST', { reason });
    setSaving(false);
    if (!result.ok) {
      setError(result.fields?.reason);
      toast.error(result.error);
      return;
    }
    toast.success('Đã huỷ phiếu phạt');
    close();
    onChanged?.();
    router.refresh();
  };

  return (
    <Drawer
      open={penalty !== null}
      title={penalty ? `Phiếu phạt: ${penalty.employeeName}` : ''}
      placement={desktop ? 'right' : 'bottom'}
      width={desktop ? tokens.formDrawerWidth : '100%'}
      height="100%"
      rootStyle={themeCssVars()}
      destroyOnHidden
      onClose={close}
    >
      {penalty ? (
        <>
          {penalty.cancelledAt ? (
            <div className={styles.cancelBox}>
              <strong>Đã huỷ</strong>
              <span>
                {penalty.cancelledByName ?? 'Người đã nghỉ'} huỷ lúc {formatClock(penalty.cancelledAt)}{' '}
                {formatDate(vietnamToday(new Date(penalty.cancelledAt)))}: {penalty.cancelReason}
              </span>
            </div>
          ) : null}
          <dl className={styles.detail}>
            <dt>Vi phạm</dt>
            <dd>{penalty.ruleName}</dd>
            <dt>Ngày</dt>
            <dd>{formatDate(penalty.date)}</dd>
            <dt>Mức phạt</dt>
            <dd className={penalty.cancelledAt ? styles.struck : undefined}>{penaltyValueLabel(penalty)}</dd>
            {penalty.evidence ? (
              <>
                <dt>Chấm công</dt>
                <dd>{evidenceLine(penalty.evidence)}</dd>
              </>
            ) : null}
            {extraNote(penalty) ? (
              <>
                <dt>Bằng chứng</dt>
                <dd className={styles.note}>{penalty.note}</dd>
              </>
            ) : null}
            <dt>Người phạt</dt>
            <dd>{penalty.byName ?? 'Người đã nghỉ'}</dd>
          </dl>
          {penalty.cancellable ? (
            <>
              <Typography.Title level={5}>Huỷ phiếu phạt</Typography.Title>
              <Typography.Paragraph type="secondary">
                Phiếu vẫn giữ lại, không tính sẹo và tiền nữa. Nhân viên nhận thông báo kèm lý do.
              </Typography.Paragraph>
              <Input.TextArea
                aria-label="Lý do huỷ"
                rows={2}
                maxLength={300}
                status={error ? 'error' : undefined}
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setError(undefined);
                }}
                placeholder="VD: Nhầm người, đã có lý do chính đáng"
              />
              {error ? <div className={styles.error}>{error}</div> : null}
              <Button danger loading={saving} onClick={() => void cancel()} style={{ marginTop: 8 }}>
                Huỷ phạt
              </Button>
            </>
          ) : null}
        </>
      ) : null}
    </Drawer>
  );
}
