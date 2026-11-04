'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Drawer, Form, Grid, Input, InputNumber, Radio, Select, Typography } from 'antd';
import { CloseOutlined, SendOutlined } from '@ant-design/icons';
import { useConfirmDiscard } from '@/components/common/useConfirmDiscard';
import { useLeaveGuard } from '@/components/common/useLeaveGuard';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { formatDecimal } from '@/lib/format';
import type { AppHome } from '@/lib/services/attendance';
import type { RegistrationView } from '@/lib/services/registrations';
import type { MyRequestView } from '@/lib/services/requests';
import { themeCssVars, tokens } from '@/lib/theme/tokens';
import { RegisterGrid } from './RegisterCard';
import { ForgotIcon, LateIcon, LeaveIcon, OvertimeIcon, RegisterIcon, SwapIcon } from './RequestIcons';
import styles from './EmployeeScreen.module.css';

type RequestType = 'leave' | 'forgot' | 'overtime' | 'late_early' | 'shift_swap' | 'shift_register';
type Balance = { total: number; used: number; remaining: number };

/** Màu nền và màu nét của biểu tượng từng loại, lấy từ màu ngữ nghĩa của theme. */
const TYPES: { value: RequestType; label: string; icon: ReactNode; tone: string }[] = [
  { value: 'leave', label: 'Nghỉ phép', icon: <LeaveIcon />, tone: 'warn' },
  { value: 'late_early', label: 'Muộn / sớm', icon: <LateIcon />, tone: 'warn' },
  { value: 'overtime', label: 'Làm thêm', icon: <OvertimeIcon />, tone: 'ot' },
  { value: 'shift_swap', label: 'Đổi ca', icon: <SwapIcon />, tone: 'info' },
  { value: 'shift_register', label: 'Đăng ký ca', icon: <RegisterIcon />, tone: 'brand' },
  { value: 'forgot', label: 'Quên chấm', icon: <ForgotIcon />, tone: 'danger' },
];

const LEAVE_TYPES = [
  { value: 'annual', label: 'Phép năm' },
  { value: 'sick', label: 'Nghỉ ốm' },
  { value: 'unpaid', label: 'Không lương' },
];

const required = [{ required: true, message: 'Trường này là bắt buộc' }];

/** Mở lại form từ đơn đã gửi: ngày nằm ở cột, chi tiết từng loại nằm trong `payload`. */
function formValuesOf({ type, payload, fromDate, toDate, reason }: MyRequestView): Record<string, unknown> {
  const base = { reason: reason ?? '' };
  if (type === 'leave') return { ...base, leaveType: payload.leaveType, fromDate, toDate };
  if (type === 'forgot') {
    return {
      ...base,
      date: fromDate,
      shiftId: payload.shiftId,
      inTime: payload.inTime ?? undefined,
      outTime: payload.outTime ?? undefined,
    };
  }
  if (type === 'overtime')
    return { ...base, date: fromDate, when: payload.when, from: payload.from, to: payload.to };
  if (type === 'late_early') {
    return {
      ...base,
      date: fromDate,
      kind: payload.kind,
      minutes: payload.minutes,
      shiftId: payload.shiftId ?? '',
    };
  }
  return {
    ...base,
    offDate: payload.offDate,
    offShiftId: payload.offShiftId,
    workDate: payload.workDate,
    workShiftId: payload.workShiftId,
  };
}

type RequestSheetProps = {
  open: boolean;
  choices: AppHome['choices'];
  brandColor: string | null;
  /** Đơn đang sửa từ tab Tôi; null là tạo đơn mới. */
  editing: MyRequestView | null;
  onClose: () => void;
  onSent: () => void;
};

/**
 * Sheet Tạo đơn: 6 loại đơn, Đăng ký ca chọn ngay trên lưới tuần sau (US29–US31, EMP-12, EMP-13).
 * Người ca cố định không có ô Đăng ký ca. Quy tắc chặn nằm ở server.
 */
