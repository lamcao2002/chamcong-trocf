'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Segmented,
  Select,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { KeyOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { FormDrawer } from '@/components/common/FormDrawer';
import { useConfirmDiscard } from '@/components/common/useConfirmDiscard';
import { useCrudDrawer } from '@/components/common/useCrudDrawer';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { canAssignRole, canEditEmployee } from '@/lib/auth/permissions';
import { ROLE_LABELS, type Role } from '@/lib/auth/roles';
import { formatMoney, formatWorkDays } from '@/lib/format';
import { initials } from '@/lib/navigation/admin';
import type { EmployeeView } from '@/lib/services/employees';
import type { LocationView } from '@/lib/services/locations';
import type { PositionView } from '@/lib/services/positions';
import type { ShiftView } from '@/lib/services/shifts';
import { tokens } from '@/lib/theme/tokens';
import { employeeCreateSchema } from '@/lib/validation/employee';
import { MoneyInput } from './MoneyInput';
import { PAY_UNITS } from './PositionsPanel';
import styles from './config.module.css';

const CONTRACT_LABELS = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  intern: 'Thực tập',
  collaborator: 'Cộng tác viên',
} as const;

const ROLE_HINTS: Record<Role, string> = {
  app: 'Chỉ dùng app chấm công',
  manager: 'Duyệt công, đơn từ cho người mình quản lý; không thấy số tiền lương',
  hr: 'Quản lý nhân sự, ca, vị trí và lương; không sửa được Quản trị viên',
  admin: 'Toàn quyền',
};

type StaffForm = {
  name: string;
  email: string;
  status?: EmployeeView['status'];
  contract: EmployeeView['contract'];
  onboard: Dayjs;
  role: Role;
  managerId: string | null;
  positionId: string | null;
  payOn: boolean;
  payAmount?: number;
  shiftsOn: boolean;
  shiftIds?: string[];
  locationsOn: boolean;
  locationIds?: string[];
};

type StaffPanelProps = {
  employees: EmployeeView[];
  positions: PositionView[];
  shifts: ShiftView[];
  locations: LocationView[];
  viewer: { id: string; role: Role };
};

const PIN_MODAL_Z_INDEX = 1100;

const vnToday = () => dayjs().format('YYYY-MM-DD');

