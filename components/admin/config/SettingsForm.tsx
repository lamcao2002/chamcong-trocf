'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Checkbox, Col, Form, Input, InputNumber, Radio, Row, Space, Switch } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { UnsavedBar } from '@/components/common/UnsavedBar';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { inviteLink } from '@/lib/domain/invite';
import { WEEK_DAYS } from '@/lib/format';
import type { CompanyView } from '@/lib/services/company';
import { tokens } from '@/lib/theme/tokens';
import { companyPatchSchema, type CompanyInput } from '@/lib/validation/company';
import { fieldErrors } from '@/lib/validation/common';

const FIELDS = [
  'name',
  'address',
  'appName',
  'workDays',
  'graceMode',
  'otBefore',
  'otMin',
  'otFromRequest',
  'cutoffDay',
  'deviceBinding',
] as const satisfies readonly (keyof CompanyInput)[];

function pickValues(company: CompanyView): CompanyInput {
  return Object.fromEntries(FIELDS.map((field) => [field, company[field]])) as CompanyInput;
}

/** So sánh theo giá trị sẽ lưu: ô trống bằng null, thứ tự ngày không quan trọng. */
function normalized(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify([...(value as number[])].sort());
  return JSON.stringify(value === '' || value === undefined ? null : value);
}

export function SettingsForm({ company }: { company: CompanyView }) {
  const router = useRouter();
  const toast = useToast();
  const [form] = Form.useForm<CompanyInput>();
  const [saved, setSaved] = useState(() => pickValues(company));
  const [changed, setChanged] = useState<(keyof CompanyInput)[]>([]);
  const [saving, setSaving] = useState(false);
  const [origin] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin));
  const link = useMemo(() => inviteLink(origin, company.code), [origin, company.code]);

  const refreshChanged = (edited: Partial<CompanyInput>) => {
    form.setFields(Object.keys(edited).map((name) => ({ name, errors: [] })) as never);
    const values = form.getFieldsValue(true) as CompanyInput;
    setChanged(FIELDS.filter((field) => normalized(values[field]) !== normalized(saved[field])));
  };

  const discard = () => {
    form.setFieldsValue(saved);
    form.setFields(FIELDS.map((name) => ({ name, errors: [] })));
    setChanged([]);
  };

  const save = async () => {
    const values = form.getFieldsValue(true) as CompanyInput;
    const patch = Object.fromEntries(changed.map((field) => [field, values[field]]));
    const parsed = companyPatchSchema.safeParse(patch);
    if (!parsed.success) {
      const errors = fieldErrors(parsed.error);
      form.setFields(
        Object.keys(errors).map((name) => ({ name: name as keyof CompanyInput, errors: [errors[name]!] })),
      );
      return;
    }

    setSaving(true);
    const result = await apiRequest('/api/v1/company', 'PATCH', patch);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSaved({ ...values, ...parsed.data });
    setChanged([]);
    toast.success('Đã lưu cài đặt.');
    router.refresh();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Đã chép link cài app.');
    } catch {
      toast.error('Không chép được, hãy chọn link rồi chép tay.');
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      initialValues={saved}
      onValuesChange={refreshChanged}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <Card title="Thông tin công ty" style={{ boxShadow: tokens.shadowCard }}>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item label="Tên công ty" name="name">
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Tên app" name="appName" extra="Hiện trên app nhân viên.">
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label="Địa chỉ" name="address">
              <Input />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card title="Link cài app nhân viên" style={{ boxShadow: tokens.shadowCard }}>
        <p>
          Mã công ty: <strong>{company.code}</strong>
        </p>
        <Space.Compact style={{ width: '100%' }}>
          <Input value={link} readOnly aria-label="Link cài app" />
          <Button icon={<CopyOutlined />} onClick={() => void copyLink()}>
            Chép link
          </Button>
        </Space.Compact>
      </Card>

      <Card title="Quy tắc chấm công" style={{ boxShadow: tokens.shadowCard }}>
        <Form.Item label="Ngày làm việc trong tuần" name="workDays">
          <Checkbox.Group options={WEEK_DAYS} />
        </Form.Item>
        <Form.Item label="Cách tính phút muộn" name="graceMode">
          <Radio.Group
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            options={[
              {
                value: 'toan_bo',
                label: 'Tính cả số phút muộn (cho phép 5 phút, vào muộn 14 phút → tính muộn 14 phút)',
              },
              {
                value: 'phan_vuot',
                label: 'Chỉ tính phần vượt (cho phép 5 phút, vào muộn 14 phút → tính muộn 9 phút)',
              },
            ]}
          />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item label="Tính OT khi đến sớm trước giờ vào ca" name="otBefore" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Tự xác nhận OT theo đơn đã duyệt" name="otFromRequest" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Số phút tối thiểu để tính OT" name="otMin">
              <InputNumber min={0} max={600} addonAfter="phút" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="Ngày chốt kỳ lương"
              name="cutoffDay"
              extra={
                company.cutoffLocked ? 'Đã có kỳ công bố nên không đổi được.' : 'Để trống là tròn tháng.'
              }
            >
              <InputNumber min={1} max={31} disabled={company.cutoffLocked} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card title="Chống chấm hộ" style={{ boxShadow: tokens.shadowCard }}>
        <Form.Item
          label="Gắn thiết bị"
          name="deviceBinding"
          valuePropName="checked"
          extra="Mỗi tài khoản chỉ chấm công được trên điện thoại đã chấm lần đầu. Đổi máy thì Nhân sự bấm Mở khoá máy trong hồ sơ. Nên thử trên iPhone và Android của quán trước khi bật."
        >
          <Switch />
        </Form.Item>
      </Card>

      <UnsavedBar
        count={changed.length}
        saveLabel="Lưu cài đặt"
        saving={saving}
        onSave={() => void save()}
        onDiscard={discard}
      />
    </Form>
  );
}
