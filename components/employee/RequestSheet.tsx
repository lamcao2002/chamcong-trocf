'use client';

import { useEffect, useState } from 'react';
import { Form, Input, Radio, Segmented, Select, Typography } from 'antd';
import { FormDrawer } from '@/components/common/FormDrawer';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { formatDecimal } from '@/lib/format';
import type { AppHome } from '@/lib/services/attendance';

type RequestType = 'leave' | 'forgot' | 'overtime';
type Balance = { total: number; used: number; remaining: number };

const TYPES: { value: RequestType; label: string }[] = [
  { value: 'leave', label: 'Nghỉ phép' },
  { value: 'forgot', label: 'Quên chấm' },
  { value: 'overtime', label: 'Làm thêm' },
];

const LEAVE_TYPES = [
  { value: 'annual', label: 'Phép năm' },
  { value: 'sick', label: 'Nghỉ ốm' },
  { value: 'unpaid', label: 'Không lương' },
];

const required = [{ required: true, message: 'Trường này là bắt buộc' }];

type RequestSheetProps = {
  open: boolean;
  choices: AppHome['choices'];
  onClose: () => void;
};

/** Sheet Tạo đơn: nghỉ phép, quên chấm, làm thêm (US29–US31). Quy tắc chặn nằm ở server. */
export function RequestSheet({ open, choices, onClose }: RequestSheetProps) {
  const toast = useToast();
  const [form] = Form.useForm();
  const [type, setType] = useState<RequestType>('leave');
  const [balance, setBalance] = useState<Balance | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDirty(false);
    void apiRequest<{ balance: Balance }>('/api/v1/app/requests', 'GET').then((result) => {
      if (result.ok) setBalance(result.balance);
    });
  }, [open]);

  const submit = async () => {
    const values = (await form.validateFields().catch(() => null)) as Record<string, unknown> | null;
    if (!values) return;
    setSaving(true);
    const result = await apiRequest('/api/v1/app/requests', 'POST', { type, ...values });
    setSaving(false);
    if (result.ok) {
      toast.success('Đã gửi đơn');
      onClose();
      return;
    }
    toast.error(result.error);
    form.setFields(
      Object.entries(result.fields ?? {}).map(([name, message]) => ({ name, errors: [message] })),
    );
  };

  return (
    <FormDrawer
      open={open}
      title="Tạo đơn"
      dirty={dirty}
      saving={saving}
      submitLabel="Gửi đơn"
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      <Typography.Paragraph type="secondary">
        Gửi tới quản lý trực tiếp của bạn để duyệt.
      </Typography.Paragraph>
      <Segmented
        block
        options={TYPES}
        value={type}
        onChange={(value) => {
          form.resetFields();
          setType(value);
        }}
        style={{ marginBottom: 16 }}
      />
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        preserve={false}
        initialValues={{ leaveType: 'annual', when: 'after' }}
        onValuesChange={() => setDirty(true)}
      >
        {type === 'leave' ? (
          <>
            {balance ? (
              <Typography.Paragraph strong>
                Phép năm còn lại {formatDecimal(balance.remaining)}/{balance.total} ngày
              </Typography.Paragraph>
            ) : null}
            <Form.Item label="Loại nghỉ" name="leaveType" rules={required}>
              <Select options={LEAVE_TYPES} />
            </Form.Item>
            <Form.Item label="Từ ngày" name="fromDate" rules={required}>
              <Input type="date" />
            </Form.Item>
            <Form.Item label="Đến ngày" name="toDate" rules={required}>
              <Input type="date" />
            </Form.Item>
          </>
        ) : null}

        {type === 'forgot' ? (
          <>
            <Form.Item label="Ngày" name="date" rules={required}>
              <Input type="date" />
            </Form.Item>
            <Form.Item label="Ca" name="shiftId" rules={required}>
              <Select
                placeholder="Chọn ca"
                options={choices.map(({ id, name, startTime, endTime }) => ({
                  value: id,
                  label: `${name} · ${startTime}–${endTime}`,
                }))}
              />
            </Form.Item>
            <Form.Item label="Giờ vào thực tế" name="inTime" extra="Chỉ cần điền giờ bị thiếu.">
              <Input type="time" />
            </Form.Item>
            <Form.Item label="Giờ ra thực tế" name="outTime">
              <Input type="time" />
            </Form.Item>
          </>
        ) : null}

        {type === 'overtime' ? (
          <>
            <Form.Item label="Ngày" name="date" rules={required}>
              <Input type="date" />
            </Form.Item>
            <Form.Item label="Làm thêm" name="when" rules={required}>
              <Radio.Group
                options={[
                  { value: 'before', label: 'Trước ca' },
                  { value: 'after', label: 'Sau ca' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Từ giờ" name="from" rules={required}>
              <Input type="time" />
            </Form.Item>
            <Form.Item label="Đến giờ" name="to" rules={required}>
              <Input type="time" />
            </Form.Item>
          </>
        ) : null}

        <Form.Item label={type === 'overtime' ? 'Việc cần làm thêm' : 'Lý do'} name="reason" rules={required}>
          <Input.TextArea rows={3} maxLength={500} />
        </Form.Item>
      </Form>
    </FormDrawer>
  );
}
