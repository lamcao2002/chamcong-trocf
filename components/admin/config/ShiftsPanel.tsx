'use client';

import { Alert, Button, Col, Form, Input, InputNumber, Radio, Row, Switch, Tag, Typography } from 'antd';
import { MoonOutlined, PlusOutlined } from '@ant-design/icons';
import { FormDrawer } from '@/components/common/FormDrawer';
import { useCrudDrawer } from '@/components/common/useCrudDrawer';
import { isOvernight, shiftWorkLabel } from '@/lib/domain/shift';
import type { ShiftView } from '@/lib/services/shifts';
import { shiftSchema, type ShiftInput } from '@/lib/validation/shift';
import styles from './config.module.css';

const CALC_LABELS = {
  block: 'Khung ca',
  actual: 'Giờ thực tế',
  actual_strict: 'Giờ thực tế + bắt lỗi',
} as const;

const NEW_SHIFT: Partial<ShiftInput> = {
  calc: 'block',
  stdHours: 8,
  minFull: 420,
  minHalf: 210,
  graceMin: 5,
  minOt: 30,
  isPart: false,
  noLateCheck: false,
  breakStart: null,
  breakEnd: null,
};

export function ShiftsPanel({ shifts }: { shifts: ShiftView[] }) {
  const drawer = useCrudDrawer<ShiftInput>({ baseUrl: '/api/v1/shifts', schema: shiftSchema, label: 'ca' });
  const startTime = Form.useWatch('startTime', drawer.form);
  const endTime = Form.useWatch('endTime', drawer.form);
  const breakStart = Form.useWatch('breakStart', drawer.form);
  const breakEnd = Form.useWatch('breakEnd', drawer.form);
  const editing = shifts.find((shift) => shift.id === drawer.editingId);
  const hasTimes = Boolean(startTime && endTime && startTime !== endTime);

  return (
    <>
      <div className={styles.toolbar}>
        <p className={styles.muted}>{shifts.length} ca</p>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => drawer.openWith(NEW_SHIFT)}>
          Thêm ca
        </Button>
      </div>

      <div className={styles.grid}>
        {shifts.map((shift) => (
          <article key={shift.id} className={styles.card}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>{shift.name}</h3>
              <Tag>{shift.code}</Tag>
            </div>
            <p className={styles.muted}>
              {shift.startTime} – {shift.endTime} · {shiftWorkLabel(shift)}
            </p>
            <div className={styles.chips}>
              <Tag color="green">{CALC_LABELS[shift.calc]}</Tag>
              {shift.overnight ? <Tag icon={<MoonOutlined />}>Qua đêm</Tag> : null}
              {shift.isPart ? <Tag>Ca ghép</Tag> : null}
              {shift.noLateCheck ? <Tag>Không bắt lỗi</Tag> : null}
            </div>
            <p className={styles.muted}>
              {shift.positionNames.length > 0
                ? `Vị trí: ${shift.positionNames.join(', ')}`
                : 'Chưa gắn vị trí'}
            </p>
            <div className={styles.cardFoot}>
              <Button
                size="small"
                aria-label={`Sửa ca ${shift.code}`}
                onClick={() => drawer.openWith(shift, shift.id)}
              >
                Sửa
              </Button>
            </div>
          </article>
        ))}
      </div>

      <FormDrawer
        open={drawer.open}
        title={editing ? `Sửa ca ${editing.code}` : 'Thêm ca'}
        dirty={drawer.dirty}
        saving={drawer.saving}
        submitLabel="Lưu ca"
        onClose={drawer.close}
        onSubmit={() => void drawer.submit()}
        footerExtra={
          editing ? (
            <Button danger type="text" onClick={() => void drawer.remove(editing.id, `ca ${editing.code}`)}>
              Xoá ca
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
          <Row gutter={12}>
            <Col xs={24} sm={16}>
              <Form.Item label="Tên ca" name="name">
                <Input placeholder="VD: Ca sáng" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                label="Mã ca"
                name="code"
                extra={editing?.codeLocked ? 'Không đổi được vì đã có lịch hoặc lần chấm.' : undefined}
              >
                <Input placeholder="VD: SANG" disabled={editing?.codeLocked} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Giờ vào" name="startTime">
                <Input type="time" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Giờ ra" name="endTime">
                <Input type="time" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Nghỉ giữa ca từ" name="breakStart">
                <Input type="time" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Đến" name="breakEnd">
                <Input type="time" />
              </Form.Item>
            </Col>
          </Row>

          {hasTimes ? (
            <Alert
              style={{ marginBottom: 16 }}
              type={isOvernight(startTime!, endTime!) ? 'info' : 'success'}
              message={`${shiftWorkLabel({ startTime: startTime!, endTime: endTime!, breakStart, breakEnd })}${
                isOvernight(startTime!, endTime!) ? ' · Ca qua đêm, thuộc ngày bắt đầu ca' : ''
              }`}
            />
          ) : null}

          <Form.Item label="Cách tính công" name="calc">
            <Radio.Group
              options={Object.entries(CALC_LABELS).map(([value, label]) => ({ value, label }))}
              optionType="button"
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Giờ chuẩn" name="stdHours">
                <InputNumber min={0} max={24} step={0.5} addonAfter="giờ" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Cho phép muộn" name="graceMin">
                <InputNumber min={0} addonAfter="phút" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Đủ 1 công khi làm từ" name="minFull">
                <InputNumber min={0} addonAfter="phút" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Nửa công khi làm từ" name="minHalf">
                <InputNumber min={0} addonAfter="phút" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="OT tối thiểu" name="minOt" extra="Để trống thì theo công ty.">
                <InputNumber min={0} addonAfter="phút" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Ca ghép"
            name="isPart"
            valuePropName="checked"
            extra="Một ngày làm 2–3 ca; nghỉ phép tính nửa công."
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="Không bắt lỗi muộn / sớm"
            name="noLateCheck"
            valuePropName="checked"
            extra="Hợp ca ngắn như tạp vụ."
          >
            <Switch />
          </Form.Item>
          <Typography.Text type="secondary">Sửa giờ ca sẽ áp cho mọi vị trí dùng ca này.</Typography.Text>
        </Form>
      </FormDrawer>
    </>
  );
}
