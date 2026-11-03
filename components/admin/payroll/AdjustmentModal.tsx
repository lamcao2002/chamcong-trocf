'use client';

import { useState } from 'react';
import { Form, Input, Modal, Segmented, Typography } from 'antd';
import { MoneyInput } from '@/components/admin/config/MoneyInput';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';

type AdjustmentModalProps = {
  open: boolean;
  employeeId: string;
  employeeName: string;
  periodKey: string;
  onClose: () => void;
  onSaved: () => void;
};

const required = [{ required: true, message: 'Trường này là bắt buộc' }];

/** Thêm thưởng/phạt cho kỳ đang xem; khoản này cộng trừ thẳng vào thực lĩnh (US35). */
export function AdjustmentModal({
  open,
  employeeId,
  employeeName,
  periodKey,
  onClose,
  onSaved,
}: AdjustmentModalProps) {
  const toast = useToast();
  const [form] = Form.useForm();
  const [kind, setKind] = useState<'bonus' | 'penalty'>('bonus');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const values = (await form.validateFields().catch(() => null)) as { amount: number; note: string } | null;
    if (!values) return;
    setSaving(true);
    const result = await apiRequest('/api/v1/adjustments', 'POST', {
      employeeId,
      periodKey,
      kind,
      ...values,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      form.setFields(
        Object.entries(result.fields ?? {}).map(([name, message]) => ({ name, errors: [message] })),
      );
      return;
    }
    toast.success(kind === 'bonus' ? 'Đã thêm thưởng' : 'Đã thêm phạt');
    form.resetFields();
    onClose();
    onSaved();
  };

  return (
    <Modal
      open={open}
      title="Thêm thưởng / phạt"
      okText="Lưu"
      cancelText="Huỷ"
      confirmLoading={saving}
      destroyOnHidden
      onCancel={onClose}
      onOk={() => void save()}
    >
      <Typography.Paragraph type="secondary">
        {employeeName}, kỳ {periodKey}. Khoản này cộng trừ thẳng vào thực lĩnh.
      </Typography.Paragraph>
      <Segmented
        block
        value={kind}
        options={[
          { value: 'bonus', label: 'Thưởng (+)' },
          { value: 'penalty', label: 'Phạt (−)' },
        ]}
        onChange={setKind}
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical" requiredMark={false} preserve={false}>
        <Form.Item
          label="Số tiền"
          name="amount"
          rules={[...required, { type: 'number', min: 1, message: 'Số tiền phải lớn hơn 0' }]}
        >
          <MoneyInput />
        </Form.Item>
        <Form.Item label="Lý do" name="note" rules={required}>
          <Input.TextArea rows={2} maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
