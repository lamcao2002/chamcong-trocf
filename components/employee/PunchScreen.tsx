'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Tag } from 'antd';
import { useToast } from '@/components/common/useToast';
import { apiRequest } from '@/lib/api/client';
import { nearestZone, type GeoSample } from '@/lib/domain/geo';
import { formatClock } from '@/lib/format';
import type { AppHome, PunchResult } from '@/lib/services/attendance';
import { locateOnce, useGeoWatch, type GeoState } from './useGeoWatch';
import styles from './EmployeeScreen.module.css';

const CLOCK_TICK_MS = 1000;

function GpsSteps() {
  return (
    <>
      <p>
        <b>iPhone:</b> Cài đặt → Quyền riêng tư &amp; Bảo mật → Dịch vụ định vị → bật, rồi chọn Safari hoặc
        app Chấm công → Khi dùng app.
      </p>
      <p>
        <b>Android:</b> Cài đặt → Ứng dụng → Chrome → Quyền → Vị trí → Cho phép khi đang dùng ứng dụng.
      </p>
      <p>Bật xong, mở lại trang này rồi bấm chấm công.</p>
    </>
  );
}

function GpsGuide() {
  return (
    <div className={styles.guide}>
      <strong>Chưa được phép dùng vị trí</strong>
      <GpsSteps />
    </div>
  );
}

type GpsStatusProps = { geo: GeoState; home: AppHome; onRetry: () => void };

function GpsStatus({ geo, home, onRetry }: GpsStatusProps) {
  if (geo.kind === 'denied') return <GpsGuide />;
  if (geo.kind === 'idle') {
    return <p className={styles.gps}>Bấm chấm công, app sẽ xin quyền dùng vị trí</p>;
  }
  if (geo.kind === 'locating') return <p className={styles.gps}>Đang lấy vị trí…</p>;
  if (geo.kind === 'unavailable') {
    return (
      <p className={styles.gps}>
        Không lấy được vị trí.{' '}
        <Button size="small" onClick={onRetry}>
          Thử lại
        </Button>
      </p>
    );
  }
  if (home.anyLocation) return <p className={`${styles.gps} ${styles.gpsIn}`}>Được chấm ở mọi nơi</p>;

  const zone = nearestZone(geo.position, home.locations);
  if (!zone) return <p className={styles.gps}>Chưa có địa điểm chấm công</p>;
  const distance = `${Math.round(zone.distanceM)} m`;
  return (
    <p className={`${styles.gps} ${zone.inZone ? styles.gpsIn : styles.gpsOut}`}>
      {zone.inZone ? 'Trong vùng' : 'Ngoài vùng'} · {distance} · {zone.location.name}
    </p>
  );
}

function resultLines({ type, inZone, distanceM, record }: PunchResult): string[] {
  const zone = inZone
    ? []
    : [`Ngoài vùng${distanceM === null ? '' : ` · ${distanceM} m`}, chờ quản lý duyệt`];
  if (!record) return zone;
  // Ngoài lịch thì không có giờ vào ca để so, nói "Đúng giờ" sẽ sai
  if (record.status === 'ngoai_lich') return [...zone, 'Ngoài lịch, chờ quản lý duyệt'];
  if (type === 'in') return [record.lateMin > 0 ? `Muộn ${record.lateMin} phút` : 'Đúng giờ', ...zone];
  return [
    ...(record.earlyMin > 0 ? [`Về sớm ${record.earlyMin} phút`] : []),
    ...(record.otProposed > 0 ? [`Đã gửi đề xuất OT ${record.otProposed} phút`] : []),
    ...zone,
  ];
}

