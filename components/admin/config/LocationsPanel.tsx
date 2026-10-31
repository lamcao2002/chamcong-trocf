'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Slider,
  Tag,
  Typography,
  theme,
} from 'antd';
import { AimOutlined, EnvironmentOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { FormDrawer } from '@/components/common/FormDrawer';
import { useCrudDrawer } from '@/components/common/useCrudDrawer';
import { averagePosition, collectSamples } from '@/lib/domain/geo';
import type { LocationView } from '@/lib/services/locations';
import type { PositionView } from '@/lib/services/positions';
import { locationSchema, type LocationInput } from '@/lib/validation/location';
import { tokens } from '@/lib/theme/tokens';
import styles from './config.module.css';

// Leaflet cần `window` nên chỉ tải ở trình duyệt
const LocationMap = dynamic(() => import('./LocationMap').then((module) => module.LocationMap), {
  ssr: false,
  loading: () => <div className={styles.map} />,
});

const SAMPLES = 5;
const MEASURE_TIMEOUT_MS = 15_000;
const HANOI = { lat: 21.0285, lng: 105.8542 };
const DEFAULT_RADIUS = 60;

const GEO_ERRORS: Record<number, string> = {
  1: 'Trình duyệt chưa cho phép lấy vị trí. Hãy bật quyền vị trí rồi thử lại.',
  2: 'Không xác định được vị trí. Hãy ra gần cửa sổ rồi thử lại.',
  3: 'Lấy vị trí quá lâu. Hãy thử lại hoặc bấm trực tiếp lên bản đồ.',
};

type LocationsPanelProps = {
  locations: LocationView[];
  positions: PositionView[];
  employeeCounts: Record<string, number>;
};

export function LocationsPanel({ locations, positions, employeeCounts }: LocationsPanelProps) {
  const drawer = useCrudDrawer<LocationInput>({
    baseUrl: '/api/v1/locations',
    schema: locationSchema,
    label: 'địa điểm',
  });
  const brand = theme.useToken().token.colorPrimary;
  const [measuring, setMeasuring] = useState(0);
  const [measureNote, setMeasureNote] = useState<{ type: 'success' | 'error'; text: string }>();
  // Toạ độ không có ô nhập nên phải bật `preserve` thì useWatch mới đọc được
  const lat = Form.useWatch('lat', { form: drawer.form, preserve: true });
  const lng = Form.useWatch('lng', { form: drawer.form, preserve: true });
  const radiusM = Form.useWatch('radiusM', drawer.form);
  const editing = locations.find((location) => location.id === drawer.editingId);
  const firstLocation = locations[0];
  const overviewCenter = firstLocation ? { lat: firstLocation.lat, lng: firstLocation.lng } : HANOI;
  const assignable = positions.filter((position) => !position.anyLocation);

  const place = ({ lat: nextLat, lng: nextLng }: { lat: number; lng: number }) => {
    drawer.form.setFieldsValue({ lat: nextLat, lng: nextLng });
    drawer.markDirty();
  };

  const measureCurrentPosition = async () => {
    if (!('geolocation' in navigator)) {
      setMeasureNote({ type: 'error', text: 'Trình duyệt này không hỗ trợ lấy vị trí.' });
      return;
    }
    setMeasureNote(undefined);
    setMeasuring(1);
    try {
      const samples = await collectSamples(navigator.geolocation, SAMPLES, MEASURE_TIMEOUT_MS, (collected) =>
        setMeasuring(Math.min(collected + 1, SAMPLES)),
      );
      const position = averagePosition(samples);
      place(position);
      setMeasureNote({
        type: 'success',
        text: `Đã lấy trung bình ${samples.length} lần đo, độ chính xác khoảng ${Math.round(position.accuracy)} m. Có thể kéo ghim để chỉnh.`,
      });
    } catch (error) {
      const code = (error as GeolocationPositionError).code;
      setMeasureNote({ type: 'error', text: GEO_ERRORS[code] ?? GEO_ERRORS[2]! });
    }
    setMeasuring(0);
  };

  const openForm = (values: Partial<LocationInput>, id?: string) => {
    setMeasureNote(undefined);
    drawer.openWith(values, id);
  };

  return (
    <>
      <Card style={{ boxShadow: tokens.shadowCard }}>
        <div className={styles.toolbar}>
          <p className={styles.muted}>{locations.length} địa điểm</p>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() =>
              openForm({
                ...overviewCenter,
                radiusM: DEFAULT_RADIUS,
                positionIds: assignable.map((position) => position.id),
              })
            }
          >
            Thêm địa điểm
          </Button>
        </div>
        <LocationMap points={locations} center={overviewCenter} brand={brand} />
      </Card>

      <div className={styles.grid} style={{ marginTop: 16 }}>
        {locations.map((location) => (
          <article key={location.id} className={styles.card}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>
                <EnvironmentOutlined /> {location.name}
              </h3>
              <Tag>Bán kính {location.radiusM} m</Tag>
            </div>
            <p className={styles.muted}>{location.address ?? 'Chưa có địa chỉ'}</p>
            <div className={styles.chips}>
              <Tag icon={<TeamOutlined />}>{employeeCounts[location.id] ?? 0} người</Tag>
              {location.positionIds.map((id) => (
                <Tag key={id}>{positions.find((position) => position.id === id)?.name}</Tag>
              ))}
            </div>
            <div className={styles.cardFoot}>
              <Button
                size="small"
                aria-label={`Sửa ${location.name}`}
                onClick={() => openForm(location, location.id)}
              >
                Sửa
              </Button>
            </div>
          </article>
        ))}
      </div>

      <FormDrawer
        open={drawer.open}
        title={editing ? `Sửa: ${editing.name}` : 'Thêm địa điểm'}
        dirty={drawer.dirty}
        saving={drawer.saving}
        submitLabel="Lưu địa điểm"
        onClose={drawer.close}
        onSubmit={() => void drawer.submit()}
        footerExtra={
          editing ? (
            <Button danger type="text" onClick={() => void drawer.remove(editing.id, editing.name)}>
              Xoá
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
          <Form.Item label="Tên địa điểm" name="name">
            <Input placeholder="VD: Quán Hoàn Kiếm" />
          </Form.Item>
          <Form.Item label="Địa chỉ" name="address">
            <Input />
          </Form.Item>

          <Button
            block
            icon={<AimOutlined />}
            loading={measuring > 0}
            onClick={() => void measureCurrentPosition()}
            style={{ marginBottom: 12 }}
          >
            {measuring > 0 ? `Đang đo lần ${measuring}/${SAMPLES}` : 'Lấy vị trí hiện tại'}
          </Button>
          {measureNote ? (
            <Alert style={{ marginBottom: 12 }} type={measureNote.type} message={measureNote.text} showIcon />
          ) : null}

          <div style={{ marginBottom: 8 }}>
            {typeof lat === 'number' && typeof lng === 'number' ? (
              <LocationMap
                points={[{ id: 'pin', name: '', lat, lng, radiusM: radiusM ?? DEFAULT_RADIUS }]}
                center={{ lat, lng }}
                brand={brand}
                onPick={place}
                height={260}
              />
            ) : null}
          </div>
          <Typography.Text type="secondary">Bấm lên bản đồ hoặc kéo ghim để đặt vị trí.</Typography.Text>
          <p>
            <Typography.Text type="secondary">
              Toạ độ: {lat?.toFixed(6)}, {lng?.toFixed(6)}
            </Typography.Text>
          </p>

          <Form.Item
            label="Bán kính"
            name="radiusM"
            extra="GPS điện thoại thường lệch 10–50 m, đặt quá nhỏ dễ bị báo ngoài vùng."
          >
            <InputNumber min={30} max={500} addonAfter="m" style={{ width: '100%' }} />
          </Form.Item>
          <Slider
            min={30}
            max={500}
            step={10}
            aria-label="Bán kính"
            value={radiusM}
            onChange={(value) => {
              drawer.form.setFieldValue('radiusM', value);
              drawer.markDirty();
            }}
          />

          <Form.Item label="Vị trí chấm công tại đây" name="positionIds" style={{ marginTop: 16 }}>
            <Checkbox.Group options={assignable.map(({ id, name }) => ({ value: id, label: name }))} />
          </Form.Item>
        </Form>
      </FormDrawer>
    </>
  );
}
