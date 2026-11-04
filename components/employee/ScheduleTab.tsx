'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Button, Drawer, Input, Skeleton, Tag } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { vietnamToday } from '@/lib/domain/date';
import { addDays, mondayOf, weekDay } from '@/lib/engine/time';
import { dayStatusLabel, formatClock, formatDate, formatDayLabel, formatDecimal } from '@/lib/format';
import type { MyScheduleView, MyTimesheetView } from '@/lib/services/timesheet';
import { themeCssVars } from '@/lib/theme/tokens';
import styles from './EmployeeScreen.module.css';

const MIN_REASON = 10;
const QUICK_REASONS = ['Quên bấm chấm công', 'Điện thoại hết pin', 'Đi mua hàng cho quán'];
const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

type Day = MyTimesheetView['days'][number];
type DayRow = Day['records'][number];

const draftKey = (date: string, shiftId: string | null) => `chamcong.draft.${date}.${shiftId ?? 'none'}`;

/** Nháp chỉ để đỡ gõ lại; Safari có thể chặn bộ nhớ nên lỗi thì bỏ qua. */
function readDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(key: string, value: string) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Không lưu được nháp thì người dùng gõ lại khi mở lần sau
  }
}

function ExplainForm({ row, onSent }: { row: DayRow; onSent: () => void }) {
  const toast = useToast();
  const key = draftKey(row.date, row.shiftId);
  const [reason, setReason] = useState(() => row.explanation?.reason ?? readDraft(key));
  const [saving, setSaving] = useState(false);
  const ready = reason.trim().length >= MIN_REASON;

  const update = (value: string) => {
    setReason(value);
    writeDraft(key, value);
  };

  const send = async () => {
    setSaving(true);
    const result = await apiRequest('/api/v1/app/explanations', 'POST', {
      date: row.date,
      shiftId: row.shiftId,
      reason: reason.trim(),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    writeDraft(key, '');
    toast.success('Đã gửi giải trình');
    onSent();
  };

  return (
    <div className={styles.explain}>
      <div className={styles.choices}>
        {QUICK_REASONS.map((text) => (
          <Tag.CheckableTag key={text} checked={reason === text} onChange={() => update(text)}>
            {text}
          </Tag.CheckableTag>
        ))}
      </div>
      <Input.TextArea
        rows={3}
        maxLength={500}
        aria-label="Lý do giải trình"
        placeholder={`Lý do, ít nhất ${MIN_REASON} ký tự`}
        value={reason}
        onChange={(event) => update(event.target.value)}
      />
      <Button type="primary" block loading={saving} disabled={!ready} onClick={() => void send()}>
        Gửi giải trình
      </Button>
    </div>
  );
}

function DayDetailView({ day, onSent }: { day: Day; onSent: () => void }) {
  if (day.records.length === 0) return <p className={styles.muted}>Ngày này không có ngày công.</p>;
  return (
    <>
      {day.records.map((row) => (
        <div key={row.shiftId ?? 'none'} className={styles.dayRecord}>
          <strong>{row.shiftName ?? 'Không gắn ca'}</strong>
          <p className={styles.resultLine}>Hệ thống ghi nhận: {dayStatusLabel(row.status)}</p>
          <p className={styles.resultLine}>
            Vào {row.inAt ? formatClock(row.inAt) : '—'} · Ra {row.outAt ? formatClock(row.outAt) : '—'} ·{' '}
            {formatDecimal(row.cong)} công
          </p>
          {row.explanation ? (
            <p className={styles.resultLine}>Đã giải trình: {row.explanation.reason}</p>
          ) : null}
          {row.needsReview ? <ExplainForm row={row} onSent={onSent} /> : null}
        </div>
      ))}
    </>
  );
}

function WeekList({ week, title }: { week: string; title: string }) {
  const [view, setView] = useState<MyScheduleView | null>(null);

  useEffect(() => {
    void apiRequest<{ schedule: MyScheduleView }>(`/api/v1/app/schedule?week=${week}`, 'GET').then(
      (result) => {
        if (result.ok) setView(result.schedule);
      },
    );
  }, [week]);

  return (
    <div className={`${styles.card} ${styles.followCard}`}>
      <strong>{title}</strong>
      {view ? (
        <ul className={styles.timeline}>
          {view.days.map(({ date, isOff, holiday, shifts }) => (
            <li key={date}>
              <span>{formatDayLabel(date)}</span>
              <span className={styles.timelineSub}>
                {isOff ? 'Nghỉ' : ''}
                {shifts.map(({ name, startTime, endTime }) => `${name} ${startTime}–${endTime}`).join(', ')}
                {!isOff && shifts.length === 0 ? '—' : ''}
                {holiday ? ` · ${holiday}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      )}
    </div>
  );
}

type ScheduleTabProps = { brandColor: string | null };

/** Màn M3: lịch tuần, lịch tháng có chấm màu, chi tiết ngày, giải trình, đơn của tôi nằm ở tab Tôi (US32, US33). */
export function ScheduleTab({ brandColor }: ScheduleTabProps) {
  const toast = useToast();
  const [month, setMonth] = useState<string | undefined>();
  const [view, setView] = useState<MyTimesheetView | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const thisWeek = mondayOf(vietnamToday());

  const load = useCallback(async () => {
    const query = month ? `?month=${month}` : '';
    const result = await apiRequest<{ timesheet: MyTimesheetView }>(`/api/v1/app/timesheet${query}`, 'GET');
    if (result.ok) setView(result.timesheet);
    else toast.error(result.error);
  }, [month, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = view?.days.find(({ date }) => date === selectedDate) ?? null;
  const leading = view ? (weekDay(view.period.from) + 6) % 7 : 0;

  return (
    <main className={styles.body}>
      <div className={styles.card}>
        <h1 className={styles.title}>Lịch &amp; công</h1>
        {view ? (
          <>
            <div className={styles.monthNav}>
              <button type="button" aria-label="Kỳ trước" onClick={() => setMonth(view.previousKey)}>
                <LeftOutlined />
              </button>
              <span>
                {formatDate(view.period.from).slice(0, 5)} – {formatDate(view.period.to)}
              </span>
              <button
                type="button"
                aria-label="Kỳ sau"
                disabled={!view.nextKey}
                onClick={() => setMonth(view.nextKey ?? undefined)}
              >
                <RightOutlined />
              </button>
            </div>
            <div className={styles.calendar}>
              {WEEKDAY_LABELS.map((label) => (
                <span key={label} className={styles.calendarHead}>
                  {label}
                </span>
              ))}
              {Array.from({ length: leading }, (_, index) => (
                <span key={index} aria-hidden />
              ))}
              {view.days.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  disabled={day.date > view.today}
                  aria-label={`Ngày ${formatDate(day.date)}`}
                  className={`${styles.calendarDay} ${day.date === view.today ? styles.calendarToday : ''}`}
                  onClick={() => setSelectedDate(day.date)}
                >
                  {Number(day.date.slice(8))}
                  <span className={`${styles.dot} ${styles[`dot_${day.symbol}`] ?? ''}`} aria-hidden />
                </button>
              ))}
            </div>
            <p className={styles.resultLine}>
              {formatDecimal(view.totals.cong)} công · muộn {view.totals.lateMin} phút · thiếu{' '}
              {view.totals.missing}
            </p>
          </>
        ) : (
          <Skeleton active paragraph={{ rows: 5 }} title={false} />
        )}
      </div>

      <WeekList week={thisWeek} title="Tuần này" />
      <WeekList week={addDays(thisWeek, 7)} title="Tuần sau" />

      <Drawer
        open={selected !== null}
        title={selected ? formatDate(selected.date) : ''}
        placement="bottom"
        height="80%"
        destroyOnHidden
        onClose={() => setSelectedDate(null)}
      >
        {/* Drawer nằm ngoài vùng đặt biến CSS của màn */}
        <div style={themeCssVars(brandColor ?? undefined) as CSSProperties}>
          {selected ? (
            <DayDetailView
              day={selected}
              onSent={() => {
                setSelectedDate(null);
                void load();
              }}
            />
          ) : null}
        </div>
      </Drawer>
    </main>
  );
}