/** Màn M2: ca hôm nay, trạng thái GPS, nút VÀO/RA CA, kết quả và dòng thời gian (US17–US20). */
export function PunchScreen({ home }: { home: AppHome }) {
  const router = useRouter();
  const toast = useToast();
  const { modal } = App.useApp();
  const [attempt, setAttempt] = useState(0);
  const geo = useGeoWatch(attempt);
  const [clock, setClock] = useState(() => formatClock(home.now));
  const [action, setAction] = useState(home.nextAction);
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<PunchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const sending = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setClock(formatClock(new Date())), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => setAction(home.nextAction), [home.nextAction]);

  const scheduledIds = home.shifts.map(({ id }) => id);
  const flexible = home.shiftMode === 'flexible' && home.choices.length > 0;
  const chooses = flexible && action === 'in';
  const selected = picked ?? scheduledIds.find((id) => home.choices.some((shift) => shift.id === id)) ?? null;
  const offSchedule = selected !== null && !scheduledIds.includes(selected);

  /** Chưa có vị trí thì lấy ngay lúc bấm: chưa có quyền thì trình duyệt hỏi, bị chặn thì chỉ cách bật. */
  const positionNow = async (): Promise<GeoSample | null> => {
    if (geo.kind === 'ready') return geo.position;
    setLocating(true);
    const found = await locateOnce();
    setLocating(false);
    // Đã có quyền thì bật lại theo dõi để thấy trong/ngoài vùng
    if (found.kind === 'ready') {
      setAttempt((value) => value + 1);
      return found.position;
    }
    modal.warning({
      title: found.kind === 'denied' ? 'Cần bật định vị để chấm công' : 'Không lấy được vị trí',
      content:
        found.kind === 'denied' ? (
          <div className={styles.guideModal}>
            <GpsSteps />
          </div>
        ) : (
          'Kiểm tra đã bật Định vị (GPS) trên điện thoại, ra chỗ thoáng rồi bấm chấm công lại.'
        ),
      okText: 'Đã hiểu',
    });
    if (found.kind === 'unavailable') setAttempt((value) => value + 1);
    return null;
  };

  const submit = async () => {
    if (sending.current) return;
    if (chooses && selected === null) {
      toast.error('Chọn ca trước khi vào');
      return;
    }
    sending.current = true;
    const position = await positionNow();
    if (!position) {
      sending.current = false;
      return;
    }
    setSaving(true);
    const { lat, lng, accuracy } = position;
    const response = await apiRequest<{ result: PunchResult }>('/api/v1/app/punch', 'POST', {
      type: action,
      lat,
      lng,
      accuracy,
      chosenShiftId: action === 'in' ? (chooses ? selected : null) : home.openShiftId,
    });
    sending.current = false;
    setSaving(false);
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    setResult(response.result);
    setAction(action === 'in' ? 'out' : 'in');
    router.refresh();
  };

  return (
    <main className={styles.body}>
      <div className={styles.card}>
        <p className={styles.clock}>{clock}</p>
        {home.isOff ? <p className={styles.today}>Hôm nay bạn được cho nghỉ</p> : null}
        {!home.isOff && home.shifts.length === 0 ? <p className={styles.today}>Hôm nay không có ca</p> : null}
        {home.shifts.map(({ id, name, startTime, endTime }) => (
          <p key={id} className={styles.today}>
            {name} · {startTime}–{endTime}
          </p>
        ))}
        <GpsStatus geo={geo} home={home} onRetry={() => setAttempt(attempt + 1)} />

        {chooses ? (
          <div className={styles.choices} role="group" aria-label="Chọn ca">
            {home.choices.map(({ id, code, startTime, endTime }) => (
              <Tag.CheckableTag key={id} checked={selected === id} onChange={() => setPicked(id)}>
                {code} {startTime}–{endTime}
              </Tag.CheckableTag>
            ))}
          </div>
        ) : null}
        {chooses && offSchedule ? <p className={styles.note}>Ca này ngoài lịch, quản lý sẽ duyệt</p> : null}
        {chooses && selected === null ? <p className={styles.note}>Chọn ca trước khi vào</p> : null}

        <div className={styles.punchRing}>
          <button
            type="button"
            className={`${styles.punch} ${action === 'out' ? styles.punchOut : ''}`}
            // Luôn bấm được: thiếu vị trí thì xin quyền lúc bấm, thiếu ca thì nhắc chọn
            disabled={saving || locating}
            onClick={() => void submit()}
          >
            {locating ? 'Đang lấy vị trí…' : saving ? 'Đang gửi…' : action === 'in' ? 'VÀO CA' : 'RA CA'}
          </button>
        </div>
      </div>

      {result ? (
        <div className={`${styles.card} ${styles.followCard}`} role="status">
          <strong>
            {result.type === 'in' ? 'Đã vào ca' : 'Đã ra ca'} lúc {formatClock(result.at)}
          </strong>
          {resultLines(result).map((line) => (
            <p key={line} className={styles.resultLine}>
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {home.timeline.length > 0 ? (
        <div className={`${styles.card} ${styles.followCard}`}>
          <strong>Hôm nay</strong>
          <ul className={styles.timeline}>
            {home.timeline.map(({ id, at, type, inZone, shiftName }) => (
              <li key={id}>
                <span>
                  {type === 'in' ? 'Vào' : 'Ra'} {formatClock(at)}
                </span>
                <span className={styles.timelineSub}>
                  {[shiftName, inZone === false ? 'ngoài vùng' : null].filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </main>
  );
}
