'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, DatePicker, Input, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { useConfirmDiscard } from '@/components/common/useConfirmDiscard';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import type { HolidayView } from '@/lib/services/holidays';
import { holidaySchema } from '@/lib/validation/holiday';
import { fieldErrors } from '@/lib/validation/common';
import styles from './config.module.css';

type HolidaysPanelProps = {
  holidays: HolidayView[];
  /** Năm của nút "Thêm ngày lễ Việt Nam", là năm sau theo giờ Việt Nam. */
  nextYear: number;
};

export function HolidaysPanel({ holidays, nextYear }: HolidaysPanelProps) {
  const router = useRouter();
  const toast = useToast();
  const confirmDiscard = useConfirmDiscard();
  const [date, setDate] = useState<Dayjs | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const body = { date: date?.format('YYYY-MM-DD') ?? '', name };
    const parsed = holidaySchema.safeParse(body);
    if (!parsed.success) {
      toast.error(Object.values(fieldErrors(parsed.error))[0] ?? 'Dữ liệu không hợp lệ');
      return;
    }
    setBusy(true);
    const result = await apiRequest('/api/v1/holidays', 'POST', body);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDate(null);
    setName('');
    toast.success('Đã thêm ngày lễ.');
    router.refresh();
  };

  const remove = async ({ id, date: holidayDate, name: holidayName }: HolidayView) => {
    if (!(await confirmDiscard({ title: `Xoá ${holidayName} (${formatDate(holidayDate)})?`, okText: 'Xoá' })))
      return;
    const result = await apiRequest(`/api/v1/holidays/${id}`, 'DELETE');
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Đã xoá ngày lễ.');
    router.refresh();
  };

  const seed = async () => {
    setBusy(true);
    const result = await apiRequest<{ added: unknown[] }>(
      `/api/v1/holidays/seed-vn?year=${nextYear}`,
      'POST',
    );
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.added.length > 0
        ? `Đã thêm ${result.added.length} ngày lễ năm ${nextYear}.`
        : 'Các ngày lễ này đã có.',
    );
    router.refresh();
  };

  return (
    <section style={{ marginTop: 28 }} aria-label="Ngày lễ">
      <div className={styles.toolbar}>
        <h3 className={styles.cardTitle}>Ngày lễ</h3>
        <Button loading={busy} onClick={() => void seed()}>
          Thêm ngày lễ Việt Nam năm {nextYear}
        </Button>
      </div>
      <p className={styles.muted}>
        Ca cố định được đủ công dù không đi làm; đi làm tính OT theo hệ số lễ. Tết Nguyên đán, Giỗ Tổ và ngày
        nghỉ bù đổi theo năm nên thêm tay.
      </p>

      {holidays.map((holiday) => (
        <div key={holiday.id} className={styles.holidayRow}>
          <span>
            <strong>{formatDate(holiday.date)}</strong> · {holiday.name}
          </span>
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            aria-label={`Xoá ${holiday.name} ${formatDate(holiday.date)}`}
            onClick={() => void remove(holiday)}
          />
        </div>
      ))}
      {holidays.length === 0 ? (
        <Typography.Text type="secondary">Chưa có ngày lễ nào.</Typography.Text>
      ) : null}

      <div className={styles.holidayAdd}>
        <DatePicker
          value={date}
          onChange={setDate}
          format="DD/MM/YYYY"
          placeholder="Chọn ngày"
          aria-label="Ngày lễ"
          inputReadOnly
        />
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Tên ngày lễ"
          aria-label="Tên ngày lễ"
          style={{ flex: '1 1 180px', width: 'auto' }}
        />
        <Button type="primary" loading={busy} onClick={() => void add()}>
          Thêm
        </Button>
      </div>
    </section>
  );
}
