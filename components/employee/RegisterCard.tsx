'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from 'antd';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { formatDate, formatDayLabel } from '@/lib/format';
import type { RegistrationView } from '@/lib/services/registrations';
import styles from './EmployeeScreen.module.css';

const cellId = (date: string, shiftId: string) => `${date}|${shiftId}`;

const STATE_TEXT = { pending: 'Đã gửi, chờ duyệt', scheduled: 'Đã xếp lịch' };

type RegisterCardProps = { reloadKey: number; onSent: () => void };

/** Đăng ký ca tuần sau, lưới ca × ngày; chỉ người ca linh hoạt mới thấy (EMP-12). */
export function RegisterCard({ reloadKey, onSent }: RegisterCardProps) {
  const toast = useToast();
  const [view, setView] = useState<RegistrationView | null>(null);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const url = '/api/v1/app/shift-registrations';
    const result = await apiRequest<{ registration: RegistrationView | null }>(url, 'GET');
    if (result.ok) setView(result.registration);
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  if (!view || view.shifts.length === 0) return null;
  const stateOf = (date: string, shiftId: string) =>
    view.cells.find((cell) => cell.date === date && cell.shiftId === shiftId)?.state;

  const toggle = (id: string) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));

  const send = async () => {
    setSaving(true);
    const items = picked.map((id) => {
      const [date, shiftId] = id.split('|');
      return { date, shiftId };
    });
    const result = await apiRequest('/api/v1/app/shift-registrations', 'POST', { items });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Đã gửi đăng ký');
    setPicked([]);
    void load();
    onSent();
  };

  return (
    <div className={`${styles.card} ${styles.followCard}`}>
      <strong>Đăng ký ca tuần sau</strong>
      <p className={styles.muted}>
        {formatDate(view.dates[0]!).slice(0, 5)} – {formatDate(view.dates[6]!)}. Bấm ô để chọn, quản lý nhận
        thì ca vào lịch.
      </p>
      <table className={styles.register}>
        <thead>
          <tr>
            <th scope="col" aria-label="Ca" />
            {view.dates.map((date) => (
              <th key={date} scope="col">
                {formatDayLabel(date).split(' ')[0]}
                <br />
                {date.slice(8)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.shifts.map(({ id, code, name }) => (
            <tr key={id}>
              <th scope="row" title={name}>
                {code}
              </th>
              {view.dates.map((date) => {
                const state = stateOf(date, id);
                const key = cellId(date, id);
                const chosen = picked.includes(key);
                const label = `${name}, ${formatDate(date)}`;
                return (
                  <td key={date}>
                    <button
                      type="button"
                      disabled={state !== undefined}
                      aria-pressed={state ? undefined : chosen}
                      aria-label={state ? `${label}: ${STATE_TEXT[state]}` : label}
                      className={`${styles.registerCell} ${chosen ? styles.registerPicked : ''} ${state ? styles[`register_${state}`] : ''}`}
                      onClick={() => toggle(key)}
                    >
                      {state === 'scheduled' || chosen ? '✓' : ''}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className={styles.registerLegend}>
        <li>
          <span className={`${styles.registerMark} ${styles.registerPicked}`} aria-hidden /> Bạn chọn
        </li>
        <li>
          <span className={`${styles.registerMark} ${styles.register_pending}`} aria-hidden /> Đã gửi, chờ
          duyệt
        </li>
        <li>
          <span className={`${styles.registerMark} ${styles.register_scheduled}`} aria-hidden /> Đã xếp lịch
        </li>
      </ul>
      <Button
        block
        type="primary"
        disabled={picked.length === 0}
        loading={saving}
        onClick={() => void send()}
      >
        {picked.length > 0 ? `Gửi đăng ký · ${picked.length} ca` : 'Chưa chọn ca nào'}
      </Button>
    </div>
  );
}
