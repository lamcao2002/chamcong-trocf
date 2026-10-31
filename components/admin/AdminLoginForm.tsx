'use client';

import { useRef, useState } from 'react';
import { Alert, Button, Form, Input, type InputRef } from 'antd';
import type { ZodType } from 'zod';
import { loginSchema, type LoginInput } from '@/lib/validation/auth';

const CONNECTION_ERROR = 'Không kết nối được, vui lòng thử lại';

/** Dùng lại schema của API cho từng trường, tránh hai bộ luật lệch nhau. */
function matches(schema: ZodType, message: string) {
  return {
    validator: async (_rule: unknown, value: unknown) => {
      if (!schema.safeParse(value ?? '').success) throw new Error(message);
    },
  };
}

export function AdminLoginForm() {
  const [form] = Form.useForm<LoginInput>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const pinInput = useRef<InputRef>(null);

  const submit = async (values: LoginInput) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const response = await fetch('/api/v1/auth/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (response.ok) {
        // Tải lại hẳn để không còn dữ liệu cache của phiên trước; replace để Back không về màn này
        window.location.replace('/app');
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? CONNECTION_ERROR);
      form.setFieldValue('pin', '');
      pinInput.current?.focus();
    } catch {
      setError(CONNECTION_ERROR);
    }
    setSubmitting(false);
  };

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => void submit(values)}>
      <Form.Item
        label="Mã công ty"
        name="companyCode"
        rules={[matches(loginSchema.shape.companyCode, 'Nhập mã công ty')]}
      >
        <Input placeholder="VD: PHONHO" autoComplete="organization" autoCapitalize="characters" autoFocus />
      </Form.Item>
      <Form.Item label="Email" name="email" rules={[matches(loginSchema.shape.email, 'Nhập email hợp lệ')]}>
        <Input type="email" placeholder="ten@congty.vn" autoComplete="username" />
      </Form.Item>
      <Form.Item label="Mã PIN" name="pin" rules={[matches(loginSchema.shape.pin, 'Mã PIN gồm 4–8 chữ số')]}>
        <Input.Password ref={pinInput} inputMode="numeric" maxLength={8} autoComplete="current-password" />
      </Form.Item>
      {error ? (
        <Alert type="error" message={error} showIcon role="alert" style={{ marginBottom: 16 }} />
      ) : null}
      <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
        Đăng nhập
      </Button>
    </Form>
  );
}
