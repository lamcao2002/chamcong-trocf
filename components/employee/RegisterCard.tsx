'use client';

import { formatDate, formatDayLabel } from '@/lib/format';
import type { RegistrationView } from '@/lib/services/registrations';
import styles from './EmployeeScreen.module.css';

export const registerCellId = (date: string, shiftId: string) => `${date}|${shiftId}`;

const STATE_TEXT = { pending: 'Đã gửi, chờ duyệt', scheduled: 'Đã xếp lịch' };

const SUNDAY = 0;

type RegisterGridProps = {
  view: RegistrationView;
  picked: readonly string[];
  onToggle: (id: string) => void;
  /** Bỏ một ô đã gửi, chỉ khi đợt đăng ký còn mở. */
  onRemove: (requestId: string, label: string) => void;
};

/** Lưới đăng ký ca tuần sau trong sheet Tạo đơn: hàng là ca, cột là ngày (EMP-12). */
export function RegisterGrid({ view, picked, onToggle, onRemove }: RegisterGridProps) {
  const { open } = view.window;
  return (
    <>
      <div className={styles.registerHead}>
        <strong>
          Tuần sau · {formatDate(view.dates[0]!).slice(0, 5)} – {formatDate(view.dates[6]!).slice(0, 5)}
        </strong>
        <span className={styles.muted}>{open ? 'Bấm ô để chọn' : 'Đang đóng'}</span>
      </div>
      <p className={open ? styles.registerWindow : styles.registerClosed} role={open ? undefined : 'status'}>
        {open ? view.window.text : `Chưa tới giờ đăng ký. ${view.window.text}.`}
        {open ? '. Bấm ô Chờ để bỏ đăng ký.' : ''}
      </p>
      <table className={styles.register}>
        <thead>
          <tr>
            <th scope="col" aria-label="Ca" />
            {view.dates.map((date) => (
              <th
                key={date}
                scope="col"
                className={new Date(`${date}T00:00:00Z`).getUTCDay() === SUNDAY ? styles.registerSunday : ''}
              >
                {formatDayLabel(date).split(' ')[0]}
                <span className={styles.registerDay}>{Number(date.slice(8))}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.shifts.map(({ id, name, startTime, endTime }) => (
            <tr key={id}>
              <th scope="row">
                <span className={styles.registerShift}>{name}</span>
                <span className={styles.registerTime}>
                  {startTime}–{endTime}
                </span>
              </th>
              {view.dates.map((date) => {
                const cell = view.cells.find((row) => row.date === date && row.shiftId === id);
                const state = cell?.state;
                const key = registerCellId(date, id);
                const chosen = picked.includes(key);
                const label = `${name}, ${formatDate(date)}`;
                const removable = open && state === 'pending' && cell?.requestId;
                return (
                  <td key={date}>
                    <button
                      type="button"
                      disabled={
                        state === 'scheduled' || (!open && !state) || (state === 'pending' && !removable)
                      }
                      aria-pressed={state ? undefined : chosen}
                      aria-label={
                        state ? `${label}: ${STATE_TEXT[state]}${removable ? '. Bấm để bỏ' : ''}` : label
                      }
                      className={`${styles.registerCell} ${chosen ? styles.registerPicked : ''} ${state ? styles[`register_${state}`] : ''}`}
                      onClick={() => {
                        if (removable) onRemove(cell.requestId!, label);
                        else if (!state) onToggle(key);
                      }}
                    >
                      {state === 'pending' ? 'Chờ' : state === 'scheduled' || chosen ? '✓' : ''}
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
    </>
  );
}