export function RequestSheet({ open, choices, brandColor, editing, onClose, onSent }: RequestSheetProps) {
  const toast = useToast();
  const desktop = Grid.useBreakpoint().lg ?? false;
  const confirmDiscard = useConfirmDiscard();
  const asking = useRef(false);
  const [form] = Form.useForm();
  const [type, setType] = useState<RequestType>('leave');
  const [balance, setBalance] = useState<Balance | null>(null);
  const [registration, setRegistration] = useState<RegistrationView | null>(null);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [note, setNote] = useState('');
  const [formDirty, setFormDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const registering = type === 'shift_register';
  const dirty = registering ? picked.length > 0 || note.trim() !== '' : formDirty;
  useLeaveGuard(open && dirty);

  const loadRegistration = async () => {
    const result = await apiRequest<{ registration: RegistrationView | null }>(
      '/api/v1/app/shift-registrations',
      'GET',
    );
    if (result.ok) setRegistration(result.registration);
  };

  useEffect(() => {
    if (!open) return;
    setType(editing ? (editing.type as RequestType) : 'leave');
    setFormDirty(false);
    setPicked([]);
    setNote('');
    void apiRequest<{ balance: Balance }>('/api/v1/app/requests', 'GET').then((result) => {
      if (result.ok) setBalance(result.balance);
    });
    void loadRegistration();
  }, [open, editing]);

  const canRegister = registration !== null && registration.shifts.length > 0;
  const types = TYPES.filter(({ value }) => value !== 'shift_register' || canRegister);

  const shiftOptions = choices.map(({ id, name, startTime, endTime }) => ({
    value: id,
    label: `${name} · ${startTime}–${endTime}`,
  }));

  const requestClose = async () => {
    if (saving || asking.current) return;
    if (dirty) {
      asking.current = true;
      const confirmed = await confirmDiscard();
      asking.current = false;
      if (!confirmed) return;
    }
    onClose();
  };

  const choose = async (next: RequestType) => {
    if (next === type || editing) return;
    if (dirty && !(await confirmDiscard())) return;
    form.resetFields();
    setFormDirty(false);
    setPicked([]);
    setNote('');
    setType(next);
  };

  const sendRegistration = async () => {
    setSaving(true);
    const items = picked.map((id) => {
      const [date, shiftId] = id.split('|');
      return { date, shiftId };
    });
    const body = { items, ...(note.trim() ? { note: note.trim() } : {}) };
    const result = await apiRequest('/api/v1/app/shift-registrations', 'POST', body);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Đã gửi đăng ký');
    setPicked([]);
    setNote('');
    void loadRegistration();
    onSent();
  };

  const submit = async () => {
    if (registering) {
      await sendRegistration();
      return;
    }
    const values = (await form.validateFields().catch(() => null)) as Record<string, unknown> | null;
    if (!values) return;
    setSaving(true);
    const result = editing
      ? await apiRequest(`/api/v1/app/requests/${editing.id}`, 'PATCH', { type, ...values })
      : await apiRequest('/api/v1/app/requests', 'POST', { type, ...values });
    setSaving(false);
    if (result.ok) {
      toast.success(editing ? 'Đã sửa đơn' : 'Đã gửi đơn');
      onClose();
      onSent();
      return;
    }
    toast.error(result.error);
    form.setFields(
      Object.entries(result.fields ?? {}).map(([name, message]) => ({ name, errors: [message] })),
    );
  };

  const submitLabel = registering
    ? picked.length > 0
      ? `Gửi đăng ký · ${picked.length} ca`
      : 'Gửi đăng ký'
    : editing
      ? 'Lưu đơn'
      : 'Gửi đơn';

  const removeRegistration = async (requestId: string, label: string) => {
    if (!(await confirmDiscard({ title: `Bỏ đăng ký ${label}?`, okText: 'Bỏ đăng ký' }))) return;
    const result = await apiRequest(`/api/v1/app/requests/${requestId}`, 'DELETE');
    if (!result.ok) toast.error(result.error);
    else toast.success('Đã bỏ đăng ký');
    void loadRegistration();
    onSent();
  };

  return (
    <Drawer
      open={open}
      placement={desktop ? 'right' : 'bottom'}
      width={desktop ? tokens.formDrawerWidth : '100%'}
      height="calc(100% - 24px)"
      closable={false}
      destroyOnHidden
      onClose={() => void requestClose()}
      rootStyle={themeCssVars(brandColor ?? undefined)}
      rootClassName={styles.sheetRoot}
      title={null}
      footer={
        <Button
          block
          type="primary"
          size="large"
          shape="round"
          icon={<SendOutlined />}
          loading={saving}
          disabled={registering && (picked.length === 0 || !registration?.window.open)}
          onClick={() => void submit()}
        >
          {submitLabel}
        </Button>
      }
      styles={{ footer: { padding: '12px 16px max(12px, env(safe-area-inset-bottom))' } }}
    >
      <span className={styles.sheetGrip} aria-hidden />
      <div className={styles.sheetHead}>
        <div>
          <h2 className={styles.sheetTitle}>{editing ? 'Sửa đơn' : 'Tạo đơn'}</h2>
          <p className={styles.muted}>
            {editing
              ? 'Sửa xong bấm Lưu, quản lý sẽ thấy nội dung mới'
              : 'Gửi tới quản lý trực tiếp của bạn để duyệt'}
          </p>
        </div>
        <button
          type="button"
          className={styles.sheetClose}
          aria-label="Đóng"
          onClick={() => void requestClose()}
        >
          <CloseOutlined />
        </button>
      </div>

      <div className={styles.typeGrid} role="group" aria-label="Loại đơn">
        {types.map(({ value, label, icon, tone }) => (
          <button
            key={value}
            type="button"
            aria-pressed={type === value}
            disabled={editing !== null && type !== value}
            className={`${styles.typeTile} ${type === value ? styles.typeActive : ''}`}
            onClick={() => void choose(value)}
          >
            <span className={`${styles.typeIcon} ${styles[`tone_${tone}`]}`}>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {registering && registration ? (
        <>
          <RegisterGrid
            view={registration}
            picked={picked}
            onRemove={(requestId, label) => void removeRegistration(requestId, label)}
            onToggle={(id) =>
              setPicked((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]))
            }
          />
          <label className={styles.fieldLabel} htmlFor="register-note">
            Ghi chú (không bắt buộc)
          </label>
          <Input
            id="register-note"
            size="large"
            maxLength={500}
            value={note}
            placeholder="VD: Thứ Tư em chỉ làm được ca chiều"
            onChange={(event) => setNote(event.target.value)}
          />
        </>
      ) : null}

      {registering ? null : (
        <Form
          key={editing?.id ?? 'new'}
          form={form}
          layout="vertical"
          requiredMark={false}
          preserve={false}
          initialValues={
            editing ? formValuesOf(editing) : { leaveType: 'annual', when: 'after', kind: 'late' }
          }
          onValuesChange={() => setFormDirty(true)}
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
                <Select placeholder="Chọn ca" options={shiftOptions} />
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

          {type === 'late_early' ? (
            <>
              <Form.Item label="Bạn xin" name="kind" rules={required}>
                <Radio.Group
                  options={[
                    { value: 'late', label: 'Đi trễ' },
                    { value: 'early', label: 'Về sớm' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="Ngày" name="date" rules={required}>
                <Input type="date" />
              </Form.Item>
              <Form.Item label="Số phút" name="minutes" rules={required}>
                <InputNumber min={1} max={480} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                label="Ca"
                name="shiftId"
                initialValue=""
                extra="Đơn được duyệt thì số phút này không tính muộn."
              >
                <Select options={[{ value: '', label: 'Cả ngày' }, ...shiftOptions]} />
              </Form.Item>
            </>
          ) : null}

          {type === 'shift_swap' ? (
            <>
              <Form.Item label="Ngày xin nghỉ" name="offDate" rules={required}>
                <Input type="date" />
              </Form.Item>
              <Form.Item label="Ca nghỉ" name="offShiftId" rules={required}>
                <Select placeholder="Chọn ca" options={shiftOptions} />
              </Form.Item>
              <Form.Item label="Ngày làm bù" name="workDate" rules={required}>
                <Input type="date" />
              </Form.Item>
              <Form.Item
                label="Ca làm bù"
                name="workShiftId"
                rules={required}
                extra="Nghỉ một ngày theo lịch và đi làm bù vào ngày khác."
              >
                <Select placeholder="Chọn ca" options={shiftOptions} />
              </Form.Item>
            </>
          ) : null}

          <Form.Item
            label={type === 'overtime' ? 'Việc cần làm thêm' : 'Lý do'}
            name="reason"
            rules={required}
          >
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      )}
    </Drawer>
  );
}
