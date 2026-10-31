'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, type FormInstance } from 'antd';
import type { ZodType } from 'zod';
import { apiRequest } from '@/lib/api/client';
import { fieldErrors } from '@/lib/validation/common';
import { useConfirmDiscard } from './useConfirmDiscard';
import { useToast } from './useToast';

type CrudOptions<Values> = {
  baseUrl: string;
  /** Schema dùng chung với API. */
  schema: ZodType;
  /** Chữ trong toast, vd "ca", "vị trí". */
  label: string;
  /** Sửa trước khi gửi, vd bỏ các trường chỉ dùng trên form. */
  toBody?: (values: Values, editingId: string | undefined) => unknown;
  onSaved?: (result: Record<string, unknown>, values: Values, isNew: boolean) => void;
};

function showFieldErrors(form: FormInstance, fields: Record<string, string>) {
  const names = Object.keys(fields);
  form.setFields(names.map((name) => ({ name: name.split('.'), errors: [fields[name]!] })));
  if (names[0]) form.scrollToField(names[0].split('.'));
}

/** Trạng thái chung của drawer thêm/sửa: kiểm tra bằng zod, gọi API, báo lỗi cạnh trường, tải lại dữ liệu. */
export function useCrudDrawer<Values extends object>({
  baseUrl,
  schema,
  label,
  toBody,
  onSaved,
}: CrudOptions<Values>) {
  const [form] = Form.useForm<Values>();
  const router = useRouter();
  const toast = useToast();
  const confirmDiscard = useConfirmDiscard();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [initialValues, setInitialValues] = useState<Partial<Values>>();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const openWith = (values: Partial<Values>, id?: string) => {
    // Kho dữ liệu của form sống lâu hơn drawer: phải xoá, không thì form mới mang giá trị lần trước
    const leftovers = Object.keys(form.getFieldsValue(true) as object);
    if (leftovers.length > 0) {
      form.setFieldsValue({
        ...Object.fromEntries(leftovers.map((key) => [key, undefined])),
        ...values,
      } as Parameters<typeof form.setFieldsValue>[0]);
    }
    setInitialValues(values);
    setEditingId(id);
    setDirty(false);
    setOpen(true);
  };

  /** Lỗi gán tay không tự mất như lỗi từ `rules`: xoá khi người dùng sửa trường đó. */
  const handleValuesChange = (changed: object) => {
    setDirty(true);
    form.setFields(Object.keys(changed).map((name) => ({ name, errors: [] })) as never);
  };

  const close = () => {
    setOpen(false);
    setDirty(false);
  };

  const submit = async () => {
    const values = form.getFieldsValue(true) as Values;
    const body = toBody ? toBody(values, editingId) : values;
    form.setFields(form.getFieldsError().map(({ name }) => ({ name, errors: [] })) as never);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      showFieldErrors(form, fieldErrors(parsed.error));
      return;
    }

    setSaving(true);
    const result = await apiRequest<Record<string, unknown>>(
      editingId ? `${baseUrl}/${editingId}` : baseUrl,
      editingId ? 'PATCH' : 'POST',
      body,
    );
    setSaving(false);

    if (!result.ok) {
      if (result.fields) showFieldErrors(form, result.fields);
      toast.error(result.error);
      return;
    }
    close();
    toast.success(`Đã lưu ${label}.`);
    onSaved?.(result, values, !editingId);
    router.refresh();
  };

  const remove = async (id: string, name: string) => {
    if (!(await confirmDiscardOf(name))) return;
    const result = await apiRequest(`${baseUrl}/${id}`, 'DELETE');
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    close();
    toast.success(`Đã xoá ${label}.`);
    router.refresh();
  };

  const confirmDiscardOf = (name: string) => confirmDiscard({ title: `Xoá ${name}?`, okText: 'Xoá' });

  return {
    form,
    open,
    editingId,
    initialValues,
    dirty,
    saving,
    openWith,
    close,
    submit,
    remove,
    markDirty: () => setDirty(true),
    handleValuesChange,
  };
}