export function StaffPanel({ employees, positions, shifts, locations, viewer }: StaffPanelProps) {
  const toast = useToast();
  const confirmDiscard = useConfirmDiscard();
  const [status, setStatus] = useState<'active' | 'left' | 'all'>('active');
  const [positionFilter, setPositionFilter] = useState<string>();
  const [pinNotice, setPinNotice] = useState<{ name: string; email: string; pin: string }>();
  const [resetting, setResetting] = useState(false);

  const drawer = useCrudDrawer<StaffForm>({
    baseUrl: '/api/v1/employees',
    schema: employeeCreateSchema,
    label: 'hồ sơ',
    toBody: (values, editingId) => ({
      name: values.name,
      email: values.email,
      contract: values.contract,
      onboardDate: values.onboard?.format('YYYY-MM-DD') ?? '',
      role: values.role,
      managerId: values.managerId ?? null,
      positionId: values.positionId ?? null,
      payOverride: values.payOn
        ? { ...employees.find(({ id }) => id === editingId)?.payOverride, payAmount: values.payAmount }
        : null,
      shiftIds: values.shiftsOn ? (values.shiftIds ?? []) : null,
      locationIds: values.locationsOn ? (values.locationIds ?? []) : null,
      ...(values.status ? { status: values.status } : {}),
    }),
    onSaved: (result, values, isNew) => {
      const created = result.employee as { pin?: string } | undefined;
      if (isNew && created?.pin) {
        setPinNotice({ name: values.name, email: values.email, pin: created.pin });
      }
    },
  });

  const positionId = Form.useWatch('positionId', drawer.form);
  const payOn = Form.useWatch('payOn', drawer.form);
  const shiftsOn = Form.useWatch('shiftsOn', drawer.form);
  const locationsOn = Form.useWatch('locationsOn', drawer.form);
  const editing = employees.find((employee) => employee.id === drawer.editingId);
  const readOnly = editing ? !canEditEmployee(viewer, editing) : false;
  const inherited = positions.find((position) => position.id === positionId);
  const isSelf = editing?.id === viewer.id;

  const shiftCode = (id: string) => shifts.find((shift) => shift.id === id)?.code ?? '?';
  const locationName = (id: string) => locations.find((location) => location.id === id)?.name ?? '?';

  const visible = useMemo(
    () =>
      employees.filter(
        (employee) =>
          (status === 'all' || employee.status === status) &&
          (!positionFilter || employee.positionId === positionFilter),
      ),
    [employees, status, positionFilter],
  );

  const managerOptions = employees
    .filter(({ role, status: state, id }) => role !== 'app' && state === 'active' && id !== drawer.editingId)
    .map(({ id, name }) => ({ value: id, label: name }));

  const openNew = () =>
    drawer.openWith({
      contract: 'full_time',
      onboard: dayjs(vnToday()),
      role: 'app',
      managerId: null,
      positionId: null,
      payOn: false,
      shiftsOn: false,
      locationsOn: false,
    });

  const openEdit = (employee: EmployeeView) =>
    drawer.openWith(
      {
        name: employee.name,
        email: employee.email,
        status: employee.status,
        contract: employee.contract,
        onboard: dayjs(employee.onboardDate),
        role: employee.role,
        managerId: employee.managerId,
        positionId: employee.positionId,
        payOn: Boolean(employee.payOverride),
        payAmount: employee.payOverride?.payAmount,
        shiftsOn: Boolean(employee.shiftIds),
        shiftIds: employee.shiftIds ?? undefined,
        locationsOn: Boolean(employee.locationIds),
        locationIds: employee.locationIds ?? undefined,
      },
      employee.id,
    );

  const resetPin = async () => {
    if (!editing) return;
    const confirmed = await confirmDiscard({
      title: `Đặt lại PIN của ${editing.name}?`,
      okText: 'Đặt lại',
    });
    if (!confirmed) return;

    setResetting(true);
    const result = await apiRequest<{ pin: string }>(`/api/v1/employees/${editing.id}/reset-pin`, 'POST');
    setResetting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPinNotice({ name: editing.name, email: editing.email, pin: result.pin });
  };

  const copyPin = async () => {
    if (!pinNotice) return;
    const message = `${pinNotice.name}: đăng nhập bằng ${pinNotice.email}, PIN ${pinNotice.pin}`;
    try {
      await navigator.clipboard.writeText(message);
      toast.success('Đã chép.');
    } catch {
      toast.error('Không chép được, hãy ghi lại PIN.');
    }
  };

  return (
    <>
      <Card style={{ boxShadow: tokens.shadowCard }}>
        <div className={styles.toolbar}>
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'active', label: 'Đang làm' },
              { value: 'left', label: 'Đã nghỉ' },
              { value: 'all', label: 'Tất cả' },
            ]}
          />
          <Select
            allowClear
            placeholder="Tất cả vị trí"
            aria-label="Lọc theo vị trí"
            value={positionFilter}
            onChange={setPositionFilter}
            options={positions.map(({ id, name }) => ({ value: id, label: name }))}
            style={{ flex: '1 1 160px', maxWidth: 260 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
            Thêm nhân viên
          </Button>
        </div>

        <div className={styles.stack} style={{ gap: 8 }}>
          {visible.map((employee) => {
            const position = positions.find(({ id }) => id === employee.positionId);
            return (
              <button
                key={employee.id}
                type="button"
                className={styles.rowCard}
                onClick={() => openEdit(employee)}
              >
                <span className={styles.avatar} aria-hidden>
                  {initials(employee.name)}
                </span>
                <span className={styles.rowBody}>
                  <span className={styles.rowName}>
                    {employee.name}
                    {employee.role !== 'app' ? <Tag color="purple">{ROLE_LABELS[employee.role]}</Tag> : null}
                    {employee.status === 'left' ? <Tag>Đã nghỉ</Tag> : null}
                  </span>
                  <span className={styles.muted}>
                    {position?.name ?? 'Chưa gắn vị trí'} · {CONTRACT_LABELS[employee.contract]} ·{' '}
                    {employee.email}
                  </span>
                </span>
                <RightOutlined aria-hidden />
              </button>
            );
          })}
          {visible.length === 0 ? (
            <Typography.Text type="secondary">Không có nhân viên nào.</Typography.Text>
          ) : null}
        </div>
      </Card>

      <FormDrawer
        open={drawer.open}
        title={editing ? editing.name : 'Thêm nhân viên'}
        dirty={drawer.dirty}
        saving={drawer.saving}
        readOnly={readOnly}
        submitLabel={editing ? 'Lưu hồ sơ' : 'Thêm nhân viên'}
        onClose={drawer.close}
        onSubmit={() => void drawer.submit()}
        footerExtra={
          editing && !readOnly ? (
            <Button icon={<KeyOutlined />} loading={resetting} onClick={() => void resetPin()}>
              Đặt lại PIN
            </Button>
          ) : null
        }
      >
        <Form
          form={drawer.form}
          layout="vertical"
          requiredMark={false}
          disabled={readOnly}
          initialValues={drawer.initialValues}
          onValuesChange={drawer.handleValuesChange}
        >
          {readOnly ? (
            <Alert style={{ marginBottom: 16 }} type="info" message="Bạn không được sửa Quản trị viên." />
          ) : null}
          {!editing ? (
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              message="PIN 4 số được tạo tự động sau khi thêm."
            />
          ) : null}

          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item label="Họ tên" name="name">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Email đăng nhập" name="email">
                <Input type="email" placeholder="ten@congty.vn" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Ngày vào làm"
                name="onboard"
                extra="Trước ngày này không tính vắng."
                rules={[]}
              >
                <DatePicker format="DD/MM/YYYY" allowClear={false} inputReadOnly style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Loại hợp đồng" name="contract">
                <Select
                  options={Object.entries(CONTRACT_LABELS).map(([value, label]) => ({ value, label }))}
                />
              </Form.Item>
            </Col>
            {editing ? (
              <Col span={24}>
                <Form.Item
                  label="Trạng thái"
                  name="status"
                  extra="Đã nghỉ: không đăng nhập được, bảng công cũ giữ nguyên."
                >
                  <Radio.Group
                    optionType="button"
                    disabled={isSelf || readOnly}
                    options={[
                      { value: 'active', label: 'Đang làm' },
                      { value: 'left', label: 'Đã nghỉ' },
                    ]}
                  />
                </Form.Item>
              </Col>
            ) : null}
          </Row>

          <Divider plain orientation="left">
            Vị trí
          </Divider>
          <Form.Item label="Vị trí" name="positionId">
            <Select
              allowClear
              placeholder="Chọn vị trí"
              options={positions.map(({ id, name }) => ({ value: id, label: name }))}
            />
          </Form.Item>

          {inherited ? (
            <Alert
              style={{ marginBottom: 16 }}
              type="success"
              message={`Theo vị trí ${inherited.name}`}
              description={[
                inherited.shiftIds.map(shiftCode).join(', '),
                formatWorkDays(inherited.workDays),
                inherited.anyLocation
                  ? 'Ở đâu cũng được'
                  : inherited.locationIds.map(locationName).join(', '),
                `${formatMoney(inherited.payAmount)}${PAY_UNITS[inherited.payType]}`,
              ].join(' · ')}
            />
          ) : (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              message="Chưa gắn vị trí: chọn ca và địa điểm riêng bên dưới."
            />
          )}

          <Form.Item label="Lương riêng" name="payOn" valuePropName="checked">
            <Switch />
          </Form.Item>
          {payOn ? (
            <Form.Item
              label={`Mức riêng${inherited ? ` (${PAY_UNITS[inherited.payType]})` : ''}`}
              name="payAmount"
              extra={inherited ? `Vị trí: ${formatMoney(inherited.payAmount)}` : undefined}
            >
              <MoneyInput />
            </Form.Item>
          ) : null}

          <Form.Item label="Ca riêng" name="shiftsOn" valuePropName="checked">
            <Switch />
          </Form.Item>
          {shiftsOn ? (
            <Form.Item label="Các ca được làm" name="shiftIds">
              <Select
                mode="multiple"
                options={shifts.map(({ id, code, startTime, endTime }) => ({
                  value: id,
                  label: `${code} · ${startTime}–${endTime}`,
                }))}
              />
            </Form.Item>
          ) : null}

          <Form.Item label="Địa điểm riêng" name="locationsOn" valuePropName="checked">
            <Switch />
          </Form.Item>
          {locationsOn ? (
            <Form.Item label="Các địa điểm chấm công" name="locationIds">
              <Select
                mode="multiple"
                options={locations.map(({ id, name }) => ({ value: id, label: name }))}
              />
            </Form.Item>
          ) : null}

          <Divider plain orientation="left">
            Quản lý và quyền
          </Divider>
          <Form.Item label="Người quản lý trực tiếp" name="managerId">
            <Select allowClear placeholder="Không có" options={managerOptions} />
          </Form.Item>
          <Form.Item label="Quyền" name="role">
            <Radio.Group
              disabled={isSelf || readOnly}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              options={(Object.keys(ROLE_LABELS) as Role[]).map((role) => ({
                value: role,
                disabled: !canAssignRole(viewer.role, role),
                label: `${ROLE_LABELS[role]}: ${ROLE_HINTS[role]}`,
              }))}
            />
          </Form.Item>
        </Form>
      </FormDrawer>

      <Modal
        open={Boolean(pinNotice)}
        // Mở được từ trong drawer: phải nằm trên drawer, PIN chỉ hiện một lần nên không được bị che
        zIndex={PIN_MODAL_Z_INDEX}
        title={`PIN của ${pinNotice?.name}`}
        okText="Đã ghi lại"
        cancelButtonProps={{ style: { display: 'none' } }}
        maskClosable={false}
        closable={false}
        onOk={() => setPinNotice(undefined)}
      >
        <p>
          Email: <strong>{pinNotice?.email}</strong>
        </p>
        <Typography.Title level={2} style={{ letterSpacing: 8, textAlign: 'center' }} data-testid="pin-value">
          {pinNotice?.pin}
        </Typography.Title>
        <Alert type="warning" message="PIN chỉ hiện đúng một lần này. Hãy gửi cho nhân viên ngay." />
        <Button block icon={<KeyOutlined />} style={{ marginTop: 12 }} onClick={() => void copyPin()}>
          Chép thông tin đăng nhập
        </Button>
      </Modal>
    </>
  );
}
