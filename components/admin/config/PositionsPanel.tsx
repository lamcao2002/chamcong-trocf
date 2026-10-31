'use client';

import {
  Alert,
  Button,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Tag,
} from 'antd';
import { EnvironmentOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { FormDrawer } from '@/components/common/FormDrawer';
import { useCrudDrawer } from '@/components/common/useCrudDrawer';
import { WEEK_DAYS, formatMoney, formatWorkDays } from '@/lib/format';
import type { LocationView } from '@/lib/services/locations';
import type { PositionView } from '@/lib/services/positions';
import type { ShiftView } from '@/lib/services/shifts';
import { positionSchema } from '@/lib/validation/position';
import { MoneyInput } from './MoneyInput';
import styles from './config.module.css';

export const PAY_UNITS = { month: '/tháng', hour: '/giờ', unit: '/công' } as const;

type PositionForm = Pick<
  PositionView,
  | 'name'
  | 'shiftMode'
  | 'fixedShiftId'
  | 'shiftIds'
  | 'workDays'
  | 'anyLocation'
  | 'locationIds'
  | 'payType'
  | 'payAmount'
  | 'stdDays'
  | 'leaveDays'
  | 'otWeekday'
  | 'otSaturday'
  | 'otOffday'
  | 'otHoliday'
>;

const NEW_POSITION: Partial<PositionForm> = {
  shiftMode: 'flexible',
  fixedShiftId: null,
  shiftIds: [],
  workDays: [0, 1, 2, 3, 4, 5, 6],
  anyLocation: false,
  locationIds: [],
  payType: 'hour',
  stdDays: 26,
  leaveDays: 12,
  otWeekday: 150,
  otSaturday: null,
  otOffday: 200,
  otHoliday: 300,
};

type PositionsPanelProps = {
  positions: PositionView[];
  shifts: ShiftView[];
  locations: LocationView[];
};

export function PositionsPanel({ positions, shifts, locations }: PositionsPanelProps) {
  const drawer = useCrudDrawer<PositionForm>({
    baseUrl: '/api/v1/positions',
    schema: positionSchema,
    label: 'vị trí',
  });
  const shiftMode = Form.useWatch('shiftMode', drawer.form);
  const anyLocation = Form.useWatch('anyLocation', drawer.form);
  const editing = positions.find((position) => position.id === drawer.editingId);

  const shiftOptions = shifts.map((shift) => ({
    value: shift.id,
    label: `${shift.code} · ${shift.startTime}–${shift.endTime}`,
  }));
  const locationOptions = locations.map((location) => ({ value: location.id, label: location.name }));
  const shiftCode = (id: string) => shifts.find((shift) => shift.id === id)?.code ?? '?';
  const locationName = (id: string) => locations.find((location) => location.id === id)?.name ?? '?';

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.muted}>
          {positions.length} vị trí · {positions.reduce((sum, position) => sum + position.headcount, 0)} người
        </p>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => drawer.openWith(NEW_POSITION)}>
          Thêm vị trí
        </Button>
      </div>

      <div className={styles.grid}>
        {positions.map((position) => (
          <article key={position.id} className={styles.card}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>{position.name}</h3>
              <Tag icon={<TeamOutlined />}>{position.headcount} người</Tag>
            </div>
            <p className={styles.muted}>{position.shiftMode === 'fixed' ? 'Ca cố định' : 'Linh hoạt'}</p>
            <div>
              <span className={styles.price}>{formatMoney(position.payAmount)}</span>
              <span className={styles.muted}> {PAY_UNITS[position.payType]}</span>
            </div>
            <div className={styles.chips}>
              {position.shiftIds.map((id) => (
                <Tag key={id}>{shiftCode(id)}</Tag>
              ))}
            </div>
            <p className={styles.muted}>{formatWorkDays(position.workDays)}</p>
            <p className={styles.muted}>
              <EnvironmentOutlined />{' '}
              {position.anyLocation ? 'Ở đâu cũng được' : position.locationIds.map(locationName).join(', ')}
            </p>
            <div className={styles.cardFoot}>
              <Button
                size="small"
                aria-label={`Sửa vị trí ${position.name}`}
                onClick={() => drawer.openWith(position, position.id)}
              >
                Sửa
              </Button>
            </div>
          </article>
        ))}
      </div>

      <FormDrawer
        open={drawer.open}
        title={editing ? `Vị trí: ${editing.name}` : 'Thêm vị trí'}
        dirty={drawer.dirty}
        saving={drawer.saving}
        submitLabel="Lưu vị trí"
        onClose={drawer.close}
        onSubmit={() => void drawer.submit()}
        footerExtra={
          editing ? (
            <Button
              danger
              type="text"
              onClick={() => void drawer.remove(editing.id, `vị trí ${editing.name}`)}
            >
              Xoá vị trí
            </Button>
          ) : null
        }
      >
        <Form
          form={drawer.form}
          layout="vertical"
          requiredMark={false}
          initialValues={drawer.initialValues}
          onValuesChange={drawer.handleValuesChange}
        >
          {editing && editing.headcount > 0 ? (
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              message={`${editing.headcount} người đang giữ vị trí này. Lưu xong, ca, địa điểm và lương của họ cập nhật theo.`}
            />
          ) : null}

          <Form.Item label="Tên vị trí" name="name">
            <Input placeholder="VD: Phục vụ" />
          </Form.Item>

          <Divider plain orientation="left">
            Ca và ngày làm
          </Divider>
          <Form.Item label="Kiểu ca" name="shiftMode">
            <Radio.Group
              optionType="button"
              options={[
                { value: 'flexible', label: 'Linh hoạt' },
                { value: 'fixed', label: 'Ca cố định' },
              ]}
            />
          </Form.Item>
          {shiftMode === 'fixed' ? (
            <Form.Item
              label="Ca cố định"
              name="fixedShiftId"
              extra="Ngày nào cũng ca này, không cần xếp lịch."
            >
              <Select options={shiftOptions} placeholder="Chọn ca" />
            </Form.Item>
          ) : (
            <Form.Item label="Các ca được phép làm" name="shiftIds">
              <Checkbox.Group options={shiftOptions} />
            </Form.Item>
          )}
          <Form.Item
            label="Ngày làm"
            name="workDays"
            extra="Ngày không chọn là ngày nghỉ: đi làm sẽ thành OT."
          >
            <Checkbox.Group options={WEEK_DAYS} />
          </Form.Item>

          <Divider plain orientation="left">
            Địa điểm chấm công
          </Divider>
          <Form.Item name="anyLocation">
            <Radio.Group
              options={[
                { value: false, label: 'Tại địa điểm đã chọn' },
                { value: true, label: 'Ở đâu cũng được' },
              ]}
            />
          </Form.Item>
          {anyLocation ? null : (
            <Form.Item label="Địa điểm" name="locationIds">
              <Checkbox.Group options={locationOptions} />
            </Form.Item>
          )}

          <Divider plain orientation="left">
            Lương
          </Divider>
          <Form.Item label="Kiểu lương" name="payType">
            <Radio.Group
              optionType="button"
              options={[
                { value: 'month', label: 'Lương tháng' },
                { value: 'hour', label: 'Theo giờ' },
                { value: 'unit', label: 'Theo công' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Mức lương" name="payAmount">
            <MoneyInput />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Công chuẩn" name="stdDays">
                <InputNumber min={1} max={31} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ngày phép năm" name="leaveDays">
                <InputNumber min={0} max={60} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider plain orientation="left">
            Hệ số OT (%)
          </Divider>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Ngày thường" name="otWeekday">
                <InputNumber min={100} addonAfter="%" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Thứ Bảy nghỉ" name="otSaturday">
                <InputNumber min={100} placeholder="150" addonAfter="%" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Chủ nhật, ngày nghỉ" name="otOffday">
                <InputNumber min={100} addonAfter="%" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ngày lễ" name="otHoliday">
                <InputNumber min={100} addonAfter="%" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </FormDrawer>
    </>
  );
}
